-- 019: admin flag separate from the account type, last activity, chat blocking (owner, 2026-11-14).
--
-- * users.is_admin — grants the admin interface WITHOUT changing users.type, so a creator (or a business) can
--   also be an admin and still appear in the creator gallery / lists (three queries filter on type = 'creator').
--   lib/viewer.ts and lib/admin-auth.ts treat type = 'admin' OR is_admin = true as admin.
-- * users.last_seen_at — stamped by GET /api/profile at most every 10 minutes; shown in /admin/creators.
-- * connections.blocked_* — an admin can stop a chat (/admin/connections): the messages API refuses new
--   messages and both sides see "המערכת עצרה את ההתקשרות" with a link to contact us.
-- Additive. Clients stay read-only (007). The only data change: עדי (+972585979474) becomes an admin, at the
-- owner's explicit request.

alter table public.users
  add column if not exists is_admin boolean not null default false,
  add column if not exists last_seen_at timestamptz;

comment on column public.users.is_admin is 'Admin interface access on top of the account type (type stays creator/brand)';
comment on column public.users.last_seen_at is 'Last authenticated activity (stamped by /api/profile, ≤ every 10 min)';

alter table public.connections
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists blocked_by uuid references public.users(id);

comment on column public.connections.blocked_at is 'Set by an admin to stop the chat; null = chat follows the status';

-- Owner's request 2026-11-14: the second admin keeps her creator account
update public.users set is_admin = true where phone = '+972585979474';
