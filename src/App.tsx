import { useRef, useEffect, useState } from 'react';
import { CalibrationScreen } from './calibration/CalibrationScreen';
import { GameCanvas } from './game/GameCanvas';
import { CvDriver } from './input/CvDriver';
import { useKeyboardControls, usePauseHotkeys } from './input/useKeyboardControls';
import { useGameStore } from './state/gameStore';
import type { DepthStatus } from './gestures/depthGuard';
import { ThresholdZones } from './ui/ThresholdZones';
import { HipMarker } from './ui/HipMarker';
import { StartScreen } from './ui/StartScreen';
import { Hud } from './ui/Hud';
import { PauseOverlay } from './ui/PauseOverlay';
import { GameOverScreen } from './ui/GameOverScreen';

/** Space reserved above/below the stage for the header and status bar. */
const CHROME_HEIGHT = '10rem';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraAspect, setCameraAspect] = useState(4 / 3);

  const phase = useGameStore((s) => s.phase);
  const controlMode = useGameStore((s) => s.controlMode);
  const gesture = useGameStore((s) => s.gesture);
  const depthStatus = useGameStore((s) => s.depthStatus);
  const hasPose = useGameStore((s) => s.poseLandmarks !== null);

  const isCv = controlMode === 'cv';
  // The webcam + MediaPipe pipeline exists only while this is true.
  const cvActive = isCv && phase !== 'menu';
  const inRun = phase === 'playing' || phase === 'paused' || phase === 'gameOver';

  useKeyboardControls(controlMode === 'keyboard');
  usePauseHotkeys();

  // Match the stage to the camera's real aspect ratio: it stops the feed from being
  // stretched, and it makes normalized landmark coords line up 1:1 with the overlay.
  // Keyboard mode has no camera, so the stage falls back to a fixed 16:9.
  useEffect(() => {
    if (!cvActive) return;
    const video = videoRef.current;
    if (!video) return;

    function syncAspectRatio() {
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        setCameraAspect(video.videoWidth / video.videoHeight);
      }
    }

    syncAspectRatio();
    video.addEventListener('loadedmetadata', syncAspectRatio);
    video.addEventListener('resize', syncAspectRatio);
    return () => {
      video.removeEventListener('loadedmetadata', syncAspectRatio);
      video.removeEventListener('resize', syncAspectRatio);
    };
  }, [cvActive]);

  const stageAspect = cvActive ? cameraAspect : 16 / 9;

  return (
    <div className="flex h-dvh w-screen flex-col items-center gap-3 overflow-hidden bg-zinc-950 p-4 text-zinc-100">
      {cvActive && <CvDriver videoRef={videoRef} />}

      <header className="flex w-full max-w-6xl shrink-0 items-center justify-between px-1">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-200">POV Runner</h1>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              (cvActive ? hasPose : phase === 'playing')
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                : 'bg-zinc-600'
            }`}
          />
          <span className="text-zinc-400">
            {cvActive && !hasPose ? 'waiting for camera' : phase}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60"
          style={{
            aspectRatio: `${stageAspect}`,
            width: `min(100%, calc((100dvh - ${CHROME_HEIGHT}) * ${stageAspect}))`,
          }}
        >
          {phase === 'menu' && <StartScreen />}

          {inRun && (
            <div className="absolute inset-0">
              <GameCanvas />
            </div>
          )}

          {inRun && <Hud />}

          {/* CV mode owns a video panel: full-stage during calibration, corner
              PiP during the run so the tracking overlays stay readable. */}
          {cvActive && (
            <div
              className={
                inRun
                  ? 'absolute right-3 top-3 z-10 w-[28%] overflow-hidden rounded-xl border border-white/15 bg-black shadow-lg shadow-black/60'
                  : 'absolute inset-0'
              }
              style={inRun ? { aspectRatio: `${cameraAspect}` } : undefined}
            >
              <video
                ref={videoRef}
                className="h-full w-full -scale-x-100 object-cover"
                muted
                playsInline
              />

              {phase !== 'calibrating' && <ThresholdZones />}
              <HipMarker />

              {phase === 'calibrating' && <CalibrationScreen />}
            </div>
          )}

          {phase === 'calibrating' && (
            <button
              className="absolute left-4 top-4 z-10 rounded-full border border-white/20 bg-black/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200 backdrop-blur transition-colors hover:bg-black/70"
              onClick={() => useGameStore.getState().setPhase('menu')}
              type="button"
            >
              ← Menu
            </button>
          )}

          {phase === 'paused' && <PauseOverlay />}
          {phase === 'gameOver' && <GameOverScreen />}
        </div>
      </div>

      <footer className="flex w-full max-w-6xl shrink-0 items-center justify-center gap-3 px-1">
        {cvActive ? (
          <>
            <StatusPill label="Jump" active={gesture.jump} />
            <StatusPill label="Duck" active={gesture.duck} />
            <DepthPill status={depthStatus} />
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5">
              <span className="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
                Hip
              </span>
              <span className="font-mono text-base tabular-nums text-zinc-200">
                x {gesture.hipX.toFixed(2)}
              </span>
              <span className="font-mono text-base tabular-nums text-zinc-200">
                y {gesture.hipY.toFixed(2)}
              </span>
            </div>
          </>
        ) : (
          <p className="py-2.5 text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
            {phase === 'menu'
              ? 'Pick a control mode to start'
              : '← → lanes · ↑ jump · ↓ roll · Esc pause'}
          </p>
        )}
      </footer>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-colors duration-150 ${
        active
          ? 'border-emerald-400/60 bg-emerald-400/15'
          : 'border-white/10 bg-zinc-900'
      }`}
    >
      <div
        className={`h-2.5 w-2.5 rounded-full transition-colors duration-150 ${
          active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-700'
        }`}
      />
      <span
        className={`text-sm font-semibold uppercase tracking-[0.15em] transition-colors duration-150 ${
          active ? 'text-emerald-200' : 'text-zinc-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

const DEPTH_LABELS: Record<DepthStatus, string> = {
  unknown: 'Depth —',
  valid: 'Depth OK',
  tooFar: 'Step closer',
  tooClose: 'Step back',
};

/**
 * Out-of-range depth suppresses gestures, so it gets a pill that reads as a warning
 * rather than the plain on/off styling the gesture pills use.
 */
function DepthPill({ status }: { status: DepthStatus }) {
  const isWarning = status === 'tooFar' || status === 'tooClose';
  const isValid = status === 'valid';

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-colors duration-150 ${
        isValid
          ? 'border-emerald-400/60 bg-emerald-400/15'
          : isWarning
            ? 'border-amber-400/60 bg-amber-400/15'
            : 'border-white/10 bg-zinc-900'
      }`}
    >
      <div
        className={`h-2.5 w-2.5 rounded-full transition-colors duration-150 ${
          isValid
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            : isWarning
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              : 'bg-zinc-700'
        }`}
      />
      <span
        className={`text-sm font-semibold uppercase tracking-[0.15em] transition-colors duration-150 ${
          isValid ? 'text-emerald-200' : isWarning ? 'text-amber-200' : 'text-zinc-400'
        }`}
      >
        {DEPTH_LABELS[status]}
      </span>
    </div>
  );
}

export default App;
