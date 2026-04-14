# MIX LINE Modular Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic 2031-line `src/app.tsx` into focused modules with esbuild bundling, zero behavior changes.

**Architecture:** Replace `tsc` compilation with esbuild bundling. Split code into `src/engine/` (business logic), `src/ui/` (React components), and `src/styles.ts` (CSS injection). All modules use ES imports/exports; esbuild bundles into a single IIFE for Spicetify.

**Tech Stack:** TypeScript, esbuild (new), Spicetify API, React (via Spicetify global)

---

### Task 1: Add esbuild and update build config

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install esbuild**

```bash
cd C:/Users/l1kad/Desktop/spo
npm install --save-dev esbuild
```

- [ ] **Step 2: Update package.json scripts**

Replace the `scripts` section in `package.json` with:

```json
{
  "scripts": {
    "build": "esbuild src/app.tsx --bundle --outfile=dist/app.js --format=iife --target=es2020 --jsx=transform --jsx-factory=Spicetify.React.createElement --jsx-fragment=Spicetify.React.Fragment",
    "watch": "esbuild src/app.tsx --bundle --outfile=dist/app.js --format=iife --target=es2020 --jsx=transform --jsx-factory=Spicetify.React.createElement --jsx-fragment=Spicetify.React.Fragment --watch"
  }
}
```

- [ ] **Step 3: Update tsconfig.json for module support**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react",
    "jsxFactory": "Spicetify.React.createElement",
    "jsxFragmentFactory": "Spicetify.React.Fragment",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "noEmit": true,
    "paths": {
      "react": ["./node_modules/@types/react"]
    }
  },
  "include": ["src/**/*"]
}
```

Key change: `"module": "ESNext"` (was `"None"`), `"noEmit": true` (esbuild handles output, tsc only type-checks).

- [ ] **Step 4: Verify esbuild builds the current app.tsx**

```bash
npm run build
```

Expected: `dist/app.js` is created with no errors.

- [ ] **Step 5: Verify tsc type-checks cleanly**

```bash
npx tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "build: switch to esbuild bundler, tsc for type-checking only"
```

---

### Task 2: Extract types and constants

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/constants.ts`

- [ ] **Step 1: Create `src/engine/types.ts`**

```typescript
export interface HistoryEntry {
  uri: string;
  name: string;
  artist: string;
  imageUrl: string;
  timestamp: number;
}

export interface WaveState {
  isActive: boolean;
  isLoading: boolean;
  seedTrackName: string;
  currentTrackName: string;
  currentArtistName: string;
  currentImageUrl: string;
  currentUri: string;
  lockedArtist: string | null;
  playedCount: number;
  history: HistoryEntry[];
  activeMood: string | null;
  isFavoritesMode: boolean;
  sessionMinutes: number;
  uniqueArtistsCount: number;
  topArtists: { name: string; count: number }[];
  topLikedArtist: string | null;
  pinnedMood: string | null;
}
```

- [ ] **Step 2: Create `src/engine/constants.ts`**

```typescript
export const MOODS = [
  { id: "chill", label: "Chill" },
  { id: "focus", label: "Focus" },
  { id: "hype", label: "Hype" },
  { id: "sad", label: "Sad" },
  { id: "drive", label: "Drive" },
  { id: "romantic", label: "Romantic" },
  { id: "party", label: "Party" },
  { id: "workout", label: "Workout" },
  { id: "sleep", label: "Sleep" },
  { id: "acoustic", label: "Acoustic" },
  { id: "indie", label: "Indie" },
  { id: "electronic", label: "Electronic" },
] as const;

export const EQ_COLS = 13;
export const EQ_ROWS = 7;
export const EQ_COLS_MINI = 9;
export const EQ_ROWS_MINI = 5;
```

- [ ] **Step 3: Update `src/app.tsx` to import from new files**

At the top of `app.tsx`, add:

```typescript
import { HistoryEntry } from "./engine/types";
import { MOODS, EQ_COLS, EQ_ROWS, EQ_COLS_MINI, EQ_ROWS_MINI } from "./engine/constants";
```

Remove the `HistoryEntry` interface, `MOODS` array, and `EQ_*` constants from `app.tsx` (lines 7-34).

- [ ] **Step 4: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

Expected: both pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/constants.ts src/app.tsx
git commit -m "refactor: extract types and constants into engine modules"
```

---

### Task 3: Extract WaveEngine

**Files:**
- Create: `src/engine/WaveEngine.ts`
- Modify: `src/app.tsx` — remove WaveEngine class (~600 lines)

- [ ] **Step 1: Create `src/engine/WaveEngine.ts`**

Copy the entire `class WaveEngine { ... }` block from `app.tsx` (lines 40 through the closing `}` of the class, approximately line 730) into this new file. Add at the top:

```typescript
import { HistoryEntry } from "./types";
import { MOODS } from "./constants";
```

Add `export` before `class WaveEngine`.

- [ ] **Step 2: Update `src/app.tsx`**

Remove the `class WaveEngine { ... }` block from `app.tsx`. Add import:

```typescript
import { WaveEngine } from "./engine/WaveEngine";
```

- [ ] **Step 3: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/engine/WaveEngine.ts src/app.tsx
git commit -m "refactor: extract WaveEngine into dedicated module"
```

---

### Task 4: Extract icons

**Files:**
- Create: `src/ui/icons.tsx`
- Modify: `src/app.tsx` — remove icon functions

- [ ] **Step 1: Create `src/ui/icons.tsx`**

Move all icon functions (`WaveIcon`, `PlayIcon`, `StopIcon`, `RefreshIcon`, `HeartIcon`, `ThumbDownIcon`, `LockIcon`, `HistoryIcon`, `StatsIcon`, `MoodIcon`, `MixIcon`) from `app.tsx` into this file.

At the top:

```typescript
const h = (...args: any[]) => Spicetify.React.createElement(...(args as [any, any, ...any[]]));

export function WaveIcon({ size }: { size: number }) {
  // ... exact existing code
}
// ... all other icon functions, each with export
```

Every function gets `export` keyword.

- [ ] **Step 2: Update `src/app.tsx`**

Remove all icon functions. Add import:

```typescript
import { WaveIcon, PlayIcon, StopIcon, RefreshIcon, HeartIcon, ThumbDownIcon, LockIcon, HistoryIcon, StatsIcon, MoodIcon, MixIcon } from "./ui/icons";
```

- [ ] **Step 3: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/icons.tsx src/app.tsx
git commit -m "refactor: extract icon components into ui/icons"
```

---

### Task 5: Extract visual components (AsciiWave, SeaWaves, MixLabel)

**Files:**
- Create: `src/ui/visualizers.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create `src/ui/visualizers.tsx`**

Move `AsciiWave`, `MixLabel`, `PanelMixLabel`, `SeaWaves`, and the `SEA_ROWS` constant from `app.tsx`. At the top:

```typescript
import { EQ_COLS, EQ_ROWS, EQ_COLS_MINI, EQ_ROWS_MINI } from "../engine/constants";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));
```

Export: `AsciiWave`, `MixLabel`, `PanelMixLabel`, `SeaWaves`.

Also move and export `newMixCounter`, `newMixListeners`, `triggerNewMix`, `useNewMixSignal` into this file (they're used exclusively by MixLabel/PanelMixLabel and the "New mix" button callbacks).

- [ ] **Step 2: Update `src/app.tsx`**

Remove moved code. Add:

```typescript
import { AsciiWave, MixLabel, PanelMixLabel, SeaWaves, triggerNewMix } from "./ui/visualizers";
```

- [ ] **Step 3: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/visualizers.tsx src/app.tsx
git commit -m "refactor: extract visual components (AsciiWave, SeaWaves, MixLabel)"
```

---

### Task 6: Extract panel components (NowPlayingCard, MoodChips, Stats, History)

**Files:**
- Create: `src/ui/panel.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create `src/ui/panel.tsx`**

Move these components from `app.tsx`: `NowPlayingCard`, `MainTab`, `MoodChips`, `InlineStats`, `HistoryTab`, `LikeButton`, `StatsTab`.

At the top:

```typescript
import { HistoryEntry, WaveState } from "../engine/types";
import { MOODS } from "../engine/constants";
import { WaveEngine } from "../engine/WaveEngine";
import { HeartIcon, PlayIcon, StopIcon, MixIcon, MoodIcon, HistoryIcon, StatsIcon, LockIcon, ThumbDownIcon } from "./icons";
import { AsciiWave, PanelMixLabel, triggerNewMix } from "./visualizers";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));
```

Each component needs `export`. They receive `engine` as a module-level reference. Add at the top of the file, after imports:

```typescript
let engine: WaveEngine;
export function setEngine(e: WaveEngine) { engine = e; }
```

Change component type signatures to use `WaveState` instead of `ReturnType<WaveEngine["getState"]>`.

Export: `setEngine`, `NowPlayingCard`, `MainTab`, `MoodChips`, `InlineStats`, `HistoryTab`, `StatsTab`.

- [ ] **Step 2: Update `src/app.tsx`**

Remove moved components. Add:

```typescript
import { setEngine as setPanelEngine, NowPlayingCard, MainTab, HistoryTab, StatsTab } from "./ui/panel";
```

After creating the engine instance, call: `setPanelEngine(engine);`

- [ ] **Step 3: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/panel.tsx src/app.tsx
git commit -m "refactor: extract panel components (NowPlayingCard, MoodChips, Stats, History)"
```

---

### Task 7: Extract HomeBanner and BottomBarWidget

**Files:**
- Create: `src/ui/HomeBanner.tsx`
- Create: `src/ui/BottomBarWidget.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create `src/ui/HomeBanner.tsx`**

Move `HomeBanner` function. Imports:

```typescript
import { MOODS } from "../engine/constants";
import { WaveEngine } from "../engine/WaveEngine";
import { WaveIcon, PlayIcon, StopIcon, HeartIcon, MixIcon } from "./icons";
import { SeaWaves, PanelMixLabel, triggerNewMix } from "./visualizers";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));

let engine: WaveEngine;
export function setHomeBannerEngine(e: WaveEngine) { engine = e; }
```

Move `useEngineState` and `useTimeTick` hooks into a new shared file or keep them in app.tsx. Best: create `src/ui/hooks.ts`:

```typescript
import { WaveEngine } from "../engine/WaveEngine";

const React = Spicetify.React;

let engine: WaveEngine;
export function setHooksEngine(e: WaveEngine) { engine = e; }

export function useEngineState() {
  const [state, setState] = React.useState(engine.getState());
  React.useEffect(() => {
    const unsub = engine.subscribe(() => setState({ ...engine.getState() }));
    return () => { unsub(); };
  }, []);
  return state;
}

export function useTimeTick(active: boolean) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [active]);
}
```

Import `useEngineState` in HomeBanner from `./hooks`.

Export `HomeBanner`.

- [ ] **Step 2: Create `src/ui/BottomBarWidget.tsx`**

Move `BottomBarWidget` function. Imports:

```typescript
import { WaveEngine } from "../engine/WaveEngine";
import { WaveIcon, StopIcon, MoodIcon, HistoryIcon, StatsIcon, MixIcon } from "./icons";
import { AsciiWave, PanelMixLabel, triggerNewMix } from "./visualizers";
import { NowPlayingCard, MainTab, HistoryTab, StatsTab } from "./panel";
import { useEngineState } from "./hooks";

const React = Spicetify.React;
const h = (...args: any[]) => React.createElement(...(args as [any, any, ...any[]]));

let engine: WaveEngine;
export function setBottomBarEngine(e: WaveEngine) { engine = e; }
```

Export `BottomBarWidget`.

- [ ] **Step 3: Update `src/app.tsx`**

Remove `HomeBanner`, `BottomBarWidget`, `useEngineState`, `useTimeTick`. Add:

```typescript
import { setHooksEngine } from "./ui/hooks";
import { setHomeBannerEngine, HomeBanner } from "./ui/HomeBanner";
import { setBottomBarEngine, BottomBarWidget } from "./ui/BottomBarWidget";
```

In `main()`, after `const engine = new WaveEngine()`:

```typescript
setHooksEngine(engine);
setPanelEngine(engine);
setHomeBannerEngine(engine);
setBottomBarEngine(engine);
```

- [ ] **Step 4: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks.ts src/ui/HomeBanner.tsx src/ui/BottomBarWidget.tsx src/app.tsx
git commit -m "refactor: extract HomeBanner, BottomBarWidget, and shared hooks"
```

---

### Task 8: Extract styles

**Files:**
- Create: `src/styles.ts`
- Delete: `src/styles.css`
- Modify: `src/app.tsx`

- [ ] **Step 1: Create `src/styles.ts`**

Move the entire `injectStyles()` function from `app.tsx` into this file. Add `export` keyword.

```typescript
export function injectStyles() {
  // ... exact existing code
}
```

- [ ] **Step 2: Delete unused `src/styles.css`**

```bash
rm src/styles.css
```

- [ ] **Step 3: Update `src/app.tsx`**

Remove `injectStyles` function. Add:

```typescript
import { injectStyles } from "./styles";
```

- [ ] **Step 4: Build and type-check**

```bash
npm run build && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/styles.ts src/app.tsx
git rm src/styles.css
git commit -m "refactor: extract styles, remove unused styles.css"
```

---

### Task 9: Clean up app.tsx entry point and final verification

**Files:**
- Modify: `src/app.tsx` — should now be ~80-120 lines (entry point only)

- [ ] **Step 1: Verify app.tsx is now just the entry point**

`src/app.tsx` should contain only:
- Imports
- `const engine = new WaveEngine()` and engine setup calls
- `cleanupPreviousInstance()`
- `registerContextMenu()`
- `injectHomeBanner()`
- `main()`
- The self-invoking `(async () => { await main(); })()`

Confirm no stray code remains. If the `h` helper is still there, remove it (each ui file has its own).

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: `dist/app.js` created, no errors.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Copy to Spicetify and apply**

```bash
cp dist/app.js mywave.js
cp mywave.js "$APPDATA/spicetify/Extensions/mywave.js"
"$LOCALAPPDATA/spicetify/spicetify.exe" apply
```

Expected: Spicetify applies successfully, Spotify restarts, MIX LINE works identically.

- [ ] **Step 5: Verify file sizes**

```bash
wc -l src/app.tsx src/engine/*.ts src/ui/*.tsx src/ui/*.ts src/styles.ts
```

Expected: `app.tsx` ~80-120 lines, no file over ~600 lines, total roughly same as before.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: complete modular split — app.tsx is now entry point only"
```
