-- 010_review_flow_moderation_brief.sql
-- Batch 5: portfolio moderation (MOD-01), brand-written brief, advisor fixes.
--
-- Apply as a single transaction (PostgreSQL 17: ADD VALUE is allowed inside a transaction as long as the
-- new value is not used in the same transaction — it isn't).

-- 1. Portfolio moderation: an admin can take a portfolio video down. The app already hides `rejected`
--    videos from brands and excludes them from the 5-video gate; the enum value simply didn't exist.
alter type public.video_status add value if not exists 'rejected';

-- 2. Brand-written brief, sent to the creator in the chat when a match opens (replaces the fill-in template).
alter table public.products add column if not exists brief text;

-- 3. Supabase advisor 0011: pin search_path on the helper functions used by RLS policies.
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.get_my_user_id() set search_path = public, pg_temp;
alter function public.get_my_user_type() set search_path = public, pg_temp;
alter function public.get_my_creator_profile_id() set search_path = public, pg_temp;
alter function public.get_my_brand_profile_id() set search_path = public, pg_temp;
alter function public.update_updated_at() set search_path = public, pg_temp;

-- 4. Profiles are served by the API (service role); nothing in the app reads them with the client key.
--    Until now any holder of the publishable key could list every creator's date of birth and handles.
drop policy if exists creator_profiles_select on public.creator_profiles;
create policy creator_profiles_select on public.creator_profiles
  for select using (user_id = public.get_my_user_id() or public.is_admin());

drop policy if exists brand_profiles_select on public.brand_profiles;
create policy brand_profiles_select on public.brand_profiles
  for select using (user_id = public.get_my_user_id() or public.is_admin());
