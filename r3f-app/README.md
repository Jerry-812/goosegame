# GooseGame Ultimate (R3F + Native Packaging)

This folder is a modern, high-performance 3D rewrite of the game using **Three.js + React Three Fiber**.
It is designed to be wrapped into native apps:

- **iOS**: via Capacitor (Xcode builds an iOS `.app`)
- **macOS**: via Electron builder (builds a macOS `.app` + DMG)

## Dev

```bash
cd r3f-app
npm install
npm run dev
```

## Build Web

```bash
npm run build
npm run preview
```

## iOS `.app` (Capacitor)

```bash
npm run build
npm run cap:sync
# first time only:
# npx cap add ios
npm run cap:open:ios
```

Then in Xcode: select a device/simulator and Build/Run.

## macOS `.app` (Electron)

```bash
npm run build
npm run electron:build:mac
```

Output will be in `release/`.

## Assets

This project now supports real GLB models (with a procedural fallback).

- Food models are loaded from `public/assets/food/` and mapped in `src/components/PileItem.tsx`.
- If you want to swap or add models, update `MODEL_URLS` in `src/components/PileItem.tsx`.
- If a model is missing, the game falls back to the procedural geometry.

### Attribution

The current food model pack is adapted from **XOIAL – Free Low Poly Food Asset Pack** (Sketchfab).
Please keep attribution if you redistribute the assets, and verify the license terms.
