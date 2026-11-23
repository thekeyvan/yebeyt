# yebeyt · agent guide

This file is the one source of rules for every coding agent on this repo: Claude Code, Codex and GitHub Copilot. `CLAUDE.md` and `.github/copilot-instructions.md` only point here.

yebeyt («یه بیت») is a Persian poetry app for iOS. Version 1.0 (a calm reader) is on the App Store. We are now building **yebeyt 2.0**: a sticker-style redesign with games, friends and messages. The design and every product decision for it are in [docs/yebeyt-2.md](docs/yebeyt-2.md). Read that before planning any 2.0 work.

## Repo map

| Path | What |
|---|---|
| `Yebeyt/` | SwiftUI app (iOS 17+, XcodeGen `project.yml`, target `Yebeyt`). `App/`, `Core/`, `Art/`, `Features/`, `UI/`, `Resources/` |
| `server/` | Backend at api.yebeyt.com: Hono + TypeScript + Postgres; Sign in with Apple and Google, divan sync. Hosted on Railway |
| `site/` | yebeyt.com (static, Cloudflare Pages): home, privacy, terms, support |
| `design/canvas/` | The 2.0 design: one HTML file per screen in `project/`, the scripts that make them, and their `README.md` |
| `tools/` | Scripts that build the bundled poetry data, icons and app icon |

## Build and check

- iOS (needs a Mac with Xcode 26 and `brew install xcodegen`):
  ```bash
  xcodegen generate
  xcodebuild -project Yebeyt.xcodeproj -scheme Yebeyt -destination 'platform=iOS Simulator,name=iPhone 17' build
  ```
  Use any simulator from `xcrun simctl list devices available`. The unit test target is not there yet; adding it (`YebeytTests` in `project.yml`, run with `xcodebuild test`) is the first 2.0 slice.
- Server: `cd server && npm ci && npm run build`. The server has no tests yet either; the slice that first changes it adds them (`node --test`).
- Design canvas: see `design/canvas/README.md`. Edit the `gen_*.py` scripts, never the boards by hand.
- Debug launch arguments open a screen directly, which helps for simulator screenshots: `-beytSkip YES`, `-beytTab library|me`, `-beytRoute poem:<url>|mood:<key>|book:<url>|fal|search`, `-beytSheet poet:<slug>|share:<url>|font`.

## Rules

Product:
- Everything the user sees is Persian and right-to-left. Use the everyday Persian word wherever one exists (رده‌بندی, not لیدربورد; پیام‌ها, not دایرکت).
- The app works **without an account**: reading, library, search, fal, listening, solo games, the divan on the phone. Only features with a server behind them (scores, leaderboard, streak, playing with friends, messages, sync) ask for an account, at the moment they are used, never up front.
- Sign-in is **only Apple and Google**. No email or phone sign-up.
- No religious symbols anywhere in icons or art (no crescent, star, mosque shapes, calligraphy of holy names).
- Feedback reports follow the privacy rules in `docs/yebeyt-2.md`. Never send typed text from elsewhere, messages, phone number, IP or location.

Code and data:
- Keep files small and simple. No dead code, no speculative abstractions. Handle errors at the boundaries.
- Never commit secrets: `Config/Local.xcconfig`, `.p8` keys, tokens, `.env` files. Never commit user data or Ganjoor reader comments.
- Fonts and poetry data keep their own licences; add any new font's licence next to it and to `THIRD_PARTY_NOTICES.md`.
- Host services on Railway, never Vercel.

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
