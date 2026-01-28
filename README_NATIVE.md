# Native macOS / iOS build (optimal path)

This repo contains **two** builds:

1) **Current web game (kept)**: the original `index.html + main.js` in the repo root (what you already had).
2) **New “Ultimate” rebuild (recommended)**: `r3f-app/` (Vite + React + react-three-fiber) designed to be wrapped into native apps.

Why this approach?
- You keep your existing work intact.
- The new app is modular, easier to extend, and ready for native packaging.

---

## 1) Run the Ultimate build (web)

```bash
cd r3f-app
npm i
npm run dev
```

---

## 2) Build macOS `.app` (Electron)

Prereqs: macOS + Xcode Command Line Tools.

```bash
cd r3f-app
npm i
npm run electron:build:mac
```

Output:
- `r3f-app/release/GooseGameUltimate*.dmg` (contains `.app`)

---

## 3) Build iOS `.app` (Capacitor)

Prereqs: macOS + Xcode.

First-time init:

```bash
cd r3f-app
npm i
npx cap add ios
```

Then build & sync:

```bash
npm run build
npm run cap:sync
npm run cap:open:ios
```

In Xcode:
- Select a signing team
- Build & Run on simulator/device
- Archive for TestFlight/App Store

---

## Assets & licensing notes

The open-source reference project uses a Sketchfab asset pack. **Do not copy or ship assets unless you have a license that allows redistribution**.

This repo’s “Ultimate” build now loads a free low‑poly food pack by default:
- `r3f-app/public/assets/food/` contains the GLB models.
- `r3f-app/src/components/PileItem.tsx` maps item types to model URLs.

To upgrade with your own 3D objects:
- Put your licensed `.glb` models into `r3f-app/public/assets/`.
- Update `MODEL_URLS` in `r3f-app/src/components/PileItem.tsx`.
