import { useRef, useEffect, useCallback } from 'react';
import { usePoseDetection } from './pose/usePoseDetection';
import { useGameStore } from './state/gameStore';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  usePoseDetection(videoRef);
  const gesture = useGameStore((s) => s.gesture);

  // Draw the hip midpoint waypoint on the canvas overlay
  const drawWaypoint = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Keep canvas dimensions in sync with the video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // hipX/hipY are normalized 0-1; mirror X to match the mirrored video
    const x = (1 - gesture.hipX) * canvas.width;
    const y = gesture.hipY * canvas.height;

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crosshair lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 24, y);
    ctx.lineTo(x - 12, y);
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + 24, y);
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x, y - 12);
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x, y + 24);
    ctx.stroke();
  }, [gesture.hipX, gesture.hipY]);

  useEffect(() => {
    let rafId: number;
    function loop() {
      drawWaypoint();
      rafId = requestAnimationFrame(loop);
    }
    loop();
    return () => cancelAnimationFrame(rafId);
  }, [drawWaypoint]);

  const laneColor = {
    left: 'text-orange-400',
    center: 'text-green-400',
    right: 'text-orange-400',
  }[gesture.lane];

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col items-center justify-center overflow-hidden">
      {/* Camera feed + overlay */}
      <div className="relative w-full max-w-6xl aspect-video rounded-xl overflow-hidden shadow-2xl border border-gray-700">
        <video
          ref={videoRef}
          className="w-full h-full object-cover -scale-x-100"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Lane indicator badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1.5 rounded-full">
          <span className={`font-semibold text-sm uppercase tracking-wide ${laneColor}`}>
            {gesture.lane}
          </span>
        </div>
      </div>

      {/* Status panel */}
      <div className="mt-4 flex gap-6 text-sm font-mono text-gray-300">
        <StatusPill label="Jump" active={gesture.jump} />
        <StatusPill label="Duck" active={gesture.duck} />
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Hip</span>
          <span>{gesture.hipX.toFixed(2)}, {gesture.hipY.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-gray-600'}`}
      />
      <span className={active ? 'text-green-300' : 'text-gray-500'}>{label}</span>
    </div>
  );
}

export default App;
