# Siegress desktop builds

Requires Node.js 24 and npm. Install dependencies with `npm ci`.

| Command | Output |
| --- | --- |
| `npm run desktop:start` | Build and launch the game in Electron |
| `npm run desktop:mac` | Apple Silicon `.app`, DMG and ZIP |
| `npm run desktop:mac:intel` | Intel Mac `.app`, DMG and ZIP |
| `npm run desktop:win` | Windows x64 installer and portable EXE |
| `npm run desktop:linux` | Linux/SteamOS x64 AppImage and tar.gz |

Outputs are in `release/`. The game, artwork, audio and fonts are bundled for offline use. Desktop assets are built separately in `dist-desktop/`; the existing web/Sites build remains `npm run build`. Muffin Man uses the optimized animated GLB. Runtime robot and water-monster sprite assets are also bundled.

On macOS, open `release/mac-arm64/Siegress.app` (or `release/mac/Siegress.app` for Intel). This initial build is ad-hoc signed, not Apple-notarized. Public distribution will require Developer ID signing and notarization. Windows builds also need a signing certificate for trusted public distribution. No signing credentials are stored in this repo.

Build installers on their matching operating system. To enable GitHub Actions, copy `desktop/workflows/desktop.yml` to `.github/workflows/desktop.yml` and commit it using a credential with workflow permission. Then manually run **Desktop executables** to build Apple Silicon, Intel Mac, Windows and Linux packages; download them from that run's artifacts. This workflow does not publish releases automatically.

On SteamOS, copy the x64 AppImage to a writable folder and make it executable (`chmod +x Siegress-*.AppImage`). Add it as a non-Steam game from Desktop Mode, then launch it from Gaming Mode. If AppImage FUSE support is unavailable, run with `--appimage-extract-and-run`, or use the tar.gz package and launch its `siegress-dev` binary. Linux/SteamOS packages are configured but still need testing on those systems. Steam Deck controls can use a Steam Input keyboard/mouse mapping; native gamepad support and Steamworks integration are not included.

F11 or Alt+Enter toggles full screen. On macOS, the View menu also provides full screen, reload and developer tools. The desktop renderer has no Node access, uses a secure local `siegress://game/` origin, and blocks external navigation. Game saves in localStorage persist in Electron's per-user app data directory. The development-only map editing endpoint is not available in packaged builds.

Validation: `npm run desktop:smoke` verifies the bundled game reaches its start screen without renderer errors. `npm run test:desktop` checks bundle path isolation; `npm run test:gait` checks sprite and movement invariants. Always launch a packaged app to check GPU rendering, pointer lock and audio on the target system before distribution.
