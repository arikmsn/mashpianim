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

## Current state (as of 2026-11-03 07:40 Asia/Jerusalem)

| Area | State |
|---|---|
| Production (mashpian.online, Vercel) | `main` @ `a4943e2` — **predates all batches** |
| Waiting for deploy | `security/batch-1` → `batch-2` → `batch-3` → `batch-4` → `feature/batch-5` → `feature/batch-6` (stacked local branches, not pushed). Merge in order, deploy once |
| Database (Supabase `rhhfzvmiwhmnviznxvlv`) | Migrations 007–011 **already applied**: client roles read-only, constraints, `match_connection()` (credits + creator slots atomically), `rate_limits` + `rate_limit_hit()`, bucket size/MIME limits, `timelines.max_revisions = 2`, `video_status` has `rejected`, `products.brief`, `products.max_creators` CHECK, profile tables readable only by their owner/admin. Project status `ACTIVE_HEALTHY` (PG 17.11, eu-west-3) |
| Known production regression until deploy | Marking a notification as read returns 500 (Batch 2 removed client write policies; Batch 2 code fixes the route) |
| Supabase plan | **Free**: 50 MB per upload, 1 GB storage. The product cap is 150 MB per video (`MAX_VIDEO_MB`); it takes effect only after upgrading to Pro and raising the project upload limit |
| Tests | `npm test` — 65 unit tests; `tsc` and `next build` clean on `feature/batch-6` |
| Dev/test accounts | dev-login roles `creator` / `brand` (non-production only); QA brand at 5/10 credits with 5 QA products, QA creator at 5 portfolio videos. Each dev-login signs that account's earlier sessions out |

## Open items (priority order)

1. **Owner — deploy & ops**: merge batches 1–6 into `main`; then rotate the real admin password, delete the two `dev_account` auth users in production, remove `ADMIN_AUTH_SECRET`, Production `ADMIN_LOGIN_*` and the unused `GOOGLE_CLIENT_ID/SECRET`, confirm `CRON_SECRET` exists in Vercel (could not be verified from here — 403).
2. **Owner — Supabase Pro** (~$25/month): needed for 150 MB videos (2 minutes of 1080p) and for storage beyond 1 GB. After upgrading: Dashboard → Storage → Settings → upload limit ≥ 150 MB.
3. **Owner — create a real admin account** (a `users` row with `type='admin'`): the admin screens, portfolio takedown and the optional deliverable review step can't be exercised without one; there is no admin test account by design.
4. Product follow-ups (not started): ranking signals in the creator gallery/feed (city, followers, response time); payments (Cardcom adapter is a stub); per-message read receipts; thumbnail backfill for videos uploaded before posters existed (needs ffmpeg).
5. Advisors still flagged, accepted: the RLS helper functions are callable via RPC by signed-in/anonymous users — they only return the caller's own ids and must stay executable for the policies to work; leaked-password protection is an Auth dashboard toggle (owner).
6. INFRA-01: Vercel Hobby (daily cron only, 60 s functions, non-commercial terms) — revisit before scale.

## Changelog (newest first)

| When (Asia/Jerusalem) | Branch / commit | What changed |
|---|---|---|
| 2026-11-03 07:40 | `feature/batch-6` (this commit) | **Batch 6 — product limits, sign-in hardening, onboarding.** BRAND-01: `max_creators` is editable (1–50, default 3), the feed shows `occupied/max` and hides full products, hearts and `match_connection()` refuse a full product (migration 011). SEC-09: `verify-otp` signs in server-side and no longer returns a password; login/register refresh the auth store and navigate with the router. New creators land on `/profile?onboarding=1` with the upload modal open. Cron auto-approval now notifies both parties. Dead Google callback route removed. 65 unit tests |
| 2026-11-03 02:55 | `feature/batch-5` @ `ae2044e` | **Batch 5 — flow completion.** FLOW-01: the brand reviews a deliverable straight from `uploaded` (approve → videos approved + downloadable, or request a revision; the admin step stays optional); the review clock starts at upload and the cron auto-approves `uploaded`/`in_review` after the deadline. MOD-01: `video_status` gets `rejected`; admins take portfolio videos down / restore them from `/admin/moderation` (hidden from brands, not counted for the gate, creator notified). Chat closes with the connection (server `chat_closed`, read-only history in `/messages`, closing system message). Brand-written **brief** on products (`products.brief`) replaces the fill-in template at match; product form loses the dead category field; brand modal uses the admin revision limit. Advisors: `search_path` pinned on helper functions; `creator_profiles`/`brand_profiles` readable only by owner/admin. Migration 010 applied. 60 unit tests |
| 2026-11-03 02:30 | `security/batch-4` @ `89218d0` | **Batch 4 — operational hardening + video uploads.** Rate limiting on send-otp / verify-otp / dev-login / register (DB counters, `rate_limit_hit()`); image uploads validated by magic bytes, buckets get size + MIME limits; admin pages gated server-side (404 for non-admins); admin actions audited in `activity_log`; deadlines and the revision limit read from admin settings (`timelines`), settings page wired to the API; cron purges expired OTPs and stale limiter rows and sends each reminder at most once per 48 h. Videos: cap 150 MB with a clear message, upload progress bar (%) via `lib/storage-upload.ts`. Migration 009 applied. 53 unit tests |
| 2026-11-03 00:21 | `security/batch-3` @ `787de25` | **Batch 3.** Connection deliverable upload works end to end (direct to Storage + `save-connection`), brand sees the video; product edit fixed (`category` column never existed); portfolio video delete; pre-gate hearts can't match (`creator_not_ready`); per-user client cache (no leak between logins) |
| 2026-11-02 23:40 | `security/batch-2` @ `66c8d6b` | **Batch 2.** RLS hardening: client roles SELECT-only (migrations 007/008); unique `auth_user_id` / `phone`, one active connection per creator+product, credits CHECK; atomic `match_connection()`; notifications route on service role |
| 2026-11-02 22:02 | `security/batch-1` @ `2a7a204`, `daee8c5` | **Batch 1.** API authorization hotfixes: registration role lock, profile field allowlists, connection participant checks (no phone leak), chat/read-receipt authz, dev-login rebuilt (no default password, hidden in production), public product projection, `user-type` session-scoped |
| 2026-11-02 21:18 | `main` @ `a4943e2` | Developer handoff doc + CLAUDE.md refresh. Earlier product history: see `git log` and HANDOFF §7 |
