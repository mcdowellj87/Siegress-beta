# Siegress Beta

An illustrated exploration game featuring painted 3D characters, psionic combat, and proximity music.

Play: https://mcdowellj87.github.io/Siegress-beta/

GitHub Pages deploys automatically when `main` is updated.

## Run locally

Install Node.js 22.12 or newer, then run:

```sh
npm ci
npm run dev -- --port 5187
```

Open http://127.0.0.1:5187/.

## Build

```sh
npm run build
```

The browser build is written to `dist/`. See [DESKTOP.md](DESKTOP.md) for desktop packaging.

Runtime artwork, audio, the optimized Muffin Man GLB, and its Draco decoder are included. Generated builds, dependencies, local hosting settings, and retired experiments are excluded.

## Controls

WASD to move, Shift to sprint, R to regulate, F for casting mode, Space to cast. Tab opens the developer console.

Original game artwork and audio belong to their respective creators. Included third-party libraries retain their license notices. No open-source license is granted for the original game or artwork.
