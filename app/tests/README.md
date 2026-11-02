# Tests

## Unit tests (no services required)

```
npm test
```

Runs `tests/**/*.test.ts` with Node's built-in runner (`node --test`, TypeScript via `--experimental-strip-types`, Node ≥ 22.6). No extra dependencies.

`authz.test.ts` covers the pure authorization rules used by the API routes: registration role whitelist, profile field allowlists, connection participation, public product projection, dev-login availability.

`match-errors.test.ts` covers the mapping of `match_connection()` database errors (`NO_CREDITS`, `CONNECTION_NOT_PENDING`, …) to API responses and the Postgres unique-violation detection used for duplicate hearts.

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
