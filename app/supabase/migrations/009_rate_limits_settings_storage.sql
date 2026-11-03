-- 009_rate_limits_settings_storage.sql
-- Batch 4 (operational hardening): request rate limiting (SEC-07), storage caps and MIME allowlists
-- (SEC-10), and deadlines driven by the admin settings (FLOW-02).
--
-- Apply as a single transaction.

-- 1. Rate limiting -----------------------------------------------------------------------------------
-- Fixed-window counters keyed by "<scope>:<subject>" (phone, IP, ...). Only the service role touches
-- this table, through rate_limit_hit(); client roles get nothing (RLS on, no policies, no grants).
create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_start timestamptz;
  v_now   timestamptz := now();
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
                  when public.rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now then 1
                  else public.rate_limits.count + 1
                end,
        window_start = case
                  when public.rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now
                  else public.rate_limits.window_start
                end
  returning count, window_start into v_count, v_start;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'retry_after_seconds', greatest(0, ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - v_now)))::integer)
  );
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- 2. Storage buckets --------------------------------------------------------------------------------
-- Enforced by Storage itself, so direct browser uploads are covered too.
-- NOTE: the project's plan caps the *effective* file size (Free plan: 50 MB). After upgrading, raise the
-- project-wide limit in Dashboard → Storage → Settings; the bucket value is the product's target cap
-- (150 MB ≈ 2 minutes of 1080p phone video). Keep in sync with MAX_VIDEO_MB in src/lib/uploads.ts.
update storage.buckets
   set file_size_limit = 157286400,
       allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp']
 where id = 'videos';

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'images';

-- 3. Settings-driven deadlines ----------------------------------------------------------------------
-- The product spec allows 2 revisions; the seeded admin setting said 1 and was never read by the code.
update public.site_settings
   set data = data || jsonb_build_object('max_revisions', 2),
       updated_at = now()
 where id = 'timelines'
   and coalesce(nullif(data->>'max_revisions', ''), '0') ~ '^\d+$'
   and (data->>'max_revisions')::integer < 2;

-- match_connection() now takes the shipping deadline from site_settings.timelines.shipping_days (default 7).
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

  if not v_conn.credit_deducted then
    if v_brand.used_credits >= v_brand.total_credits then
      raise exception 'NO_CREDITS';
    end if;
    update public.brand_profiles
       set used_credits = used_credits + 1
     where id = v_brand.id;
  end if;

  select product_type into v_type from public.products where id = v_conn.product_id;

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
