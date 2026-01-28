You are proposing a small improvement to the Goose Catch Deluxe Three.js game.

Requirements:
- Output a unified diff only.
- Change at most 5 files and no more than 300 lines total.
- Do not modify package.json, lockfiles, .github/workflows, Vite config, or vercel config.
- Do not remove renderer/canvas initialization.
- Prefer performance, stability, or UX improvements that can be validated via Playwright.

Project context:
- The playable app lives under goose-catch-main/ and is built with Vite.
- The root package.json proxies build/preview commands to goose-catch-main.
