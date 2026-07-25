import { useEffect, useRef } from 'react';
import { CalibrationScreen } from './calibration/CalibrationScreen';
import { GameCanvas } from './game/GameCanvas';
import { usePoseDetection } from './pose/usePoseDetection';
import { useGameStore } from './state/gameStore';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  usePoseDetection(videoRef);
  const phase = useGameStore((state) => state.phase);
  const gesture = useGameStore((state) => state.gesture);
  const isPlaying = phase === 'playing';

  useEffect(() => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    if (!context) return;

    const x = (1 - gesture.hipX) * canvas.width;
    const y = gesture.hipY * canvas.height;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fillStyle = '#3b82f6';
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.stroke();
  }, [gesture.hipX, gesture.hipY]);

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gray-900">
      {isPlaying && (
        <div className="absolute inset-0">
          <GameCanvas />
        </div>
      )}

      <div
        className={
          isPlaying
            ? 'absolute right-4 top-4 z-10 aspect-video w-72 overflow-hidden rounded-lg border border-gray-600 bg-black shadow-2xl'
            : 'relative aspect-video w-full max-w-6xl overflow-hidden rounded-xl border border-gray-700 shadow-2xl'
        }
      >
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 object-cover"
          muted
          playsInline
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {phase === 'calibrating' && <CalibrationScreen />}

        {isPlaying && (
          <>
            <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {gesture.lane}
            </div>
            <div className="absolute bottom-2 right-2 flex gap-2">
              <GestureIndicator active={gesture.jump} label="Jump" />
              <GestureIndicator active={gesture.duck} label="Duck" />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function GestureIndicator({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
        active
          ? 'border-green-300 bg-green-500/90 text-white'
          : 'border-gray-500 bg-black/70 text-gray-400'
      }`}
    >
      {label}
    </span>
  );
}

export default App;
