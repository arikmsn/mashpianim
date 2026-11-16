-- 023_message_log: every SMS / WhatsApp the platform sends (owner, 2026-11-16: "I need to track the SMS count"),
-- plus the bookkeeping of the WhatsApp digests (which hearts were announced, when a business got its weekly
-- summary). Service-role writes only; admins read through /api/admin/messages and /api/admin/stats.

create table if not exists public.message_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms', 'whatsapp')),
  -- otp | welcome | heart | match | digest_creator | digest_brand | other
  kind text not null,
  phone text not null,
  user_id uuid references public.users(id) on delete set null,
  -- dry = composed and logged but not sent (WHATSAPP_DIGESTS=dry)
  status text not null check (status in ('sent', 'failed', 'dry')),
  provider_ref text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists message_log_created_idx on public.message_log (created_at desc);
create index if not exists message_log_channel_created_idx on public.message_log (channel, created_at desc);
create index if not exists message_log_user_kind_created_idx on public.message_log (user_id, kind, created_at desc);

alter table public.message_log enable row level security;
revoke all on public.message_log from anon, authenticated;
