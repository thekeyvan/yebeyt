# yebeyt web app

The web app does everything the iOS app does, so people can read and play in a browser. It lives at **app.yebeyt.com**. yebeyt.com stays the website: the home page, privacy, terms, support, `/en` and the link pages.

## Decisions (owner, 26 Nov)

- **Web first.** The web app comes before the rest of the iOS work: 9b (Universal Links, App Clip, deferred links, invite rewards) and push wait until it's done. App Store prep (listing, screenshots, review notes) goes on alongside it, because it is mostly not code.
- **Separate app on a subdomain.** `apps/webapp` (`@yebeyt/webapp`), Next.js App Router with TypeScript. It is its own Railway service `webapp` with the domain `app.yebeyt.com` (Railway URL https://webapp-production-529c90ac.up.railway.app) and is deployed from `main` like the others. Railway's config can't register a custom domain, so it was added with `railway domain app.yebeyt.com --service webapp --port 8080`. The link pages on yebeyt.com get a «روی وب بازی کن / بخون» button into the web app.
- **Mobile first.** On a phone, each screen follows its iOS board in `design/canvas/project/`. Wider screens use the standard responsive patterns, with no new boards:
  - from 768 px, the content is a centred column (max 560 px; reader and games 640 px) on the dotted paper;
  - from 1024 px, the bottom tab bar becomes a right-hand side rail (RTL);
  - from 1024 px, messages and the library show list and detail side by side (messages: built in W7, the inbox stays beside the open chat; the library's list and detail are still the one column, which needs its screens (book, section, poet) re-cut as panes, so it waits for its own slice);
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
  - As built (W4): two cookies (`yb_access`, `yb_refresh`), `Secure` whenever the page is served over https (so a plain-http test on localhost keeps them). Sign in with Apple JS runs in a popup with `<origin>/auth/apple` as its return URL; a code from it needs that URL again at Apple's token endpoint, so the server's Apple sign-in takes an optional `redirectUri`, accepted only when it is in the new optional env list `APPLE_REDIRECT_URIS`. The web Services ID goes in `APPLE_BUNDLE_IDS`, as planned.
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
- **W1 Reading** (merged 26 Nov): poetry data loading, the reader in both modes, text sheet, meaning, hold menu, marks, recitation.
- **W2 Home, Explore, Library, Search** (merged 26 Nov), plus reading progress (iOS `ReadingProgress`: the last couplet opened in each poem, for «ادامه بده»).
- **W3 Solo games**, in two parts: **W3a** (merged 26 Nov) the catalog, معمای امروز, جورچین, the after-answer sheet, round end and stats; **W3b** حدس شاعر، مصراع دوم، از کدوم کتاب؟، معنی‌یاب، گوش کن (the iOS names), with the poet page's game card. گوش کن stops its clip with `timeupdate` plus an animation-frame check and fades it with a Web Audio gain.
- **W4 Accounts and sync**: the web sign-in, username, gate, onboarding, carry-over, the typed API client, divan/scores/reactions sync.
- **W5 Me** (built 26 Nov): `/me` and its screens (divan, avatar, invite, settings with deleting the account, privacy, badges, licences); the avatar drawing moved to `packages/avatar`, shared with `apps/web`. Left out of the settings as they make no sense in a browser: the shake for feedback and the version line; there is no blocked-people screen on the phone, so none here. «بازخورد» says «به‌زودی» until W9.
- **W6 Friends and leaderboard** (built 27 Nov): `/people`, `/u/<username>`, `/messages/requests` (with its row and the tab badge in پیام‌ها), `/me/friends` and the profile's friend count, «دوستات» on the home, `/games/leaderboard`, blocking and reporting; the invite page of yebeyt.com opens the person's page here. «پیام بده» on a person's page and the live `friend.request` and `friend.accepted` events come with the messages (W7), because they need the chat and the socket.
- **W7 Messages and shared divans** (built 27 Nov): `/messages` (the inbox), `/messages/<username>` (the chat), `/messages/<username>/divan` (the shared divan), «پیام بده» on a person's page, the reader's «به دیوان مشترک» sheet, and the live socket (`POST /auth/live` gives it a short-lived token and its address; one socket per tab, closed when the page is hidden for a minute and on sign-out; the friend events update the requests live). The server needed no change: `/v1/live` checks no Origin. Left out until W8: starting and joining a game from a chat (the buttons say «به‌زودی روی وب»); the long-press menu on a couplet card in a chat and on a shared divan's couplet is a question asked at once (delete, report, take out), because the web's hold menu belongs to the reader.
- **W8 Playing with friends** (built 27 Nov): `/games/lobby` («بازی با دوست»), `/games/mosh/<id>`, `/games/duel/<id>` and `/c/<code>` (the board of a challenge, which a guest can play too), the مشاعره card and «+ بازی با دوست» on the بازی tab, the chat's game cards and chips, and the challenge card after جورچین and حدس شاعر; the live socket can now send (a duel's answer; never a frame over the server's 4 KB), and the door lets through exactly the games and challenges calls, a challenge's reading and result with the session when there is one. The server needed no change. yebeyt.com's `/c/<code>` has «روی وب بازی کن». Left out: the «استوری» picture of a challenge, and the scripted live replies of the phone's debug stub (the tests push the events).
- **W9 Feedback** (built 27 Nov; the last slice: **the web app is feature-complete**, everything the iOS app does except what is listed under «Not on the web»): «بازخورد» in the settings and Shift + «?» open the choices over the page, and the five forms, their copy and limits, the question before an unsent one is closed, the offline, rate-limit and busy lines, the screenshot with its editor, the screen recording, and the technical info are the phone's. A report goes through the door to `POST /v1/feedback` and the two `PUT`s of its files, which the door lets through alone (3 MB and 25 MB, the only bodies over 1 MB, CSRF on). The screenshot is drawn by modern-screenshot (MIT) from a copy of the page in which every private view and field is already a solid block; recording is MP4 only, because the server takes nothing else, so a browser that can't record MP4 (Firefox, Chrome before 126) or can't share the screen (iPhone Safari) has no recording option. The version is the build's git sha. The report leaves out the recitation position (the player's state is not read), and there is no shake switch because there is no shake.

## Follow-ups (noted by the lead)

- **Guest rate limits on the server (W8 review, 27 Nov).** A guest playing a challenge link on the web counts against the server's shared guest buckets: 120 results an hour for all guests together, and 600 lookups a minute for the whole server. Web guests all reach the server through the web app's own door, so they share one address anyway, and a single abuser can use up the results bucket for everyone. Before the web app is announced, give guests a per-browser key (a signed cookie the door adds) and limit by that, with a tighter global cap as a backstop.
- **Rare lost typing in WebKit tests.** About 1 in 50 to 1 in 2,000 runs, a field is empty right after Playwright's `fill`, on the same element, with no redraw. It was already there before W8, and nothing shows that people hit it. If a user report ever matches it, look again.
