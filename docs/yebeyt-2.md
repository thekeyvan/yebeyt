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

## Still open (ask the user)

- Feedback delivery: in the app to api.yebeyt.com (recommended) or by email.
- Long-press on every couplet everywhere in the app (proposed), and adding it to the map.
- In chat, a system line when a friend adds to a shared divan, and «به دیوان مشترک» in the long-press menu (proposed).
- The full fal (فال حافظ) flow is not designed yet.
- A full end-of-round screen per game (for now `ChallengeSend` covers it).
