-- 018: first-time walkthrough flags (owner, 2026-11-11).
-- users.onboarding records which one-time moments the account has seen, each with a timestamp and how it ended:
-- "done" = finished, "skipped" = "דלג" / closed early, "backfill" = set here for accounts already past the moment.
-- Moments (lib/onboarding.ts): welcome (cards on the first feed visit), first_heart, first_match.
-- Additive. Clients stay read-only (007); only POST /api/onboarding/seen (service role) writes it.
-- The old users.onboarding_completed boolean (001) is unused by the app and stays as is.

alter table public.users
  add column if not exists onboarding jsonb not null default '{}'::jsonb;

comment on column public.users.onboarding is
  'One-time walkthrough moments seen: {"welcome"|"first_heart"|"first_match": {"at": timestamptz, "how": "done"|"skipped"|"backfill"}}';

-- Creators who already hearted something are past the "first heart" moment
update public.users u
set onboarding = u.onboarding || jsonb_build_object('first_heart', jsonb_build_object('at', now(), 'how', 'backfill'))
where u.type = 'creator'
  and not (u.onboarding ? 'first_heart')
  and exists (
    select 1
    from public.creator_profiles cp
    join public.connections c on c.creator_id = cp.id
    where cp.user_id = u.id and c.initiated_by = 'creator'
  );

-- Creators who already have a match (the brand confirmed) are past the "first match" moment
update public.users u
set onboarding = u.onboarding || jsonb_build_object('first_match', jsonb_build_object('at', now(), 'how', 'backfill'))
where u.type = 'creator'
  and not (u.onboarding ? 'first_match')
  and exists (
    select 1
    from public.creator_profiles cp
    join public.connections c on c.creator_id = cp.id
    where cp.user_id = u.id and c.status not in ('pending', 'rejected', 'cancelled')
  );

-- The welcome cards are deliberately not backfilled: every creator sees them once (owner's choice, 2026-11-11).
