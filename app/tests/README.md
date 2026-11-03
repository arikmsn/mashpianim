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
