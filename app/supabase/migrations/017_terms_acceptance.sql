-- 017: terms-of-service acceptance (owner, 2026-11-09).
-- Every creator and business must accept the terms once inside the app (again when lib/legal.ts TERMS_VERSION
-- changes); the app blocks its screens until they do. Additive: two nullable columns on users, no data change.
-- Clients stay read-only (007); only the service role (POST /api/legal/accept) writes these.

alter table public.users
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

comment on column public.users.terms_accepted_at is 'When this account accepted the terms of service (null = never)';
comment on column public.users.terms_version is 'The TERMS_VERSION (lib/legal.ts) that was accepted';
