# Owner to-do

Things only the owner can do: they need accounts or devices the agents don't have here (the corporate proxy on this laptop blocks `gcloud`, Cloudflare and the simulator's network). None of them blocks the build; tick them off on the other laptop.

## 1. Cloudflare: point api.yebeyt.com at the new server

In Cloudflare → yebeyt.com → DNS, edit the `api` record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `api` | `1kdy3n7t.up.railway.app` | DNS only (grey cloud) |

It still points at `al3flpv4.up.railway.app`, the deleted 1.0 service. The `_railway-verify.api` TXT record is already right; leave it. Check afterwards: `curl https://api.yebeyt.com/health` answers `{"status":"ok"}`. Until then the server answers at https://server-production-98f46b7e.up.railway.app, and sign-in on a phone doesn't work.

## 1b. Cloudflare: point yebeyt.com at the new website

The new site (`apps/web`) runs on Railway and answers at https://web-production-83a0b542.up.railway.app. The old Cloudflare Pages site (1.0) still owns yebeyt.com; detach it from Pages first, then in Cloudflare → yebeyt.com → DNS:

| Type | Name | Target / value | Proxy |
|---|---|---|---|
| CNAME | `@` (yebeyt.com) | `j45dzw62.up.railway.app` | DNS only (grey cloud) |
| CNAME | `www` | `uqy7gib1.up.railway.app` | DNS only |
| TXT | `_railway-verify` | `railway-verify=0ff77988ea9c89a144c79c87ed28059d6c156bbce03877270de6863b4e5ea5e6` | — |
| TXT | `_railway-verify.www` | `railway-verify=99e2ec4d1178f00db1b97a3a1af74764917aa999f3af124375c99495eba2d7fa` | — |

Keep any MX/TXT records for Zoho mail (hello@yebeyt.com) as they are. Check afterwards: `curl https://yebeyt.com/.well-known/apple-app-site-association` returns the JSON. Universal Links and the App Clip need this.

Also set the App Store id in `apps/web/lib/config.ts` (`APP_STORE_ID`) once the app record exists; until then the store buttons open an App Store search.

## 2. Google Cloud ✅ (done 24 Nov)

New project **yebeyt** (account accounts@ksco.nl) with the consent screen («یه بیت», support accounts@ksco.nl, contact hello@yebeyt.com, yebeyt.com links, no logo so no verification needed), published. The iOS client `461381422799-sfbege1fi9tirookg2rp7utukvdtathq.apps.googleusercontent.com` (bundle `com.yebeyt.app`, team `95YDC2AP63`) is in `apps/ios/project.yml` and in the server's `GOOGLE_CLIENT_IDS` on Railway.

- Once Google sign-in works on a phone, shut down the old project `beyt-515410` (IAM & Admin → Settings → Shut down).
- Add the App Store id to the iOS client when the app record exists.

## 3. Apple

- developer.apple.com → Identifiers → `com.yebeyt.app`: the **Sign in with Apple** capability is on.
- The Sign in with Apple key `ZBLL8ASYCU` (team `95YDC2AP63`) is still valid; the server uses it to revoke tokens when an account is deleted.
- App Store Connect: the app record for `com.yebeyt.app` exists; version 2.0.0 will be uploaded there.

## 3b. Apple: a key for push notifications

«تا فردا» games and new messages need push notifications. On developer.apple.com → Certificates, IDs & Profiles → Keys → «+»: name it «yebeyt push», tick **Apple Push Notifications service (APNs)**, choose «Sandbox & Production», continue, register, and download the `.p8` file (it can be downloaded only once). Then in Railway → project yebeyt → service `server` → Variables add:

- `APNS_KEY`: the whole text of the `.p8` file
- `APNS_KEY_ID`: the key's 10-character id shown on the page

Never commit the `.p8`. Tell the lead when it's there; push comes in its own slice after that.

## 4. Test on a real phone

These can't be tested in the simulator here:

- A recitation plays and the reader follows it (Hafez, any ghazal, ▶).
- «ادامه با اپل» and «ادامه با گوگل» sign in (after item 1), and then the username step.
- Poet pictures appear on Explore (Hafez, Saadi, …) after a moment online.
- Feedback: shake the phone on any screen and the sheet opens; the «بازخورد» row in settings opens it too. Send a bug with a screenshot and a screen recording («دوباره انجامش بده، ما فیلم می‌گیریم»): iOS asks once to allow recording, then the red «در حال ضبط · تموم» pill shows. The simulator gives ReplayKit no frames, so recording can only be tested on a real phone. The report should appear in `GET /v1/admin/feedback` with the screenshot and the recording.

## 5. Read when there's time

- The lead's decisions in [yebeyt-2.md](yebeyt-2.md) («Decisions the lead made while the owner was away»).
- `tools/ganjoor/curation.json` (poet bios and book blurbs) and `tools/ganjoor/glossary.json` (word meanings): both written by an agent; please check the Persian.

## 6. Questions (the lead decided something for now; change anything)

1. ✅ **Levels:** (owner: OK, 24 Nov) نوآموز 0 · بیت‌خوان 500 · غزل‌باز 2000 · سخن‌دان 5000 · استاد سخن 12000 points. Names and thresholds OK?
2. **Badges:** ۷ روز, اولین مشاعره, حافظ‌شناس (50 right answers on Hafez), ۱۰۰ بیت (100 couplets read). More badges, other rules?
3. ✅ **Avatar parts:** (owner: as is, 24 Nov) the board draws one face and six accessories. For now: skin, hair and background are colour choices; eyes and mouth have three simple variants. Do you want to design more parts (or have them drawn)?
4. ✅ **Settings screen** (owner: plain list, 24 Nov) (the gear on Profile) has no board. It holds the account (name, username, sign out, delete account), text, privacy, about. Is a quick board worth making, or is a plain list fine?
5. **Delete account copy:** «حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟» — «پاک کن» / «نه».
6. **Invite texts:** the board has the رفیقانه text; the lead writes شاعرانه and کوتاه. Please read them in the app.
7. **Divan «موضوع»:** grouped by the mood words (عشق, دلتنگی, امید, بهار, جوونی, دوستی, else بقیه). Other topics?
8. **Feedback storage:** screenshots and recordings are kept in Postgres for now (screenshot ≤3 MB, recording ≤25 MB). If many arrive, move them to a Railway bucket. OK?
9. ✅ **Feedback after deleting an account:** (owner: stays anonymous, 24 Nov) the text stays, without the user (anonymous). Or should it be deleted too?
10. **Reading feedback:** there is no admin screen yet; feedback is read through the admin API (`GET /v1/admin/feedback` with `ADMIN_TOKEN`). Should a simple page come before the admin dashboard?
11. **Friends = mutual follows.** Following is one-way; two people following each other are friends. OK, or should friend requests need acceptance?
12. ✅ **League tiers** (owner: OK, 24 Nov) reuse the level names (نوآموز … استاد سخن), weekly from Saturday, groups of 30, top 5 up, bottom 5 down. OK?
13. **Notifications:** (owner will add the key; steps in 3b) «تا فردا» games and messages need push notifications. That needs an APNs key (Apple Developer → Keys → a key with Apple Push Notifications). Please create one and put it in Railway as `APNS_KEY` (with its key id as `APNS_KEY_ID`), or tell the lead to do without push for now.
14. **Scores come from the phone,** so a determined cheater could fake them. The server caps points per round, and the daily and onboarding points count once. Good enough for now?
15. **Privacy policy (slice 9, the new website):** a reported message keeps a copy of its text for moderation, even if its sender later deletes their account. The policy needs a line about that (and about feedback, see the feedback section).
16. ✅ **Another person's page** (owner: plain layout is fine, 24 Nov) has no board; for now it is the Profile layout without the private parts, plus «دنبال کن», «پیام بده», and «بلاک» / «گزارش». Want a board for it?

## 7. App Store Connect: the privacy label for feedback

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
- The privacy policy (slice 9) needs this clause: «اگه بازخورد بفرستی، متن، عکس صفحه و (اگه بخوای) فیلم صفحه‌ات رو می‌گیریم. اگه باگ گزارش کنی، اطلاعات فنی گوشی (نسخه‌ی اپ، مدل و نسخه‌ی سیستم، صفحه‌ای که بودی، چند صفحه‌ی قبلش، کدهای خطاهای اخیر) هم همراهشه. اگه وارد حساب شده باشی، گزارش به نام کاربریت ثبت می‌شه؛ اگه نه، بی‌نام. چیزی که جای دیگه تایپ کردی، پیام‌هات، شماره‌ات، آی‌پی یا مکانت هیچ‌وقت همراهش نمی‌ره.»
