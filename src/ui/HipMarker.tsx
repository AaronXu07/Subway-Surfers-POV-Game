import { useGameStore } from '../state/gameStore';
import { toScreenX } from '../gestures/gestureThresholds';

/**
 * The hip midpoint is the single point every gesture is derived from, so it gets one
 * small marker — a dot with a thin ring — instead of a full skeleton.
 */
export function HipMarker() {
  const hipX = useGameStore(state => state.gesture.hipX);
  const hipY = useGameStore(state => state.gesture.hipY);
  const hasPose = useGameStore(state => state.poseLandmarks !== null);

  if (!hasPose) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${toScreenX(hipX) * 100}%`, top: `${hipY * 100}%` }}
    >
      <div className="h-9 w-9 rounded-full border-2 border-white/55 shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
    </div>
  );
}
