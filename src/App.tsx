import { useRef } from 'react';
import { CalibrationScreen } from './calibration/CalibrationScreen';
import { usePoseDetection } from './pose/usePoseDetection';
import { useGameStore } from './state/gameStore';

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  usePoseDetection(videoRef);
  const phase = useGameStore(state => state.phase);
  const gesture = useGameStore(state => state.gesture); 

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-6 text-white">
      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 object-cover"
          muted
          playsInline
        />

        {phase === 'calibrating' && <CalibrationScreen />}
      </div>

      {phase === 'playing' && (
        <pre className="w-full max-w-5xl rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xl">
          {JSON.stringify(gesture, null, 2)}
        </pre>
      )}
    </main>
  );
}

export default App;
