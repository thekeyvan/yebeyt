# yebeyt 2.0 design canvas

Source for the sticker-style redesign canvas (Claude Design artifact
https://claude.ai/artifact/JiaDy1vekUMDw6QxCTJNoH, private).

- `project/` is the canvas itself: `canvas.json` (pages, board positions, titles) and one `*.dc.html` per board.
- The `gen_*.py` scripts write those boards. Every board on the canvas comes from them; edit a script, never the board by hand, or the next run overwrites it.
- `fonts/` holds the fonts the canvas loads from its own asset store (Lalezar, Vazirmatn, Parastoo Bold), so the canvas works without Google Fonts. All are OFL. Parastoo Bold is from github.com/rastikerdar/parastoo-font; its licence is next to it. The iOS app will need `Parastoo-Bold.ttf` added to `Yebeyt/Resources/Fonts/`.

## Build order

Run each script with the `project` folder as its only argument, in this order. Later steps patch what earlier ones wrote.

```bash
cd design/canvas
for g in gen_explore gen_calm gen_home gen_player gen_fonts gen_v11 gen_map gen_divan; do python3 -I $g.py project; done
cp Explore_before_names.html project/Explore.dc.html
for g in gen_names gen_shared gen_library gen_games gen_invite gen_play gen_icons gen_links apply_fonts gen_v12 gen_feedback; do python3 -I $g.py project; done
```

| Script | What it makes |
|---|---|
| `gen_explore`, `gen_calm`, `gen_home` | Tab boards (explore, poet, profile, home, inbox, chat) and the shared tab bar |
| `gen_player` | Reading screens (couplet by couplet, meaning, text settings) |
| `gen_fonts` | Font comparison board (old explorations page) |
| `gen_v11` | The canvas layout: one row per flow, the row heading boards, page titles and numbers (the `FLOWS` list), the whole-poem view and the «آ» sheet |
| `gen_map` | App map board |
| `gen_divan`, `gen_shared` | My divan, shared divan |
| `gen_names` | Long poet and book names on Explore (works on `Explore_before_names.html`) |
| `gen_library` | All books, one book, list of ghazals |
| `gen_games`, `gen_play`, `gen_icons` | Games catalogue, the nine game screens, game icons (`gameicons.py` is the icon set) |
| `gen_invite` | Challenge by link, invite friends, play-with-a-friend lobby |
| `gen_links` | Wires buttons to the screens they open |
| `apply_fonts` | Self-hosted fonts and bold Parastoo as the poem font on every board |
| `gen_v12` | Whole-poem view with the shared header, long-press state, mode toggle on every reading screen |
| `gen_feedback` | Shake-to-feedback sheet, bug report, game suggestion |

## Previewing a board without the canvas

`shoot.py` renders boards to PNG with headless Chrome, mapping the canvas's `/_blob/...` font URLs to the files in `fonts/` and `Yebeyt/Resources/Fonts/`:

```bash
python3 -I shoot.py design /tmp/shots Calm.dc.html Poem.dc.html
```

## Publishing

Boards are published to the artifact above with the Artifact tool (`root` = this folder, `file_path` = `project/canvas.json`, every board listed in `files`). Fonts and poet portraits are already in the artifact's asset store; their `/_blob/...` ids are in the scripts.
