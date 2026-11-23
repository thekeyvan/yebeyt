# yebeyt server

The backend at **api.yebeyt.com** (Railway): Hono, Postgres with Drizzle, Zod. The HTTP contract is `packages/api/openapi.json`, written from the code (see "The contract").

Sign-in is Apple or Google only. The server keeps the provider's account id, the username and an optional display name (the name the person chose to show; it is never read from the provider's token), and nothing else about the person: no email, no IP. Logs are one line per request (method, route pattern, status, ms).

## Commands

Run from the repo root (Node 22 or newer, pnpm 12):

```bash
pnpm install
pnpm -r typecheck
pnpm -r test                                   # vitest; Postgres runs in-process (PGlite), no network
pnpm --filter @yebeyt/server api:check         # fails when packages/api/openapi.json is stale
pnpm --filter @yebeyt/server api:generate      # rewrites it; commit the result
pnpm --filter @yebeyt/server build             # tsc → apps/server/dist
pnpm --filter @yebeyt/server db:generate       # after editing src/db/schema.ts: writes a migration into drizzle/ (commit it)
```

Migrations in `drizzle/` are applied every time the server starts.

## Environment

All are checked at start; a missing or malformed one stops the server with a message naming the variable (never its value).

| Variable | What |
|---|---|
| `DATABASE_URL` | `postgres://…` (Railway's Postgres plugin provides it) |
| `JWT_SECRET` | 32+ random characters. Signs access tokens (HS256); the key that seals the stored Apple refresh tokens is derived from it. Changing it signs everyone out and makes stored Apple tokens unreadable (account deletion then skips the Apple revoke for them) |
| `APPLE_BUNDLE_IDS` | comma list of accepted audiences, e.g. `com.yebeyt.app` |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID` | for the client-secret JWT sent to Apple (code exchange and revoke) |
| `APPLE_PRIVATE_KEY` | the `.p8` PEM; `\n` escapes are accepted so it fits on one line |
| `GOOGLE_CLIENT_IDS` | comma list of accepted OAuth client ids (the iOS one, later the web one) |
| `ADMIN_TOKEN` | 16+ random characters; the Bearer token for `/v1/admin/*` |
| `PORT` | default 8080 (Railway sets it) |

## Local development

The tests need nothing installed. To run the server itself you need a Postgres (any 14+) and a `DATABASE_URL`:

```bash
createdb yebeyt
export DATABASE_URL=postgres://localhost/yebeyt JWT_SECRET=$(openssl rand -hex 32) \
  APPLE_BUNDLE_IDS=com.yebeyt.app APPLE_TEAM_ID=TEAMID1234 APPLE_KEY_ID=KEYID12345 \
  APPLE_PRIVATE_KEY="$(awk 'NF{printf "%s\\n",$0}' AuthKey_XXXX.p8)" \
  GOOGLE_CLIENT_IDS=x.apps.googleusercontent.com ADMIN_TOKEN=$(openssl rand -hex 16)
pnpm --filter @yebeyt/server dev        # tsx watch on :8080
curl localhost:8080/health
```

Without a local Postgres, PGlite can stand in as a server: `npm i @electric-sql/pglite @electric-sql/pglite-socket` in a scratch folder, start `new PGLiteSocketServer({ db: await PGlite.create(), port: 54329 })` and use `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres`. (Real Apple/Google sign-in needs real tokens and the real keys; the tests use locally generated ones.)

## Endpoints

`/health`, `/v1/auth/{apple,google,refresh,logout}`, `/v1/me` (GET, DELETE), `/v1/me/profile`, `/v1/me/username`, `/v1/me/avatar`, `/v1/me/progress`, `/v1/me/divan` (merge-sync of kept couplets), `/v1/me/privacy`, `/v1/usernames/{check,suggestions}`, `/v1/poets/pictures`, `/v1/poets/{slug}/picture`, `/v1/admin/poets/{slug}/picture`, `/v1/feedback` (+ `/{id}/screenshot`, `/{id}/recording`), `/v1/admin/feedback` (+ `/{id}/screenshot`, `/{id}/recording`). Details, bodies and error codes are in `packages/api/openapi.json`. Errors are `{ "error": "<code>" }` (e.g. `username_taken`, `username_change_too_soon` with `allowedAt`); the apps turn codes into Persian copy.

Sessions: access token = JWT, 15 minutes; refresh token = random 32 bytes, stored as a sha256, 60 days, single use (rotated on every refresh). Showing a used refresh token again revokes that whole sign-in, unless it was used less than 10 seconds ago (a client retrying or racing itself): then that call is just refused (401) and the sign-in stays. Apple sign-in requires the raw `nonce` (the identity token must carry its sha256). JSON bodies are limited to 64 KB; the divan sync to 1 MB (2000 items); the admin picture upload to 15 MB. A user can keep at most 20 000 divan rows (kept or removed); past that a PUT that adds new keys gets 413 `divan_full` (a soft limit: two parallel requests can go slightly over).

## Feedback

`POST /v1/feedback` takes a report of one of five types (`bug`, `annoyed`, `idea`, `game`, `liked`); sign-in is optional (a token that is sent must be valid, else 401). The fields allowed per type are in the contract (e.g. `technical` only on bug, `screen` only on bug and annoyed, a `game` idea only on game); the body is limited to 32 KB and unknown keys, also inside `technical`, are refused. App version, phone model and OS version are required on every type. The server stores the text and these fields, the user id when signed in, and nothing about the connection: no IP, location or device id (logs hold only method, route, status, ms). The answer carries an `uploadToken` (random 32 bytes, only its sha256 is stored) valid 15 minutes for `PUT /v1/feedback/{id}/screenshot` (JPEG or PNG, 3 MB; bug, annoyed, idea) and `/recording` (MP4, 25 MB; bug), sent as `X-Upload-Token`. The first bytes must match the declared type (PNG, JPEG, MP4), else 415. One file per kind (a second gets 409 `already_uploaded`). Attachment budget per hour, in memory: 200 MB per signed-in user and 500 MB for all guests' reports together (429 `rate_limited`); at most 3 uploads are handled at once, the rest get 503 `busy` with `Retry-After`. Files are stored in Postgres (`feedback_attachments`, bytea) for now; moving them to object storage is later work.

Rate limits, in memory (they restart with the server): 10 reports an hour per signed-in user; all guests together share 120 an hour (429 `rate_limited`).

`GET /v1/admin/feedback?type=&before=` (admin token) lists newest first, 50 a page, with the username when there is one and each attachment's kind and size; `nextBefore` is the cursor for the next page. `GET /v1/admin/feedback/{id}/screenshot|recording` downloads the file as an attachment. Deleting an account keeps its reports as anonymous feedback (`user_id` becomes null); the attachments stay too.

## The contract

`packages/api/openapi.json` is generated by `scripts/openapi.ts` from the route definitions; never edit it by hand. After changing a route, run `api:generate` and commit it. `api:check` (and a test) fail when it is out of date.

## Poet pictures

Stored in Postgres (`poet_pictures`), served with `ETag` and a day of caching. Upload from `design/poets`:

```bash
API_URL=http://localhost:8080 ADMIN_TOKEN=… pnpm --filter @yebeyt/server pictures:upload design/poets
pnpm --filter @yebeyt/server pictures:upload design/poets --dry-run   # resize only, upload nothing
```

The script takes `poet-<name>.png`, maps the name to the Ganjoor slug (`rumi`→`moulavi`, `ferdowsi`→`ferdousi`, `rudaki`→`roodaki`, the rest are the same), checks the slug against `apps/ios/Yebeyt/Resources/Data/poets.json`, resizes to 512×512 WebP quality 82 (WebP keeps the transparent background) and uploads. Files whose poet is not in `poets.json` (today akhavan, forough, nima, shamlou, sohrab) are skipped and listed.

## Deploy (Railway)

The Dockerfile builds from the **repo root** (it needs the lockfile and the workspace files):

The Railway project (services, the Postgres, builds, health check, the custom domain) is described in `.railway/railway.ts` at the repo root. The `server` service is connected to this repo: every push to `main` that touches the server, `packages/` or the workspace files builds `apps/server/Dockerfile` and deploys it, with `/health` as the health check. Environment variables are not in the file (`variables: { managed: false }`); they live only in Railway.

- Preview a change to the infrastructure: `railway config plan` (from the repo root, after `railway link`). Apply it: `railway config apply`.
- A manual deploy of the working tree: `railway up --service server` from the repo root.
- api.yebeyt.com is a custom domain on the service; Cloudflare holds the CNAME.

Local image check, if Docker is available: `docker build -f apps/server/Dockerfile -t yebeyt-server .`
