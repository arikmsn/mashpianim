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
| `016_chat_pipeline_regions.sql` | **Not applied yet** — waits for the owner's approval (requested 2026-11-04 18:10). `messages.kind` (text/brief/video/event) + `data jsonb`, `connections.brief_posted_at` / `brief_approved_at`, `brand_profiles.region`, `creator_passes` table (service role only), `site_settings` timelines `max_revisions` → 1. Additive except the settings value; the live code ignores the new columns, so it can be applied before the deploy | No |

Rules:
- Never edit an applied file; add a new numbered file.
- Apply through `apply_migration` (or `supabase db push`) so the migration is recorded, then commit the file in the same change.
- Pre-check data before adding constraints (see the header comments in `007`).
- Client roles (`anon`, `authenticated`) are read-only since `007`; new tables created by `postgres` get SELECT only by default. Grant nothing more unless a client-side read is really needed.
