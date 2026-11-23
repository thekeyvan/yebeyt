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

11. **Friends = mutual follows.** Following is one-way; two people following each other are friends. OK, or should friend requests need acceptance?
12. **League tiers** reuse the level names (نوآموز … استاد سخن), weekly from Saturday, groups of 30, top 5 up, bottom 5 down. OK?
13. **Notifications:** «تا فردا» games and messages need push notifications. That needs an APNs key (Apple Developer → Keys → a key with Apple Push Notifications). Please create one and put it in Railway as `APNS_KEY` (with its key id as `APNS_KEY_ID`), or tell the lead to do without push for now.
14. **Scores come from the phone,** so a determined cheater could fake them. The server caps points per round, and the daily and onboarding points count once. Good enough for now?

