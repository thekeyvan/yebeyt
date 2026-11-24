# Owner to-do

Only what is still open. These need accounts or devices the agents don't have here (the corporate proxy on this laptop blocks Cloudflare, `gcloud` and the simulator's network). None of them blocks the build. What's already done is listed at the end.

## 0. App Store Connect: an API key for TestFlight uploads

So the lead can upload TestFlight builds from this Mac: appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API → Team Keys → «+». Name `yebeyt ci`, access **Admin** (needed so Xcode can create the distribution certificate). Download the `.p8` (only once; keep a copy with the push key) and tell the lead the **Key ID** and the **Issuer ID**. The lead keeps the file in `~/.appstoreconnect/private_keys/`, never in the repo. Then in the app's TestFlight tab, add yourself to an Internal Testing group.

## 1. Google Cloud

- Once Google sign-in works on a phone, shut down the old project `beyt-515410` (IAM & Admin → Settings → Shut down).

## 2. Test on a real phone

These can't be tested in the simulator here (build from Xcode onto the phone):

- A recitation plays and the reader follows it (Hafez, any ghazal, ▶).
- «ادامه با اپل» and «ادامه با گوگل» sign in, and then the username step. api.yebeyt.com works now, so this can be tested.
- Poet pictures appear on Explore (Hafez, Saadi, …) after a moment online.
- Feedback: shake the phone on any screen and the sheet opens; the «بازخورد» row in settings opens it too. Send a bug with a screenshot and a screen recording («دوباره انجامش بده، ما فیلم می‌گیریم»): iOS asks once to allow recording, then the red «در حال ضبط · تموم» pill shows. The simulator gives ReplayKit no frames, so recording can only be tested on a real phone. The report should appear in `GET /v1/admin/feedback` with the screenshot and the recording.
- With a second account (another phone, or a friend): send a friend request and accept it, send a message, and play a game together.

## 3. Read when there's time

- The lead's decisions in [yebeyt-2.md](yebeyt-2.md) («Decisions the lead made while the owner was away»).
- `tools/ganjoor/curation.json` (poet bios and book blurbs) and `tools/ganjoor/glossary.json` (word meanings): both written by an agent; please check the Persian.

## 4. App Store Connect: the privacy label (don't fill it in yet)

This table covers only feedback. Accounts, the divan sync, friends, messages and game scores also send data, and those rows are still missing. The lead will finish the full table before the first upload; fill in the label then, all at once.

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
- 24 Nov: App Clip ID `com.yebeyt.app.Clip` registered (Associated Domains). App Store Apple ID `6837700208` (the lead turns it on in the website's store buttons when 2.0 is live; until then the id has no store page). The old Pages project is deleted.
- 24 Nov: App Store Connect Privacy Policy URL https://yebeyt.com/en/privacy and Support URL https://yebeyt.com/en/support; Google consent screen links (/en, /en/privacy, /en/terms) and the App Store id on the Google iOS client.
- 24 Nov: push key «yebeyt push» (`K95YXBLYY5`) in Railway as `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`.
- Answered 24 Nov: badges (the four), delete-account copy, the three invite texts, divan topics, feedback in Postgres, feedback read through the admin API until the dashboard, score caps are enough for now, the friend-requests copy; the English home adds "(poetry duels)" after mosha'ere.
- Answered earlier: levels, avatar parts, settings as a plain list, feedback stays anonymous after account deletion, league tiers, push notifications, another person's page in a plain layout, friend requests instead of mutual follows. The privacy policy has the lines about reported messages and feedback.
