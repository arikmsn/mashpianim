# Mashpian — Project Status

The one page to read first. It says what is live, what is waiting, what is next, and where the details are.
**Update it at the end of every work phase** (any developer or AI agent): add one changelog row (Asia/Jerusalem
time, branch + commit, what changed), refresh the state table and the open items. Keep it short — details go in
the documents linked below, never here.

## Where things are

| Topic | Document |
|---|---|
| Architecture, data model, API map, routes/sitemap, gaps, decisions | [docs/HANDOFF.md](HANDOFF.md) |
| Conventions for code and for AI agents | [CLAUDE.md](../CLAUDE.md) |
| Product spec (Hebrew, living doc) | https://claude.ai/artifact/NGJAQESGe2XRZxzU6VSkRx |
| Automated tests + manual check lists per batch | [app/tests/README.md](../app/tests/README.md) |
| Database migrations and how to apply them | [app/supabase/migrations/README.md](../app/supabase/migrations/README.md) |
| Security audit vocabulary (SEC-xx, FUNC-xx, …) | Audit report of 2026-11-02 (chat); IDs are referenced in commits and in HANDOFF §8 |

## Current state (as of 2026-11-03 08:40 Asia/Jerusalem)

| Area | State |
|---|---|
| Production (mashpian.online, Vercel) | `main` @ `a4943e2` — **predates all batches**. Release candidate: `feature/batch-6` (this commit), **waiting for the owner's go** |
| Deploy plan | Fast-forward `main` to `feature/batch-6` (`2a7a204` … this commit; batches 1–6 are stacked, one deploy). No env changes needed first, no migrations pending (007–011 are already live). Rollback = Vercel "instant rollback" to the current production deployment |
| Database (Supabase `rhhfzvmiwhmnviznxvlv`) | Migrations 007–011 **already applied**: client roles read-only, constraints, `match_connection()` (credits + creator slots atomically), `rate_limits` + `rate_limit_hit()`, bucket size/MIME limits, `timelines.max_revisions = 2`, `video_status` has `rejected`, `products.brief`, `products.max_creators` CHECK, profile tables readable only by their owner/admin. Project status `ACTIVE_HEALTHY` (PG 17.11, eu-west-3) |
| Known production regression until deploy | Marking a notification as read returns 500 (Batch 2 removed client write policies; Batch 2 code fixes the route). Everything else in production still works with the new schema |
| Supabase plan | **Free**: 50 MB per upload, 1 GB storage, 5 GB egress. The product cap users see is now **50 MB** (`MAX_VIDEO_MB`, clear Hebrew message). The bucket allows 150 MB; after Pro + project upload limit raised, set `MAX_VIDEO_MB = 150` |
| Release QA (2026-11-03, browser on a local production build against the live DB, QA accounts only) | **Passed**: creator login (gate), feed heart, portfolio upload modal (50 MB hint, oversize rejected with the message), chat send, closed chat read-only, notifications mark-read, logout; brand login, creator gallery, product create/edit/delete (brief, slots), heart approval → match (credit deducted), ship with tracking → creator confirms delivery → deliverable upload with progress → brand requests a revision (notes shown to the creator, 1/2) → creator re-uploads → brand approves → `completed` (videos approved, closing message, notifications to both). Dev-login rate limit (429) observed working. **Not covered locally**: WhatsApp OTP registration/login (needs GreenAPI keys) and the admin screens (no admin test account) — owner smoke test after deploy |
| Tests | `npm test` — 65 unit tests; `tsc` and `next build` clean on `feature/batch-6` |
| Dev/test accounts | dev-login roles `creator` / `brand` (non-production only); QA brand has used 7 of 10 credits, QA creator has 5 portfolio videos. Each dev-login signs that account's earlier sessions out; dev-login is limited to 10 per IP per 15 minutes |

## Open items (priority order)

**A — before launch**
1. **Owner — approve the deploy** (fast-forward `main` to `feature/batch-6`). Code side: nothing left open.
2. **Owner — post-deploy smoke test on a phone**: register/login with a real WhatsApp OTP, open `/admin` with the real admin account, mark a notification as read (the current 500 should be gone).

**B — after launch**
3. **Owner — ops cleanup**: rotate the real admin password; delete the two `dev_account` auth users in production; remove `ADMIN_AUTH_SECRET`, Production `ADMIN_LOGIN_*`, `SUPABASE_SERVICE_ROLE_KEY` from Preview, `NEXT_PUBLIC_SUPABASE_*` and `GOOGLE_CLIENT_ID/SECRET` (unused); confirm `CRON_SECRET` exists in Production (could not be verified from here — 403).
4. **Owner — Supabase Pro** (~$25/month) when 2-minute videos or > 1 GB storage are needed; then `MAX_VIDEO_MB = 150` (one-line change + redeploy).
5. Small product fixes: product delete has no confirmation dialog; approving a connection also marks the superseded (revision-requested) deliverable as approved; the "too many attempts" copy says "a minute" while the windows are 10–15 minutes.
6. Product follow-ups (not started): ranking signals in the creator gallery/feed (city, followers, response time); payments (Cardcom adapter is a stub); per-message read receipts; thumbnail backfill for videos uploaded before posters existed (needs ffmpeg).

**C — owner decisions / not verifiable from here**
7. Supabase dashboard login (owner reported failures; the project itself is healthy) and database backups — **NOT VERIFIED**; Free plan has no PITR.
8. Admin QA before deploy is possible only by temporarily making a QA account an admin — owner's call; otherwise test after deploy.
9. Accepted advisor findings: RLS helper functions callable via RPC (return only the caller's ids, must stay executable); leaked-password protection is an Auth dashboard toggle. INFRA-01: Vercel Hobby (daily cron, 60 s functions, non-commercial terms) — revisit before scale.

## Changelog (newest first)

| When (Asia/Jerusalem) | Branch / commit | What changed |
|---|---|---|
| 2026-11-03 08:40 | `feature/batch-6` (this commit, after `f702202`) | **Release preparation + QA.** Video cap aligned with the Supabase Free plan: `MAX_VIDEO_MB` 150 → 50 with a clear oversize message (`f702202`; the bucket keeps 150 MB for Pro). Full browser QA of the main journeys on a local production build (see "Release QA" above): all passed; OTP and admin screens left for the owner's post-deploy smoke test. Launch-readiness report (A/B/C) delivered; env-var audit done (no Vercel changes). Docs refreshed (this file, HANDOFF §4/§8, tests README). No push/deploy — waiting for the owner's approval |
| 2026-11-03 07:40 | `feature/batch-6` @ `d7a7e2d` | **Batch 6 — product limits, sign-in hardening, onboarding.** BRAND-01: `max_creators` is editable (1–50, default 3), the feed shows `occupied/max` and hides full products, hearts and `match_connection()` refuse a full product (migration 011). SEC-09: `verify-otp` signs in server-side and no longer returns a password; login/register refresh the auth store and navigate with the router. New creators land on `/profile?onboarding=1` with the upload modal open. Cron auto-approval now notifies both parties. Dead Google callback route removed. 65 unit tests |
| 2026-11-03 02:55 | `feature/batch-5` @ `ae2044e` | **Batch 5 — flow completion.** FLOW-01: the brand reviews a deliverable straight from `uploaded` (approve → videos approved + downloadable, or request a revision; the admin step stays optional); the review clock starts at upload and the cron auto-approves `uploaded`/`in_review` after the deadline. MOD-01: `video_status` gets `rejected`; admins take portfolio videos down / restore them from `/admin/moderation` (hidden from brands, not counted for the gate, creator notified). Chat closes with the connection (server `chat_closed`, read-only history in `/messages`, closing system message). Brand-written **brief** on products (`products.brief`) replaces the fill-in template at match; product form loses the dead category field; brand modal uses the admin revision limit. Advisors: `search_path` pinned on helper functions; `creator_profiles`/`brand_profiles` readable only by owner/admin. Migration 010 applied. 60 unit tests |
| 2026-11-03 02:30 | `security/batch-4` @ `89218d0` | **Batch 4 — operational hardening + video uploads.** Rate limiting on send-otp / verify-otp / dev-login / register (DB counters, `rate_limit_hit()`); image uploads validated by magic bytes, buckets get size + MIME limits; admin pages gated server-side (404 for non-admins); admin actions audited in `activity_log`; deadlines and the revision limit read from admin settings (`timelines`), settings page wired to the API; cron purges expired OTPs and stale limiter rows and sends each reminder at most once per 48 h. Videos: cap 150 MB with a clear message, upload progress bar (%) via `lib/storage-upload.ts`. Migration 009 applied. 53 unit tests |
| 2026-11-03 00:21 | `security/batch-3` @ `787de25` | **Batch 3.** Connection deliverable upload works end to end (direct to Storage + `save-connection`), brand sees the video; product edit fixed (`category` column never existed); portfolio video delete; pre-gate hearts can't match (`creator_not_ready`); per-user client cache (no leak between logins) |
| 2026-11-02 23:40 | `security/batch-2` @ `66c8d6b` | **Batch 2.** RLS hardening: client roles SELECT-only (migrations 007/008); unique `auth_user_id` / `phone`, one active connection per creator+product, credits CHECK; atomic `match_connection()`; notifications route on service role |
| 2026-11-02 22:02 | `security/batch-1` @ `2a7a204`, `daee8c5` | **Batch 1.** API authorization hotfixes: registration role lock, profile field allowlists, connection participant checks (no phone leak), chat/read-receipt authz, dev-login rebuilt (no default password, hidden in production), public product projection, `user-type` session-scoped |
| 2026-11-02 21:18 | `main` @ `a4943e2` | Developer handoff doc + CLAUDE.md refresh. Earlier product history: see `git log` and HANDOFF §7 |
