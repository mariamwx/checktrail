# UI layer (placeholder)

HTML/CSS for each category. Game code lives in `/public/logic/` — keep element ids listed in `CONTRACT.md`.

| Path | What |
|------|------|
| `hub/` | Landing hub styles |
| `category1/` | Anon Wheel markup + CSS |
| `category2/` | Mirror Vote markup + CSS |

## Swap UI

1. Replace files under `category1/` / `category2/` (and `hub/` if needed).
2. Keep every id in `CONTRACT.md`.
3. Do not move game rules into the UI layer — that stays in `/logic/`.

## Routes

- `/` → hub
- `/game.html` → Category 1 (`ui/category1`)
- `/category2.html` → Category 2
