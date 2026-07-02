---
name: Luarmor-Style Dark Gold Theme
description: Deep navy background, gold/amber primary CTA, subtle bordered cards, faint chart-line + grid background, gold shield crest logo
type: design
---
- Palette: deep navy bg (222 40% 6%), light foreground (210 25% 92%), gold primary (45 95% 62%).
- Fonts: Inter body, Space Grotesk headings (-0.02em tracking).
- Card: dark navy `hsl(222 35% 9%)`, 1px border `hsl(222 25% 16%)`, radius 0.625rem, soft black shadow. Hover shifts border toward gold.
- Background: `CloudBackground` renders a subtle 56px grid + faint gold chart-line SVG at bottom + top-vignette. No 3D shapes, no smoke.
- Logo: inline SVG gold gradient shield crest in `CloudLogo.tsx`.
- Active nav tab: gold primary pill with dark text, rounded-md.
- Theme override in DashboardLayout clamps custom `--foreground` to min lightness 85%, max saturation 30% so text stays readable on dark bg.
