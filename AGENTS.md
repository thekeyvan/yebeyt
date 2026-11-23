# yebeyt · agent guide

This file is the one source of rules for every coding agent on this repo: Claude Code, Codex and GitHub Copilot. `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

yebeyt («یه بیت») is a Persian poetry app with games, friends and messages, in a sticker style. It is being built **from scratch** as a monorepo: iOS first, then the server, the website and links; a web app, an admin dashboard and Android come later. No earlier code or user data is carried over (the old 1.0 app was never distributed; it lives only in git history, `main` before the foundations slice). The design and every product decision are in [docs/yebeyt-2.md](docs/yebeyt-2.md). Read that before planning any work.

## Repo map

Folders are added only when their first slice lands.

| Path | What |
|---|---|
| `apps/ios/` | SwiftUI app (iOS 17+, Swift 6, XcodeGen `project.yml`, targets `Yebeyt` and `YebeytTests`, bundle id `com.yebeyt.app`) |
| `apps/server/` | (slice 4) Backend at api.yebeyt.com: TypeScript, Hono, Postgres, Drizzle, Zod/OpenAPI, WebSocket for live games. Hosted on Railway |
| `apps/web/` | (slice 9) Next.js: yebeyt.com, the link pages `/c` `/i` `/g`, apple-app-site-association; later the web app. Hosted on Railway |
| `apps/admin/`, `apps/android/` | (later) Admin dashboard (Next.js), Android (Kotlin + Jetpack Compose) |
| `packages/tokens/` | `tokens.json`: the one source of colours, fonts and sticker sizes. `tools/make_tokens.py` writes the platform files from it |
| `packages/api/` | (slice 4) The OpenAPI contract; clients for each platform are generated from it |
| `assets/fonts/` | Every font file and its licence (`licenses/`). Apps take the fonts they use from here |
| `design/canvas/` | The design: one HTML file per screen in `project/`, the scripts that make them, and their `README.md` |
| `tools/` | Scripts: tokens, agent roles, poetry data from Ganjoor, icons and app icon |

JavaScript and TypeScript packages will share one pnpm workspace with Turborepo, added with the first such package.

## Build and check

- iOS (needs a Mac with Xcode 26 or later and `brew install xcodegen`):
  ```bash
  cd apps/ios && xcodegen generate
  xcodebuild test -project Yebeyt.xcodeproj -scheme Yebeyt -destination 'platform=iOS Simulator,name=iPhone 17'
  ```
  Use any simulator from `xcrun simctl list devices available`.
- Tokens: after editing `packages/tokens/tokens.json`, run `python3 tools/make_tokens.py`; `python3 tools/make_tokens.py --check` fails when a generated file is out of date. Never edit generated token files by hand.
- Server (from slice 4): its own tests run with the server's test command, documented in `apps/server/`.
- Design canvas: see `design/canvas/README.md`. Edit the `gen_*.py` scripts, never the boards by hand.
- Debug launch arguments open a screen directly, which helps for simulator screenshots: `-beytTab home|explore|games|messages|me`, `-beytUnread <n>` (unread badge), `-beytRoute stickers` (the sticker sheet). Each slice adds its own and lists them here.

## Rules

Product:
- Everything the user sees is Persian and right-to-left. Use the everyday Persian word wherever one exists (رده‌بندی, not لیدربورد; پیام‌ها, not دایرکت).
- The app works **without an account**: reading, library, search, fal, listening, solo games, the divan on the phone. Only features with a server behind them (scores, leaderboard, streak, playing with friends, messages, sync) ask for an account, at the moment they are used, never up front.
- Sign-in is **only Apple and Google**. No email or phone sign-up.
- No religious symbols anywhere in icons or art (no crescent, star, mosque shapes, calligraphy of holy names).
- Feedback reports follow the privacy rules in `docs/yebeyt-2.md`. Never send typed text from elsewhere, messages, phone number, IP or location.

Code and data:
- Keep files small and simple. No dead code, no speculative abstractions. Handle errors at the boundaries.
- Never commit secrets: `apps/ios/Config/Local.xcconfig`, `.p8` keys, tokens, `.env` files. Never commit user data or Ganjoor reader comments.
- Poetry data comes from Ganjoor's public repositories (github.com/ganjoor). Fonts and poetry data keep their own licences; add any new font to `assets/fonts/` with its licence in `assets/fonts/licenses/` and a row in `THIRD_PARTY_NOTICES.md`.
- Host every service on Railway (server, web, admin, databases), never Vercel.

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
