# Third-party notices

The MIT license in [`LICENSE`](LICENSE) covers the code in this repository. It does **not** cover
the fonts or the poetry data listed below; those keep their own terms.

## Fonts (`Yebeyt/Resources/Fonts`)

All fonts are under the SIL Open Font License 1.1. Full license texts are in [`LICENSES/fonts`](LICENSES/fonts).
The files were converted from WOFF2 to TTF without other changes.

| Font | Copyright | License |
|---|---|---|
| Parastoo, Gandom, Sahel, Shabnam (WOL builds) | Saber Rastikerdar ([github.com/rastikerdar](https://github.com/rastikerdar)) | OFL 1.1. Gandom, Shabnam and Parastoo derive from DejaVu / Bitstream Vera, see `DejaVu-Bitstream-Vera.txt` |
| Vazirmatn | The Vazirmatn Project Authors | OFL 1.1 |
| Markazi Text | The Markazi Text Project Authors | OFL 1.1 |
| Noto Naskh Arabic, Noto Nastaliq Urdu | The Noto Project Authors | OFL 1.1 |

## Poetry, meanings and recitations

- Poem texts, line-by-line meanings, poem summaries and poet biographies come from
  [Ganjoor](https://ganjoor.net), through its public data export
  [github.com/ganjoor/ganjoor-data](https://github.com/ganjoor/ganjoor-data).
  The classical poems themselves are in the public domain. Many meanings and summaries were written
  with AI help (the app marks them with a sparkle icon). `ganjoor-data` has not published a license
  for the meanings and summaries, so they are **not** covered by this repository's MIT license.
  The bundled subset lives in `Yebeyt/Resources/Data` and `tools/source`.
- Recitations (audio and timing) are streamed at runtime from `api.ganjoor.net`; no audio is stored
  in this repository.
- No Ganjoor user data (comments, accounts) is included.

Thank you to Ganjoor and its contributors for making this poetry open and readable.
