import { useRef, useEffect, useState } from 'react';
import { CalibrationScreen } from './calibration/CalibrationScreen';
import { usePoseDetection } from './pose/usePoseDetection';
import { useGameStore } from './state/gameStore';
import { ThresholdZones } from './ui/ThresholdZones';
import { HipMarker } from './ui/HipMarker';

/** Space reserved above/below the camera stage for the header and status bar. */
const CHROME_HEIGHT = '10rem';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

  usePoseDetection(videoRef);
  const phase = useGameStore((s) => s.phase);
  const gesture = useGameStore((s) => s.gesture);
  const hasPose = useGameStore((s) => s.poseLandmarks !== null);

  // Match the stage to the camera's real aspect ratio: it stops the feed from being
  // stretched, and it makes normalized landmark coords line up 1:1 with the overlay.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function syncAspectRatio() {
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    }

    syncAspectRatio();
    video.addEventListener('loadedmetadata', syncAspectRatio);
    video.addEventListener('resize', syncAspectRatio);
    return () => {
      video.removeEventListener('loadedmetadata', syncAspectRatio);
      video.removeEventListener('resize', syncAspectRatio);
    };
  }, []);

  return (
    <div className="flex h-dvh w-screen flex-col items-center gap-3 overflow-hidden bg-zinc-950 p-4 text-zinc-100">
      <header className="flex w-full max-w-6xl shrink-0 items-center justify-between px-1">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-200">POV Runner</h1>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              hasPose ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-zinc-600'
            }`}
          />
          <span className="text-zinc-400">{hasPose ? phase : 'waiting for camera'}</span>
        </div>
      </header>

      <div className="flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60"
          style={{
            aspectRatio: `${aspectRatio}`,
            width: `min(100%, calc((100dvh - ${CHROME_HEIGHT}) * ${aspectRatio}))`,
          }}
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

          {phase === 'playing' && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-4 py-1.5 backdrop-blur">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-100">
                {gesture.lane}
              </span>
            </div>
          )}
        </div>
      </div>

      <footer className="flex w-full max-w-6xl shrink-0 items-center justify-center gap-3 px-1">
        <StatusPill label="Jump" active={gesture.jump} />
        <StatusPill label="Duck" active={gesture.duck} />
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

export default App;
