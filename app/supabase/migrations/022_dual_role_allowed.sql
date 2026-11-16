-- 022_dual_role_allowed: an admin may open the second role (creator ↔ business) for a specific account
-- (owner, 2026-11-16: not self-service for everyone — the admin decides per user; the user then sees
-- "הוספת חשבון …" in the profile and registers the other role on the same phone).
-- Additive; default false, so nothing changes for existing accounts.

alter table public.users
  add column if not exists dual_role_allowed boolean not null default false,
  add column if not exists dual_role_allowed_at timestamptz;
