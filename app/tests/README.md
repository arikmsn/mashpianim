# Tests

## Unit tests (no services required)

```
npm test
```

Runs `tests/**/*.test.ts` with Node's built-in runner (`node --test`, TypeScript via `--experimental-strip-types`, Node ≥ 22.6). No extra dependencies.

`authz.test.ts` covers the pure authorization rules used by the API routes: registration role whitelist, profile field allowlists, connection participation, public product projection, dev-login availability.

`match-errors.test.ts` covers the mapping of `match_connection()` database errors (`NO_CREDITS`, `CONNECTION_NOT_PENDING`, …) to API responses and the Postgres unique-violation detection used for duplicate hearts.

`uploads-products.test.ts` covers the storage-path ownership checks behind `save-portfolio` / `save-connection` / video delete, the connection statuses that accept a deliverable, and the product update allowlist (no `category` column).

`client-cache.test.ts` covers the per-user ownership of the SWR cache (`syncCacheOwner`): a different user, or a logout, drops the previous user's cached API responses.

`chat.test.ts` covers the chat card guards (`isBriefSnapshot` / `isVideoCard`), the texts the app writes in a person's name, the 24 h final review window and the regions list; `notification-links.test.ts` pins which notification types open the chat.

`rate-limit.test.ts` covers client IP extraction, limiter key normalisation and the retry message. `uploads.test.ts` covers the video pre-flight (type + 150 MB cap), image magic-byte sniffing, Storage error mapping and the admin timeline settings parser.

## Security regression checks that need a running stack

These cannot run without Supabase + a session. Run them against a local `npm run dev` (or a preview deployment) with two test users (A, B) signed in on two browsers; use the browser devtools console on the app origin so cookies are sent.

| # | Check | Steps | Expected |
|---|---|---|---|
| 1 | Register rejects admin | `fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userType:'admin',profile:{fullName:'x'}})})` as a signed-in user | 400 `סוג משתמש לא תקין` |
| 2 | Register cannot target another account | same call with `userId:'<B auth uid>', userType:'creator'` as A | 403 |
| 3 | Register without session | same call in a private window | 401 |
| 4 | Profile privileged fields ignored | as A: `PUT /api/profile` body `{userFields:{type:'admin',is_active:false,phone:'+972500000009'},profileFields:{total_credits:999,level:'on_the_radar',hearts:99}}` then `GET /api/profile` | 200; `user.type`, `is_active`, `phone`, credits/level unchanged |
| 5 | Legitimate profile edit works | as A: `PUT /api/profile` `{userFields:{full_name:'שם חדש'},profileFields:{bio:'ביו'}}` then `GET /api/profile` | values updated |
| 6 | Non-participant cannot read a connection | as B: `GET /api/connections/<A's connection id>` | 403; as A: 200 with messages, no `phone` field anywhere in the JSON |
| 7 | Non-participant cannot send / mark read | as B: `POST /api/connections/<id>` `{text:'hi'}` and `POST /api/messages/read` `{connection_id:'<id>'}` | 403 both; as A: 200 |
| 8 | Chat cannot create system messages | as A: `POST /api/connections/<id>` `{text:'x',is_system:true,sender_id:'<B id>'}` then `GET` | stored message has `is_system:false` and `sender_id` = A |
| 9 | Dev login hidden in production | on the production URL: `POST /api/auth/dev-login` `{}` | 404 |
| 10 | Dev login never returns secrets (non-prod) | `POST /api/auth/dev-login` with the configured phone/password and `role:'creator'` | 200 `{success, role, redirect}` only; response has no `authPassword`/`password`; session cookie set |
| 11 | Public products hide private fields | as a creator: `GET /api/products?status=active` and `GET /api/products/<id>` | no `shipping_address`, `digital_access_instructions`, `brand_id`, `brand_profiles` in any item |
| 12 | Brand still sees its own private fields | as the owning brand: `GET /api/products?brand=me` | items include `shipping_address` / `digital_access_instructions` |
| 13 | user-type is session-scoped | as A: `GET /api/auth/user-type?userId=<B uid>` | 403; without `userId` → own type |

## Database-level checks (Batch 2: migrations 007/008)

These hit Supabase directly with the publishable (anon) key, which is what an attacker who extracts it from the browser would do. `URL` = `NEXT_PUBLIC_SUPABASE_URL`, `ANON` = `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `JWT` = a signed-in user's access token (from the `sb-*-auth-token` cookie, base64 JSON → `access_token`).

| # | Check | Request | Expected |
|---|---|---|---|
| 14 | Signed-in user cannot write any table | `PATCH $URL/rest/v1/users?id=eq.<own id>` with `apikey: $ANON`, `Authorization: Bearer $JWT`, body `{"type":"admin"}`; repeat for `connections`, `messages`, `notifications`, `brand_profiles`, `products`, `videos` (INSERT/UPDATE/DELETE) | 403 `42501 permission denied for table …`; rows unchanged |
| 15 | Anonymous cannot write | `POST $URL/rest/v1/users` with only `apikey: $ANON` | 401 `42501` |
| 16 | Match function is service-role only | `POST $URL/rest/v1/rpc/match_connection` `{"p_connection_id":"<id>"}` with a user JWT, and with the anon key alone | 403 / 401 `permission denied for function match_connection` |
| 17 | Reads still scoped (Realtime depends on this) | `GET $URL/rest/v1/connections?select=id,status` with a user JWT; same with anon key only | own rows only; anon gets `[]` |
| 18 | One active heart per creator/product | two simultaneous `POST /api/connections` `{product_id}` as the same creator | one 201, one 409; exactly one non-cancelled row in `connections` for that pair |
| 19 | Credits are atomic and bounded | brand with `used_credits = total_credits` approves/hearts a pending connection | 400 `לעסק אין סרטונים זמינים כרגע…`; connection stays `pending`, `used_credits` unchanged |
| 20 | Admin cannot set total below used | `PUT /api/admin/brands` `{userId, total_credits:<less than used>}` as admin | 400 `לא ניתן להגדיר פחות סרטונים ממה שכבר נוצל` |

## Batch 3 checks (FUNC-01, FUNC-02, VID-01, CRED-02, QA-01)

| # | Check | Steps | Expected |
|---|---|---|---|
| 21 | Connection video upload works end to end | as the creator of a `delivered` connection: upload a video from the connections page (any size) | toast success; connection shows `הועלה`; the brand opens the connection and sees the video player; `videos` row has `connection_id` set |
| 22 | Metadata route refuses foreign paths | `POST /api/videos/save-connection` with `storagePath` under another user's folder, another connection id, or a plain `portfolio/<uid>/<file>` | 400 `נתיב קובץ לא תקין` |
| 23 | Only the creator of the connection, only in the right status | same call as the brand (its own folder never matches the path → 400), as a non-creator with a matching path → 403, or as the creator while the connection is `approved`/`shipped` → 400 | denied in all three cases |
| 24 | Brand/creator can list connection videos; strangers cannot | `GET /api/videos?connectionId=<id>` as each party and as a third user | 200 / 200 / 403 |
| 25 | Product edit succeeds and ignores `category` | as the owning brand: `PUT /api/products/<id>` `{name:'x', category:'ביוטי', brand_id:'<other>', price:'120'}` then `GET` | 200; name and price updated; brand unchanged. Body with only unknown keys → 400 |
| 26 | Portfolio video delete | as the creator: `DELETE /api/videos/<own portfolio video id>` | 200 `{success, portfolio_count}`; row gone; storage object and thumbnail removed. Another creator's video or a connection video → 403 |
| 27 | Pre-gate hearts can't be matched | brand approves a pending heart from a creator with fewer than 5 portfolio videos (`PUT …/connections/<id>` `{status:'approved'}` or a brand heart on the same product) | 409 `code:'creator_not_ready'`; connection stays `pending`; credits unchanged |
| 28 | Cache never leaks between users (QA-01) | log in as a brand, open `/brand`, log out, log in as a creator in the same tab | lands on `/feed` (not `/brand`); `sessionStorage` has no `mashpian:cache:*` keys from the brand session; `mashpian:cache-owner` equals the creator's auth uid |

Note for scripted runs: every dev-login sets a fresh one-time password on the test account and signs it in; earlier sessions of that same account stop validating (401). Log in once per account per run, or re-login after another client (e.g. a browser) used the same role.

## Batch 4 checks (SEC-07, SEC-10, SEC-11, FLOW-02, FLOW-03, video limits)

| # | Check | Steps | Expected |
|---|---|---|---|
| 29 | Admin pages gated | `GET /admin` anonymous; `GET /admin` and `/admin/settings` as a creator | 307 → `/login?redirect=/admin`; 404; API `/api/admin/*` → 403 |
| 30 | OTP send limit | `POST /api/auth/send-otp` 4× for one phone within 10 min | 4th → 429 `code: rate_limited` with `Retry-After` |
| 31 | OTP verify limit | `POST /api/auth/verify-otp` with a wrong code 11× for one phone | the per-code counter trips at the 6th, the limiter at the 11th (429 `rate_limited`) |
| 32 | Dev-login brute force | 11 wrong passwords from one IP within 15 min (non-production) | 429 after the 10th hit of the window |
| 33 | Image sniffing | `upload-image` / `upload-avatar` with a text file named `.jpg` (content-type image/jpeg); then a real PNG named `.jpg` | 400 `הקובץ אינו תמונה תקינה`; 200 with a `.png` storage path |
| 34 | Bucket limits | direct Storage `POST` of `text/plain` into `videos` with a user JWT | 400/415 `invalid_mime_type`; a file above the bucket limit (or the plan limit) → `exceeded the maximum allowed size` |
| 35 | Video pre-flight | pick a 151 MB file or a `.mkv` in the profile/connections upload | Hebrew message with the 150 MB cap / supported formats; nothing is uploaded |
| 36 | Upload progress | upload a video from the profile modal or a connection card | percent text and bar advance, then `שומר...`, then the success toast |
| 37 | Cron housekeeping | `GET /api/cron/deadlines?secret=…` with an expired `otp_codes` row present | 200; `results.purged_otps ≥ 1`; running twice on the same overdue connection sends one warning (`skipped_duplicates` on the second run) |
| 38 | Settings drive deadlines | set `timelines.max_revisions` to 1 in `/admin/settings`, then request a 2nd revision on an `in_review` connection | 400 `הגעתם למקסימום תיקונים (1)`; `film_deadline` / `review_deadline` follow `filming_days` / `review_days` |
| 39 | Admin audit | any admin PUT (brands, creators, settings, content) | an `activity_log` row `admin_update_*` with `actor_id` = the admin's users.id |

`connection-flow.test.ts` covers the chat open/closed rules, which statuses the brand may review, and the brief message (template vs. brand text; the brief never appears in public product data).

## Batch 5 checks (FLOW-01, MOD-01, brief, chat close)

Scripted runs: send Hebrew bodies from a UTF-8 shell (PowerShell `-Encoding utf8`, or JSON files) — Git Bash on Windows garbles Hebrew in `curl -d` strings.

| # | Check | Steps | Expected |
|---|---|---|---|
| 40 | Brand reviews straight after upload | creator uploads a deliverable (connection `uploaded`); brand opens the connection | review block visible (approve / request revision); `PUT {status:'completed'}` → 200; the connection's videos become `approved` + downloadable; a closing system message appears |
| 41 | Revision round-trip | brand `PUT {status:'revision_requested', revision_notes}` on `uploaded`; creator re-uploads via `save-connection` | 200; `revision_count` +1; the pending video turns `revision_requested`; re-upload → `uploaded` with a fresh `review_deadline` |
| 42 | Revision allowance from settings | `/api/connections` payload has `settings.max_revisions`; the brand modal shows `x/N`; exceeding N → 400 | matches `/admin/settings` → לוחות זמנים → תיקונים מותרים |
| 43 | Chat closes with the connection | after `completed` (or `cancelled` after a match): `POST /api/connections/<id>` `{text}` | 400 `code: chat_closed`; `/messages` still lists the conversation, shows the closing system message and no composer |
| 44 | Brief at match | brand creates a product with `brief`; creator and brand heart | second system message = header + the brand's brief + format lines, no `(העסק ישלים)`; `GET /api/products/<id>` as a creator has no `brief` |
| 45 | Portfolio takedown (MOD-01) | admin: `/admin/moderation` → תיקי עבודות → הסרה (`PUT /api/admin/moderation {videoId, action:'reject'}`) | video `status='rejected'`; hidden from brands (`GET /api/videos?portfolio=<creator>`), visible to the creator with a badge; not counted for the 5-video gate (`portfolio_gate` shows the lower count); creator gets a notification; שחזור restores it |
| 46 | Review deadline auto-approve | an `uploaded` connection whose `review_deadline` passed, then the cron runs | warning once, then after 3 more days `completed` + videos approved + closing system message; both parties get the `connection_completed` notification |

## Batch 6 checks (BRAND-01, SEC-09, onboarding)

| # | Check | Steps | Expected |
|---|---|---|---|
| 47 | Creator slots on a product | brand sets `max_creators` on a product (form field or `PUT {max_creators}`); creators and brand list products | feed items carry `occupied`/`spots_left`; a product with `spots_left = 0` disappears from `?status=active` for creators but stays in `?brand=me` with `matched_count` |
| 48 | Full product refuses hearts and matches | with `occupied ≥ max_creators`: creator or brand `POST /api/connections` | 409 `code: product_full`; a pending heart that becomes full before the other side answers is refused at match with 409 (`PRODUCT_FULL` from `match_connection()`), credits untouched |
| 49 | `max_creators` validation | `PUT /api/products/<id>` with `{max_creators: 0}` / `500` / `"4"` | 400 (nothing valid) / clamped to 50 / 4 |
| 50 | OTP sign-in is server-side (SEC-09) | `POST /api/auth/verify-otp` with a valid code | JSON has `userId`, `userType`, `needsOnboarding` only — no `tempPassword`/`email`; the response sets the `sb-*-auth-token` cookies; `/api/profile` with those cookies is authenticated |
| 51 | New creator lands on the first upload | finish creator registration | redirected to `/profile?onboarding=1`; the upload modal opens and the URL is cleaned to `/profile` |

## PWA / branding checks

| # | Check | Steps | Expected |
|---|---|---|---|
| 52 | Static files bypass the auth middleware | signed out: `curl -I /sw.js`, `/offline.html`, `/manifest.json`, `/apple-icon.png` | all 200 (no 307 to `/login`) |
| 53 | Icons come from `logo.png` | replace `public/logo.png`, run `python scripts/gen-icons.py`, bump the cache names in `public/sw.js` | all icon files regenerated; after deploy, an installed app shows the new icon once the new worker activates (reopen the app twice) |
| 54 | No white around the icon | install on Android (circle and squircle launchers) and iOS; open the splash | icon fills its shape with the gradient, artwork not clipped; splash background is brand pink, not white |

## Batch 7 checks (creator product page, feed, journey timeline)

| # | Check | Steps | Expected |
|---|---|---|---|
| 55 | Feed chips | open `/feed` as a creator with categories | chips: `בשבילך`, `הכל`, own categories, the rest; `בשבילך` is active and lists own-category products plus anything hearted/matched; empty state offers "הצגת כל המוצרים" |
| 56 | Product page | tap a feed card (image or title) | `/products/<id>`: value, slots, brand row → brand profile modal, "על המוצר", "הבריף — מה צריך להיות בסרטון" (brand text or the fallback + 3 format lines), "לוח זמנים ומשלוח" from admin settings; locked creators (< 5 videos) see blurred details + the gate |
| 57 | Product page actions | with a connection in each status | pending-from-brand → approve/decline; own pending → cancel; `shipped` → tracking + confirm receipt; `delivered`/`filming`/`revision_requested` → upload with progress (`uploaded` afterwards); `uploaded` → "waiting for the brand"; chat link whenever the chat exists; no open connection → heart (or "המוצר מלא") |
| 58 | Journey timeline | `/connections` active cards and the product page | 5 steps with ✓ up to the current one, next action + deadline (`activeDeadlineField`); digital products say גישה; `flow-timeline.test.ts` |
| 59 | Deep link into connections | `/connections?open=<id>` | the right tab opens, the card is highlighted and scrolled into view |
| 60 | Brief visibility | `GET /api/products/<id>` signed out vs. as a creator | signed out: no `brief`, no `connection`; creator: `brief` present, `connection` = own (open first, else latest), `settings` days |
| 61 | Bell badge clears | with unread notifications open `/notifications`, then go back to the feed | the badge is gone at once (no reload); the rows that were new stay highlighted during that visit; `PUT /api/notifications {all:true}` was called once |
| 62 | Badge updates live | trigger a notification for the signed-in user (e.g. a heart from the other account) while on the feed | the badge increments within seconds without a reload (realtime), and after returning to the app from the background |
| 116 | The business stays anonymous | creator: feed, product page, "המוצרים שבחרתי", `/api/products`, `/api/profiles/<brand user>` | the card says "עסק מאומת · השם ייחשף כשהעסק יסמן אותך בחזרה"; the product page shows a locked "עסק מאומת" card and no profile button; after her own unanswered heart the grid says "עסק מאומת"; the API sends `brand_name: ""`, `brand_user_id: null`, `brand_revealed: false`; the business profile endpoint answers 403 `brand_hidden`. Once the business hearts her (or back, or confirms) the name, logo and "פרופיל העסק" appear everywhere (`brand-reveal.test.ts`) |
| 113 | One-screen deck | creator: גלו on a phone | no page scroll: header, the brand-hearts strip, the card and the three buttons fit above the nav; no portfolio banner; a locked ❤️ opens "כדי לסמן לב צריך 5 סרטונים…" with "🎬 להעלאת סרטון" → the profile's upload modal |
| 114 | Instant product page | creator: tap "פרטים" (or the image / the brand name) on the card | the page paints at once (the route and `/api/products/<id>` were prefetched while the card was on screen; the `loading.tsx` skeleton otherwise); the hero image opens full screen on tap, Escape / tap closes it |
| 115 | RTL arrows, fresh counts, achievements, filter | creator deck / brand gallery; profile; filter popup | carousel arrows point outward (SVG, not ‹ ›); right after a portfolio upload the profile count, the feed lock and the product pages agree without a refresh; "הישגים" says it counts videos approved by businesses (X/5 …) and "תיק עבודות מלא" is its own badge; the filter chips and button carry no counts |
| 105 | Creator deck | creator: גלו | one product at a time with image, description, brand, category / region tags; swipe or arrows browse; ❤️ sends the heart (toast, the card leaves the deck and appears under "המוצרים שבחרתי"); ✕ hides the product for good (reload: still gone; "להחזיר מוצרים שדילגת עליהם" in the empty state restores them); "פרטים" opens the product page; a locked creator sees 🔒 and the gate modal |
| 106 | Feed filter popup | creator: the filter button at the end of the search row | the popup lists only categories that currently have products (with counts), the regions brands declared, physical / digital; the badge on the button shows the active count; "הצגת N מוצרים" applies |
| 107 | Chosen products | creator: "❤️ המוצרים שבחרתי" | thumbnail grid of hearted / mutual / active / completed products with a lit heart and a status label; "ביטול הלב" only on unanswered own hearts (the brand gets `heart_withdrawn`) |
| 108 | Brand profile hearts | creator: פרופיל העסק popup (connections, chat header, product page) | products already chosen carry a marker (❤️ נשלח / 🎉 מאטץ' / פעיל / הושלם); 🤍 on the others sends a heart (gate applies); "ביטול" withdraws an unanswered heart |
| 109 | Creator lists | creator: חיבורים | "בתהליך": brands that chose her (כן, מעוניין/ת / לא תודה) and mutual pairs ("אישרת — ממתין לאישור הסופי של העסק"); "הסתיימו": every matched connection with status, לצ'אט, פרופיל העסק; the tab badge = hearts waiting on her; `?open=<id>` lands on the right tab |
| 110 | Brief card in chat | match → chat (both roles) | card with מה רואים / מה היא תגיד / אורך + "לבריף המלא" (full template modal); creator: "✅ אישור הבריף" → "אישרתי את הבריף" in her name, chip "אישרת את הבריף", brand notified `brief_approved`, `ship_deadline` set; brand: "עדכון הבריף" → brief screen with `?connection=` → save posts a new version (card "גרסה 2", approval reset, creator notified `brief_updated`); older cards read "הוחלף בגרסה חדשה" |
| 111 | Chat pipeline | after the brief approval | brand "📦 המוצר נשלח" (tracking / digital access) → system event in the chat; creator "אישור קבלת החבילה" → "קיבלתי את החבילה" in her name, `film_deadline` set; "🎬 העלאת הסרטון" → video card (poster, ▶ opens the player) → brand "✅ מאשר סרטון" or "✏️ דרוש שינוי" (composer prefilled "דרוש שינוי: ", once) → creator re-uploads ("הגרסה המתוקנת", final) → brand approves or the cron completes after 24 h; status strip (timeline + clock + next step) and the "📋 הבריף" modal on every chat |
| 112 | Post-match notifications | tap notification rows after a match | brief posted / updated / approved, shipped, delivered, uploaded, revision, completed and deadline warnings all open `/messages?connection=<id>`; hearts still open the product page / connection card; icons 📋 / ✅ (`notification-links.test.ts`, `chat.test.ts`) |
| 95 | Structured brief | brand: product card "בריף" → `/brand/products/<id>/brief` | the template מה רואים · מה היא תגיד (text) · אורך · שוטים שחייבים · כתוביות · כללי צילום · מה אסור · עוד משהו, all optional, "תצוגה מקדימה" renders it as the creator sees it, save (with `?connection=` the save also posts the card into that chat); the creator's product page shows the same sections; the chat card at match carries a snapshot (`connection-flow.test.ts` "structured brief") |
| 96 | Product form | brand: הוספת מוצר | fields: name, description, שווי מוצר, type, category incl. "✎ אחר" + typed label, shipping / digital access, image, סוג הסרטון chips, short notes; no expiry / stock / creators-per-product / product link; after saving a new product → "רוצים למלא בריף מפורט?" |
| 97 | Gallery carousel | brand home | swipe left/right or arrows browse without skipping; ✕ removes the creator for good (reload: still gone); ❤️ on a creator who hearted you → "לב בחזרה" → מאטץ'; "💗 אהבתי" lists hearted creators; no counts in the header or "כל היוצרים"; "לצפייה בכולם" opens the thumbnail popup; tapping a thumbnail jumps the carousel |
| 98 | Brand lists | brand: חיבורים | tabs בחרו בך / הרשימה שלי / מאטץ' / פעילים / הסתיימו; badge counts on בחרו בך (pink) and מאטץ' (green); first visit lands on מאטץ' when it has items; `?tab=match` deep link |
| 99 | Match confirmation | brand: מאטץ' → "✅ אישור החיבור" | confirm modal names the creator, product and the credit charge (remaining count); with 0 credits → purchase CTA instead; after confirming: chat opens with the brief, credit −1, row moves to פעילים; the creator gets the match notification |
| 100 | Mutual hearts | creator hearts a product the brand already hearted them on (or approves a brand heart) | row shows "🎉 מאטץ' — ממתין לאישור העסק", no chat yet; brand gets "יש מאטץ'! אשרו את החיבור" (+ WhatsApp); creator product page explains the wait |
| 101 | Hearts without credits | brand with 0 credits sends a heart | allowed (amber note in the picker); confirming a match is refused with the credits message and opens the purchase request |
| 102 | Nav badge | both roles | "חיבורים" shows the number of hearts waiting on the viewer (brand: בחרו בך + מאטץ'; creator: brand hearts); updates on realtime connection changes |
| 103 | Products page actions | brand: המוצרים שלי | "עריכה" and "בריף" on the right; "השהיה" and "מחיקה" small and grey on the far left; no "x/y יוצרים" text; category shows the typed label when set |
| 104 | Cron mutual reminder | run the cron with a mutual pair older than 3 days | the brand gets "מאטץ' ממתין לאישורכם" once per 48 h; one-sided hearts still expire after 7 days, mutual pairs never do |
| 91 | Brand profile counters | brand profile header | מוצרים = live products, חיבורים = connections past the heart stage (QA brand: 5 / 11) |
| 92 | Creator profile modal | brand home → "פרופיל" on a card; brand connection modal | portfolio grid shows posters with a play button (no inline players); tap → modal player; intro video stays a single player |
| 93 | Brand connections first tab | open `/brand/connections` with no pending hearts | lands on "פעילים" (or "הסתיימו"); tapping a tab is never overridden; `?open=<id>` still wins |
| 94 | Birth date echo | creator "עריכת פרופיל" | label says (יום/חודש/שנה); after picking, a Hebrew date line appears (`dates.test.ts`) |
| 84 | Profile stats | creator profile header | "סרטונים בתיק" = number of portfolio videos, "שיתופי פעולה" = completed connections, "לבבות" = hearts; no "דירוג —" |
| 85 | No credits, no hearts | brand with 0 remaining credits → heart a creator | picker shows the red notice + "לרכישת סרטונים", send button disabled; `POST /api/connections` as that brand → 403 `no_credits`; approving a creator's heart still fails in `match_connection` with the credits message |
| 86 | Purchase request | brand home "רכישה", brand profile "רכישת סרטונים" | opens "רכישת סרטונים" (contact kind preset, subject prefilled, intro text); sending creates a feedback row visible in `/admin/feedback` |
| 87 | Expiry date | product form | label says (יום/חודש/שנה); after picking a date a Hebrew line "יפוג ב-3 בדצמבר 2026" appears |
| 88 | Register needs a code first | open `/register` or `/register?type=brand` directly | redirected to `/login` (with `?type=brand`); after the code, a new phone lands on `/register?verified=1&…&type=brand` with the brand form preselected |
| 89 | Cron role tags | run the cron (`?secret=`) with an overdue connection on an account that holds both roles | the reminder shows only in the matching session (brand reminders in the brand session, creator ones in the creator session) |
| 90 | Capacity watch | `/admin` dashboard; cron | gauge card with storage + database bars (after migration 014 is applied; before it: the "not available" line); when usage ≥ 70 % the cron adds one admin notification per day ("האחסון מתקרב למגבלת התוכנית") that opens `/admin` (`capacity.test.ts`, `notification-links.test.ts`) |
| 81 | Update banner | deploy a new build, open the app in a tab that was already open; also a fresh load after a deploy | long-lived tab: bottom banner "גרסה חדשה זמינה" with ✕, install prompt hidden meanwhile; fresh load: no banner (the page is already the new build) |
| 82 | Feed search empty state | type a word that matches nothing | "לא נמצאו מוצרים עבור ״…״" with "ניקוי החיפוש" (and "חיפוש בכל המוצרים" when a chip is active); the category copy only appears without a search |
| 83 | Chat timestamps + blocked notice | open a chat; send "0501234567" | every bubble has HH:MM, day separators היום / אתמול / date (`chat-time.test.ts`); the phone message is refused with a red notice under the composer, the text returns to the input; a plain message clears the notice |
| 78 | Product category | brand creates/edits a product and picks a category; creator filters the feed | the chip shows only products of that category; a product without a pick gets the brand's first category; `PUT {category:"nonsense"}` ignored (`categories.test.ts`) |
| 79 | Portfolio posters | creator profile → portfolio tab | cards show a poster (or gradient) with a play button, no inline players; tap → modal player with autoplay; delete still works from the card |
| 80 | Hebrew file picker | portfolio upload modal, product image field | "בחירת קובץ" / "החלפת קובץ" / "לא נבחר קובץ" + file name and size, ✕ clears; no English browser text |
| 76 | Phone validation | login with "123", "abc", "031234567", "+1 555…" | toast "מספר הטלפון לא תקין…" with no request; `POST /api/auth/send-otp` with the same → 400 (`phone.test.ts`) |
| 77 | QA-session fixes | brand profile as a multi-role account, own card absent from the brand gallery, pause/activate toasts, delete confirmation, no email login link, `/does-not-exist` in Hebrew, page stays light under system dark mode | all as described |
| 72 | Role choice at login | OTP login with an account that holds several roles (admin + creator profile, or creator + brand) | after the code: "באיזה ממשק להיכנס?" with one option per role; the pick lands on that role's home; a single-role account goes straight in |
| 73 | One session, one role | signed in as creator with an admin account | no admin notifications, no admin links, `/admin` → 404, portfolio upload allowed, feed/connections/messages show only the creator side; profile → "החלפת ממשק" switches (full reload), admin sidebar → "מעבר לממשק אחר"; logout clears the role |
| 74 | Admin settings save | `/admin/settings` → change the general section → save | "ההגדרות נשמרו בהצלחה!" and `site_settings.updated_by` = the admin's auth id |
| 75 | OTP link | request a code on the phone, tap the link in the WhatsApp message | the login opens with the phone and code filled in and verifies by itself |
| 69 | Admin acts as a creator | sign in with an admin-type account that has a creator profile | feed relations, `/connections`, `/messages` and badges show only that account's own connections; the product page shows the account's own heart; notification taps go to product/connection/chat — never to `/admin` (only `feedback_received` does) |
| 70 | Equal card heights | feed with products with/without description or image | all cards in a row have the same height; the description area keeps two lines; the footer sits at the bottom |
| 71 | Drive product images | product with a Google Drive share link or `uc?export=view` link | rendered via `lh3.googleusercontent.com/d/<id>=w1200` on feed, product page, chat header, brand gallery and connection modal (file must be shared "anyone with the link"); the page carries `<meta name="referrer" content="no-referrer">` — Google rejects these images when a Referer is sent |
| 67 | In-app report | profile → "צור קשר / דיווח על תקלה" → send a bug with subject + details | 201; the row appears under "הפניות שלי" as חדש; every admin gets a `feedback_received` notification linking to `/admin/feedback`; a 6th report within an hour → 429 |
| 68 | Admin handles a report | `/admin/feedback` → note + "בטיפול" / "סגירה" | status + note saved (`activity_log` `admin_update_feedback`); the reporter gets `feedback_updated` with the status and the note; the note shows under the report in the user's profile |
| 65 | Feed paints once | cold-load `/feed` (cleared session storage) with a creator that has categories and hearts | skeletons until products + profile + relations are in, then the final grid and strip appear together — no chip flip, no card reorder; revisits render instantly from cache |
| 66 | No duplicate requests | open the feed with devtools → Network | `/api/profile` requested once per screen (bottom nav + page share the in-flight request; a second screen within 2 s uses the cache) |
| 64 | Brand journey view | `/brand/connections` active tab, and a card's modal | compact timeline per active card and a full one in the modal, worded for the brand (ship → waiting for receipt → review); pending/closed connections show none |
| 63 | Notification deep links | tap rows of different types as creator and as brand | creator: product page (rows with `productId`) or `/connections?open=…`; brand: `/brand/connections?open=…` opens the connection's modal; match → chat; takedown → profile; `notification-links.test.ts` |

## QA run — 2026-11-04 evening (creator interface rework, local production build of `715c5da`, QA accounts only)

API level (`qa-creator.sh`, `qa-upload.sh` in the session scratchpad; cookie jars of the two QA accounts): brand region PUT/validation; products with the new brief keys (unknown keys dropped); creator pass → hidden / reset → back / brand 403 / unknown 404; heart → heart back → confirm (credit 7→8) → chat opens with the brief card v1; brand cannot approve (403), creator approves (event in her name, `ship_deadline`, brand `brief_approved`), approving twice → 400; brand re-posts → v2, approval reset, creator `brief_updated`; ship with tracking → system event; delivered → "קיבלתי את החבילה" + `film_deadline`; upload #1 straight to Storage + `save-connection` → video card (signed url + poster), `review_deadline` +7 d; revision → video `revision_requested`, event "דרוש שינוי: …", creator `revision_requested`; upload #2 → round 2 final, `review_deadline` +24 h; second revision → 400; cron with the window moved into the past → `completed`, both videos approved, closing message, brand `connection_completed`.

Browser (Chrome extension on `localhost:3100`): creator feed deck (card, tags incl. 📍 region, ❤️ / ✕ / פרטים, counter), filter popup (DOM), "המוצרים שבחרתי", connections lists (בתהליך with a brand heart card, הסתיימו), chat (brief v1 "הוחלף", v2 card with "אישרת את הבריף", events, status strip, upload button; after the revision: video card with "נדרש שינוי", the brand's note, "העלאת הגרסה המתוקנת"), notifications (icons; the revision row opens `/messages?connection=…`); brand chat ("ממתינים לאישור הבריף" + "עדכון הבריף" → brief screen with `?connection=` → save posts v2 → after the creator's approval "📦 המוצר נשלח" → modal with tracking → "המוצר בדרך"), brand products / connections pages. Two polish fixes came out of it (pencil on change-request events, one next-step line in the chat strip). Not covered: the hook's file picker through automation (the `file_upload` shortcut bypasses the upload button, so the API path was used), real OTP, admin screens. Test data removed afterwards (QA products deleted, test connection cancelled, QA brand credits back to 7/10).

## Release QA run — 2026-11-03 (browser, local production build)

How it was run: `npm run build` then `npm start -- -p 3100` from `app/` with the env passed to the process only (dev-login gate `ADMIN_LOGIN_PHONE`/`ADMIN_LOGIN_PASSWORD` set to local-only values, `NODE_ENV=production`, `ALLOW_DEV_LOGIN=true`), against the live database using only the two QA accounts. The hidden gate opens with 5 taps on the login title; the gate values and `CRON_SECRET` used here are not the production ones.

| Journey | Result | Checks |
|---|---|---|
| Creator: gate login → feed heart → profile upload modal (50 MB hint, oversize file rejected with the message) → chat send → closed chat is read-only → notifications mark-read → logout | pass | 36, 43 |
| Brand: gate login → creator gallery → product create / edit / delete via the form (brief, `max_creators`) → approve heart (match, credit 7/10) → ship with tracking | pass | 44, 47 |
| Creator confirms delivery → uploads the deliverable with progress (`uploaded`) | pass | 36, 40 |
| Brand requests a revision with notes (1/2 shown) → creator sees the notes and re-uploads → brand approves → `completed`, both videos `approved`, closing message, notifications to both | pass | 40, 41, 42 |
| Brand sends a chat message on an active connection | pass | — |
| Dev-login rate limit after 10 attempts / 15 min | 429 shown as expected | 32 |
| WhatsApp OTP registration / login | **not run locally** (needs GreenAPI keys) — owner smoke test after deploy | 30, 50, 51 |
| Admin moderation / settings | **not run** (no admin test account by design) — owner after deploy, or temporarily promote a QA account | 29, 38, 39, 45 |

Observations (not blockers, listed in `docs/STATUS.md` B5): completion approves the superseded deliverable as well; product delete has no confirmation; the 429 copy says "a minute".
