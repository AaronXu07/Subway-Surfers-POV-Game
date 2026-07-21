import { useRef } from 'react';
import { usePoseDetection } from './pose/usePoseDetection';
import { useGameStore } from './state/gameStore';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  usePoseDetection(videoRef);
  const gesture = useGameStore(state => state.gesture); // reactive, fine for a debug readout

  return (
    <div>
      <video ref={videoRef} className="-scale-x-100" muted playsInline />
      <pre className="text-4xl">{JSON.stringify(gesture, null, 2)}</pre>
    </div>
  );
}

export default App;