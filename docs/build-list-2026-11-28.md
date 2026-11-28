# Build list · design changes of 28 Nov

The owner designed these on 28 Nov. They are on the canvas and in this repo (`design/canvas/project/`). This file is the work list for building them: one section per slice, each with its boards, what changes, the files to start from, the server work, the acceptance criteria and the tests. Follow the loop in [AGENTS.md](../AGENTS.md): one branch per slice, builder test-first, reviewer, then merge on the owner's word. Every slice covers **iOS (`apps/ios`) and the web app (`apps/webapp`)** unless it says otherwise.

Read the boards for exact copy, colours and sizes: render one with `python3 -I design/canvas/shoot.py design /tmp/shots <Board>.dc.html`, or open the HTML. The decisions behind them are in [yebeyt-2.md](yebeyt-2.md): «Empty states and the fal», «A poet's books are books», «Public profiles and finding friends».

Suggested order (each depends only on the ones before it where noted):

| # | Branch | What | Size | Needs |
|---|---|---|---|---|
| 1 | `fix/empty-cases` | The 15 places where an empty or failed state isn't handled at all | S–M | — |
| 2 | `feat/empty-states` | The empty-state screens (rows ۹–۱۱) | M | 1 |
| 3 | `feat/poet-books` | The poet page shows books as covers | S | — |
| 4 | `feat/fal` | فال حافظ, solo (row ۱۲) | M | — |
| 5 | `feat/public-profiles` | Public and private profiles, follow, the public «تازه‌ها» feed (row ۱۳) | L | 2 |
| 6 | `feat/contacts` | Find friends from contacts by email (row ۱۳) | M | 5 |
| 7 | `feat/fal-pair` | فال دونفره (row ۱۲) | M | 4, 5 |

Shared building blocks for 1, 2 and 6: an `EmptyState` view on each platform (picture slot, Lalezar title, one or two lines, a main button, an optional link, an optional «still works» chip row), a small dashed `EmptyCard` for a section, and the sticker-sheet pictures. The pictures are drawn in HTML in `design/canvas/emptyart.py` (`art_sheet`, `art_divan`, `art_search`, `art_inbox`, `art_friends`, `art_board`, `art_done`, `art_offline`, `art_poem_failed`, `art_mute`, `art_badges`, `art_requests`, `art_feed`, `art_games`, `art_nabat_small`, and `nabat()` for the شاخ نبات): rebuild them with the app's own sticker views (dashed slots = a rounded rectangle with a dashed `#C9C5D3` 3 pt stroke; stickers = the existing sticker style). Don't ship them as images.

---

## 1 · `fix/empty-cases`: the empty cases nobody handles

Found by reading the code on 28 Nov. Fix the behaviour; the screens they should show come in slice 2 (until then a plain line and a way out is enough). Paths are under `apps/ios/Yebeyt/` unless they start with `webapp/`.

| # | Where | What happens today | What it must do |
|---|---|---|---|
| 1 | Chat with no messages (`Messages/ChatScreen.swift`, `webapp/components/messages/ChatScreen.tsx`) | blank list | starters (`EmptyChatNew`) |
| 2 | Library and Section filtered to nothing (`Library/LibraryScreen.swift:27`, `Library/SectionScreen.swift:35`) | blank grid/list | «پیدا نشد» state (`EmptyLibraryNone`, `EmptySectionNone`) |
| 3 | Home feed with no entries (`Friends/Feed/FeedSection.swift:27`) | heading only | slice 5's feed; until then `EmptyHomeFriends`' card |
| 4 | Lobby with no friends (`Play/LobbyScreen.swift:124`; friends load failure swallowed at `LobbyModel.swift:106`) | a lone «+ بیشتر» | `EmptyLobbyNoFriends`; a load failure shows «دوباره» |
| 5 | Leaderboard: a loaded nil league (`Friends/Leaderboard/LeaderboardScreen.swift:76`) | blank area | `EmptyBoardNoPoints` |
| 6 | Search and mood when the couplet index fails (`Search/SearchScreen.swift`, `Search/MoodScreen.swift`, `Poetry/CorpusStore.swift:12`) | blank forever | «نرسید» with «دوباره» (the web already has «بیت‌ها باز نشد») |
| 7 | Daily puzzle nil (`Games/GameHost.swift:13`; web `DailyScreen.tsx:36` spins forever) | blank screen **with no close button** | `EmptyDailyMissing` with close |
| 8 | جورچین round nil (`Games/JigsawScreen.swift:22`, `:59`) | blank, no loader, no close | loading then `EmptyGameFailed`-style with close |
| 9 | مشاعره and duel load failure (`Play/MoshScreen.swift:27`, `Play/DuelScreen.swift:24`, error swallowed at `FriendGames.swift:55`; web `MoshScreen.tsx:44`, `DuelScreen.tsx:49`) | spinner forever | after the error or 10 s: `EmptyChallengeGone` («این بازی پیدا نشد یا تموم شده») or «نرسید» when offline |
| 10 | Divan offline (`Me/Divan/DivanModel.swift:20–22` drops couplets whose poems can't load) | «هنوز بیتی نگه نداشتی» while the header says «۳۸ بیت» | keep them as placeholder cards (`EmptyDivanOffline`) |
| 11 | Shared divan chips with no match (`Messages/SharedDivanScreen.swift:163`) | the empty-divan line | its own line: «{name} هنوز بیتی نذاشته» / «هنوز بیتی نذاشتی» / «از این شاعر بیتی نیست» |
| 12 | Couplet picker (`Messages/CoupletPickerSheet.swift:62`, `:65`, `:124`, `:133`) | flashes «دیوانت هنوز خالیه» before the divan loads; «چیزی پیدا نشد» during the 250 ms debounce and forever if the index fails | show nothing while loading; «چیزی پیدا نشد» only after a finished search; «نرسید» on failure |
| 13 | Unknown destination (`Features/DestinationView.swift:13–23`) | blank screen | `EmptyNotFound` (the web already says «اینجا چیزی پیدا نشد») |
| 14 | Web guest who taps «بعداً» on the gate (`webapp` Friends, Leaderboard, Requests, Chat, SharedDivan screens) | spinner forever | `EmptyInboxGuest`'s card with the sign-in buttons |
| 15 | Badges and stats of a new player (`Me/Profile/ProfileScreen.swift:138–140`, `BadgesScreen.swift:69`) | zeros and faded badges, no words | `EmptyBadges` (each locked badge says how to earn it) |

Also: a feed card whose poem can't load (`FeedSection.swift:67`) shows no couplet and «بفرست» does nothing; show a placeholder couplet like `EmptyDivanOffline` and disable «بفرست» until it loads.

**Acceptance:** none of the 15 shows a blank screen, a spinner past 10 s, or a screen without a way back. **Tests:** a unit test per model change (divan keeps unloaded couplets; picker states), UI tests for 7, 8, 13 using debug arguments (add `-beytDailyMissing 1`, `-beytJigsawFails 1`, `-beytRoute book:/nope`).

---

## 2 · `feat/empty-states`: the screens (rows ۹–۱۱)

Rules (board `EmptyRules`): six kinds (هنوز چیزی نیست · پیدا نشد · تموم شد · نرسید · حساب لازمه · داره میاد); always one main button and at most one link; never «متأسفیم» or «خطا»; show what still works; a dashed card inside a section, centred when the whole screen is empty; loading shows the screen's shape and, after 10 s, «دوباره».

Can be split into three PRs, one per row. For each board: where it goes (iOS · web), when it shows, and where its buttons go. Copy is on the board.

**Row ۹ · home, explore, reading**
| Board | iOS · web | When | Buttons → |
|---|---|---|---|
| `EmptyHomeFriends` | `Friends/Feed/FeedSection.swift` · `webapp/components/friends/FeedSection.tsx` | slice 5's «تازه‌ها» when I follow nobody: suggestions carousel + suggested items with a «پیشنهاد» tag. Until slice 5: a dashed card «اینجا جای دوستاته» with «پیدا کردن دوست» | person card → that person; «دنبال کن» (slice 5) |
| `EmptySearchStart` | `Search/SearchScreen.swift` · `SearchScreen.tsx` | field empty | example rows fill the field; chips search |
| `EmptySearchNone` | same, and `MoodScreen` | no result | suggestion (if any) → search it; «پاک کن و از اول» |
| `EmptyLibraryNone` | `Library/LibraryScreen.swift` · `LibraryScreen.tsx` | search/chip with no book | «همه‌ی کتاب‌ها رو ببین» clears; «بگو کدوم شاعر رو می‌خوای» → feedback «یه ایده دارم» with the text prefilled |
| `EmptySectionNone` | `Library/SectionScreen.swift` · `SectionScreen.tsx` | search with no poem | «توی همه‌ی شعرها بگرد» → search with the same text |
| `EmptyNotFound` | `Features/DestinationView.swift` · `WithLibrary.tsx` and the person screen | unknown id or bad link | «برو به خونه», «برگرد» |
| `EmptyPoemOffline` | `Reader/ReaderView.swift:131` · `ReaderScreen.tsx` | not cached and offline | «دوباره»; chips open the bundled books |
| `EmptyReaderLoading` | `ReaderView.swift:96` | while loading (blank today) | — |
| `EmptyOffline` | every server screen: inbox, chat, leaderboard, friends, people, requests, shared divan, person | offline or server busy (`Account/APIError.swift:68–70` copy stays for toasts) | «دوباره»; chips → خوندن, بازی‌های تکی, دیوان |

No recitation: **keep hiding the play button** (owner, 28 Nov: «اگر شعری خوانش نداشته باشه اصلا نباید پلی رو نشون بدیم»). No toast, no disabled button.

**Row ۱۰ · games**
| Board | iOS · web | When | Buttons → |
|---|---|---|---|
| `EmptyDailyDone` | `Games/DailyScreen.swift` (today it reopens on the answer sheet) and the card `DailyPuzzleCard.swift` · `DailyScreen.tsx`, `DailyCard.tsx` | solved today: countdown to Tehran midnight, streak, friends who solved it | «یه بازی دیگه» → catalog; «کل بیت رو بخون» → reader |
| `EmptyDailyMissing` | `Games/GameHost.swift` | no puzzle | «دوباره»; «یه جورچین بزن» |
| `EmptyGameFailed` | `Games/QuizScreen.swift:71–94`, `MatchScreen.swift:40`, `JigsawScreen.swift` · `QuizScreen.tsx` | a round can't be built (listen offline is the board; others: «این بازی الان باز نشد») — instead of closing silently | «دوباره»; chips → games that work offline |
| `EmptyBoardNoPoints`, `EmptyBoardNoFriends`, `EmptyBoardNewWeek` | `Friends/Leaderboard/LeaderboardScreen.swift:78/88/104` · `LeaderboardScreen.tsx` | league with no points (and nil league), friends tab with no friends, global tab with nobody this week | play; «پیدا کردن دوست» → `PeopleStart`; play |
| `EmptyBadges` | `Me/Profile/BadgesScreen.swift` · `BadgesScreen.tsx` | no badge yet: header card + each locked badge with how to earn it | «اولین جورچین رو بزن» |
| `EmptyLobbyNoFriends` | `Play/LobbyScreen.swift` · lobby on web | no friends | «لینک بازی رو بفرست» (share sheet with the game link), «پیدا کردن دوست» |
| `EmptyGamesFriends` | `Games/GamesView.swift` (`MoshCard`) · games tab on web | no game with friends going on | «مشاعره با یه دوست» → lobby with مشاعره picked |
| `EmptyChallengeGone` | `Play/ChallengeAcceptScreen.swift:34/39` and the duel/mosh failure · `apps/web` `/c` `/g` pages already have their own | over, wrong code, or failed to load | «خودت یه چالش بساز» → جورچین; «برو به بازی‌ها» |

**Row ۱۱ · friends, messages, me**
| Board | iOS · web | When | Buttons → |
|---|---|---|---|
| `EmptyPeopleNone` | `Friends/PeopleScreen.swift:78` · `PeopleScreen.tsx` | no username match | «لینک دعوت رو بفرست» |
| `EmptyRequests` | `Friends/RequestsScreen.swift:39` | none | «پیدا کردن دوست» → `PeopleStart` |
| `EmptyFriends` | `Friends/FriendsScreen.swift:41` (its copy names a button that isn't there) | none | «پیدا کردن دوست» → `PeopleStart`; «دعوت با لینک» |
| `EmptyInbox` | `Messages/InboxScreen.swift:66` · `InboxScreen.tsx` | no conversations | «دوستاتو پیدا کن» → `PeopleStart`; «دعوت با لینک» |
| `EmptyInboxGuest` | the پیام‌ها tab for a guest (`App/TabBar.swift:52` gates it today) · `InboxScreen.tsx:76`, and slice 1 #14 | guest | Apple / Google buttons; «فعلاً نه» → home |
| `EmptyChatNew` | `Messages/ChatScreen.swift` · `ChatScreen.tsx` | no message yet | «یه بیت از دیوانت بفرست» → picker; «مشاعره رو شروع کن» → new مشاعره with this friend; «فال دونفره» → slice 7 (hide until then) |
| `EmptySharedDivan` | `Messages/SharedDivanScreen.swift:163` | empty | «اولین بیت رو بذار» → picker |
| `EmptyPickerSheet` | `Messages/CoupletPickerSheet.swift` | my divan is empty | today's couplet with «بفرست» |
| `EmptyDivan`, `EmptyDivanNone`, `EmptyDivanOffline` | `Me/Divan/DivanScreen.swift:32/43` and the profile preview `ProfileScreen.swift:197` · `DivanScreen.tsx` | nothing kept / no match / poems not on the phone | «بیت امروز رو ببین», «برو کاوش» / «توی همه‌ی شعرها بگرد», «پاک کن» / — |
| `EmptyProfileGuest` | `Me/Profile/ProfileScreen.swift:99/115` · `ProfileScreen.tsx` | guest | Apple / Google; divan card → کاوش |
| `EmptyInviteNoName` | `Me/Invite/InviteScreen.swift:16/143` · `InviteScreen.tsx` | no username (today: a link to yebeyt.com and a half-faded share row) | «نام کاربری بساز» → username screen |
| `EmptyFalHistory` | slice 4 | no fal yet | «یه فال بگیر» |

**Acceptance:** every board above is reachable with a debug argument (add `-beytEmpty <board-name>` that fakes the condition, or reuse the fake backends), and a UI test screenshots each; the web has a Playwright screenshot per board in `webapp/e2e/screenshots.spec.ts`.

---

## 3 · `feat/poet-books`: books as covers on the poet page

Boards: `Poet` (one book: Hafez), `PoetMany` (several: Saadi). Decision: yebeyt-2.md «A poet's books are books».

- iOS `Library/PoetScreen.swift`: replace `chips` / `chipItems` (lines ~130–166). Keep today's rule: one book with more than one section → show that book's card and its sections; otherwise the shelf of books.
  - One book: a card with the cover (reuse the library's cover view), «کتابِ {poet}», the title, «ادامه: …» and progress when there is reading progress for it, «باز کن» → `.book(id)`. Under it the sections in a two-column grid of tiles: name, count from the book index («۴۹۵ غزل»), the cover colour as a 6 pt strip on the leading edge, a chevron → `.section(book:section:)`.
  - Several books: heading «کتاب‌های {poet} · {n} کتاب» with «همه» → Library filtered to this poet (add a poet filter to `LibraryScreen`), then a horizontal `ScrollView` of covers (96 pt wide, title up to two lines, kind under it) → `.book(id)`.
- Web `webapp/components/library/PoetScreen.tsx`, reuse `BookCover.tsx` and the library tile.
- Covers and kinds come from `tools/ganjoor/curation.json` (`color`, `type`), as in the library.

**Acceptance:** Hafez shows one card and four tiles; Saadi shows six covers that scroll; every tile and cover opens the right screen; long titles wrap to two lines. **Tests:** update the poet UI tests (`HomeAndExploreUITests`) and the web `browse.spec.ts`.

---

## 4 · `feat/fal`: فال حافظ (row ۱۲, solo)

Boards in order: `FalIntro` → `FalOpening` → `FalResult` → `FalGhazal` · `FalShare` · `FalHistory` (and `EmptyFalHistory`). Opened from the کاوش card (`Explore/FalCard.swift`, `webapp/components/library/FalCard.tsx`): «باز کن» now opens `FalIntro` instead of a random ghazal.

- **Intro** (night lapis `#1C20B8` with light dots, white text): the closed divan, Hafez's picture, the شاخ نبات sticker; the words «ای حافظ شیرازی، تو محرم هر رازی. به شاخ نباتت قسم، هر چی صلاحه برام آشکار کن.»; the hold ring. Clock button → history.
- **Hold:** press and hold the ring for 2 s; the ring fills, haptics grow (light → medium → a success at the end); releasing early drains the ring back to 0 (no penalty). VoiceOver: a double-tap-and-hold works, and an accessibility action «باز کن» opens at once.
- **The ghazal:** random among the 495 ghazals of Hafez's main section, as today (`fal.ts`, `FalCard.swift`). Works offline (bundled).
- **Result** (paper): the first couplet on the big card («بیتِ فالت»), «حافظ چی می‌گه؟», then کل غزل · بشنو · نگه دار, the next two couplets fading out, «کارتش رو بفرست», «برای یه نیت دیگه» → intro.
- **«حافظ چی می‌گه؟»:** no source yet (owner to decide who writes the 495 readings). Until then show the Ganjoor meaning of the first couplet when the data has one, and hide the card when it doesn't. Make the reading a field in the curation data (`tools/ganjoor/curation.json` → `fal.json` next to the bundled data) so it can be filled later without code.
- **Whole ghazal:** the whole-poem view with the fal couplet highlighted (amber `#FFF4D6` with an amber ring, label «بیتِ فالت»); «بشنو» plays from that couplet.
- **Share card:** 9:16 image rendered on the phone (`ImageRenderer` on iOS; canvas on the web): night lapis, «فال من از حافظ», the couplet, the reading's first sentence, yebeyt.com. Never the name or the wish. Channels: story, پیام‌ها (send to a friend; account needed), save image, more.
- **History:** on the phone only (same storage as other local data), `{date, poemPath}`; the wish is never typed or stored. Newest first. Synced? No.

Debug arguments: `-beytRoute fal|fal-result|fal-ghazal|fal-share|fal-history`, `-beytFalPoem <n>` (fixed ghazal), `-beytSeedFals <n>`. **Tests:** the ring resets on early release; a fal is added to history with the right poem; works with the network off; UI screenshots of every board. Web: pointer events for the hold (`webapp/components/reader/useLongPress.ts` is a start).

---

## 5 · `feat/public-profiles`: public and private profiles, follow, «تازه‌ها»

Owner, 28 Nov: «پروفایل‌ها باید بتونن پابلیک یا پرایوت بشن و دیفالت باید پابلیک باشن که بتونیم اینجا چیز میز نشون بدیم. حتی برای کسی که دوستی نداره. مثل اینستا.» Boards: `OnbVisibility`, `PersonPublic`, `PersonPrivate`, `PrivacyVisibility`, `PeopleStart`, and the feed in `EmptyHomeFriends`. Decision text: yebeyt-2.md «Public profiles and finding friends».

**The model**
- Two relations: **friends** (mutual, by request; unchanged: messages, games, shared divans) and **follow** (one-way, new): following a public profile needs no approval and puts their public activity in my «تازه‌ها». A friend counts as followed.
- `visibility`: `public` | `private` per account.
  - Public: anyone signed in sees the profile page and the activity each setting allows as «همه»; anyone can follow.
  - Private: only friends see the activity; others see `PersonPrivate` and can send a friend request; nobody can follow. Turning private removes every follow from people who aren't friends (the copy on `PrivacyVisibility` says so).
- **No follower or following counts** anywhere (the calm rule from the 20 Nov social roadmap: no follower counts, no like races). The existing `friendsCount` stays where it is today. Ask the owner before showing any count.
- Messages and game invites stay as their own settings (`messagesFrom`, `gameInvitesFrom`), unchanged: public does not open messages to strangers.

**Server (`apps/server`)**
- `db/schema.ts`:
  - `users.visibility text not null default 'private'` with enum `public | private`. The default in the database is `private` on purpose; the client sends the choice made in onboarding (see Defaults).
  - New table `follows (follower_id, followee_id, created_at)`: primary key on the pair, check not self, index on `followee_id`, cascade on user delete.
  - `privacy_settings`:
    - `keptVisibility` (the divan) and `dailyVisibility` gain `everyone`: enum `everyone | friends | me`.
    - New `reactionsVisibility everyone | friends | me` for likes and reposts. Today they follow `keptVisibility` (`routes/feed.ts` description); split them.
    - New `findableByEmail boolean not null default true` (used by slice 6).
  - While an account is private, `everyone` acts as `friends`.
  - Run `pnpm --filter @yebeyt/server db:generate` and commit the migration.
- Routes:
  - `POST /v1/follows/{username}` and `DELETE /v1/follows/{username}`:
    - 404 when not found or blocked either way.
    - 409 `private` when private and not a friend.
    - Idempotent.
  - `GET /v1/users/{username}` (`routes/people.ts` `PublicProfile`):
    - Add `visibility`, `following` and `canFollow`.
    - Add the flags `canSeeActivity` and `badges` (the earned badge ids). Badges are public on a public profile.
  - `GET /v1/users/{username}/activity?kind=reactions|daily&cursor=`:
    - 30 a page, newest first, respecting the settings.
    - 403 `private` when not allowed.
  - `GET /v1/feed` (`routes/feed.ts`):
    - Items come from friends and from the people I follow, filtered by each person's settings.
    - Each item gets `suggested: boolean`.
    - When the page has fewer than 10 items from the last 7 days, add suggested items from public accounts I don't follow. Rank them by reactions in the last 48 h, and include the house account (`users.is_house`). Never take them from someone blocked either way. Mark them `suggested: true`.
  - `GET /v1/people/suggestions`: up to 10 public people I don't follow and aren't friends with, and nobody blocked. Each has a `why` key: `taste` (shares a favourite poet from the taste chosen in onboarding; store the taste on the server if it isn't yet), `league` (same league group), or `friends` (a friend of a friend).
  - `PUT /v1/me/visibility { visibility }`. `GET /v1/me` returns `visibility`.
  - Blocking also removes follows both ways (`routes/blocks.ts`).
  - Account merge (`mergeAccounts.ts`) moves follows. Account delete cascades.
- Update `packages/api/openapi.json` (`api:generate`).

**Defaults (privacy by default, GDPR Art. 25)**
- New accounts choose on `OnbVisibility`, a step after the username. «عمومی» is preselected and marked «پیشنهاد ما», and the person taps «بعدی». The choice is sent with the username.
- Accounts made before this release stay `private`, so nothing they did becomes public without them. They get a one-time card on the من tab («صفحه‌ت می‌تونه عمومی باشه») that opens `PrivacyVisibility`.
- The divan's default stays as it is.
- **Decided (owner, 28 Nov):** «عمومی» stays preselected. The step can't be skipped (no «رد شو»), so everyone sees the choice; the privacy policy (both languages) says profiles are public unless you choose private, and how to change it.

**Clients**
- Onboarding: new step `OnbVisibility` between username and friends. iOS: `Onboarding/OnboardingFlow.swift` and a new view next to `OnbFriendsView.swift`. Web: `webapp/components/onboarding/OnboardingHost.tsx`. The step bar gets a fourth step «صفحه‌ت».
- Person page (`Friends/PersonScreen.swift`, `PersonModel.swift` · `webapp/components/friends/PersonScreen.tsx`):
  - Public: chips (league, streak, favourite poets), «دنبال کن» / «دنبالش می‌کنی», and «دوستی بخواه» (the existing friend control).
  - Tabs پسندیده‌ها · معماها · نشان‌ها. The «…» menu keeps report and block.
  - Private: the lock card and «دوستی بخواه» only.
- Home feed (`Friends/Feed/FeedSection.swift`, `FeedModel.swift`, `FeedText.swift` · `FeedSection.tsx`, `FeedCard.tsx`):
  - The title becomes «تازه‌ها».
  - When I follow nobody, show the line «هنوز کسی رو دنبال نمی‌کنی؛ اینا رو بقیه گذاشتن…» and the suggestions carousel (person cards with «دنبال کن»).
  - Suggested items carry a «پیشنهاد» tag.
  - Guests: show the carousel's people as a sign-in card (the feed needs an account).
- Privacy (`Me/Privacy/PrivacyScreen.swift`, `PrivacyStore.swift` · `PrivacyScreen.tsx`):
  - The «صفحه‌ی من» card on top (عمومی / خصوصی).
  - Three three-way rows: پسندیده‌ها و بازنشرها, معمای امروز, دیوان.
  - The «با ایمیلم پیدام کنن» switch.
  - The existing switches below.
- People (`Friends/PeopleScreen.swift` · `PeopleScreen.tsx`): `PeopleStart` when the field is empty: the contacts card (slice 6; hidden on the web and until then), «شاید بخوای دنبالشون کنی», and the invite link row.
- Debug and stubs: extend `Debug/FriendsBackend.swift` with a public stranger (`negar`), a private stranger (`bardia`, as on the board), follows, suggestions and suggested feed items. Add `-beytVisibility public|private`, `-beytRoute people-start|person:bardia`, and `-beytOnboarding visibility`.

**Also**
- Privacy policy, both languages (`apps/web/app/(fa)/privacy`, `(en)/en/privacy`): public profiles, what is public, follows, how to go private.
- App Store privacy label: Name, User ID and Other User Content are visible to other users (owner-todo §5).
- `docs/app-store.md` review notes: how to try a public and a private profile with the house account.

**Acceptance**
- A new account picks public or private in onboarding.
- A public profile's likes, reposts and daily results are seen by a stranger and appear in their «تازه‌ها» after they follow.
- A private profile shows only the lock to strangers; follow is refused.
- Going private removes non-friend followers.
- Blocking removes follows.
- No count of followers appears anywhere.
- An account made before this stays private.

**Tests**
- Server (vitest, PGlite): every visibility × setting × relation combination for profile, activity and feed; follow rules; suggestions exclude blocked, followed and friends; migration defaults.
- iOS unit tests for the models; UI tests for the onboarding step, both person pages and privacy.
- Web Playwright for the same.

---

## 6 · `feat/contacts`: find friends from contacts, by email

Owner, 28 Nov: «ما شماره سیو نمی‌کنیم ولی ایمیل‌ها رو داریم. باید بتونیم به یه طریقی دوستاش رو از ایمیل ایمپورت کنیم. معمولا دسترسی مخاطبین می‌گیرن…». Boards: `PeopleStart` (the card), `ContactsAsk`, `ContactsFound`, `ContactsNone`.

- **How it matches:**
  - On the phone, read only the contacts' email addresses (`CNContactEmailAddressesKey`, plus the given name for the local «هنوز نیومدن» list).
  - Normalise each address: trim it and lower-case it; don't strip dots or plus parts. Then hash it with SHA-256 (CryptoKit) and send the hashes.
  - The server compares them with the SHA-256 of the verified emails it already keeps (`identities.email`).
  - It returns the people found, as `FoundPerson`, never an email.
  - Nothing sent is stored or logged.
- **Server:**
  - Add `identities.email_sha256` (indexed): fill it on every sign-in, backfill it in the migration, and clear it with the email.
  - `POST /v1/people/contacts { hashes: string[] }`:
    - Takes up to 1000 hashes per call; rate-limited to 5 calls an hour per user.
    - Returns `{ items: FoundPerson[] }` (with `visibility`, `friendship`, `following`, `canPlay`).
    - Matches only accounts with `findableByEmail` on, never me, never anyone blocked either way.
    - Apple relay addresses (`@privaterelay.appleid.com`) are never matched.
- **iOS:**
  - `ContactsAsk` is our own explanation, shown before the system prompt; «اجازه بده» then asks `CNContactStore.requestAccess`.
  - `Info.plist` `NSContactsUsageDescription` (Persian): «برای اینکه ببینی کدوم دوستات توی یه بیت هستن. فقط ایمیل‌ها، رمزی‌شده، و نگه داشته نمی‌شن.»
  - iOS 18 limited access: use the contacts granted and show «فقط مخاطب‌هایی که اجازه دادی» with a button to the system's contact access picker.
  - Denied: the card says «دسترسی به مخاطبات بسته‌ست» with «تنظیمات».
  - `ContactsFound`:
    - People found: «دنبال کن» for public profiles, «دوستی بخواه» for private ones, and «همه رو دنبال کن» for the public ones.
    - «هنوز نیومدن»: the local names and emails of contacts with no match, each with «دعوت». «دعوت» opens the share sheet with the invite text and link. **We never email anyone.**
  - None found → `ContactsNone`.
  - Entry points: `PeopleStart`, `EmptyInbox`, `EmptyFriends`, and the onboarding friends step (`Onboarding/OnbFriendsView.swift`).
- **Web:** no contacts (the Contact Picker API is only on Android Chrome). Hide the card and keep the invite link.
- **Not doing:** Google contacts through the People API. It needs a restricted scope and Google's security review, and the phone's contacts already hold most Gmail addresses.
- **Also:**
  - `PrivacyInfo.xcprivacy`: contacts are read but not kept, so they don't count as collected under Apple's definition. Write this down in owner-todo §5 for the label.
  - Privacy policy: a paragraph on contacts matching.
  - Privacy screen: the «با ایمیلم پیدام کنن» switch (slice 5).
- **Acceptance:**
  - A contact whose email matches an account that is findable appears.
  - Nothing is found for accounts that switched findability off, for blocked accounts, or for relay addresses.
  - Hashes are never stored. Check this with a test that inspects the database after a call.
  - Limited and denied access each show their own state.
- **Tests:**
  - Server (vitest): matching, findability, blocks, the rate limit, and that nothing is persisted.
  - iOS: the normalisation and hashing; UI tests with a fake contacts store (`-beytContacts found|none|denied|limited`).

---

## 7 · `feat/fal-pair`: فال دونفره

Boards: `FalFriend` → `FalPair` → `FalPairResult`. Needs an account and a friend, so a guest gets `AccountGate`.

- **Server:** a new kind in the live games (`apps/server/src/games.ts`, `live.ts`, `hub.ts`):
  - Two players. Each sends `hold-start` and `hold-end`.
  - When both have held for 2 s at the same time, the server picks the ghazal and sends it to both.
  - The result is written into their conversation as a fal card (a new message kind), so it stays there.
  - An invite link `/g/<code>` works like the other games.
- **Clients:**
  - `FalFriend` lists the friends who can play; non-users get the link.
  - `FalPair` shows both rings: mine follows my finger, theirs comes over the socket. Either one letting go resets both.
  - `FalPairResult` is `FalResult` with both faces and «برو به پیام‌ها».
  - The chat shows the fal card (couplet, «فال تو و سارا», «ببین»).
- **Starts:** «با یه دوست فال بگیر» on `FalIntro`, and the «فال دونفره بگیرید» starter in `EmptyChatNew`.
- **Tests:**
  - Server: the hold timing and both players getting the same ghazal.
  - Clients: UI with the fake live socket (`-beytLive 1`) and `-beytRoute fal-pair`.
