# ZHAW XAI Paper Presentation

Animated presentation built with [Motion Canvas](https://motioncanvas.io/) (TypeScript + Vite).

## Stack

- Motion Canvas v3.17.2
- Node 20.20.2 (pinned via Volta)
- pnpm

## Setup

```bash
pnpm install
pnpm start
```

Editor opens at <http://localhost:9000>.

## First-time Editor Setup

The editor defaults to **RENDER** mode (video export UI). To present:

1. Click the **camera icon** in the left sidebar (Video Settings).
2. Find the **RENDER** button at the bottom of the panel.
3. Click the **dropdown arrow** next to it.
4. Select **PRESENT**.

The choice is stored in browser `localStorage` and persists across reloads. Each contributor / browser profile must do this once.

## Presenting

- Click **PRESENT** button → enters Presentation Mode.
- `Space` → next slide
- `→` skip to next slide (no animation)
- `←` → previous slide
- `F` (in editor) → fullscreen
- `Esc` → exit fullscreen / presenter

Slides are defined in scenes via `yield* beginSlide('name')`.

## Presenter Notes Overlay

Live notes window synced to the presenter. Open in a second window/monitor.

1. Start dev server (`pnpm start`).
2. Main editor: <http://localhost:9000>.
3. Notes window: <http://localhost:9000/notes.html>. Open in separate browser window.
4. Enter presenter mode in the editor (PRESENT button). Notes window auto-syncs.
5. Notes shows **current slide name + notes**, **next slide preview**, **slide counter**, **elapsed timer**.

**Authoring notes:**

In any scene file, replace `beginSlide(name)` with `slide(name, notes, owner?)`:

```ts
import {slide} from '../lib/slide';

yield* slide('fwd:network-built', `
  3 input neurons, 4 hidden, 2 output. Fully connected.
  Mention: input = features, output = class scores.
`, 'Alice');
```

Owner is optional — shown in notes window header (current + next) so each presenter knows when their turn comes. Notes are extracted at build time (regex on `slide('id', \`notes\`, 'owner')`). Vite hot-reloads on save.

**Notes window controls:**

- `←` / `→` → navigate slides (driven from notes window into presenter).
- `Space` → next.
- `R` → reset timer.

**How it works:**

- Vite plugin scans `src/scenes/**/*.{ts,tsx}` for `slide(name, \`notes\`)` and exposes them as `virtual:slide-notes`.
- Bridge script injected into editor monkey-patches `Presenter.prototype.present` to broadcast `onInfoChanged` events via `BroadcastChannel('mc-slides')`.
- Notes window subscribes to channel, renders current/next slide.

## Project Layout

```
notes.html                  presenter notes overlay (route /notes.html)
src/
├── project.ts              register scenes
├── global.d.ts             type shims (?scene, virtual:slide-notes)
├── lib/
│   ├── theme.ts            colors / sizes / fonts
│   ├── slide.ts            slide(name, notes) wrapper around beginSlide
│   ├── neuron.tsx          styled Neuron factory
│   ├── network.tsx         buildNetwork() → {intro, propagate, ...}
│   └── presenter-bridge.ts injected into editor; broadcasts slide events
├── notes/
│   ├── notes.css
│   └── notes-app.ts        notes overlay app
└── scenes/
    ├── 01-intro.tsx
    └── 02-forward-prop.tsx
```

Add new section files as `NN-name.tsx` under `src/scenes/`. Register in `src/project.ts`. Number prefix controls timeline order.

## Resolution

Default canvas: 1920×1080 (16:9). Change in editor (Video Settings → Resolution) or edit `src/project.meta` directly to match presentation display aspect.
