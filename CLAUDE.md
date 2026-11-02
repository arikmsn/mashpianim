# Mashpianim — Project Guide

## Overview
UGC creator-brand marketplace ("משפיען אונליין", mashpian.online). Creators get free products, brands get authentic video content.
Hebrew-first (RTL), Instagram-gradient/pink theme, mobile-first PWA.
Matching is mutual, Tinder-style: a heart from either side is a pending `connections` row; the other side approving = match (credit deducted, chat opens). Creators need 5 portfolio videos to heart/approve.

**Full developer handoff (data model, API map, gaps, decisions): `docs/HANDOFF.md`.**
Product spec (Hebrew, living doc): https://claude.ai/artifact/NGJAQESGe2XRZxzU6VSkRx

## Tech Stack
- Next.js 16 (App Router) + React 19 + TypeScript — project root is `app/`
- Tailwind CSS 4 + Framer Motion
- Supabase (Postgres, Auth, Storage, Realtime) — project `rhhfzvmiwhmnviznxvlv`; API routes use the service-role key and authorize themselves
- Vercel hosting (Hobby plan), auto-deploy from `main`; daily cron via `app/vercel.json`
- GreenAPI for WhatsApp (OTP + notifications)
- Cardcom payments adapter — stub, not connected

## Project Structure
```
app/src/
├── middleware.ts            # Supabase session refresh
├── app/
│   ├── login/, register/    # phone OTP flows
│   ├── (app)/               # authenticated: feed (creator home), brand (brand home = creator gallery),
│   │                        #   connections, brand/connections, brand/products, messages, profile, notifications
│   ├── admin/               # admin dashboard
│   └── api/                 # route handlers (see docs/HANDOFF.md §5)
├── components/ui/           # design-system primitives
├── components/features/     # profile views / ProfileModal
├── hooks/                   # use-auth (shared store), use-notifications
└── lib/                     # match.ts, client-cache.ts, notifications.ts, video-thumbnail.ts, adapters/, supabase/, moderation/
docs/                        # HANDOFF.md, design-research.md
```

## Conventions
- All UI text in Hebrew; RTL layout by default; `'` inside JSX text must be `&apos;`
- Data loading: `swrFetch` from `lib/client-cache.ts` + Supabase Realtime for refreshes
- Never render `<video>` in lists — use `thumbnail_url` posters; autoplay only the focused card
- Adapter pattern for external services (payments, messaging, invoicing)
- RLS on every Supabase table; API routes check role + ownership explicitly
- Content moderation on chat (`lib/moderation/chat-filter.ts`); no direct contact info sharing
- Use `as any` for Supabase rows (existing style); keep `tsc` clean; don't add new ESLint errors (some pre-existing ones remain)

## Commands (run in `app/`)
- `npm run dev` — dev server
- `npx tsc --noEmit -p .` — type check (must pass)
- `npm run build` — production build (must pass; this is what Vercel runs)
- `npm run lint` — ESLint
