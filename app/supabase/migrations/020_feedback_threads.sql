-- 020_feedback_threads: replies on in-app reports (owner list 2026-11-14, item 6).
--
-- A report becomes a thread: the user's message, our replies, the user's follow-ups. Writes go through the
-- service-role API only (client roles are read-only since 007); the reporter reads their own thread and admins
-- everything through RLS, exactly as `feedback` itself (012). Additive; no data change.

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  from_admin boolean not null default false,
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_feedback_created_idx on public.feedback_messages (feedback_id, created_at);

alter table public.feedback_messages enable row level security;

create policy feedback_messages_select on public.feedback_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.feedback f
      where f.id = feedback_messages.feedback_id
        and (f.user_id = public.get_my_user_id() or public.is_admin())
    )
  );

revoke insert, update, delete, truncate, references, trigger on public.feedback_messages from anon, authenticated;
grant select on public.feedback_messages to authenticated;

-- The thread's last word: ordering in the admin list and the "the user answered" marker
alter table public.feedback add column if not exists last_message_at timestamptz;
alter table public.feedback add column if not exists last_message_from text;
alter table public.feedback drop constraint if exists feedback_last_message_from_check;
alter table public.feedback add constraint feedback_last_message_from_check
  check (last_message_from is null or last_message_from in ('user', 'admin'));
