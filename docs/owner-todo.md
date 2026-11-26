# Owner to-do

Only what is still open. These need accounts or devices the agents don't have here (the corporate proxy on this laptop blocks Cloudflare, `gcloud` and the simulator's network). None of them blocks the build. What's already done is listed at the end.

## 1. Google Cloud

- Google sign-in works on a phone now (24 Nov), so shut down the old project `beyt-515410` (console.cloud.google.com → pick `beyt-515410` → IAM & Admin → Settings → Shut down; type the project id to confirm).

## 1b. The web app (app.yebeyt.com)

- Cloudflare DNS for app.yebeyt.com (the web app already runs at https://webapp-production-529c90ac.up.railway.app). Add two records, both with proxy off (grey cloud): `CNAME` `app` → `9qiq7rgm.up.railway.app`, and `TXT` `_railway-verify.app` → `railway-verify=e8ae026eacb8bf91d81b3dc5d937e91399b58ada56d442b56af67e5e42deabd8`. Railway issues the certificate by itself once they resolve.
- Before web sign-in (slice W4): in developer.apple.com → Identifiers → Services IDs, make `com.yebeyt.web` with Sign in with Apple on, domain `app.yebeyt.com`, return URL `https://app.yebeyt.com/auth/apple`. In Google Cloud (the yebeyt project) → Credentials, make an OAuth client of type *Web application* with origin `https://app.yebeyt.com`. Send the lead both ids (they aren't secret).

## 2. Test on a real phone

These can't be tested in the simulator here (build from Xcode onto the phone):

- A recitation plays and the reader follows it (Hafez, any ghazal, ▶).
- «ادامه با اپل» signs in, and then the username step. (Google ✅ 24 Nov: sign in, save a couplet, sign out and in again, the couplet is still there.)
- Poet pictures appear on Explore (Hafez, Saadi, …) after a moment online.
- Feedback: shake the phone on any screen and the sheet opens; the «بازخورد» row in settings opens it too. Send a bug with a screenshot and a screen recording («دوباره انجامش بده، ما فیلم می‌گیریم»): iOS asks once to allow recording, then the red «در حال ضبط · تموم» pill shows. The simulator gives ReplayKit no frames, so recording can only be tested on a real phone. The report should appear in `GET /v1/admin/feedback` with the screenshot and the recording.
- Shake while typing in chat opens feedback; in a screen recording the keyboard's suggestion bar doesn't show your words (tell the lead if it does).
- VoiceOver and the recording pill: start a screen recording from the bug form with VoiceOver on; the focus jumps to the red pill, and a double-tap stops the recording. Try it inside a game too (the pill must still be reachable and the form comes back).
- With a second account (another phone, or a friend): send a friend request and accept it, send a message, and play a game together.
- Build 202611241909 and later: in «بیت جورچین» a dragged word follows your finger; nothing hides under the tab bar; poet pictures are the new bold portraits and refresh on every launch.
- Recitation: press play on any couplet and it starts there; swipe to another couplet (or tap one in the whole poem) and the audio jumps there. Tell the lead if starting feels slow on mobile data (the audio loads in a precise mode now).
- Feel: like, keep, repost, send and right answers each have their own pop-up and a light tap; a win gets confetti; try with Settings → Accessibility → Motion → Reduce Motion on too.
- Confirmations: leaving a started game, cancelling or rejecting a friend request, signing out, closing unsent feedback ask first; removing a couplet from the divan and «رد کن» on today's couplet show «برگردون».
- The «یه بیت» demo friend: search `yebeyt`, send a request (accepted at once), send a message (it answers with a couplet).
- Build 202611242331 and later: back/close rows stay pinned at the top while you scroll; every bottom sheet shows a grabber and closes with a drag down; tabs slide, the reader springs up, lists spring instead of fading. Invite links on yebeyt.com show your own avatar.
- Build 202611260306 and later: in «گوش کن» the clip stops before the second line starts (tell the lead if one gives the answer away); the games tab is a grid of boards; the «یه بیت» friend has no game chips in its chat; in chat, drag down or tap outside to close the keyboard, and shake works with the keyboard open; removing your couplet from a shared divan disappears for both people; on a small phone (SE) the daily puzzle and onboarding fit without scrolling and the back swipe works from the edge.

## 3. Read when there's time

- The lead's decisions in [yebeyt-2.md](yebeyt-2.md) («Decisions the lead made while the owner was away»).
- `tools/ganjoor/curation.json` (poet bios and book blurbs) and `tools/ganjoor/glossary.json` (word meanings): both written by an agent; please check the Persian.

## 4. App Store Connect: what's there and what 2.0 needs (checked 24 Nov)

The lead is logged in to App Store Connect in the agent browser and uploads TestFlight builds from this Mac with Xcode (no API key needed). The lead asks before anything that can't be undone: submitting for review, releasing, deleting, agreements, tax or payments.

State now:
- **Version 1.0.0 was rejected** (21 Nov, guideline 2.1 "Information Needed"). Apple asked, in the App Review Notes, for: a screen recording on a real device from launch through the main flow, including sign-in, **account deletion**, user content with **report and block**; the app's purpose and audience; how to reach the main features (and login details if needed); the external services used; regional differences; and proof of rights to third-party material. 2.0 replaces 1.0: the same in-flight version is renamed 2.0.0, the 2.0 build attached, and the Notes rewritten.
- The listing text (promo text, description, keywords) still describes the 1.0 reader. 2.0 needs new text: games, friends, messages.
- The screenshots are of 1.0. 2.0 needs new ones (the lead makes them in the simulator).
- The icon shown is 1.0's crescent. It goes away with the first 2.0 build (the 2.0 icon is the two sticker cards).
- Category: Books / Reference now. The lead suggests **Games (Word, Trivia) + Books** for 2.0; set it when the 2.0 listing is written, if the owner agrees.
- Age rating (13+) was answered for a reader. 2.0 adds messages between people and user-written content, so the questionnaire must be answered again.
- App Privacy is published for 1.0 (name, email, user id, other user content, product interaction). 2.0 adds feedback diagnostics, screenshots and recordings, game scores and messages; the lead writes the full table before the first submission.
- Fine as is: free, available in 174 countries (not China mainland, so its compliance banners don't apply), privacy URL `/en/privacy`, support URL `/en/support`, marketing URL `/en`, App Review contact, release set to automatic after approval.
- TestFlight: internal group «K&S Team» exists. Test Information (beta description, feedback email, privacy URL, review contact) is empty; needed only for external testers.

For you:
- **The screen recording for App Review:** on your phone, once 2.0 is on TestFlight: launch, browse, a game, sign in with Apple, a friend request, a message, report and block, delete the account. The lead writes the script when the build is ready.
- **Permission from Ganjoor (for Apple's point 6):** ganjoor-data has no licence file. The poems are public domain, but the meanings and summaries are Ganjoor's own work. Ganjoor's about page says it publishes its data so others can do similar work, which shows intent but isn't a permission. Please send this from hello@yebeyt.com through https://ganjoor.net/contact (or to Hamid Reza Mohammadi directly) and keep the reply; the lead attaches it to the App Review notes:

  > سلام آقای محمدی، وقت‌تون بخیر.
  > من کیوان محمودی هستم، سازندهٔ «یه بیت» (yebeyt.com)، یک اپ رایگان iOS برای خواندن و بازی با شعر فارسی، بدون تبلیغ و بدون فروش داده. متن شعرها، معنی‌ها و خلاصه‌ها را از مخزن عمومی ganjoor-data برمی‌داریم و خوانش‌ها را از API عمومی گنجور پخش می‌کنیم؛ در اپ و سایت، گنجور با لینک به‌عنوان منبع آمده است.
  > اپل برای انتشار اپ مدرکی می‌خواهد که اجازهٔ استفاده از این محتوا را داریم. ممکن است لطف کنید با یک پاسخ کوتاه به همین ایمیل اجازه بدهید که از متن شعرها، معنی‌ها، خلاصه‌ها و خوانش‌های گنجور با ذکر منبع در «یه بیت» استفاده کنیم؟ اگر شرطی برای ذکر منبع یا نحوهٔ استفاده دارید، با کمال میل رعایت می‌کنیم.
  > از سال‌ها کاری که برای شعر فارسی کرده‌اید سپاسگزارم.
- A second account for the reviewer: the lead builds the «یه بیت» demo friend (owner OK, 24 Nov).

## 5. App Store Connect: the privacy label (don't fill it in yet)

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
- 24 Nov: first 2.0 TestFlight build 2.0.0 (202611241416) in the «K&S Team» group; Google sign-in and divan sync tested on a phone.
- 24 Nov: push key «yebeyt push» (`K95YXBLYY5`) in Railway as `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`.
- Answered 24 Nov: badges (the four), delete-account copy, the three invite texts, divan topics, feedback in Postgres, feedback read through the admin API until the dashboard, score caps are enough for now, the friend-requests copy; the English home adds "(poetry duels)" after mosha'ere.
- Answered earlier: levels, avatar parts, settings as a plain list, feedback stays anonymous after account deletion, league tiers, push notifications, another person's page in a plain layout, friend requests instead of mutual follows. The privacy policy has the lines about reported messages and feedback.
