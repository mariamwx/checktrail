# UI layer (placeholder)

This folder is the **only** place to replace look-and-feel.

Game rules, Supabase, rooms, scoring, and sync live in `/public/logic/` — **do not edit those for UI work**.

## Layout

| Path | What |
|------|------|
| `hub/hub.css` | Category picker (`/`) styles |
| `category1/` | Anon Wheel markup + CSS |
| `category1/assets/` | Drop images/fonts/icons for Category 1 here |
| `category2/` | Mirror Vote markup + CSS |
| `category2/assets/` | Drop images/fonts/icons for Category 2 here |

## Rules for swapping the UI

1. Keep every **`id="..."`** listed in `CONTRACT.md` (logic binds to these).
2. Keep screen wrappers: `#screen-home`, `#screen-lobby`, etc., and the class `screen` / `active`.
3. You may change class names used only for styling, copy, layout, fonts, colors, and assets.
4. Point new CSS/images at `/ui/category1/assets/...` or `/ui/category2/assets/...`.
5. Do **not** move or rewrite the `<script src="/logic/...">` tags at the bottom of each `index.html`.

## Stable entry URLs

These still work (rewritten to this folder):

- `/game.html` → Category 1
- `/category2.html` → Category 2
- `/` → hub (`app/page.tsx` + `hub/hub.css`)
