# Kuartal Terminal — Desktop

A native window (Windows, macOS, Linux) around **https://terminal.kuartalsystems.com**,
built with [Tauri 2](https://tauri.app). Because it loads the live site, the
desktop app is always up to date — no reinstall when the terminal changes.

## Getting the installers

You don't need to build anything on your own computer:

1. On GitHub, open **Actions → Desktop app → Run workflow** (or push a tag like `desktop-v0.1.0`).
2. When it finishes (~15 min), open **Releases** — a draft release has the
   `.msi`/`.exe` (Windows), `.dmg` (macOS) and `.AppImage`/`.deb` (Linux).

## Unsigned builds

These builds are **not code-signed** yet:
- **Windows** shows a SmartScreen warning → "More info" → "Run anyway".
- **macOS** blocks it on first open → right-click the app → Open, or allow it in
  System Settings → Privacy & Security.

Signing needs an Apple Developer account (US$99/yr) and a Windows code-signing
certificate — listed in `docs/ROADMAP.md` for when Kuartal wants a polished
public release.

## Local build (optional, for developers)

Needs Rust, Node 20+, and on Linux `libwebkit2gtk-4.1-dev librsvg2-dev`.

```sh
cd desktop
npm install
npm run build        # installers land in src-tauri/target/release/bundle/
```

`dist/index.html` is only an offline fallback page; the real UI is the web app.
To point the desktop app somewhere else (e.g. a staging server), change
`app.windows[0].url` in `src-tauri/tauri.conf.json`.
