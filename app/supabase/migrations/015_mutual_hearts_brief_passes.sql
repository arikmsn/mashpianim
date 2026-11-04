-- 015: brand interface rework (2026-11-04)
--  * connections.mutual_at — both sides hearted; the brand still has to confirm (that is the paid step)
--  * products.brief_data   — structured brief (multi-select sections + key messages), see lib/brief.ts
--  * products.category_custom — free-text category label shown instead of the feed category
--  * products.max_creators  — optional from now on (NULL = no limit; the brand decides per match)
--  * brand_passes           — creators a brand skipped ("X") in the gallery; never shown to it again
--  * match_connection()     — NULL max_creators means unlimited
-- Additive except the max_creators reset (all products become unlimited — the owner removed the field).

alter table public.connections add column if not exists mutual_at timestamptz;
create index if not exists idx_connections_mutual_at on public.connections (mutual_at) where mutual_at is not null;

alter table public.products add column if not exists brief_data jsonb;
alter table public.products add column if not exists category_custom text;
alter table public.products add constraint products_category_custom_len check (category_custom is null or char_length(category_custom) <= 40);

alter table public.products drop constraint if exists products_max_creators_check;
alter table public.products alter column max_creators drop default;
alter table public.products add constraint products_max_creators_check
  check (max_creators is null or (max_creators >= 1 and max_creators <= 50));
update public.products set max_creators = null;

create table if not exists public.brand_passes (
  brand_id   uuid not null references public.brand_profiles(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, creator_id)
);
alter table public.brand_passes enable row level security;
revoke all on public.brand_passes from anon, authenticated;
grant select, insert, delete on public.brand_passes to service_role;

-- match_connection(): same as 011, but a product without max_creators never reports PRODUCT_FULL
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
  v_max       integer;
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

  -- Creator slots on the product (every status from the match on occupies one); NULL = no limit
  select product_type, max_creators into v_type, v_max from public.products where id = v_conn.product_id;
  if v_max is not null then
    select count(*) into v_occupied
      from public.connections
     where product_id = v_conn.product_id
       and id <> v_conn.id
       and status in ('approved', 'shipped', 'delivered', 'filming', 'uploaded', 'in_review', 'revision_requested', 'completed');
    if v_occupied >= v_max then
      raise exception 'PRODUCT_FULL';
    end if;
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
