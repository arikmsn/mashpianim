-- 016: creator interface rework (2026-11-04)
--  * messages.kind / messages.data — chat cards: the brief (snapshot), the deliverable (video id), plain text
--  * connections.brief_posted_at / brief_approved_at — the brand posts the brief in the chat, the creator approves it
--  * brand_profiles.region — where the business is (feed filter "אזור בארץ"), free list in lib/regions.ts
--  * creator_passes — products a creator skipped ("X") in the feed; never shown to them again
--  * timelines.max_revisions — one revision round per connection (owner's rule)
-- Additive; the only data change is the max_revisions setting.

alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists data jsonb;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'brief', 'video', 'event'));

alter table public.connections add column if not exists brief_posted_at timestamptz;
alter table public.connections add column if not exists brief_approved_at timestamptz;

alter table public.brand_profiles add column if not exists region text;
alter table public.brand_profiles drop constraint if exists brand_profiles_region_len;
alter table public.brand_profiles add constraint brand_profiles_region_len check (region is null or char_length(region) <= 40);

create table if not exists public.creator_passes (
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_id, product_id)
);
alter table public.creator_passes enable row level security;
revoke all on public.creator_passes from anon, authenticated;
grant select, insert, delete on public.creator_passes to service_role;

update public.site_settings
   set data = jsonb_set(coalesce(data, '{}'::jsonb), '{max_revisions}', '1'::jsonb)
 where id = 'timelines';
