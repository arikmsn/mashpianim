# Database migrations

Files here mirror what was applied to the Supabase project `rhhfzvmiwhmnviznxvlv`.

| File | How it was applied | Recorded in `supabase_migrations.schema_migrations`? |
|---|---|---|
| `001` – `006` | By hand in the SQL editor during the initial build (Oct–Nov 2026), before migration tracking was used | No. Treat them as the baseline; the live schema already contains them |
| `007_rls_hardening.sql`, `008_revoke_maintain.sql` | Supabase MCP `apply_migration` on 2026-11-02 (`rls_hardening`, `revoke_maintain_from_client_roles`) | Yes |
| `009_rate_limits_settings_storage.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`rate_limits_settings_storage`) | Yes |
| `010_review_flow_moderation_brief.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`review_flow_moderation_brief`) | Yes |
| `011_max_creators.sql` | Supabase MCP `apply_migration` on 2026-11-03 (`max_creators`) | Yes |
| `012_feedback.sql` | **Not applied yet** — waits for the owner's approval (new `feedback` table for in-app reports; additive, no existing table touched) | — |

Rules:
- Never edit an applied file; add a new numbered file.
- Apply through `apply_migration` (or `supabase db push`) so the migration is recorded, then commit the file in the same change.
- Pre-check data before adding constraints (see the header comments in `007`).
- Client roles (`anon`, `authenticated`) are read-only since `007`; new tables created by `postgres` get SELECT only by default. Grant nothing more unless a client-side read is really needed.
