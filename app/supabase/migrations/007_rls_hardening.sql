-- 007_rls_hardening.sql
-- Batch 2 (security): close SEC-03, add integrity constraints, make the match atomic.
--
-- Model after this migration
--   * Every write goes through the Next.js API routes, which use the service-role key and authorize
--     themselves (see src/lib/authz.ts and the api/* routes).
--   * The client roles (anon / authenticated) keep SELECT only. SELECT is still needed for Realtime
--     postgres_changes (messages, connections, products) and for the few session-client reads
--     (users_select_own, site_content_select, ...). The existing *_select policies govern those reads.
--   * No write policy exists for the client roles AND the table privileges themselves are revoked, so a
--     future permissive policy cannot re-open writes without an explicit GRANT.
--   * users.auth_user_id and users.phone are unique; a creator can hold only one active connection per
--     product; a brand can never have used_credits > total_credits.
--   * match_connection() turns a pending heart into a match in one transaction with row locks
--     (replaces the read-then-update sequence in src/lib/match.ts). EXECUTE is granted to service_role only.
--
-- Pre-checks run before applying (all 0): users with null/duplicate auth_user_id, null/duplicate phone,
-- duplicate active (creator_id, product_id) connections, brand_profiles with used > total, connections
-- with null FKs.
--
-- Apply as a single transaction.

-- 1. Write policies for client roles -------------------------------------------------------------
drop policy if exists activity_log_insert            on public.activity_log;
drop policy if exists brand_profiles_write           on public.brand_profiles;
drop policy if exists brand_profiles_insert          on public.brand_profiles;
drop policy if exists brand_profiles_update_own      on public.brand_profiles;
drop policy if exists connections_insert             on public.connections;
drop policy if exists connections_update             on public.connections;
drop policy if exists creator_profiles_write         on public.creator_profiles;
drop policy if exists creator_profiles_insert        on public.creator_profiles;
drop policy if exists creator_profiles_update_own    on public.creator_profiles;
drop policy if exists credits_insert                 on public.credits;
drop policy if exists credits_update                 on public.credits;
drop policy if exists messages_insert                on public.messages;
drop policy if exists notifications_insert           on public.notifications;
drop policy if exists notifications_service_insert   on public.notifications;
drop policy if exists notifications_update           on public.notifications;
drop policy if exists products_write                 on public.products;
drop policy if exists products_delete                on public.products;
drop policy if exists products_insert                on public.products;
drop policy if exists products_update                on public.products;
drop policy if exists referrals_insert               on public.referrals;
drop policy if exists site_content_insert            on public.site_content;
drop policy if exists site_content_update            on public.site_content;
drop policy if exists site_settings_insert           on public.site_settings;
drop policy if exists site_settings_update           on public.site_settings;
drop policy if exists transactions_insert            on public.transactions;
drop policy if exists users_insert                   on public.users;
drop policy if exists users_update_own               on public.users;
drop policy if exists videos_insert                  on public.videos;
drop policy if exists videos_update                  on public.videos;

-- 2. Superseded *_read duplicates ------------------------------------------------------------------
-- These compare auth.uid() with public.users.id / profile.user_id, which are app ids, not auth ids.
-- The *_select policies (kept) use the SECURITY DEFINER helpers get_my_user_id() etc. and are correct.
drop policy if exists brand_profiles_read            on public.brand_profiles;
drop policy if exists connections_read               on public.connections;
drop policy if exists creator_profiles_read          on public.creator_profiles;
drop policy if exists credits_read                   on public.credits;
drop policy if exists messages_read                  on public.messages;
drop policy if exists notifications_read             on public.notifications;
drop policy if exists products_read                  on public.products;
drop policy if exists referrals_read                 on public.referrals;
drop policy if exists transactions_read              on public.transactions;
drop policy if exists users_read_own                 on public.users;
drop policy if exists videos_read                    on public.videos;

-- 3. Table privileges (defence in depth under RLS) -------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- Tables created later by the postgres role (dashboard / migrations) start without client write grants.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated;

-- 4. Integrity constraints -------------------------------------------------------------------------
alter table public.users
  add constraint users_auth_user_id_key unique (auth_user_id);

alter table public.users
  add constraint users_phone_key unique (phone);

-- One active heart/match per creator and product (closed states don't count).
create unique index if not exists connections_one_active_per_creator_product
  on public.connections (creator_id, product_id)
  where status not in ('cancelled', 'rejected', 'completed');

alter table public.brand_profiles
  add constraint brand_profiles_credits_check
  check (total_credits >= 0 and used_credits >= 0 and used_credits <= total_credits);

-- 5. Atomic match ----------------------------------------------------------------------------------
-- Locks the connection and the brand profile, deducts one credit (unless already deducted), and flips
-- the connection to approved with the 7-day shipping deadline. Raises:
--   CONNECTION_NOT_FOUND, CONNECTION_NOT_PENDING, BRAND_NOT_FOUND, NO_CREDITS
-- Authorization (who may approve) stays in the API layer; only service_role can execute this.
create or replace function public.match_connection(p_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conn   public.connections%rowtype;
  v_brand  public.brand_profiles%rowtype;
  v_type   public.product_type;
  v_now    timestamptz := now();
  v_result jsonb;
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

  update public.connections
     set status          = 'approved',
         approved_at     = v_now,
         ship_deadline   = v_now + interval '7 days',
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
