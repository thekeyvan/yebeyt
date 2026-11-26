# yebeyt web app

The web app does everything the iOS app does, so people can read and play in a browser. It lives at **app.yebeyt.com**. yebeyt.com stays the website: the home page, privacy, terms, support, `/en` and the link pages.

## Decisions (owner, 26 Nov)

- **Web first.** The web app comes before the rest of the iOS work: 9b (Universal Links, App Clip, deferred links, invite rewards) and push wait until it's done. App Store prep (listing, screenshots, review notes) goes on alongside it, because it is mostly not code.
- **Separate app on a subdomain.** `apps/webapp` (`@yebeyt/webapp`), Next.js App Router with TypeScript. It is its own Railway service `webapp` with the domain `app.yebeyt.com` (Railway URL https://webapp-production-529c90ac.up.railway.app) and is deployed from `main` like the others. Railway's config can't register a custom domain, so it was added with `railway domain app.yebeyt.com --service webapp --port 8080`. The link pages on yebeyt.com get a «روی وب بازی کن / بخون» button into the web app.
- **Mobile first.** On a phone, each screen follows its iOS board in `design/canvas/project/`. Wider screens use the standard responsive patterns, with no new boards:
  - from 768 px, the content is a centred column (max 560 px; reader and games 640 px) on the dotted paper;
  - from 1024 px, the bottom tab bar becomes a right-hand side rail (RTL);
  - from 1024 px, messages and the library show list and detail side by side;
  - bottom sheets become centred dialogs at ≥ 768 px, with the same content.
- **Design system: Tailwind v4 + UI SDK + Motion, with our own sticker components.**
  - The Tailwind theme (`@theme`) is generated from `packages/tokens/tokens.json` by `tools/make_tokens.py`, like the Swift and CSS files: colours, fonts, sticker border widths, radii and shadows. Never hand-edit it.
  - Behaviour and accessibility come from **UI SDK** (`@ui-sdk/react` + `@ui-sdk/core`, github.com/vercel-labs/ui, Apache-2.0; owner, 26 Nov). It is headless, so the look stays ours. It covers drawer (drag to close, snap points), dialog/alert-dialog, tabs, toast, menu, segmented control and slider, and it reads `direction: rtl`. It is in beta, so the exact version is pinned and upgraded only on purpose. If it fails W0's sheet/RTL tests, the fallback is Radix + vaul.
  - The look is ours, in `components/ui/` (Sticker card, Button, Badge, WordSticker, IconBox, Sheet, ConfirmSheet, Tabs, Toast, TabBar).
  - Motion (`motion/react`) gives the same springs and pop-ups as `Design/Motion.swift`, and respects `prefers-reduced-motion`.
  - RTL first: `<html lang="fa" dir="rtl">`, logical properties only (`ms-`, `pe-`, `start`, `end`). Drag directions follow the finger.
  - Icons are the same SVG paths as on iOS (`Design/Icons.swift`, `LibraryIcons.swift`, …), ported once as React components.
- **Data.**
  - The bundled poetry files (`apps/ios/Yebeyt/Resources/Data`) are copied into the web app at build, like the fonts. Other poems load in the browser from the pinned ganjoor-data commit on raw.githubusercontent.com. Recitations load from api.ganjoor.net. Both allow the browser to read them (checked 26 Nov), so poetry needs no server.
  - What the phone keeps (divan, marks, follows, progress, stats, settings) the browser keeps in IndexedDB/localStorage, synced the same way once signed in.
  - The server's API is used as it is, through a client generated from `packages/api/openapi.json`.
- **Sign-in.** Only Apple and Google. Sign in with Apple JS needs an Apple **Services ID** (e.g. `com.yebeyt.web`) with app.yebeyt.com as its domain and return URL. Google Identity Services needs a **Web client id** with app.yebeyt.com as an origin. Both ids are added to `APPLE_BUNDLE_IDS` / `GOOGLE_CLIENT_IDS` on the server, which already accepts several.
  - The web app keeps the session in an httpOnly, Secure, SameSite=Lax cookie. It talks to the API through its own same-origin route (`/api/*`), so no token is readable by page scripts and the server needs no CORS.
  - The live socket (`/v1/live`) gets a short-lived access token from that route and sends it as its first message, as iOS does.
- **Feedback.** There is no shake on the web. A «بازخورد» item in the menu (and in settings) opens the same choices. The screenshot is taken in the browser, with `.feedbackPrivate()` views blanked. Screen recording uses the browser's screen-capture prompt where it exists, and is hidden where it doesn't.
- **Tests.** Vitest and Testing Library for logic and components. Playwright for flows, at 375×667 (SE), 390×844 and 1280×800, and it takes the screenshots that prove each slice.

## Every iOS feature, and the slice that brings it to the web

| Area | iOS today | Web slice |
|---|---|---|
| Shell | tab bar (خونه، کاوش، بازی، پیام‌ها، من) with unread badge, sticky headers, edge-swipe back, sheets with grabber and drag-to-close, confirm sheets, undo toasts, springs and per-action pop-ups (hearts, ribbons, arrows, plane, ticks, confetti), dotted paper | W0 |
| Reading | reader in couplet mode (swipe) and whole-poem mode, progress rail, «آ» text sheet (7 fonts, size, spacing), meaning card, long-press hold menu (keep, share, copy, send, shared divan), marks, reading progress, share card | W1 |
| Recitation | recitations from Ganjoor, player, the text follows the audio, start at a chosen couplet, jump on couplet change | W1 |
| Home | today's couplet (keep / reject with undo), the deck of couplets by taste, Persian date | W2 |
| Explore | poets, all poets, fal (Hafez), moods, search (normaliser, couplet corpus) | W2 |
| Library | library, book, section, poet page, follow a poet, poet pictures from the server | W2 |
| Solo games | معمای امروز (Tehran day, streak, tries), جورچین (drag stickers), شاعر کیه, مصراع دوم, کدوم کتاب, جفت‌ها, گوش کن (clip ends), after-answer sheet (wrong in red, right answer shown), end-of-round screen, my stats, the games catalog grid, leave-game confirmation | W3 |
| Accounts | Sign in with Apple and Google, username (rules, availability), guest progress carry-over, account gate when a server feature is used, onboarding (welcome, taste, game, account, username, friends) | W4 |
| Sync | divan sync, reactions, scores and streak sync | W4 |
| Me | profile, divan (by day), avatar editor (parts), invite friends (link, share), settings, privacy (what is kept, delete account), badges, blocked people, sign out (with the unsynced warning) | W5 |
| Friends | find people, friend requests (send, accept, cancel, reject), a person's page, the friends list, the demo friend «یه بیت», the feed with reactions, ردهبندی (league, friends, everyone) | W6 |
| Messages | inbox with unread, friend requests, chat (text, couplet cards, «دیده شد», game lines), couplet picker, live updates over WebSocket, shared divans (add, remove, live) | W7 |
| Playing with friends | «بازی با دوست» lobby, مشاعره (turns, letters, suggestions), live duel (rounds, live events), challenge send card and challenge board, playing a challenge as a guest | W8 |
| Feedback | bug, idea, annoyed, liked, game forms; screenshot with editor; recording; technical info; privacy blanking | W9 |

Not on the web: haptics (a pop-up only), shake, the App Clip, push (web push may come later as its own slice).

## Slices

Each slice is on its own branch (`feat/web-<name>`), built by **builder**, reviewed by **reviewer**, merged and deployed to app.yebeyt.com before the next starts.

- **W0 Foundations** (merged 26 Nov, 304eaea): `apps/webapp`, the Tailwind theme from the tokens, fonts, the sticker components, the shell (tab bar and side rail, five empty tabs, headers, sheet, confirm, toast, motion), Playwright, Dockerfile, the Railway service and domain.
- **W1 Reading**: poetry data loading, the reader in both modes, text sheet, meaning, hold menu, marks, recitation.
- **W2 Home, Explore, Library, Search.**
- **W3 Solo games.**
- **W4 Accounts and sync**: the web sign-in, username, gate, onboarding, carry-over, the typed API client, divan/scores/reactions sync.
- **W5 Me.**
- **W6 Friends and leaderboard.**
- **W7 Messages and shared divans.**
- **W8 Playing with friends.**
- **W9 Feedback.**
