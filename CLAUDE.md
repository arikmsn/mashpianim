# Mashpianim — Project Guide

## Overview
UGC creator-brand marketplace ("משפיען אונליין", mashpian.online). Creators get free products, brands get authentic video content.
Hebrew-first (RTL), Instagram-gradient/pink theme, mobile-first PWA.
Matching is mutual, Tinder-style: a heart from either side is a pending `connections` row; the other side approving = match (credit deducted, chat opens). Creators need 5 portfolio videos to heart/approve.

**Start here: `docs/STATUS.md`** — what is live, what waits for deploy, what is next, changelog. **Update it at the end of every work phase** (time in Asia/Jerusalem, branch/commit, what changed); update `docs/HANDOFF.md` when architecture, data model or API changed.
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
│   │                        #   products/[id] (creator product page: brief + journey), connections, brand/connections,
│   │                        #   brand/products, messages, profile, notifications
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
- Client roles (anon/authenticated) are **read-only** at the database level (migration 007): never write to tables from the browser or with the session client — go through an API route (service role). Matching uses the `match_connection()` DB function
- Uploads: videos go browser → Storage through `lib/storage-upload.ts` (progress) into `portfolio/<auth uid>/…`, then a `/api/videos/save-*` route records them; limits and MIME lists live in `lib/uploads.ts` (keep `MAX_VIDEO_MB` in sync with the `videos` bucket). Images go through API routes that sniff magic bytes
- Abuse control: public auth routes call `checkRateLimit()` (`lib/rate-limit.ts`, DB-backed); admin actions call `logActivity()`; deadlines/revision limit come from `getTimelineSettings()` — never hardcode them
- Content moderation on chat (`lib/moderation/chat-filter.ts`); no direct contact info sharing
- Use `as any` for Supabase rows (existing style); keep `tsc` clean; don't add new ESLint errors (some pre-existing ones remain)

## Commands (run in `app/`)
- `npm run dev` — dev server
- `npx tsc --noEmit -p .` — type check (must pass)
- `npm run build` — production build (must pass; this is what Vercel runs)
- `npm run lint` — ESLint
