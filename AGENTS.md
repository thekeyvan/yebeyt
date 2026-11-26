# yebeyt · agent guide

This file is the one source of rules for every coding agent on this repo: Claude Code, Codex and GitHub Copilot. `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

yebeyt («یه بیت») is a Persian poetry app with games, friends and messages, in a sticker style. It is being built **from scratch** as a monorepo: iOS first, then the server, the website and links; a web app, an admin dashboard and Android come later. No earlier code or user data is carried over (the old 1.0 app was never distributed; it lives only in git history, `main` before the foundations slice). The design and every product decision are in [docs/yebeyt-2.md](docs/yebeyt-2.md). Read that before planning any work. What only the owner can do (DNS, cloud consoles, device tests) is listed in [docs/owner-todo.md](docs/owner-todo.md).

## Repo map

Folders are added only when their first slice lands.

| Path | What |
|---|---|
| `apps/ios/` | SwiftUI app (iOS 17+, Swift 6, XcodeGen `project.yml`, targets `Yebeyt`, `YebeytTests` (unit) and `YebeytUITests` (UI; `xcodebuild test` runs both), bundle id `com.yebeyt.app`) |
| `apps/server/` | Backend at api.yebeyt.com: TypeScript, Hono, Postgres, Drizzle (migrations in `drizzle/`, applied on start), Zod/OpenAPI; Sign in with Apple and Google, usernames, guest-progress carry-over, poet pictures. WebSocket for live games comes in slice 7. Hosted on Railway (`Dockerfile`; `main` deploys by itself; env vars and deploy in its `README.md`) |
| `apps/web/` | Next.js (App Router, TypeScript, React Server Components) at yebeyt.com: home, privacy, terms and support, in Persian (`/`, `/privacy`, …) and separately in English (`/en`, `/en/privacy`, …; two root layouts, `app/(fa)` and `app/(en)/en`, give `<html lang dir>`; `global-not-found.tsx` is the Persian 404), the link pages `/c/<code>` `/i/<username>` `/g/<code>` (they read the server's public endpoints; `API_URL` env, default the Railway URL), `/.well-known/apple-app-site-association`. Fonts are copied from `assets/fonts` at build; `app/tokens.css` is generated from the tokens. Hosted on Railway (`Dockerfile`, standalone output; `www` is redirected to the apex by `proxy.ts`) |
| `apps/webapp/` | The web app at app.yebeyt.com (plan and slices in [docs/web-app.md](docs/web-app.md)): Next.js App Router, TypeScript, Tailwind v4 themed from the tokens, UI SDK (headless behaviours), Motion; mobile first. Hosted on Railway (service `webapp`) |
| `apps/admin/`, `apps/android/` | (later) Admin dashboard (Next.js), Android (Kotlin + Jetpack Compose) |
| `.railway/` | `railway.ts`: Railway infrastructure as code for the project (services, Postgres, builds, health check, domain). `railway config plan` / `apply`; variables stay in Railway |
| `packages/tokens/` | `tokens.json`: the one source of colours, fonts and sticker sizes. `tools/make_tokens.py` writes the platform files from it (Swift for iOS, `apps/web/app/tokens.css`, the web app's Tailwind theme `apps/webapp/app/theme.css`) |
| `packages/api/` | `openapi.json`: the OpenAPI contract, written from the server's routes by `api:generate` (never edit by hand); clients for each platform are generated from it |
| `assets/fonts/` | Every font file and its licence (`licenses/`). Apps take the fonts they use from here |
| `design/canvas/` | The design: one HTML file per screen in `project/`, the scripts that make them, and their `README.md` |
| `tools/` | Scripts: tokens (`make_tokens.py`), agent roles, the placeholder app icon (`make_icon.swift`), and `ganjoor/build.py`, the poetry pipeline: it reads github.com/ganjoor/ganjoor-data at one pinned commit and `ganjoor/curation.json`, and writes `apps/ios/Yebeyt/Resources/Data/` (`poets.json`, the bundled `book-<id>.json` files, `library.json`, one `index-<catId>.json` per library book and `games.json`, the game deck of well-known couplets with meanings; download cache in `tools/ganjoor/.cache`, gitignored) |

JavaScript and TypeScript packages share one pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) with Turborepo (`turbo.json`).

## Build and check

- iOS (needs a Mac with Xcode 26 or later and `brew install xcodegen`):
  ```bash
  cd apps/ios && xcodegen generate
  xcodebuild test -project Yebeyt.xcodeproj -scheme Yebeyt -destination 'platform=iOS Simulator,name=iPhone 17'
  ```
  Use any simulator from `xcrun simctl list devices available`.
- TestFlight: `tools/testflight.sh` archives `main` and uploads it (Xcode must be signed in to team 95YDC2AP63; the build number is the date and time). It refuses a dirty tree or a HEAD other than the latest `origin/main` unless `--force` is passed. Builds appear in App Store Connect → TestFlight after processing; add them to the «K&S Team» group.
- Tokens: after editing `packages/tokens/tokens.json`, run `python3 tools/make_tokens.py`; `python3 tools/make_tokens.py --check` fails when a generated file is out of date. Never edit generated token files by hand.
- Poetry data: `python3 tools/ganjoor/build.py` rebuilds `apps/ios/Yebeyt/Resources/Data` from ganjoor-data (pinned commit in `build.py`, `--sha` overrides; downloads are cached in `tools/ganjoor/.cache`). `python3 tools/ganjoor/build.py --check` fails when the committed files are out of date, and `python3 -m unittest tools/ganjoor/test_build.py tools/ganjoor/test_library.py tools/ganjoor/test_games.py tools/ganjoor/test_clips.py tools/ganjoor/test_silence.py` runs the pipeline's tests. Recitation counts (the popularity in the indexes) come from the committed snapshot `tools/ganjoor/recitations.json` ({poemId: count}, sorted): a normal build and `--check` read only it and never call the network. `python3 tools/ganjoor/build.py --refresh-recitations` is the only thing that queries api.ganjoor.net (one query per category, downloaded into `tools/ganjoor/.cache/audio`, which a refresh clears first); it rewrites the snapshot and then builds, so commit both together. Never edit the generated data by hand. The listen clips of the deck's Hafez couplets (`clip` in `games.json`: recitation id, start, end in seconds) likewise come from the committed snapshot `tools/ganjoor/clips.json` (a couplet key → `{recitation, start, end}`, or `null` when no clean silence was found and the app keeps its margin rule); a normal build and `--check` read only it (and `--check` fails when the deck has a Hafez couplet the snapshot doesn't know, so a deck change, which `--refresh-recitations` can cause, needs `--refresh-recitations --refresh-clips` in one run). `python3 tools/ganjoor/build.py --refresh-clips` is the only thing that downloads audio: for each such couplet it takes the recitation the app will use (the poem's first in sync with the text, asked live from api.ganjoor.net), downloads its mp3 and timing file into `tools/ganjoor/.cache/clips` (gitignored), decodes it with macOS `afconvert` (no ffmpeg), finds the silence between the hemistichs in 20 ms energy windows (`silence.py`, `clips.py`), rewrites the snapshot and a CSV report (`.cache/clips-report.csv`), then builds; commit the snapshot and `games.json` together. Only times are stored, never audio. Tests: `python3 -m unittest tools/ganjoor/test_clips.py tools/ganjoor/test_silence.py` (synthetic audio, no network).
- Server and other TypeScript (Node 22 or newer, pnpm 12; from the repo root):
  ```bash
  pnpm install
  pnpm -r typecheck
  pnpm -r test                                # vitest; the database is in-process PGlite, no network
  pnpm --filter @yebeyt/server api:check      # fails when packages/api/openapi.json is stale; fix with api:generate and commit
  pnpm --filter @yebeyt/server build
  pnpm --filter @yebeyt/web build            # Next.js; `pnpm --filter @yebeyt/web dev` runs it on :3000, `start` serves the build
  pnpm --filter @yebeyt/webapp dev           # the web app on :3000 (the debug page of every component is /dev/stickers)
  pnpm --filter @yebeyt/webapp build
  pnpm --filter @yebeyt/webapp test          # Vitest and Testing Library
  pnpm --filter @yebeyt/webapp e2e           # Playwright (Chromium and WebKit; 375×667, 390×844, 1280×800) against `next build && next start`; once: `pnpm --filter @yebeyt/webapp exec playwright install chromium webkit`
  ```
  The web app's link pages call the server: set `API_URL` (e.g. `API_URL=http://localhost:8080`) to point them at a local one. The App Store id is `6837700208`; put it in `apps/web/lib/config.ts` (`APP_STORE_ID`) only when 2.0 is live on the store, since before that the id has no store page.
  After editing `apps/server/src/db/schema.ts` run `pnpm --filter @yebeyt/server db:generate` and commit the new file in `apps/server/drizzle/`. Env vars, local run, the picture upload script and the Railway deploy are in `apps/server/README.md`.
- Design canvas: see `design/canvas/README.md`. Edit the `gen_*.py` scripts, never the boards by hand.
- Debug launch arguments open a screen directly, which helps for simulator screenshots: `-beytTab home|explore|games|messages|me`, `-beytUnread <n>` (unread badge), `-beytRoute stickers` (the sticker sheet), `-beytRoute poem:<path>` (the reader, e.g. `poem:/hafez/ghazal/sh3`) with `-beytCouplet <n>` (0-based), `-beytMode scroll`, `-beytSheet text`, `-beytMeaning 1`, `-beytHold <n>`. The library routes `-beytRoute library|book:<path>|section:<path>|poet:<slug>|search:<query>|mood:<key>|poets` open the کاوش tab with those screens pushed (`book:/hafez`, `section:/hafez/ghazal`, `poet:hafez`, `mood:love`). `-beytFresh 1` first forgets what the phone has kept (reading progress, marks, follows, rejected couplets, game stats); the UI tests use it. The game routes `-beytRoute games-catalog|daily|jigsaw|jigsaw-result|round-end|poet-game|second|book-game|match|listen` open the بازی tab with the catalog, or a game in front (`jigsaw-result` shows the after-answer sheet of the 4th couplet, `jigsaw-wrong` a couplet filled with one wrong sticker (with `-beytSheet answer` already checked, so the wrong couplet's sheet is open), `round-end` the end-of-round screen); `-beytPlay <n>` plays first (`daily`: n wrong tries; `jigsaw`: n right couplets, then a sticker in hand; `poet-game`, `second`, `book-game`, `listen`: n questions answered, then an option chosen, and with `-beytSheet answer` the last answer's sheet left open; `match`: n pairs, then a word in hand); `-beytStub 1` gives `listen` canned recitations (no network, no sound); `-beytToday <yyyy-mm-dd>` fixes the Tehran day the daily puzzle and streak use. Each slice adds its own and lists them here. Accounts: `-beytOnboarding welcome|taste|game|account|username|friends` starts onboarding at that screen (a debug launch skips onboarding without it; a release build shows it on the first launch), `-beytGate likes|messages` opens the account gate, `-beytSignedIn 1` is a fake sign-in answered on the phone (no network), `-beytAPI <url>` points the app at another server; `-beytFresh 1` also signs out and forgets the taste and the onboarding flag. Me: `-beytRoute me|divan|privacy|avatar|invite|settings|badges` opens the من tab (`me` is the profile) with that screen pushed, and `-beytSeedDivan 1` first keeps 20 sample couplets of the bundled books on different days (`-beytGate` also takes `invite|profile`); `-beytSyncFails 1` (with `-beytSignedIn 1`) makes the fake server refuse the divan, for the sign-out warning. Feedback: `-beytFeedback shake|bug|annoyed|idea|game|liked` opens that sheet or form over the first screen with a made-up screenshot (`shake` is the sheet of choices; `recording` shows the recording pill), `-beytFakeRecorder 1` (on its own, independent of the fake-server arguments and of `-beytFeedback`; it only swaps the recorder) stands a fake recorder in for ReplayKit (the form's record button starts at once, the pill's «تموم» keeps a 3-second file), and `-beytShakeButton 1` adds a thin invisible strip on the screen's edge (identifier `debugShake`) that delivers a shake to the key window, keyboard up or not, for UI tests; `-beytFeedbackFails offline|rate` makes the fake server fail sending; both switch on the fake server for reports, as `-beytSignedIn` does. Friends: `-beytRoute people|people:<text>|person:<username>|leaderboard|friends` open «پیدا کردن دوست» (with `<text>` in the field) or a person's page on the خونه tab, رده‌بندی on the بازی tab, or my friends on the من tab, `-beytBoard league|friends|global` picks the leaderboard's first tab, and the fake sign-in also answers friends, friend requests (two waiting for me, one I sent; `person:aryan` asked me, `person:paria` I asked, `person:raha` nothing yet, `person:kian_k` a friend; the friends list and the search also hold the demo friend «یه بیت», `yebeyt`, with `canPlay: false`), scores, reactions, the leaderboard and the feed on the phone (`Debug/FriendsBackend.swift`). Messages: `-beytRoute inbox|requests|chat:<username>|shared:<username>` opens the پیام‌ها tab (the inbox, the friend requests, a chat, or the divan shared with that person) and, with `-beytSignedIn 1`, is answered on the phone by a stub of five friends (`sara.ghazal`, `aryan`, `kian_k`, `mahsa.m`, `bardia`, the friends stub's people; `chat:yebeyt` is the demo friend's chat, which has no game chips; `chat:sara.ghazal` has a couplet card, text bubbles, «دیده شد» and a game line, `chat:kian_k` a shared-divan line; `shared:sara.ghazal` has 24 couplets); `-beytLive 1` lets the fake live socket send a message from Sara a moment after launch, and `-beytDivanSheet 1` opens the sheet of «به دیوان مشترک» (`-beytRoute poem:<path> -beytHold <n>` shows it in the hold menu). Playing with friends: `-beytRoute lobby|mosh|duel|challenge-send|challenge:<code>` opens «بازی با دوست», PlayMosh (a game with Sara where it is my turn, with the stub's `chat:sara.ghazal` card and a مشاعره card on the بازی tab), PlayDuel (round four of five, played out by fake live events: a right answer wins the round), the end of a جورچین round with the challenge card, or the board of a challenge (`challenge:7KQ2` is ten couplets by Saadi, 8 of 10) over the first screen; they want `-beytSignedIn 1`, and `-beytPlayStub 1` makes the phone answer for the server without a fake sign-in (a guest opening `challenge:7KQ2`; with `-beytPlay <n>` its round is played out at once and a name is asked).

## Rules

Product:
- Everything the user sees is Persian and right-to-left. Use the everyday Persian word wherever one exists (رده‌بندی, not لیدربورد; پیام‌ها, not دایرکت).
- The app works **without an account**: reading, library, search, fal, listening, solo games, the divan on the phone. Only features with a server behind them (scores, leaderboard, streak, playing with friends, messages, sync) ask for an account, at the moment they are used, never up front.
- Sign-in is **only Apple and Google**. No email or phone sign-up.
- No religious symbols anywhere in icons or art (no crescent, star, mosque shapes, calligraphy of holy names).
- Feedback reports follow the privacy rules in `docs/yebeyt-2.md`. Never send typed text from elsewhere, messages, phone number, IP or location. Any view that shows typed text or message text carries `.feedbackPrivate()`: it is blanked in feedback screenshots and covered while a recording runs.

Code and data:
- Keep files small and simple. No dead code, no speculative abstractions. Handle errors at the boundaries.
- Never commit secrets: `apps/ios/Config/Local.xcconfig`, `.p8` keys, tokens, `.env` files. Never commit user data or Ganjoor reader comments.
- Poetry data comes from Ganjoor's public repositories (github.com/ganjoor). Fonts and poetry data keep their own licences; add any new font to `assets/fonts/` with its licence in `assets/fonts/licenses/` and a row in `THIRD_PARTY_NOTICES.md`.
- Host every service on Railway (server, web, admin, databases).

Git:
- Commit with the GitHub no-reply address. On a new machine, once: `git config user.email 5063636+thekeyvan@users.noreply.github.com`.
- Never commit straight to `main`. One branch per slice (`feat/<slice>`, `fix/<what>`), short imperative commit subjects like the existing history.
- Merge into `main` (fast-forward), push and delete the branch **only when the user says so**.

## How we work: three tiers

Every tool runs the same three roles, each pinned to a model tier. The person's main conversation is the **lead**.

| Tier | Role | Does |
|---|---|---|
| High | **lead** (main conversation) | Plans, writes briefs, design and product decisions, research, debugging analysis, docs, talks to the user. Does not write product code |
| High | **reviewer** | Every code review. The only one who may call a review clean. Never edits |
| Mid | **builder** | All code: tests first, then the change, then the fix rounds after a review |
| Small | **mechanic** | Build and CI logs, simple union merge conflicts, status and doc edits, waiting on checks |

The loop for each slice:

1. **lead** picks the next slice (see the order in `docs/yebeyt-2.md`, and confirm it with the user), creates the branch, and writes the builder a brief: the screens (by board file in `design/canvas/project/`), the files to touch, the behaviour, acceptance criteria, and how to build and test.
2. **builder** builds it test-first on that branch, runs the checks, commits, and reports.
3. **reviewer** reviews the branch against the brief and these rules, and lists findings as `must-fix`, `should-fix` or `judgement`.
4. **builder** fixes exactly those findings. At most two fix rounds, then one review-only round. Only the reviewer says `clean on <sha>`.
5. **lead** tells the user what landed, shows proof (test output, simulator screenshots), and merges and pushes only on the user's word.

Small non-code edits (docs, notes, config text) can stay with the lead.

Where each tool keeps the roles. All of these files are written by `tools/make_agent_roles.py` from one text: change a role there and run `python3 tools/make_agent_roles.py`, never edit the copies by hand.

| Tool | Role files | Lead |
|---|---|---|
| Claude Code | `.claude/agents/{builder,reviewer,mechanic}.md` (models by alias: `opus`, `sonnet`, `haiku`) | the main conversation, on `opus` (`.claude/settings.json`) |
| Codex | `.codex/agents/{builder,reviewer,mechanic}.toml` | the main session, model set in `.codex/config.toml` (the project must be trusted for Codex to read `.codex/`) |
| GitHub Copilot | `.github/agents/{lead,builder,reviewer,mechanic}.agent.md` | pick the **lead** agent in the chat's agent picker; it calls the other three as subagents |

Codex and Copilot have no model aliases, so their files name versioned models. When a newer model ships, update the model lines in those files.
