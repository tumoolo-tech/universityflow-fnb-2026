# App artwork: PLACEHOLDERS

**Every image in this folder is a placeholder**, generated from the design tokens by
`node scripts/assets/generate-app-icons.mjs` (the brand green and a "UF" monogram drawn from
plain shapes). Replace them with the final artwork before the first store submission
(docs/store/release-checklist.md), keeping the file names and sizes:

| File | Size | Rules |
|---|---|---|
| `icon.png` | 1024 × 1024 | Opaque, no rounded corners (iOS rounds them), no transparency (App Store refuses it) |
| `adaptive-icon.png` | 1024 × 1024 | Android foreground on transparent; keep the mark inside the middle 66% (the rest may be cropped). The background is `tokens.color.brand` (app.config.ts) |
| `splash-icon.png` | 1024 × 1024 | Shown at 200 pt wide on `tokens.color.canvas` |
| `notification-icon.png` | 96 × 96 | Android status bar: white on transparent only, a simple silhouette |

Running the script again overwrites these files.
