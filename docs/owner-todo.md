# Owner to-do

Things only the owner can do: they need accounts or devices the agents don't have here (the corporate proxy on this laptop blocks `gcloud`, Cloudflare and the simulator's network). None of them blocks the build; tick them off on the other laptop.

## 1. Cloudflare: point api.yebeyt.com at the new server

In Cloudflare → yebeyt.com → DNS, edit the `api` record:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `api` | `1kdy3n7t.up.railway.app` | DNS only (grey cloud) |

It still points at `al3flpv4.up.railway.app`, the deleted 1.0 service. The `_railway-verify.api` TXT record is already right; leave it. Check afterwards: `curl https://api.yebeyt.com/health` answers `{"status":"ok"}`. Until then the server answers at https://server-production-98f46b7e.up.railway.app, and sign-in on a phone doesn't work.

## 2. Google Cloud (project `beyt-515410`, account accounts@ksco.nl)

- IAM & Admin → Settings: rename the project to **yebeyt** (the id `beyt-515410` can't change; that's fine).
- Google Auth Platform → Branding: app name «یه بیت», support email accounts@ksco.nl, developer contact hello@yebeyt.com, home page https://yebeyt.com, privacy https://yebeyt.com/privacy, terms https://yebeyt.com/terms, authorised domain yebeyt.com.
- Clients: check that the iOS client `587119002915-eosraa9cam7d314kt6s86t0bnbd6e4fa` has bundle id `com.yebeyt.app`. The app and the server already use that id.

## 3. Apple

- developer.apple.com → Identifiers → `com.yebeyt.app`: the **Sign in with Apple** capability is on.
- The Sign in with Apple key `ZBLL8ASYCU` (team `95YDC2AP63`) is still valid; the server uses it to revoke tokens when an account is deleted.
- App Store Connect: the app record for `com.yebeyt.app` exists; version 2.0.0 will be uploaded there.

## 4. Test on a real phone

These can't be tested in the simulator here:

- A recitation plays and the reader follows it (Hafez, any ghazal, ▶).
- «ادامه با اپل» and «ادامه با گوگل» sign in (after item 1), and then the username step.
- Poet pictures appear on Explore (Hafez, Saadi, …) after a moment online.

## 5. Read when there's time

- The lead's decisions in [yebeyt-2.md](yebeyt-2.md) («Decisions the lead made while the owner was away»).
- `tools/ganjoor/curation.json` (poet bios and book blurbs) and `tools/ganjoor/glossary.json` (word meanings): both written by an agent; please check the Persian.

## 6. Questions (the lead decided something for now; change anything)

1. **Levels:** نوآموز 0 · بیت‌خوان 500 · غزل‌باز 2000 · سخن‌دان 5000 · استاد سخن 12000 points. Names and thresholds OK?
2. **Badges:** ۷ روز, اولین مشاعره, حافظ‌شناس (50 right answers on Hafez), ۱۰۰ بیت (100 couplets read). More badges, other rules?
3. **Avatar parts:** the board draws one face and six accessories. For now: skin, hair and background are colour choices; eyes and mouth have three simple variants. Do you want to design more parts (or have them drawn)?
4. **Settings screen** (the gear on Profile) has no board. It holds the account (name, username, sign out, delete account), text, privacy, about. Is a quick board worth making, or is a plain list fine?
5. **Delete account copy:** «حسابت و همه‌ی چیزهایی که جمع کردی پاک می‌شه. مطمئنی؟» — «پاک کن» / «نه».
6. **Invite texts:** the board has the رفیقانه text; the lead writes شاعرانه and کوتاه. Please read them in the app.
7. **Divan «موضوع»:** grouped by the mood words (عشق, دلتنگی, امید, بهار, جوونی, دوستی, else بقیه). Other topics?
8. **Feedback storage:** screenshots and recordings are kept in Postgres for now (screenshot ≤3 MB, recording ≤25 MB). If many arrive, move them to a Railway bucket. OK?
9. **Feedback after deleting an account:** the text stays, without the user (anonymous). Or should it be deleted too?
10. **Reading feedback:** there is no admin screen yet; feedback is read through the admin API (`GET /v1/admin/feedback` with `ADMIN_TOKEN`). Should a simple page come before the admin dashboard?
11. **Friends = mutual follows.** Following is one-way; two people following each other are friends. OK, or should friend requests need acceptance?
12. **League tiers** reuse the level names (نوآموز … استاد سخن), weekly from Saturday, groups of 30, top 5 up, bottom 5 down. OK?
13. **Notifications:** «تا فردا» games and messages need push notifications. That needs an APNs key (Apple Developer → Keys → a key with Apple Push Notifications). Please create one and put it in Railway as `APNS_KEY` (with its key id as `APNS_KEY_ID`), or tell the lead to do without push for now.
14. **Scores come from the phone,** so a determined cheater could fake them. The server caps points per round, and the daily and onboarding points count once. Good enough for now?

