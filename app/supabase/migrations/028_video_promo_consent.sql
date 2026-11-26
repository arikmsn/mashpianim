-- 028: separate, explicit consent to the platform using uploaded videos to promote itself (owner, 2026-11-26).
-- Recorded apart from the terms (017) so the consent is provable on its own: when it was given and under which
-- TERMS_VERSION wording. Given at registration (both creators and businesses) or at the in-app gate for existing
-- accounts. Additive: two nullable columns, no data change. Clients stay read-only (007); only the service role
-- (POST /api/auth/register, POST /api/legal/accept) writes them. The code tolerates the columns missing.

alter table public.users
  add column if not exists video_promo_consent_at timestamptz,
  add column if not exists video_promo_consent_version text;

comment on column public.users.video_promo_consent_at is 'When this account consented to the platform using its uploaded videos to promote the platform (null = never)';
comment on column public.users.video_promo_consent_version is 'The TERMS_VERSION (lib/legal.ts) under which the video promotion consent was given';
