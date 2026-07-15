---
name: Black & White Theme
description: Monochrome black/white/gray design with Inter+Space Grotesk fonts, glass-card styling, grain overlay, 3D smoke background
type: design
---
- Color palette: pure black (#080808) background, white foreground, gray midtones. No purple, no blue.
- Fonts: Inter (body), Space Grotesk (headings). Orbitron and Rajdhani removed.
- Glass cards: `glass-card` class — rgba(255,255,255,0.03) bg, blur(20px), 6% white border
- Grain overlay: `grain-overlay` class on page wrappers for texture
- 3D smoke: React Three Fiber animated white smoke particles on black bg
- Logo: Shield+cloud combo PNG (src/assets/shield-cloud-logo.png)
- Buttons: white bg on black (bg-foreground text-background) for primary actions
- No custom cursor. No cloud-cursor.svg references needed in new pages.
