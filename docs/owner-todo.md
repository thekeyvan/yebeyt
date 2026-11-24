# Owner to-do

Only what is still open. These need accounts or devices the agents don't have here (the corporate proxy on this laptop blocks Cloudflare, `gcloud` and the simulator's network). None of them blocks the build. What's already done is listed at the end.

## 1. Apple

- **App Clip ID:** if it isn't finished yet, register `com.yebeyt.app.Clip` (Identifiers → «+» → App IDs → App Clip, parent `com.yebeyt.app`, Product Name `Clip`), with only **Associated Domains** ticked.
- **App Store id:** send the lead the app's Apple ID (App Store Connect → the app → App Information → General → Apple ID; a number of about 10 digits). The lead puts it in the website's store buttons.
- **App Store Connect URLs:** in App Store Connect set the Privacy Policy URL to https://yebeyt.com/en/privacy and the support URL to https://yebeyt.com/en/support.
- **Push key backup:** the push key file `AuthKey_K95YXBLYY5.p8` is still in Downloads. Put it in a password manager and delete it from Downloads; it can't be downloaded again.

## 2. Google Cloud

- When the Apple ID from item 1 is known, add it to the iOS client (APIs & Services → Credentials → the iOS client → App Store ID).
- On the OAuth consent screen (Branding) set the home page https://yebeyt.com/en, privacy https://yebeyt.com/en/privacy, terms https://yebeyt.com/en/terms.
- Once Google sign-in works on a phone, shut down the old project `beyt-515410` (IAM & Admin → Settings → Shut down).

## 3. Test on a real phone

These can't be tested in the simulator here (build from Xcode onto the phone):

- A recitation plays and the reader follows it (Hafez, any ghazal, ▶).
- «ادامه با اپل» and «ادامه با گوگل» sign in, and then the username step. api.yebeyt.com works now, so this can be tested.
- Poet pictures appear on Explore (Hafez, Saadi, …) after a moment online.
- Feedback: shake the phone on any screen and the sheet opens; the «بازخورد» row in settings opens it too. Send a bug with a screenshot and a screen recording («دوباره انجامش بده، ما فیلم می‌گیریم»): iOS asks once to allow recording, then the red «در حال ضبط · تموم» pill shows. The simulator gives ReplayKit no frames, so recording can only be tested on a real phone. The report should appear in `GET /v1/admin/feedback` with the screenshot and the recording.
- With a second account (another phone, or a friend): send a friend request and accept it, send a message, and play a game together.

## 4. Read when there's time

- The lead's decisions in [yebeyt-2.md](yebeyt-2.md) («Decisions the lead made while the owner was away»).
- `tools/ganjoor/curation.json` (poet bios and book blurbs) and `tools/ganjoor/glossary.json` (word meanings): both written by an agent; please check the Persian.

## 5. Open questions (the lead decided something for now; change anything)

1. **Badges:** ۷ روز, اولین مشاعره, حافظ‌شناس (50 right answers on Hafez), ۱۰۰ بیت (100 couplets read). More badges, other rules?
2. **Delete account copy:** «حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟» — «پاک کن» / «نه».
3. **Invite texts:** the board has the رفیقانه text; the lead writes شاعرانه and کوتاه. Please read them in the app.
4. **Divan «موضوع»:** grouped by the mood words (عشق, دلتنگی, امید, بهار, جوونی, دوستی, else بقیه). Other topics?
5. **Feedback storage:** screenshots and recordings are kept in Postgres for now (screenshot ≤3 MB, recording ≤25 MB). If many arrive, move them to a Railway bucket. OK?
6. **Reading feedback:** there is no admin screen yet; feedback is read through the admin API (`GET /v1/admin/feedback` with `ADMIN_TOKEN`). Should a simple page come before the admin dashboard?
7. **Scores come from the phone,** so a determined cheater could fake them. The server caps points per round, and the daily and onboarding points count once. Good enough for now?

## 6. App Store Connect: the privacy label for feedback

The app has a privacy manifest (`apps/ios/Yebeyt/PrivacyInfo.xcprivacy`): no tracking, UserDefaults (reason CA92.1, the app's own settings), and the data that feedback sends. In App Store Connect → the app → App Privacy → Data Types, tick (for the lead to review; Apple's names):

| Data type (Apple's group) | What it is here | Linked to the user | Tracking | Purpose |
|---|---|---|---|---|
| Diagnostics → Other Diagnostic Data | The «اطلاعات فنی» of a bug report (screen, couplet, reader mode, recitation position, text settings, network type, account state, recent error codes), plus app version, phone model and system version on every report | Yes (the report carries the user when signed in; a guest's report carries nobody) | No | App Functionality |
| Usage Data → Product Interaction | The last ≤20 screen names visited, sent only with a bug report (names only, never text) | Yes (same) | No | App Functionality |
| User Content → Other User Content | The text of a report, its screenshot (the person may draw on or cover parts of it) and the optional screen recording | Yes (same) | No | App Functionality |

Notes:
- Reports also keep nothing about the connection: no IP address, location or device id (the server logs only method, route, status and time).
- The manifest can only say «linked», not «linked when signed in», so it says linked. In the label, answer «Yes, linked to the user» as above.
- Questions for the lead's review: should the report text be filed under **Customer Support** and screenshots/recordings under **Photos or Videos** instead of Other User Content? Sign-in and sync already send a name, a username and a user id, the divan and game scores: the manifest and the label need those entries too when the accounts slices are reviewed for the App Store (this slice added only the feedback ones).
- The privacy policy on the new website already has this clause: «اگه بازخورد بفرستی، متن، عکس صفحه و (اگه بخوای) فیلم صفحه‌ات رو می‌گیریم. اگه باگ گزارش کنی، اطلاعات فنی گوشی (نسخه‌ی اپ، مدل و نسخه‌ی سیستم، صفحه‌ای که بودی، چند صفحه‌ی قبلش، کدهای خطاهای اخیر) هم همراهشه. اگه وارد حساب شده باشی، گزارش به نام کاربریت ثبت می‌شه؛ اگه نه، بی‌نام. چیزی که جای دیگه تایپ کردی، پیام‌هات، شماره‌ات، آی‌پی یا مکانت هیچ‌وقت همراهش نمی‌ره.»

## Done

- 24 Nov: `yebeyt.com` and `www.yebeyt.com` point at the new website on Railway (certificates valid); the old Pages site is detached.
- 24 Nov: `api.yebeyt.com` points at the new server (CNAME `1kdy3n7t.up.railway.app`, certificate valid).
- 24 Nov: new Google Cloud project **yebeyt** (account accounts@ksco.nl), consent screen published, iOS client `461381422799-sfbege1fi9tirookg2rp7utukvdtathq.apps.googleusercontent.com` in the app and in the server's `GOOGLE_CLIENT_IDS`.
- 24 Nov: App ID `com.yebeyt.app` (description yebeyt) with Associated Domains, Push Notifications and Sign in with Apple. The Sign in with Apple key `ZBLL8ASYCU` is valid.
- 24 Nov: push key «yebeyt push» (`K95YXBLYY5`) in Railway as `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`.
- Answered: levels, avatar parts, settings as a plain list, feedback stays anonymous after account deletion, league tiers, push notifications, another person's page in a plain layout, friend requests instead of mutual follows. The privacy policy has the lines about reported messages and feedback.
