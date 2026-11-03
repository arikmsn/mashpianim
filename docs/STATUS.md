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

## Current state (as of 2026-11-03 02:30 Asia/Jerusalem)

| Area | State |
|---|---|
| Production (mashpian.online, Vercel) | `main` @ `a4943e2` — **predates all security batches** |
| Waiting for deploy | `security/batch-1` → `batch-2` → `batch-3` → `batch-4` (stacked local branches, not pushed). Merge in order, deploy once |
| Database (Supabase `rhhfzvmiwhmnviznxvlv`) | Migrations 007–009 **already applied**: client roles read-only, constraints, `match_connection()`, `rate_limits` + `rate_limit_hit()`, bucket size/MIME limits, `timelines.max_revisions = 2` |
| Known production regression until deploy | Marking a notification as read returns 500 (Batch 2 removed client write policies; Batch 2 code fixes the route) |
| Supabase plan | **Free**: 50 MB per upload, 1 GB storage. The product cap is 150 MB per video (`MAX_VIDEO_MB`); it takes effect only after upgrading to Pro and raising the project upload limit |
| Tests | `npm test` — 53 unit tests; `tsc` and `next build` clean on `security/batch-4` |
| Dev/test accounts | dev-login roles `creator` / `brand` (non-production only); QA brand at 4/10 credits, QA creator at 5 portfolio videos |

## Open items (priority order)

1. **Owner — deploy & ops**: merge batches 1–4 into `main`; then rotate the real admin password, delete the two `dev_account` auth users in production, remove `ADMIN_AUTH_SECRET` and Production `ADMIN_LOGIN_*`, confirm `CRON_SECRET` exists in Vercel (could not be verified from here — 403).
2. **Owner — Supabase Pro** (~$25/month): needed for 150 MB videos (2 minutes of 1080p) and for storage beyond 1 GB. After upgrading: Dashboard → Storage → Settings → upload limit ≥ 150 MB.
3. FLOW-01: `uploaded → in_review` is admin-only, so a brand cannot review a deliverable without an admin. MOD-01: no portfolio moderation. Batch 5 ideas: onboarding 0/5, brand-edited brief, chat auto-close.
4. UI leftovers: product form still shows a `category` field (ignored by the server); brand connection modal hardcodes "2 revisions" while the limit is now an admin setting.
5. Advisors: set `search_path` on the six helper functions; `creator_profiles` / `brand_profiles` are readable with the anon key alone (DATA exposure) — tighten in a later RLS batch.
6. INFRA-01: Vercel Hobby (daily cron only, 60 s functions, non-commercial terms) — revisit before scale.

## Changelog (newest first)

| When (Asia/Jerusalem) | Branch / commit | What changed |
|---|---|---|
| 2026-11-03 02:30 | `security/batch-4` (this commit) | **Batch 4 — operational hardening + video uploads.** Rate limiting on send-otp / verify-otp / dev-login / register (DB counters, `rate_limit_hit()`); image uploads validated by magic bytes, buckets get size + MIME limits; admin pages gated server-side (404 for non-admins); admin actions audited in `activity_log`; deadlines and the revision limit read from admin settings (`timelines`), settings page wired to the API; cron purges expired OTPs and stale limiter rows and sends each reminder at most once per 48 h. Videos: cap 150 MB with a clear message, upload progress bar (%) via `lib/storage-upload.ts`. Migration 009 applied. 53 unit tests |
| 2026-11-03 00:21 | `security/batch-3` @ `787de25` | **Batch 3.** Connection deliverable upload works end to end (direct to Storage + `save-connection`), brand sees the video; product edit fixed (`category` column never existed); portfolio video delete; pre-gate hearts can't match (`creator_not_ready`); per-user client cache (no leak between logins) |
| 2026-11-02 23:40 | `security/batch-2` @ `66c8d6b` | **Batch 2.** RLS hardening: client roles SELECT-only (migrations 007/008); unique `auth_user_id` / `phone`, one active connection per creator+product, credits CHECK; atomic `match_connection()`; notifications route on service role |
| 2026-11-02 22:02 | `security/batch-1` @ `2a7a204`, `daee8c5` | **Batch 1.** API authorization hotfixes: registration role lock, profile field allowlists, connection participant checks (no phone leak), chat/read-receipt authz, dev-login rebuilt (no default password, hidden in production), public product projection, `user-type` session-scoped |
| 2026-11-02 21:18 | `main` @ `a4943e2` | Developer handoff doc + CLAUDE.md refresh. Earlier product history: see `git log` and HANDOFF §7 |
