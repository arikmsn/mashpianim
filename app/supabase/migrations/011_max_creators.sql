-- 011_max_creators.sql
-- Batch 6 (BRAND-01): enforce products.max_creators = how many creators (videos) a product can be matched with.
--
-- Pre-check (0 rows): products with max_creators < 1.
-- Apply as a single transaction.

alter table public.products alter column max_creators set default 3;
update public.products set max_creators = 3 where max_creators is null;

alter table public.products
  add constraint products_max_creators_check check (max_creators >= 1 and max_creators <= 50);

-- match_connection(): refuse the match when the product already has max_creators matched connections.
-- The brand_profiles row lock taken just before serialises matches of one brand, so the count is race-free.
create or replace function public.match_connection(p_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conn      public.connections%rowtype;
  v_brand     public.brand_profiles%rowtype;
  v_type      public.product_type;
  v_max       integer := 3;
  v_occupied  integer := 0;
  v_now       timestamptz := now();
  v_ship_days integer := 7;
  v_setting   text;
  v_result    jsonb;
begin
  select * into v_conn from public.connections where id = p_connection_id for update;
  if not found then
    raise exception 'CONNECTION_NOT_FOUND';
  end if;
  if v_conn.status <> 'pending' then
    raise exception 'CONNECTION_NOT_PENDING';
  end if;

  select * into v_brand from public.brand_profiles where id = v_conn.brand_id for update;
  if not found then
    raise exception 'BRAND_NOT_FOUND';
  end if;

  -- Creator slots on the product (every status from the match on occupies one)
  select product_type, coalesce(max_creators, 3) into v_type, v_max from public.products where id = v_conn.product_id;
  select count(*) into v_occupied
    from public.connections
   where product_id = v_conn.product_id
     and id <> v_conn.id
     and status in ('approved', 'shipped', 'delivered', 'filming', 'uploaded', 'in_review', 'revision_requested', 'completed');
  if v_occupied >= v_max then
    raise exception 'PRODUCT_FULL';
  end if;

  if not v_conn.credit_deducted then
    if v_brand.used_credits >= v_brand.total_credits then
      raise exception 'NO_CREDITS';
    end if;
    update public.brand_profiles
       set used_credits = used_credits + 1
     where id = v_brand.id;
  end if;

  select data->>'shipping_days' into v_setting from public.site_settings where id = 'timelines';
  if v_setting ~ '^\d+$' and v_setting::integer between 1 and 365 then
    v_ship_days := v_setting::integer;
  end if;

  update public.connections
     set status          = 'approved',
         approved_at     = v_now,
         ship_deadline   = v_now + make_interval(days => v_ship_days),
         delivery_type   = coalesce(v_type, 'physical'),
         credit_deducted = true
   where id = p_connection_id;

  select jsonb_build_object(
           'connection_id', p_connection_id,
           'used_credits',  used_credits,
           'total_credits', total_credits)
    into strict v_result
    from public.brand_profiles
   where id = v_brand.id;

  return v_result;
end;
$$;

revoke all on function public.match_connection(uuid) from public, anon, authenticated;
grant execute on function public.match_connection(uuid) to service_role;
