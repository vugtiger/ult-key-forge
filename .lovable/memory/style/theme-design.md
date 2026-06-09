---
name: Wix-Style Mint & Peach Theme
description: Light cream background, mint green primary + peach orange accent, Wix-style soft rounded cards, 3D floating geometric shapes background (R3F spheres/cubes/toruses)
type: design
---
- Color palette: cream background (40 30% 98%), mint green primary (140 55% 65%), peach orange accent (24 95% 78%). Light theme, NOT dark.
- Fonts: Inter (body), Space Grotesk (headings, tight -0.02em tracking).
- Card style: Wix-style soft rounded — radius 1.25rem, white/70 bg, soft mint shadow, lift on hover.
- Background: `CloudBackground` renders R3F `<Canvas>` with floating mint/peach 3D geometric shapes (spheres, cubes, toruses, icosahedrons) with physical/clearcoat material. No smoke, no particles.
- Logo: `src/assets/wix-logo.png` — 3D gradient shield-cube mark, green→orange.
- Body has fixed radial gradients (mint top-left, peach bottom-right) for soft Wix-template feel.
- Gradients available: `--gradient-brand` (mint→peach 135deg), `--gradient-soft` (pale mint→pale peach).
- Shadows: `--shadow-soft` (mint tint) and `--shadow-pop` (peach tint).
- All pages inherit via semantic tokens (`bg-background`, `text-foreground`, `glass-card`, `depth-card`).
- No custom cursor in this theme.
