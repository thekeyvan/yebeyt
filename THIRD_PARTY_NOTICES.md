# Third-party notices

The MIT license in [`LICENSE`](LICENSE) covers the code in this repository. It does **not** cover
the fonts or the poetry data listed below; those keep their own terms.

## Fonts (`assets/fonts`)

All fonts are under the SIL Open Font License 1.1. Full license texts are in [`assets/fonts/licenses`](assets/fonts/licenses).
The files were converted from WOFF2 to TTF without other changes.

| Font | Copyright | License |
|---|---|---|
| Parastoo, Gandom, Sahel, Shabnam (WOL builds) | Saber Rastikerdar ([github.com/rastikerdar](https://github.com/rastikerdar)) | OFL 1.1. Gandom, Shabnam and Parastoo derive from DejaVu / Bitstream Vera, see `DejaVu-Bitstream-Vera.txt` |
| Vazirmatn | The Vazirmatn Project Authors | OFL 1.1 |
| Lalezar | Borna Izadpanah ([github.com/BornaIz/Lalezar](https://github.com/BornaIz/Lalezar)) | OFL 1.1 (`Lalezar-OFL.txt`) |
| Parastoo Bold | Saber Rastikerdar ([github.com/rastikerdar/parastoo-font](https://github.com/rastikerdar/parastoo-font)) | OFL 1.1 (same text as Parastoo, `Parastoo-OFL.txt`) |
| Markazi Text | The Markazi Text Project Authors | OFL 1.1 |
| Noto Naskh Arabic, Noto Nastaliq Urdu | The Noto Project Authors | OFL 1.1 |

## Poetry, meanings and recitations

- Poem texts, line-by-line meanings, poem summaries and poet biographies come from
  [Ganjoor](https://ganjoor.net), through its public repositories
  ([github.com/ganjoor](https://github.com/ganjoor), mainly
  [ganjoor-data](https://github.com/ganjoor/ganjoor-data)).
  The classical poems themselves are in the public domain. Ganjoor has not published a license
  for the meanings and summaries, so they are **not** covered by this repository's MIT license.
- `tools/ganjoor/build.py` reads [github.com/ganjoor/ganjoor-data](https://github.com/ganjoor/ganjoor-data)
  at one pinned commit and writes the data bundled in the app (`apps/ios/Yebeyt/Resources/Data`):
  the poets and a few complete books so they work offline. The app fetches other poems from the
  same pinned commit and caches them on the phone.
- Recitations are not stored here: the app asks Ganjoor's API for the list and plays the audio from Ganjoor's servers.
  The only thing derived from recitation audio is times: `tools/ganjoor/build.py --refresh-clips` downloads the mp3s of the
  game deck's Hafez couplets into a gitignored cache to find where each first hemistich ends, and commits only those
  times (`tools/ganjoor/clips.json`, `clip` in `games.json`).
- No recitation audio and no Ganjoor user data (comments, accounts) is stored in this repository.

Thank you to Ganjoor and its contributors for making this poetry open and readable.

## Libraries (`apps/ios`)

- [GoogleSignIn-iOS](https://github.com/google/GoogleSignIn-iOS) (Apache License 2.0) and its dependencies
  (AppAuth, GTMAppAuth, GTMSessionFetcher, GoogleUtilities, AppCheck, Promises; all Apache 2.0), added with Swift Package Manager for «ادامه با گوگل».
- The Apple and Google marks on the sign-in buttons are the only brand art in the app; they are drawn as shapes and belong to Apple and Google.

## Libraries (`apps/webapp`)

- [Next.js](https://github.com/vercel/next.js), [React](https://github.com/facebook/react), [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) and [Motion](https://github.com/motiondivision/motion) (all MIT).
- [UI SDK](https://github.com/vercel-labs/ui) (Apache License 2.0): the headless behaviours (sheets, toasts, segmented controls) under our own look.
- [modern-screenshot](https://github.com/qq15725/modern-screenshot) (MIT, Copyright (c) 2021-present wxm): draws the page into the picture a feedback report may carry (the private views are blank in the copy it draws).
