# yebeyt 2.0 · what we are building

Many look-alike Persian poetry apps launched in 2026. yebeyt 2.0 sets itself apart with a playful personality: games, a small circle of friends, and messages, around a calm reader. The design was settled screen by screen with the owner; this file is the decision record for building it. Anything not written here or on a board is still open: ask the user, don't invent.

It is a new app built from scratch, in a monorepo (layout in `AGENTS.md`). Nothing from the earlier 1.0 code or its server is reused and there is no earlier user data to migrate; 1.0 was never distributed. 2.0 ships as the same App Store app (`com.yebeyt.app`). iOS comes first; the web app, admin dashboard and Android come after the iOS slices and are not designed yet.

## Where the design lives

- Every screen is a board in `design/canvas/project/<Name>.dc.html` (390×844, one phone screen each). `design/canvas/project/canvas.json` holds each board's title and number.
- To look at boards, render them to PNG from the repo root: `mkdir -p /tmp/shots && python3 -I design/canvas/shoot.py design /tmp/shots Poem.dc.html Calm.dc.html` (needs Google Chrome on a Mac; it maps the canvas font URLs to the files in `design/canvas/fonts/` and `assets/fonts/`). Read the HTML for exact sizes, colours and copy.
- The live canvas (private, owner only) is https://claude.ai/artifact/JiaDy1vekUMDw6QxCTJNoH. The repo copy is the same content.
- Board numbers like «۴-۲» mean row 4, screen 2. The rows:

| Row | Flow | Boards (in order) |
|---|---|---|
| ۰ | Reference | `StickerSystem` design language · `Map` app map · `Poets` poet portraits · `GameIcons` · `GamesCatalog` |
| ۱ | شروع و حساب | `OnbWelcome` · `OnbTaste` · `OnbGame` · `OnbAccount` · `OnbUsername` · `OnbFriends` · `AccountGate` |
| ۲ | خونه، کاوش و کتابخونه | `Calm` · `Explore` · `Poet` · `Library` · `Book` · `BookSection` |
| ۳ | خوندن شعر | `Poem` · `PoemMeaning` · `PoemText` · `PoemScroll` · `PoemScrollHold` |
| ۴ | تب بازی و بازی‌های تکی | `GamesE` · `PlayDaily` · `JigsawE` · `JigsawResult` · `PlayPoet` · `PlayPoetAnswer` · `PlaySecond` · `PlayBook` · `PlayMatch` · `PlayListen` · `ChallengeSend` · `LeaderboardS` |
| ۵ | بازی با دوست | `GameLobby` · `ChallengeWeb` · `ChallengeAccept` · `PlayMosh` · `PlayDuel` |
| ۶ | پیام‌ها | `Inbox` · `Direct` · `SharedDivan` |
| ۷ | من | `Profile` · `Divan` · `Privacy` · `Avatar` · `InviteFriends` |
| ۸ | بازخورد | `FeedbackShake` · `FeedbackBug` · `FeedbackGame` |

Boards on the second canvas page (`Main`, `Games`, `GamesA`–`GamesD`, `Jigsaw`, `Leaderboard`, `Circle`, `Player`, `PoemFonts`) are old explorations. Don't build from them.

## Look: stickers

The full rules are on the `StickerSystem` board. In short:

- Colours: lapis `#2F35F5` (main), fire `#FF4D24` (streak, competition), amber `#FFB703` (points), green `#6CCB3A` (correct), magenta `#FF3D8B` (friends, poets), ink `#14112B` (text), paper `#F1EFEA` with dots `#D9D5CE` (background), white `#FFFFFF`.
- Stickers have a white border (3–5 pt) and a soft shadow (about `0 3 10` at 18% ink). No ink outlines.
- Cards, buttons, badges and text are always straight. Only decorative stickers tilt 5–12°, two or three per screen at most. One peeled corner per screen at most, on a big card. A sticker you are holding is bigger, tilted, with a longer shadow.
- Dotted paper background, like a sticker sheet, on every tab including home (the owner chose this over the plain home background on the `Calm` board).
- Fonts: titles **Lalezar**, interface **Vazirmatn**, poems **Parastoo Bold** (the default poem font). The text sheet also offers regular Parastoo. All four live in `assets/fonts/` with their OFL licences.
- App icon: for now the two-sticker mark from `StickerSystem` (drawn by `tools/make_icon.swift`).
- Tab bar: the `nav()` function in `design/canvas/gen_explore.py` is its exact spec (white card, raised round «بازی» in the middle, avatar on «من», unread badge on «پیام‌ها»). Until avatars exist (slice 5) «من» shows our own line icon in the same ring.
- Icons are our own (the app's line icons and the game icons in `design/canvas/gameicons.py`: round stickers, white border, one colour per game). No SF Symbols in the visible design.
- Tabs: خونه · کاوش · بازی · پیام‌ها · من.

## Decisions by area

**Accounts (row ۱).** No account is needed to read, browse, search, open a fal, listen, play solo games or keep couplets on the phone. Scores, the leaderboard, streaks, games with friends, messages and sync ask for an account when first used (`AccountGate`: a sheet over the current screen; progress made as a guest carries over). Sign-in is Apple or Google only, plus «فعلاً بدون حساب». After sign-in the user picks a username: `a-z 0-9 _ .`, 3–20 characters, live availability check, suggestions, can be changed every 30 days. Onboarding: welcome → taste (poets and moods) → a 30-second jigsaw → account → username → find friends.

**Reading (row ۳).** One couplet at a time (`Poem`) and the whole poem (`PoemScroll`) share the exact same header and mode toggle; switching modes must not move the header. Long-press on a couplet lifts it (`PoemScrollHold`): icon row پسند / بازنشر / بفرست / نگه دار, then a list (meaning of this couplet, read from here couplet by couplet, play with this couplet, copy text). The «آ» sheet (`PoemText`) has font (Parastoo / Parastoo Bold), weight, hemistich layout (staggered / centred), spacing and theme.

**پسند vs نگه داشتن.** پسند is social: friends see it. نگه داشتن puts the couplet in your divan, a private collection. The divan (`Divan`) has search and grouping by poet, topic or newest. A shared divan with a friend (`SharedDivan`) is opened from the chat header.

**Long names.** Poets have a short display name; full names appear on their own pages. In the Explore poet row the label is a fixed width and wraps to a second line under the name; the avatar always stays a circle. Book titles wrap to two lines.

**Pictures that grow over time** (poet portraits now; later book covers, game art and the like). The phone has a default for every item; for poets it is a sticker circle in the poet's colour with the first letter of their name. The real picture comes from the server (api.yebeyt.com on Railway) and, once loaded, is kept on the phone, so new pictures appear without an app update, and with no network the saved or default picture shows. The 16 ready portraits in `design/poets` go only to the server, not into the app. Pictures are uploaded with a script at first, later from the admin dashboard. Slice 2 builds Explore with the defaults; slice 4 adds the picture endpoint and loading them in the app.

**Library (row ۲).** All books (search, continue reading, type chips, grid) → one book (cover, continue, random poem, sections) → a section's list (search, sort by number / last letter / most read; read and in-progress marks) → the poem.

**Games (rows ۴ and ۵).** Nine games, each with its own icon: معمای امروز (missing word from letter stickers, 3 tries, streak), جورچین بیت, حدس شاعر (four faces with names), مصراع دوم, از کدوم کتاب؟ (poet shown, pick the book), معنی‌یاب (match words to meanings), گوش کن (recitation with the text hidden; answers are hemistichs, since most poems have no title), مشاعره and بازی رودررو (with friends). Nothing teaches during the timer; after every answer, right or wrong, a sheet shows the full couplet, a one-line meaning, poet and book, with «کل شعر / نگه دار / بفرست» and a big «بیت بعدی». The round ends with a list of its couplets and an invitation to challenge someone (`ChallengeSend`). Leaderboard: plain rows, medals for 1–3, your own row tinted, no podium. Show scores per face; never "x : y" or "۸ / ۱۰" (they reorder in right-to-left text); write «۸ از ۱۰».

**Playing with friends and links (row ۵).** `GameLobby`: pick a game, a turn time (۳۰ ثانیه / ۲ دقیقه / تا فردا), invite friends in the app or share a link. Links are Universal Links on yebeyt.com: `/c/<code>` challenge, `/i/<username>` invite, `/g/<code>` game. Without the app, the web page offers an App Clip to play at once, the App Store, and a visible code; after install the link is matched on the server by code (deferred deep link), with the code as fallback. No account is needed to accept a challenge; the name is asked at the end.

**Invite friends (row ۷).** Tone presets (رفیقانه / شاعرانه / کوتاه), editable text with a مشاعره opener, the personal link, and an avatar item as a reward when friends join.

**Feedback (row ۸).** Shake the phone to open «می‌خوای چیزی بگی؟» with five types. What each sends:

| Type | Screenshot | Other |
|---|---|---|
| باگ دیدم | yes, with a switch | technical info: screen and couplet, mode, recitation position, text settings, network, account state, recent errors, steps before it; optional screen recording |
| یه جاش اذیتم کرد | yes, switch on by default | screen name |
| یه ایده دارم | switch off by default | — |
| یه بازی پیشنهاد بدم | no | text only |
| خوشم اومد | no | text only |

Technical info is shown as one collapsed row «اطلاعات فنی · ببین چیه», only on bug reports. App version and phone model go with every type, silently. Never send text typed elsewhere, messages, phone number, IP or location. Shake can be turned off in settings. Shipping this needs the App Store privacy label (Diagnostics, Product Interaction) and a clause in the privacy policy (on the new website, slice 9; until then the policy text is kept with the feedback slice).

## Build order

One slice per branch, each reviewed before the next starts. The lead confirms the order with the user before starting.

0. **Foundations**: remove the old code; the monorepo layout; the new iOS app (`apps/ios`, iOS 17+, Swift 6) with the `YebeytTests` target; design tokens from `packages/tokens/tokens.json` (colours, the four fonts, sticker card/button/badge/word-sticker styles, dotted background); the new tab bar with empty tabs.
1. **Poetry data and reading** (row ۳): the data pipeline from Ganjoor's repositories into bundled data, the poem models, then the reader: shared header and toggle, whole poem, «آ» sheet, long-press.
2. **Home, Explore, Library** (row ۲).
3. **Solo games** (row ۴), starting with جورچین and معمای امروز, scores kept on the phone; the after-answer sheet; then the other solo games.
4. **New server, onboarding, account gate, username** (row ۱): `apps/server` on Railway with Sign in with Apple and Google, usernames, the poet pictures endpoint (and loading them in the app) and the `packages/api` contract.
5. **Me** (row ۷): profile, divan (with sync), privacy, avatar.
6. **Feedback** (row ۸), with the server endpoint, privacy label and policy text.
7. **Server for friends**: friends, scores and leaderboard, games with friends (live over WebSocket), messages.
8. **Playing with friends and messages** (rows ۵ and ۶), shared divan.
9. **Website and links**: `apps/web` (yebeyt.com, privacy, terms, support, the fallback pages), Universal Links, App Clip, deferred links, invite friends.

After these: the web app, the admin dashboard and Android, each designed first.

## Settled after the boards (owner, 23 Nov)

- Feedback goes inside the app to api.yebeyt.com.
- Long-press on a couplet works everywhere a couplet is shown (home, games, divan, messages), with the same menu; add it to the map.
- In chat, a system line appears when a friend adds to a shared divan, and the long-press menu has «به دیوان مشترک».
- فال حافظ stays a random Hafez ghazal in the whole-poem view; no separate flow.

## Still open (ask the user)

- A full end-of-round screen per game (for now `ChallengeSend` covers it).

## Decisions the lead made while the owner was away (please check)

The owner asked the lead to keep going alone. These were not settled on a board or with the owner; change any of them.

- **Poetry data:** built from `ganjoor-data` pinned to one commit (`tools/ganjoor/build.py`). Hafez's ghazals, Khayyam's quatrains and Baba Taher's dobeytis are bundled (about 3 MB); every other book loads from Ganjoor's repository on first use and stays on the phone. Editor notes (`Comment` verses) are not shown.
- **Reader counts:** «۲ از ۹» instead of the board's «۲/۹» (the no-slash rule).
- **Before the server exists:** پسند and بازنشر are kept on the phone without counts; نگه دار keeps the couplet in the divan on the phone; بفرست opens the iOS share sheet with the couplet and yebeyt.com. With the server (slices 4 and 7), پسند/بازنشر ask for an account when used and show counts.
- **Game buttons in the reader** (header and «بازی با این بیت») switch to the بازی tab until slice 3 starts a game with that couplet.
- **Whole-poem bar:** بفرست and نگه دار act on the couplet nearest the top of the screen.
- **«بیشتر بخون»** in the meaning card expands the card when the meaning is longer than three lines. Word glosses (dotted words) wait for a data source.
- **Text sheet:** the weight switch only works for Parastoo (the only font with a bold file). Defaults are the board's selected options.
- **Copy not on any board:** «شعر باز نشد» with «دوباره» when a poem fails to load; «خوانش باز نشد» when a recitation fails.
- **Railway:** the project is renamed `yebeyt`. The old `api` service keeps running on api.yebeyt.com until slice 4 replaces it.
- **Library content:** `tools/ganjoor/curation.json` holds the poets (short name, tag, city, century, colour, a short bio in everyday Persian), the books (Ganjoor path, everyday title, type for the Library chips, cover colour, one-line blurb) and the six moods. It was written by an agent from Ganjoor's own descriptions; please read it through. Nima, Forough, Sohrab, Akhavan, Shamlou, Simin Behbahani and Qeysar Aminpour are not in Ganjoor's data (still under copyright), so the Explore poet row uses classical poets after Hafez, Saadi and Molavi; «معاصر» books come from Bahar, Iraj, Parvin, Shahriar, Rahi and others. 99 books from 48 poets for now.
- **Popularity («پرخواننده»):** until our server counts reads, a poem's popularity is the number of recitations Ganjoor has for it (`/api/audio/published`, counted by the pipeline).
- **Home and Explore before friends exist:** the friends sections («دوستات» on home, «پرطرفدارها» on Explore) stay hidden until slice 7.
- **Mood chips** open a list of couplets from the bundled books that contain the mood's words; tapping one opens the reader there. **Search** results (no board yet) are grouped as poets, books and couplets, in the same row styles as the Library.
- **فال حافظ** (no flow designed yet): «باز کن» opens a random Hafez ghazal in the whole-poem view.
- **دنبال کن** on a poet and the bookmark on a book are kept on the phone.
- **Poet pictures** are the default sticker circles until slice 4.
- **Owner's answers (23 Nov):** contemporary poets stay out until there is a source or permission. Slices are merged and pushed when the reviewer calls them clean. The old Railway `api` service and its Postgres (1.0 data) are deleted once the new server runs. hello@yebeyt.com (Zoho) is the public contact address; accounts@ksco.nl (Google) is the support email on Google's consent screen.
- **Left for the owner (another laptop, the corporate proxy blocks gcloud here):** in Google Cloud project `beyt-515410`, rename the display name to yebeyt and set the consent screen (name «یه بیت», domain yebeyt.com, privacy and terms links); check the existing iOS OAuth client for `com.yebeyt.app`. In App Store Connect and the developer site, check the app record and Sign in with Apple for `com.yebeyt.app`.
- **Game deck:** the pipeline bundles a deck of well-known couplets for the games, taken from the most-recited poems of the curated poets, keeping couplets that have a Ganjoor meaning (the after-answer sheet needs it). `tools/ganjoor/glossary.json` (AI-written, please read) gives the words for معنی‌یاب and the dotted words in the reader.
- **Scores before accounts:** points and the streak are kept on the phone (slice 4 asks for an account and carries them over). Points: quiz answers 20 + 2 per second left; جورچین 20 per word placed plus 1 per second left in the round; معنی‌یاب 10 per pair; معمای امروز 100 / 70 / 40 for the first / second / third try; a hint costs 20 (۵۰:۵۰, the جورچین bulb) except «یه حرف» in معمای امروز, which costs 30. The streak counts days in a row the daily puzzle was solved, by Tehran date; the puzzle is the same for everyone that day.
- **Hidden until friends, links and the leaderboard exist (slices 7–9):** «سلام <name>!» until there is an account, «۳ تا از دوستات حلش کردن», the مشاعره card, «+ بازی با دوست», the leaderboard link, and the challenge card on the end-of-round screen (until links exist it shows the round's couplets instead). «سطح بعد» in گوش کن and «چطوری بفهمی؟» in از کدوم کتاب wait for content.
- **Game entry points:** «بازی با این بیت» starts جورچین with that couplet; «بازی با این غزل» starts جورچین with that poem's couplets; «بازی با بیت‌های <poet>» starts مصراع دوم with that poet only. گوش کن needs the network; when the recitation can't load it says «خوانش باز نشد» and goes back.
- **Server deployed (23 Nov):** Railway project `yebeyt` now has only `server` (the new backend, built from `apps/server/Dockerfile`; the service is connected to the GitHub repo and `main` deploys by itself; the infrastructure is in `.railway/railway.ts`) and a new empty Postgres. The old `api` service and its Postgres (1.0 data) are deleted. The Apple key, team and bundle ids and the Google client id were copied from the old service; `JWT_SECRET` and `ADMIN_TOKEN` are new (only in Railway). 11 poet portraits are uploaded. It answers at https://server-production-98f46b7e.up.railway.app.
- **One DNS change for the owner (Cloudflare):** set the `api` CNAME of yebeyt.com to `1kdy3n7t.up.railway.app` (it still points at the deleted service's `al3flpv4.up.railway.app`). The verification TXT record is already right. Until then api.yebeyt.com doesn't answer.
- **Follow-up:** Railway has deprecated `railway.json`; move the service settings (health check `/health`) to Railway's infrastructure-as-code file and connect the service to the GitHub repo so `main` deploys by itself.
- **AI-written meanings:** Ganjoor marks many meanings «هوش مصنوعی:». The pipeline strips that label from the text everywhere and keeps an `ai` flag; the owner chose (23 Nov) a small sparkle next to the meaning's heading («معنی» in the reader, «یعنی چی؟» on the after-answer sheet) only on AI-written meanings; tapping it says «این معنی با کمک هوش مصنوعی نوشته شده».
- **Find friends (OnbFriends):** «از دفترچه‌ی تلفن» can't work, because accounts are Apple or Google only and hold no phone numbers. For now the screen shows only the invite link; finding friends by username comes in slice 7. Decide whether contacts matching should exist at all.
- **Account gate copy:** «برای پسند و بازنشر یه حساب لازمه» and «برای پیام دادن به دوستات یه حساب لازمه», following the board's «برای مشاعره با دوستات یه حساب لازمه».
- **Friends and leagues, decisions for slice 7** (questions in `owner-todo.md`):
  - You follow people («دنبال کن» / «دنبالش می‌کنی»); two people who follow each other are friends («دوستا», «۱۲ دوست»). People are found by username search and by the invite link.
  - Scores are reported by the phone after each round (each with a round id so a retry doesn't count twice) and capped per game on the server; the daily puzzle result is reported too (for «۳ تا از دوستات حلش کردن» and the streak).
  - Weekly leagues, Saturday to Friday by Tehran time, in groups of up to 30. Tiers use the level names: نوآموز, بیت‌خوان, غزل‌باز, سخن‌دان, استاد سخن. The top 5 move up and the bottom 5 move down at the week's end. Everyone starts in نوآموز. «همه» on the leaderboard is the global weekly list of people who allow it (`inGlobalLeaderboard`).
  - پسند and بازنشر are stored on the server for signed-in users; friends see them in their home feed («دوستات»), subject to the privacy settings.
  - On the league board, people in your group who aren't your friends and who keep out of the global list show as «یه نفر» with their points, without name or face.
  - A friend's likes and reposts appear in your feed only when their «بیت‌هایی که نگه می‌دارم» setting is «دوستا»; their solved daily appears when «نتیجه‌ی معمای روز» is «دوستا».
  - The daily puzzle scores once per Tehran day and the onboarding game once per account; a profile shows the league and the week's points only to friends, or to anyone when the person allows the global list.

