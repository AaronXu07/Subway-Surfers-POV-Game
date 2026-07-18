# Project Architecture — POV Motion Cardio Game

A browser-based "subway surfers POV" cardio game: webcam pose tracking drives a real-time 3D game via MediaPipe + Three.js.

## Concept

Player stands in front of their webcam. Jump/duck/side-step gestures are detected via pose tracking and control a 3D on-rails runner (obstacles rushing toward camera, lane changes, perspective depth) — the "actual game" version of the workout-reel format.

## Core Technical Challenge

Two independent real-time systems must run concurrently without either blocking the other:
1. **Pose detection** — webcam → MediaPipe inference → gesture classification
2. **3D rendering** — Three.js game loop (obstacles, camera, player, collisions)

The architecture below exists almost entirely to keep these two loops decoupled, since coupling them (running inference inline inside the render loop) would periodically freeze the entire page — JS is single-threaded, and a blocking inference call stalls rendering, input, and UI simultaneously.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build tool | Vite | Fast HMR for iterating on thresholds/camera params |
| UI framework | React + TypeScript | Type safety across async worker/webcam message-passing |
| 3D rendering | React Three Fiber (R3F) + drei | Declarative Three.js in React; perspective camera + depth needed for POV effect (plain 2D canvas can't fake this convincingly) |
| Pose detection | `@mediapipe/tasks-vision` (Pose Landmarker), run in a Web Worker | Keeps inference off the main thread — genuine OS-level multithreading, not just async scheduling |
| Shared state | Zustand | Selector-based subscriptions (no whole-tree re-renders like Context), plain `getState()`/`setState()` API usable outside React (inside `useFrame`, inside worker message handlers) |
| Backend (optional, minimal) | Supabase (Postgres) | Only for session logging / lightweight leaderboard — kept intentionally minimal since DB depth is already demonstrated in the finance tracker project |
| Analytics | Plausible or Vercel Analytics | Visitor/session counts without custom tracking code |
| Hosting | Vercel / Netlify | Free tier, HTTPS by default (required for `getUserMedia`) |

**Explicitly decided against:** Redux Toolkit (ceremony disproportionate to a ~15-20 field store for a solo project — migration cost later is low if we do outgrow Zustand); Jotai (our state is one cohesive "game session" domain, not many independent atoms); Valtio (mutate-from-anywhere conflicts with wanting one writer per field, which is exactly the discipline we're trying to enforce after prop-drilling pain in a previous project).

## Folder Structure

```
src/
  pose/
    poseWorker.ts          // runs in a Web Worker, owns MediaPipe entirely
    poseWorker.types.ts    // message shapes between main thread <-> worker
    usePoseWorker.ts       // hook: spins up worker, manages video->worker frame piping
  gestures/
    gestureClassifier.ts   // pure functions: landmarks -> {jump, duck, left, right}
    gestureClassifier.test.ts
    calibration.ts         // per-user threshold calibration logic
  state/
    gameStore.ts           // Zustand store — the ONLY shared state
  game/
    scene/
      Scene.tsx, Player.tsx, ObstacleSpawner.tsx, Lane.tsx, Camera.tsx
    loop/
      useGameLoop.ts
    collision.ts            // pure functions, no React/Three imports
  ui/
    HUD.tsx, CalibrationScreen.tsx, GameOverScreen.tsx, SkeletonOverlay.tsx
  App.tsx
```

**Hard rule:** `gestures/` and `pose/` never import from `three` / `@react-three/fiber`. The classifier is pure functions, testable with fake landmark arrays, with zero DOM/WebGL dependency. This boundary is what prevents the "everything imports everything" spaghetti from the last project.

## Data Flow

```
<video> (webcam, getUserMedia)
   ↓ requestVideoFrameCallback (main thread)
poseWorker.ts (Web Worker — real separate thread)
   ↓ postMessage: raw landmarks (gameplay) or raw landmarks for overlay (calibration)
gestureClassifier.ts (pure function, main thread)
   ↓ landmarks + thresholds → {jump, duck, lateral}
gameStore.setGesture(...) — Zustand, plain synchronous call
   ↓
R3F components — read via useGameStore.getState() inside useFrame
   ↓
WebGL canvas
```

### Key rules for using the store

- **Inside `useFrame` (continuous, per-frame, 60fps):** use `useGameStore.getState()` — plain function call, no subscription, no re-render. Mutate Three.js object refs directly (position/rotation/scale). Never drive continuous motion through `setState`/React state — that would trigger 60 React re-renders/sec.
- **Inside regular UI components (HUD, calibration, game-over):** use the reactive `useGameStore(selector)` hook — these should re-render on discrete state changes (score, status).
- **Worker's `onmessage` handler:** writes directly via `useGameStore.getState().setGesture(...)` — no React involvement needed.

### Threading model

- **Multithreaded:** MediaPipe inference, isolated in the Worker — real OS-level parallelism. This is the only genuinely heavy computation in the pipeline.
- **Asynchronous but single-threaded:** everything else (R3F render loop via `requestAnimationFrame`, video frame capture via `requestVideoFrameCallback`, Zustand reads/writes, React itself) — cooperatively interleaved on the main thread, cheap enough individually that this is fine.

### Frame-dropping, not queuing

If inference takes longer than the camera's frame interval, the worker drops incoming frames rather than queuing them (`if (processing) return`). This bounds staleness to one inference cycle rather than letting a backlog accumulate and progressively lag gesture state behind real time.

## Calibration Flow

Same pose pipeline as gameplay (same worker, same model) — a `mode` flag tells the worker to return raw landmarks (calibration) instead of classified gestures (gameplay), avoiding a duplicate detection system.

**UI approach:** mirrored `<video>` feed with a live SVG skeleton overlay (landmark dots/connections drawn in normalized 0-1 coordinates matching MediaPipe's output), plus countdown-driven capture steps ("jump now!" → capture → confirm) for jump/duck/lateral thresholds. This is the standard approach used by production pose-tracking apps — not a placeholder technique.

Quality details that matter here:
- Exponential moving average smoothing on landmarks before rendering (raw output is jittery frame-to-frame)
- Mirror the video AND the landmark x-coordinates consistently
- Filter to ~15-17 body connections (skip facial landmarks) for a clean look
- This screen is a strong candidate for marketing clips — real-time skeleton tracking is immediately legible to someone scrolling past

## Performance Priorities (in order)

1. **End-to-end gesture latency** (webcam → inference → classify → render) — the core hard engineering problem, worth actually measuring and documenting
2. **Gesture classification / calibration accuracy** — thresholding, debouncing, per-user calibration; a real signal-processing problem, not just "call MediaPipe"
3. **Architecture discipline** — worker boundary, single-writer-per-field store convention, imperative-vs-reactive split — this is what avoids the prop-drilling mess from before
4. Real usage/traction data (if we pursue the reels-marketing angle) — secondary to the above

## Explicitly Out of Scope / Kept Minimal

- Persistent backend/leaderboard: minimal Supabase setup only, not a focus area
- Visual asset fidelity: low-poly/stylized geometry preferred over imported models, for predictable performance budget
- Redux or heavier state tooling: not adopted, see stack rationale above
