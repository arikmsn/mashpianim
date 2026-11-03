-- 012_feedback: in-app contact / bug / feature-request reports that land in the admin area.
--
-- Writes go through the service-role API only (client roles are read-only since 007); the owner reads
-- their own rows and admins read everything through RLS.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('bug', 'request', 'contact')),
  subject text not null check (char_length(subject) between 2 and 120),
  message text not null check (char_length(message) between 5 and 4000),
  page text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- Own rows for the signed-in user; everything for admins. No write policies on purpose.
create policy feedback_select on public.feedback
  for select to authenticated
  using (user_id = public.get_my_user_id() or public.is_admin());

-- Client roles: read only (tables created by postgres already get no write grants; this makes it explicit)
revoke insert, update, delete, truncate, references, trigger on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
