-- 026: לידים ממסלול המשפיענים (השאלון בדף הבית)
-- נכתב דרך API route עם service role בלבד. הלקוח (anon/authenticated) לא כותב ולא קורא.

create table if not exists public.influencer_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- תשובות השאלון, כפי שנבחרו (מפתחות יציבים, לא טקסט תצוגה)
  answers jsonb not null default '{}'::jsonb,
  -- answers: { tier: 'nano'|'micro'|'macro'|'unsure',
  --            platforms: ['instagram','tiktok','youtube','undecided'],
  --            categories: ['beauty','fashion','food','home','tech','other'],
  --            region: 'all'|'center'|'north'|'south_jerusalem',
  --            goal: 'content'|'post'|'both'|'unsure' }
  full_name text not null,
  business_name text,
  phone text not null,
  email text,
  note text,
  source text not null default 'homepage_quiz',
  utm jsonb,
  status text not null default 'new' check (status in ('new','contacted','qualified','closed')),
  admin_note text,
  handled_by uuid references public.users(id),
  handled_at timestamptz
);

create index if not exists influencer_leads_created_idx on public.influencer_leads (created_at desc);
create index if not exists influencer_leads_status_idx on public.influencer_leads (status);

alter table public.influencer_leads enable row level security;
-- אין policies לתפקידי לקוח בכוונה: רק service role ניגש (כמו שאר הטבלאות אחרי migration 007).

-- קצב: השאלון ציבורי. ה-route קורא ל-checkRateLimit('influencer_lead', ip) לפני הכתיבה.
