# Database migrations

Files here mirror what was applied to the Supabase project `rhhfzvmiwhmnviznxvlv`.

| File | How it was applied | Recorded in `supabase_migrations.schema_migrations`? |
|---|---|---|
| `001` – `006` | By hand in the SQL editor during the initial build (Oct–Nov 2026), before migration tracking was used | No. Treat them as the baseline; the live schema already contains them |
| `007_rls_hardening.sql`, `008_revoke_maintain.sql` | Supabase MCP `apply_migration` on 2026-11-02 (`rls_hardening`, `revoke_maintain_from_client_roles`) | Yes |
| `009_rate_limits_settings_storage.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`rate_limits_settings_storage`) | Yes |
| `010_review_flow_moderation_brief.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`review_flow_moderation_brief`) | Yes |
| `011_max_creators.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`max_creators`) | Yes |
| `012_feedback.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`feedback`), owner-approved — new `feedback` table for in-app reports (additive) | Yes |
| `013_product_category.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`product_category`), owner-requested (QA item 4) — `products.category` text NOT NULL default 'כללי', backfilled from the brand's first category | Yes |
| `014_platform_usage.sql` | Supabase MCP `apply_migration` on 2026-11-03 22:10 (`platform_usage`), owner-approved — `public.platform_usage()` SECURITY DEFINER, service_role only: database + storage size for the admin capacity gauge and the daily cron alert. Additive, no data change | Yes |
| `015_mutual_hearts_brief_passes.sql` | Supabase MCP `apply_migration` on 2026-11-04 (`mutual_hearts_brief_passes`), owner-approved — `connections.mutual_at`, `products.brief_data` + `category_custom`, `products.max_creators` nullable (**resets every product to no limit**), `brand_passes` table, `match_connection()` treats NULL as unlimited. Applied before the matching code deployed | Yes |
| `017_terms_acceptance.sql` | Supabase MCP `apply_migration` on 2026-11-10 00:50 (`terms_acceptance`, owner-approved "רוץ על המיגרציה") — adds `users.terms_accepted_at timestamptz` and `users.terms_version text` for the in-app terms gate (`POST /api/legal/accept`, `lib/legal.ts` `TERMS_VERSION`). Additive, nullable, no data change; clients stay read-only. Applied before the gate code deployed; the accept round trip was verified locally on the QA creator right after | Yes |
| `018_onboarding.sql` | applied 2026-11-11 as `onboarding_flags` | `users.onboarding jsonb default '{}'` + backfill of `first_heart` / `first_match` for creators already past them (`how: backfill`); the welcome is not backfilled |
| `022_dual_role_allowed.sql` | applied 2026-11-16 as `dual_role_allowed` | `users.dual_role_allowed` (default false) + `dual_role_allowed_at`: an admin opened the second role (creator ↔ business) for this account; the profile then offers "הוספת חשבון …" and the register API accepts the other type. Default false: nothing changed for existing accounts |
| `021_payments_sumit.sql` | applied 2026-11-14 as `payments_sumit` | `transactions.package / provider / provider_payment_id / provider_customer_id / document_id / completed_at / failure_reason / billing_*`, `brand_profiles.billing_name / billing_company_number / billing_email / sumit_customer_id`. In place before the switch went to `admins` |
| `020_feedback_threads.sql` | applied 2026-11-14 as `feedback_threads` | `feedback_messages` (thread replies: feedback_id, sender_id, from_admin, text; RLS select as 012, clients read-only), `feedback.last_message_at` / `last_message_from`. The code runs without it (threads off, status changes only) |
| `019_admin_flag_last_seen_chat_block.sql` | applied 2026-11-14 as `admin_flag_last_seen_chat_block` | `users.is_admin` (admin on top of the type), `users.last_seen_at`, `connections.blocked_at/blocked_reason/blocked_by`; data: עדי (+972585979474) `is_admin = true` at the owner's request |
| `016_chat_pipeline_regions.sql` | Supabase MCP `apply_migration` on 2026-11-04 ~22:20 (owner-approved "רוץ!!! ודחוף"), recorded as two migrations — `chat_pipeline_regions_columns` (new columns + `creator_passes`) and `chat_pipeline_regions_constraints` (value checks, `revoke` on `creator_passes`) — plus the `timelines.max_revisions` → 1 settings update run as SQL. `messages.kind` (text/brief/video/event) + `data jsonb`, `connections.brief_posted_at` / `brief_approved_at`, `brand_profiles.region`, `creator_passes` (service role only). Applied before the creator-rework code deployed | Yes |

Rules:
- Never edit an applied file; add a new numbered file.
- Apply through `apply_migration` (or `supabase db push`) so the migration is recorded, then commit the file in the same change.
- Pre-check data before adding constraints (see the header comments in `007`).
- Client roles (`anon`, `authenticated`) are read-only since `007`; new tables created by `postgres` get SELECT only by default. Grant nothing more unless a client-side read is really needed.
