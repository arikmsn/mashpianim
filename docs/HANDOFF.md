# Mashpian — Developer Handoff

Last updated: 2026-11-02. Written for whoever (human or AI) picks up development next.
Read this together with `CLAUDE.md` (conventions) and the product spec doc:
https://claude.ai/artifact/NGJAQESGe2XRZxzU6VSkRx (Hebrew, living document — journeys, rules, roadmap, open decisions).

---

## 1. What the product is

Israeli UGC marketplace, Hebrew-first, RTL, mobile-first PWA. Brand name "משפיען אונליין / Mashpian", domain https://www.mashpian.online.

- **Creators** (יוצרי תוכן) get free products in exchange for a short vertical UGC video.
- **Brands** (בעלי עסקים) buy "credits" — 1 credit = 1 video — and upload products.
- **Matching is Tinder-style and mutual** (decided 2026-11-02):
  - A brand hearts a creator *for a specific product*; a creator hearts a product.
  - A heart is a `connections` row with `status='pending'` and `initiated_by` = `'brand'` | `'creator'`.
  - The other side hearting back (a creator's "approve", a brand's "לב בחזרה") makes the pair **mutual** (`mutual_at`, still `pending`, free) — since 2026-11-04 the match itself needs the **brand's confirmation** in its "מאטץ'" list: that is the paid step → 1 credit deducted (`match_connection()`), chat opens, two system messages are inserted (match notice + the product's brief), both sides notified in-app and via WhatsApp. A brand may also confirm a creator's heart in one step.
  - A one-sided heart is answered only by the other side and withdrawn only by its sender; a mutual pair may be cancelled by either side. One-sided hearts expire after 7 days (cron); mutual pairs wait for the brand (reminder after 3 days).
  - The brand's gallery is a carousel over creators it has not hearted or skipped; "✕" is persistent (`brand_passes`).
- **5-video gate:** a creator must have ≥5 portfolio videos to heart or approve. Below that they can still *see* brand interest, but product details are blurred and buttons are locked. Enforced in the API (`lib/match.ts: countPortfolioVideos`) and in the UI.
- After a match the pipeline runs: `approved → shipped → delivered → filming → uploaded → completed` — the **brand reviews straight from `uploaded`** (approve, or `revision_requested` loop; the allowance comes from admin settings, default 2); an admin may route a deliverable through the optional `in_review` step. Silence auto-approves after `review_days`. Plus `rejected` / `cancelled`. The chat is open from the match until the connection closes; closed chats stay readable.
- No direct contact info between sides: chat messages pass through `lib/moderation/chat-filter.ts`.

## 2. Tech stack & infrastructure

| Layer | What | Notes |
| --- | --- | --- |
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript 5 | `app/` directory is the Next project root |
| Styling | Tailwind CSS 4, framer-motion 14 | Instagram-gradient theme (`.ig-gradient-bg`), pink primary |
| Backend | Next.js route handlers under `app/src/app/api/**` | All DB access through the Supabase **service-role** client; user identity via `@supabase/ssr` cookie session |
| Database/Auth/Storage/Realtime | Supabase, project id `rhhfzvmiwhmnviznxvlv` | RLS on every table; API routes bypass RLS with the service key and do their own authorization. Since migration `007_rls_hardening` the client roles (`anon`/`authenticated`) hold **SELECT only** (no write policies, write privileges revoked) — SELECT is kept for Realtime and a few session-client reads. Matching runs through the `match_connection()` SECURITY DEFINER function (service_role only), which deducts the credit and flips the status atomically |
| Messaging | GreenAPI (WhatsApp) via `lib/adapters/greenapi.ts` | OTP login codes, heart/match notifications |
| Hosting | Vercel project `mashpianim` (team `arikmsns-projects`), **Hobby plan** | Auto-deploys `main`. Hobby = crons once/day, 60 s function limit, non-commercial terms |
| Cron | `app/vercel.json` → `GET /api/cron/deadlines` daily 06:00 UTC | Route accepts Vercel's `Authorization: Bearer <CRON_SECRET>` or `?secret=` |
| Repo | https://github.com/arikmsn/mashpianim (private), branch `main` | Commit + push = deploy |
| Payments | Cardcom adapter stub in `lib/adapters/payments.ts` | **Not connected.** Credits are granted manually by admin |
| Other accounts | Render (unused), Cloudflare Stream (evaluated, rejected — paid) | |

### Environment variables (Vercel → Production)
`NEXT_SUPABASE_URL`, `NEXT_SUPABASE_ANON_KEY` (also exposed to the client via `next.config.ts env`), `SUPABASE_SEC_KEY` (service role), `GREEN_API_INSTANCE_ID` / `GREEN_API_TOKEN` (aliases `GREENAPI_INSTANCE_ID` / `GREENAPI_API_TOKEN`), `CRON_SECRET`, `ADMIN_LOGIN_PHONE`, `ADMIN_LOGIN_PASSWORD`, `ADMIN_AUTH_SECRET`. `GOOGLE_CLIENT_ID/SECRET` exist but Google login was removed from the UI on 2026-11-02 (`/auth/callback` route still exists).

### Commands (run inside `app/`)
```
npm run dev          # local dev
npx tsc --noEmit -p .   # must pass before pushing
npx eslint <files>   # see "lint state" below
npm run build        # must pass; this is what Vercel runs
```

## 3. Repository layout (actual, not the one in older docs)

```
app/src/
  middleware.ts                 Supabase session refresh (lib/supabase/middleware.ts)
  app/
    page.tsx                    marketing landing
    login/, register/           phone OTP flows (register has creator + brand branches; brand categories are chips)
    terms/
    (app)/                      authenticated area; layout.tsx gates on useAuth, template.tsx = 150ms fade
      feed/                     CREATOR HOME: product feed ("בשבילך" / "הכל" / categories), hearts, gate banner, brand-hearts strip
      products/[id]/            creator product page: details, the brand's brief, timeline settings, own connection's journey + actions
      connections/              creator's connections; journey timeline per card, pending tab shows hearts with approve/decline/cancel; `?open=<id>` highlights a card
      messages/                 chat list + chat view (both roles); product image in header
      profile/                  own profile (creator & brand variants), portfolio upload, edit modals, logout confirm
      notifications/
      brand/                    BRAND HOME: Tinder-style creator gallery (card stack + grid + filters + product picker)
      brand/products/           product CRUD
      brand/connections/        brand's connections; modal shows creator's full public profile
    admin/                      admin dashboard: brands (credits editor, activate/deactivate), creators, moderation, content, feedback (in-app reports), settings
    api/                        see section 5
    auth/callback/              OAuth callback (unused now)
  components/
    ui/                         Button, Input, Textarea, Card, Avatar (expandable → lightbox), Badge, Modal, Toast, BottomNav
    features/profile-views.tsx  CreatorProfileView, BrandProfileView, PublicProfileContent, ProfileModal, usePublicProfile
    pwa/                        service-worker registration, install prompt
  hooks/
    use-auth.ts                 ONE shared auth store (useSyncExternalStore) — session read from cookie, no per-component network call
    use-notifications.ts        ONE shared notifications store: realtime + 60 s poll + foreground refresh; markAsRead / markAllRead
    use-deliverable-upload.tsx  creator deliverable upload (direct to Storage + save-connection) shared by product page and connections
  lib/
    match.ts                    performMatch(), countPortfolioVideos(), portfolioGateError(), buildBriefMessage(), notifyHeartSent(), notifyBrandOfHeart()
    client-cache.ts             swrFetch/fetchJson/readCache (stale-while-revalidate for GET APIs; one in-flight request per URL, 2 s freshness window) + UNREAD_EVENT bus
    video-thumbnail.ts          browser-side poster generation from a video File
    notifications.ts            createNotification(), notificationData(connectionId, productId), logActivity(), notifyConnectionStatusChange()
    notification-links.ts       notificationHref(row, role, isAdmin): where a tapped notification goes (product page / connection card / modal / chat)
    viewer.ts                   resolveViewer(admin, authUserId, activeRole): the role this session signs in as + every role the account holds — user-facing routes scope to it, never "admin sees all"
    active-role.ts              the `mashpian-role` cookie (creator/brand/admin) chosen at login: readActiveRole(), set/clear helpers, homeForRole()
    images.ts                   toDirectImageUrl(): Google Drive links → embeddable thumbnail url (the root layout also sets referrer: no-referrer — Google refuses hotlinked Drive images with a Referer)
    phone.ts                    normalizeIsraeliMobile(): the only phone format the app accepts (05X / 972 → E.164), used by the login form and send-otp
    categories.ts               PRODUCT_CATEGORIES (the 8 feed categories), REGISTRATION_TO_FEED, resolveProductCategory(): one list behind the feed chips, the product form and the API validation
    chat-time.ts                formatMessageTime() / sameDay() / dayLabel(): bubble times and day separators in the chat (viewer's zone)
    capacity.ts                 Supabase capacity watch: SUPABASE_PLAN (flip to "pro" after the upgrade), PLAN_LIMITS, capacityStatus() (70 % warn / 90 % critical) — admin gauge + daily cron alert; reads platform_usage() (migration 014)
    connection-flow.ts          lifecycle rules + journey timeline (FLOW_STEPS, flowNextAction incl. the mutual state, activeDeadlineField), optional creator limit (normalizeMaxCreators → number|null, isProductFull), brand lists (BRAND_BUCKETS, brandBucket, heartState)
    brief.ts                    structured brief: BRIEF_SECTIONS (10 multi-select sections), sanitizeBriefData, briefDataLines, buildBriefMessage (chat text at match), FORMAT_LINES
    admin-auth.ts               verifyAdmin(), isSupabaseConfigured()
    moderation/chat-filter.ts   blocks phone/email/links in chat
    adapters/                   greenapi.ts (live), messaging.ts, payments.ts (Cardcom stub), invoicing.ts (stub)
    supabase/                   client.ts (browser, memoized), server.ts (cookie-bound), middleware.ts
docs/                           design-research.md (visual references), this file
```

## 4. Data model (Supabase, schema `public`)

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id`, `auth_user_id` (→ auth.users), `type` enum creator/brand/admin, `full_name`, `phone`, `email`, `avatar_url`, `is_active`, `onboarding_completed` | App code always resolves `users.id` from `auth.getUser().id` via `auth_user_id` |
| `creator_profiles` | `id`, `user_id`, `bio`, `city`, `categories text[]`, `level` enum creator/creator_plus/on_the_radar, `hearts`, `completed_connections`, `tiktok_handle`, `tiktok_followers`, `instagram_handle`, `instagram_followers`, `intro_video_url`, `date_of_birth` | |
| `brand_profiles` | `id`, `user_id`, `shop_name`, `logo_url`, `category` (legacy single), `categories text[]` (added 2026-11-02, backfilled), `website_url`, `description`, `total_credits`, `used_credits` | remaining credits = total − used |
| `products` | `id`, `brand_id` (→ brand_profiles.id), `name`, `description`, `price` (shown as "שווי מוצר"), `image_url`, `product_type` physical/digital, `digital_access_*`, `shipping_policy`, `shipping_address`, `source_url` (legacy, no longer edited or shown to creators), `status` (active/…/deleted), `expiration_date` + `quantity` (legacy, no longer in the form), `max_creators` (nullable since 015: NULL = no limit, the default), `brief` (free-text notes), `brief_data` jsonb (015: structured brief — sections × picked options + `messages`, see `lib/brief.ts`), `category` (013, NOT NULL default `כללי`), `category_custom` (015, free label ≤ 40 chars) | `category` is one of `PRODUCT_CATEGORIES`; "אחר" in the form stores `category = כללי` + the typed label in `category_custom` (shown on cards / product page, chips still filter on `category`). A limit in `max_creators` is still enforced in `match_connection()` and on new hearts when set. `brief`/`brief_data` are sent to signed-in creators on the product page and rendered into the chat at match (`buildBriefMessage`) |
| `connections` | `id`, `creator_id` (→ creator_profiles.id), `brand_id` (→ brand_profiles.id), `product_id`, `status` enum (see §1), `initiated_by` text creator/brand (added 2026-11-02), `mutual_at` (015: both sides hearted; status stays `pending` until the brand confirms), `delivery_type`, `credit_deducted`, `revision_count`, `revision_notes`, `rejection_reason`, timestamps `approved_at/shipped_at/delivered_at/filmed_at/completed_at`, deadlines `ship_deadline/deliver_deadline/film_deadline/review_deadline`, `tracking_number/url`, `digital_access_value/expires_at`, `creator_read_at`, `brand_read_at` | Index on (creator_id, product_id). Brand lists (`brandBucket()` in `lib/connection-flow.ts`): pending + creator-initiated + no mutual = "בחרו בך"; pending + brand-initiated + no mutual = "הרשימה שלי"; pending + `mutual_at` = "מאטץ'" (the brand's paid confirmation = `match_connection()`); chat-open statuses = "פעילים"; closed = "הסתיימו" |
| `brand_passes` (015) | `brand_id` (→ brand_profiles.id), `creator_id` (→ creator_profiles.id), `created_at`; PK (brand_id, creator_id) | Creators a brand skipped ("✕") in the gallery — excluded from `/api/creators` for that brand. Service role only (RLS on, no client policies) |
| `videos` | `id`, `creator_id` (→ **users.id**, not creator_profiles), `connection_id` (NULL = portfolio video), `storage_path`, `url` (signed, refreshed on read), `thumbnail_url` (public URL), `title`, `description`, `status` enum pending/approved/revision_requested/rejected, `is_downloadable`, `download_count`, `approved_at/by` | Portfolio uploads are published immediately as `approved`; an admin can take one down (`rejected`: hidden from brands, not counted for the 5-video gate, creator notified) or restore it from `/admin/moderation`. Deliverables start `pending` and become `approved` + downloadable when the brand completes the connection (or the cron auto-approves) |
| `messages` | `id`, `connection_id`, `sender_id` (users.id), `text`, `is_system`, `created_at` | Unread = messages after the reader's `*_read_at` on the connection |
| `notifications` | `user_id`, `type`, `title`, `body`, `read`, `data jsonb` | `data` = `{connectionId, productId?}` for connection events, `{videoId}` for portfolio takedowns; the client resolves the destination from `type` + `data` |
| `activity_log` | `actor_id`, `action`, `entity_type`, `entity_id`, `details` | |
| `otp_codes` | custom WhatsApp OTP flow (not Supabase SMS) | |
| `feedback` (migration 012, applied 2026-11-03) | `user_id` (→ users.id, null on delete), `kind` bug/request/contact, `subject`, `message`, `page`, `user_agent`, `status` new/in_progress/closed, `admin_note`, timestamps | In-app reports; RLS: own rows + admins read, writes via the API only |

**Storage buckets:** `videos` (private; policies `auth_users_upload_videos` + `auth_users_read_own_videos` scoped to `portfolio/{auth.uid()}/`; limit 150 MB, MIME mp4/quicktime/webm/x-m4v/3gpp), `images` (private, service role only; 5 MB, JPEG/PNG/WebP), `thumbnails` (**public**, authenticated upload to `portfolio/{auth.uid()}/`, 2 MB, images only). Videos are uploaded **directly from the browser** to Supabase Storage with a progress bar (`lib/storage-upload.ts`, XHR to the Storage REST endpoint; Vercel's 4.5 MB body limit makes server-side upload impossible), then `/api/videos/save-portfolio` or `/api/videos/save-connection` records metadata. **Plan limit:** the Supabase organization is on the Free plan — 50 MB per file and 1 GB total — so the product cap users see is **50 MB** (`MAX_VIDEO_MB` in `lib/uploads.ts`; the message tells them to shorten the clip or drop to 720p). The bucket already allows 150 MB; after upgrading to Pro and raising the project upload limit in Dashboard → Storage → Settings, set `MAX_VIDEO_MB` to 150 (≈ 2 minutes of 1080p).

**Branding assets:** `public/logo.png` is the single source (transparent rounded-square gradient with the white phone/M artwork). Every icon is generated from it by `scripts/gen-icons.py` (Pillow + numpy): `icon-192/512.png` (manifest `any`, transparent corners), `icon-192/512-maskable.png` (manifest `maskable`: gradient bleeds past the canvas, artwork inside the 40 % safe zone so circle/squircle launchers don't clip it), `apple-icon.png` (iOS, opaque) and `favicon.ico`. After replacing `logo.png`: run the script, then bump `CACHE_NAME`/`STATIC_CACHE` in `public/sw.js` — the service worker caches images, and installed apps keep the old files until a new worker activates (images are also refreshed in the background on every visit since v3). `manifest.json` `background_color`/`theme_color` are the brand pink `#E1306C` (splash screen and status bar); pages, the install prompt and the offline page show `logo.png` directly.

Migrations were applied via the Supabase MCP (`apply_migration`); recent ones: `add_video_storage_policies_for_auth_users`, `add_brand_categories_array`, `add_connections_initiated_by`, `add_public_thumbnails_bucket`, `rls_hardening` + `revoke_maintain_from_client_roles` (2026-11-02, saved in the repo as `app/supabase/migrations/007_rls_hardening.sql` and `008_revoke_maintain.sql`), `rate_limits_settings_storage` (2026-11-03, `009_rate_limits_settings_storage.sql`: `rate_limits` table + `rate_limit_hit()`, bucket limits, `match_connection()` reads `shipping_days`), `review_flow_moderation_brief` (2026-11-03, `010_review_flow_moderation_brief.sql`: `video_status.rejected`, `products.brief`, `search_path` on helper functions, `creator_profiles`/`brand_profiles` SELECT limited to owner/admin), `max_creators` (2026-11-03, `011_max_creators.sql`: CHECK 1–50, default 3, `match_connection()` raises `PRODUCT_FULL`). See `app/supabase/migrations/README.md`. 007 removed every write policy for the client roles, revoked their INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER (008: MAINTAIN) table privileges, added `UNIQUE(users.auth_user_id)`, `UNIQUE(users.phone)`, a partial unique index `connections(creator_id, product_id)` over non-closed statuses, a `brand_profiles` credits CHECK (`0 ≤ used ≤ total`), and the `match_connection(uuid)` function. Database-level regression checks are listed in `app/tests/README.md`.

## 5. API routes (all under `app/src/app/api`)

Pattern in every route: `createServerClient()` → `auth.getUser()` for identity; `createClient(url, SUPABASE_SEC_KEY)` for data; look up `users` by `auth_user_id`; authorize by `type` and ownership. Responses are `{ error: "<Hebrew>" }` on failure.

| Route | Methods | Purpose |
| --- | --- | --- |
| `auth/send-otp`, `auth/verify-otp` | POST | WhatsApp OTP login/registration (creates the Supabase auth user; `verify-otp` signs the user in **server-side** — auth cookies on the response, no password in the JSON — the client then calls `refreshAuth()` and navigates). Rate limited: 3 codes per phone / 10 per IP per 10 min; 10 verifications per phone / 30 per IP per 10 min (429 + `Retry-After`, `code: rate_limited`) |
| `auth/register` | POST | completes profile (creator or brand) after OTP; 10 per IP per hour. The `/register` page itself only opens with `verified=1&userId=…` (login sends new phones there, `?type=` preselects the form); opened directly it redirects to `/login` |
| `auth/user-type` | GET, POST, DELETE | GET: onboarding status + the role this session signs in as + every role the account holds; POST `{role}` picks the session role (only roles the account holds; sets the httpOnly `mashpian-role` cookie, returns the role's home); DELETE clears it (logout). `verify-otp` returns `roles`/`role` and sets the cookie itself for single-role accounts; `register` and `dev-login` set it too |
| `auth/dev-login` | POST | **non-production only** (404 in Vercel production; local/preview production builds need `ALLOW_DEV_LOGIN=true`). Gate = `ADMIN_LOGIN_PHONE`+`ADMIN_LOGIN_PASSWORD`; signs in the synthetic `creator` / `brand` test accounts (flagged `dev_account`) server-side; 10 attempts per IP per 15 min |
| `profile` | GET, PUT | own user + profile (+ `role`, `roles`); creator GET includes `portfolio_count`, brand GET includes `products_count` (not deleted) and `connections_count` (past the heart stage) |
| `profile/upload-avatar` | POST | avatar/logo to `images` bucket, 365-day signed URL; ≤ 5 MB, type decided by magic bytes (JPEG/PNG/WebP) |
| `profiles/[userId]` | GET | **public** profile of a creator (portfolio with signed URLs + thumbnails, socials, stats) or brand (active products, stats). Never returns phone/email |
| `products` | GET, POST | list (`?status=active`, `?brand=me`, `?brand_id=`) — returns `brand_name`, `brand_user_id`, `categories`, `category_custom`, `logo_url`, `max_creators` (null = no limit), `occupied`, `spots_left` (null = no limit; + `matched_count` for the owner); signed-in creators also get `brief` + `brief_data`; `source_url` is never returned to creators; products with a reached limit are hidden from creators; create (accepts `brief`, `brief_data`, `category`, `category_custom`; `max_creators` is always null on new products) |
| `products/[id]` | GET, PUT, DELETE | PUT goes through `pickProductUpdates()` (allowlist; `category` must be a real feed category or it is dropped) |
| `products/upload-image` | POST | product image to `images` bucket; ≤ 5 MB, type decided by magic bytes |
| `creators` | GET | brand only — ranked creator gallery with portfolio count, poster, preview video, relation to this brand (incl. `mutualAt`), `fit` flag; creators the brand passed on are excluded |
| `creators/pass` | POST, DELETE | POST `{creator_user_id}` records a gallery skip ("✕", `brand_passes`); DELETE forgets all skips ("להחזיר יוצרים שדילגתם עליהם") |
| `connections/counts` | GET | hearts waiting on the viewer — brand: `{chose_you, match, actionable}`, creator: `{actionable}` (badge on the "חיבורים" nav item, brand home quick buttons) |
| `connections` | GET, POST | GET: own connections enriched with `unread_count`, `last_message`, `last_message_at` (one messages query for all) + `settings.max_revisions`. POST: send a heart — creator `{product_id}` (gate-checked) or brand `{product_id, creator_user_id}`; hearts are free on both sides. If the other side already hearted the same product the pair becomes mutual (`mutual_at`, response `{mutual: true}`) and the brand is asked to confirm; 409 `already_mutual` when it already is |
| `connections/[id]` | GET, PUT, POST | PUT `{status}` on a pending heart: `mutual` = the responder's heart back (a creator's `approved` means the same; portfolio gate applies); `approved` = the brand's paid confirmation (`performMatch` → `match_connection()`: credit, chat, brief), allowed on a mutual pair or straight on a creator's heart; a one-sided heart is answered only by the other side and withdrawn only by its sender, a mutual pair may be cancelled/rejected by either side. Other transitions unchanged — | GET connection + messages; PUT status transition (state machine in file; pending rules per `initiated_by`; `approved` → `performMatch`; `uploaded` → brand `completed` / `revision_requested` or admin `in_review`; `completed` approves the deliverables and posts a closing system message; deadlines/revision allowance from `lib/settings.ts`); POST chat message (contact filter; 400 `chat_closed` once the connection is closed) |
| `messages/unread`, `messages/read` | GET, POST | badge count; mark connection read |
| `videos` | GET, POST | GET `?portfolio=me|<userId>` (brands/admins may view others) or `?connectionId=` (the two parties or admin); POST = small-file fallback upload through the server (Vercel 4.5 MB body cap) — the app uploads directly to Storage instead |
| `videos/[id]` | PUT/DELETE | approve/reject/delete |
| `videos/save-portfolio` | POST | records a browser-uploaded portfolio video (`storagePath`, `title`, `thumbnailPath`); the path must be `portfolio/<auth uid>/<file>` |
| `videos/save-connection` | POST | records a browser-uploaded deliverable for a connection (`connectionId`, `storagePath` = `portfolio/<auth uid>/connections/<connectionId>/<file>`, `thumbnailPath`) and moves the connection to `uploaded`; creator of that connection only, status must be delivered/filming/revision_requested |
| `videos/[id]` | DELETE | creator deletes one of their own portfolio videos (storage objects + row); admins may delete any video |
| `notifications` | GET, PUT | GET: own rows (newest 50); PUT `{id, read}` marks one, `{all: true}` marks every unread row (the notifications screen calls it on open). `data` carries `connectionId` and, since Batch 7, `productId` — `lib/notification-links.ts` turns a row into its destination per role |
| `admin/brands` | GET, PUT | list; PUT `{userId, is_active?, total_credits?}` (total can't drop below used → 400). Every admin PUT writes an `activity_log` row (`admin_update_*`, actor = admin's users.id) |
| `admin/creators`, `admin/content`, `admin/stats` | | admin screens' data; the `/admin/*` pages themselves are gated server-side in `admin/layout.tsx` (anonymous → login, non-admin → 404) |
| `admin/moderation` | GET, PUT | GET: deliverables awaiting the optional admin pass (`videos`), latest 100 portfolio videos with creator names (`portfolioVideos`), flagged chat. PUT `{videoId, action}`: deliverables → `approve` (→ `in_review`), `revision`, `reject`; portfolio videos → `reject` (takedown: `status='rejected'`, creator notified) / `restore` |
| `admin/settings` | GET, PUT | `site_settings` rows by section: `general`, `credits`, `moderation`, `timelines` (`shipping_days`, `filming_days`, `review_days`, `max_revisions`). `timelines` is live: `lib/settings.ts` feeds the connection state machine and `match_connection()` reads `shipping_days` |
| `admin/feedback` | GET, PUT | In-app reports (`feedback` table, migration 012). GET `?status=open|new|in_progress|closed|all` with the reporter's name/type/phone + `newCount`; PUT `{id, status?, admin_note?}` — a status change notifies the reporter (`feedback_updated`), audited as `admin_update_feedback` |
| `feedback` | GET, POST | Signed-in users: GET own reports; POST `{kind: bug|request|contact, subject, message, page?}` (validated in `lib/feedback.ts`, 5 per user per hour) → row + a `feedback_received` notification to every admin (links to `/admin/feedback`) |
| `cron/deadlines` | GET | expires 7-day hearts; shipping/filming/review deadline warnings (each at most once per 48 h per connection, tagged with the recipient's role) & auto-cancel/auto-complete; purges expired `otp_codes` and stale `rate_limits` rows; capacity watch — `platform_usage()` vs `lib/capacity.ts` limits, one `capacity_warning` notification per admin per day at ≥ 70 % |
| `admin/stats` | GET | dashboard counters + `capacity` (`capacityStatus()` + raw `usage`, null until migration 014 exists) |

## 6. Front-end conventions that matter

- Pages are client components. Data loading uses `swrFetch(url, apply)` from `lib/client-cache.ts`: `apply` runs with the cached response immediately (instant revisit) and again with fresh data. Mutations refetch via `fetchJson`. Supabase Realtime (`postgres_changes`) is used on `connections`, `products`, `messages` to refresh lists.
- Auth: `useAuth()` is a single shared store; `(app)/layout.tsx` redirects to `/login?redirect=` when there is no session. Role is fetched from `/api/profile` (cached) — BottomNav shows creator or brand tabs accordingly.
- UI primitives live in `components/ui`; `Avatar` has `expandable` (lightbox); `ProfileModal userId=…` shows any user's public profile anywhere.
- All user-facing text is Hebrew. JSX text containing `'` must use `&apos;` (eslint `react/no-unescaped-entities`).
- Lint state: `npx tsc --noEmit` is clean and must stay clean. ESLint has ~15 **pre-existing** errors (`react-hooks` "setState synchronously in effect", "cannot access variable before declared") and widespread `no-explicit-any` — the codebase uses `as any` for Supabase rows. Don't add new errors; don't feel obliged to fix old ones unless touching that code.
- Unread badge: the messages page emits `emitUnreadChanged(delta)` (window event) and BottomNav listens; it also refetches on visibility change.
- Video performance: never render `<video>` in lists; use `thumbnail_url` posters (`preload="none"`) and only autoplay the single focused card. Videos without a poster use `src="…#t=0.1"` so Safari paints a frame.

## 7. What was built (chronological, all on `main`)

Earlier work: OTP auth, registration, feed, products, connections pipeline with deadlines, chat with moderation, admin dashboard, PWA, realtime, avatars, admin credit editor, public profiles (`f4999d3`), brand multi-categories and logout confirmation (`5418ed6`), performance pass — shared auth store, SWR cache, N+1 fix, page fade (`c2d5c44`).

2026-11-02 — product pivot to mutual hearts:
- `9c9a7de` mutual-heart matching: `initiated_by`, `lib/match.ts`, brand discovery gallery (`/brand`), creator hearts on the feed, 5-video gate (UI + server), heart direction in both connection lists, 7-day expiry in cron, product image in chat header, Google login removed, party-ownership check on connection updates (security fix).
- `5d93dfc` cron auth fix (previous `vercel.json` sent a literal `${CRON_SECRET}`; every run was 401).
- `9bc40c1` browser-generated posters → public `thumbnails` bucket; gallery grid uses images only.

## 8. What is missing / known gaps (prioritized)

**Product (this week per spec)**
1. ~~Onboarding "portfolio 0/5" screen in registration~~ — done 2026-11-03 (Batch 6): a new creator lands on `/profile?onboarding=1`, which opens the first upload; the feed/profile banners keep the 0/5 progress.
2. ~~Brief editing by the brand~~ — done 2026-11-03 (Batch 5): `products.brief`, sent at match instead of the template.
3. Ranking signals beyond category/portfolio/completions (city, followers, response time) in `/api/creators` and the feed.
4. Supabase Pro ($25/mo): needed before 2-minute videos (then set `MAX_VIDEO_MB` from 50 to 150) and before storage/egress exceed the free tier (1 GB / 5 GB). Launch on Free is acceptable short-term.

**Product (this month)**
5. ~~Enforce `products.max_creators`~~ — done 2026-11-03 (Batch 6): editable in the product form (1–50, default 3); the feed hides full products and shows `occupied/max`; new hearts and `match_connection()` refuse a full product (`product_full` / `PRODUCT_FULL`).
6. ~~Auto-close chat~~ — decided and done 2026-11-03 (Batch 5): the chat closes when the connection completes (brand approval or auto-approval), history stays readable.
7. Cardcom payments (adapter stub exists); until then admin grants credits.
8. ~~Admin moderation of portfolio videos~~ — done 2026-11-03 (Batch 5): takedown/restore in `/admin/moderation`.

**Technical debt / risks**
9. ~~`POST /api/videos` (connection video upload) streams the file through the serverless function~~ — fixed 2026-11-03 (Batch 3): the connections page uploads straight to Storage under `portfolio/<uid>/connections/<connectionId>/` and calls `POST /api/videos/save-connection`; the old `POST /api/videos` remains only as a small-file fallback with corrected authorization.
10. Old portfolio videos have no `thumbnail_url` (only ones uploaded after `9bc40c1` do). A one-off backfill needs ffmpeg (e.g. a Render worker) or re-upload.
11. Vercel Hobby: cron once/day; move to Pro for `*/15 * * * *` and commercial terms. `CRON_SECRET` must exist in Production (could not be verified via API).
12. ~~`brand/products/page.tsx` sends a `category` field~~ — removed 2026-11-03 (Batch 5).
13. ~~`app/src/app/auth/callback/route.ts` is dead code~~ — removed 2026-11-03 (Batch 6). The `GOOGLE_CLIENT_ID/SECRET` env vars can be deleted from Vercel (owner).
14. Automated tests: `npm test` (65 unit tests, see `app/tests/README.md`). Manual flows need a real WhatsApp OTP or the non-production dev-login (`creator` / `brand` test accounts). Since Batch 6 `verify-otp` signs the user in server-side (cookies) and no longer returns a password.
15. Message read-receipts are per connection (`*_read_at`), not per message.
16. The admin "moderation/content" pages were not reviewed in this round.

## 9. Decisions already made (don't re-litigate)

- Phone OTP only; no Google.
- Hearts from both sides; credit deducted at match; a brand with 0 credits can still send hearts but the match is blocked with an explanatory error until credits are added.
- A heart to a creator with <5 videos expires like any other (7 days); no special hold.
- Creator home stays the product feed; brand home is the creator gallery.
- Cloudflare Stream rejected for now (paid); browser-side posters instead. Revisit if posters are not enough.
- Social handles are shown as links on public profiles (treated as public identity, not contact info).

## 10. Working agreement with the owner (Arik)

- Hebrew UI, RTL, mobile first; he tests on his phone after each deploy.
- Ship in small commits to `main`; each should pass `tsc` and `npm run build`.
- He wants the app to feel like a native app (fast transitions, instant lists) — keep the SWR + realtime pattern.
- When a paid service would help, say so with the price and the trade-off; don't add paid dependencies silently.
