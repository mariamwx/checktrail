# UI layer (placeholder + diegetic 3D)

This folder is the **only** place to replace look-and-feel.

Game rules, Supabase, rooms, scoring, and sync live in `/public/logic/` — **do not edit those for UI work**.

## Layout

| Path | What |
|------|------|
| `hub/hub.css` | Category picker (`/`) styles |
| `category1/` | Anon Wheel markup + CSS + 3D bridge |
| `category1/assets/` | GLBs (`GJ_AssetsTest_V004.glb`, `GJ_AssetsTest_V005_player4.glb`) |
| `category1/scene-bridge.js` | Three.js / DiegeticWorld ↔ DOM (no game logic) |
| `diegetic-framework/` | Friend’s Three.js framework (CDN import map) |
| `preview/` | **See the models** — open `/ui/preview/` |
| `category2/` | Mirror Vote markup + CSS |
| `CONTRACT.md` | Required element ids for logic |

## See the 3D assets

Open **`/ui/preview/`** (with `npm run dev`). Orbit the room + player4 — original materials and animations, no side panel.

## Rules for swapping the UI

1. Keep every **`id="..."`** listed in `CONTRACT.md` (logic binds to these).
2. Keep screen wrappers: `#screen-home`, `#screen-lobby`, etc., and the class `screen` / `active`.
3. Keep `#scene-container` if you want the Three.js backdrop.
4. You may change class names used only for styling, copy, layout, fonts, colors, and assets.
5. Do **not** move or rewrite the `<script src="/logic/...">` tags at the bottom of each game HTML.
6. Animation / trigger names for the GLB live in `category1/scene-bridge.js` (and `preview/preview.js`), not in logic.

## Stable entry URLs

- `/game.html` → Category 1
- `/category2.html` → Category 2
- `/ui/preview/` → 3D asset sandbox
- `/` → hub (`app/page.tsx` + `hub/hub.css`)
