import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import {
  CALIBRATION_LANDMARKS,
  DEFAULT_CALIBRATION_CONFIG,
  evaluateCalibrationPose,
  type CalibrationBoundsConfig,
} from './calibrationBounds';

interface CalibrationScreenProps {
  config?: CalibrationBoundsConfig;
}

const LANDMARK_LINES = [
  [CALIBRATION_LANDMARKS.head, CALIBRATION_LANDMARKS.leftShoulder],
  [CALIBRATION_LANDMARKS.head, CALIBRATION_LANDMARKS.rightShoulder],
  [CALIBRATION_LANDMARKS.leftShoulder, CALIBRATION_LANDMARKS.rightShoulder],
  [CALIBRATION_LANDMARKS.leftShoulder, CALIBRATION_LANDMARKS.leftHip],
  [CALIBRATION_LANDMARKS.rightShoulder, CALIBRATION_LANDMARKS.rightHip],
  [CALIBRATION_LANDMARKS.leftHip, CALIBRATION_LANDMARKS.rightHip],
];

export function CalibrationScreen({ config = DEFAULT_CALIBRATION_CONFIG }: CalibrationScreenProps) {
  const landmarks = useGameStore(state => state.poseLandmarks);
  const setPhase = useGameStore(state => state.setPhase);
  const holdStartedAtRef = useRef<number | null>(null);
  const [holdTimer, setHoldTimer] = useState<{ startedAt: number | null; now: number }>(() => ({
    startedAt: null,
    now: performance.now(),
  }));

  const evaluation = useMemo(
    () => evaluateCalibrationPose(landmarks, config),
    [landmarks, config],
  );

  useEffect(() => {
    if (!evaluation.isInside) {
      holdStartedAtRef.current = null;
      const rafId = requestAnimationFrame(() => {
        setHoldTimer({ startedAt: null, now: performance.now() });
      });
      return () => cancelAnimationFrame(rafId);
    }

    holdStartedAtRef.current ??= performance.now();
    let rafId: number;

    function updateTimer() {
      const now = performance.now();
      setHoldTimer({ startedAt: holdStartedAtRef.current, now });

      if (holdStartedAtRef.current && now - holdStartedAtRef.current >= config.requiredHoldMs) {
        setPhase('playing');
        return;
      }

      rafId = requestAnimationFrame(updateTimer);
    }

    rafId = requestAnimationFrame(updateTimer);
    return () => cancelAnimationFrame(rafId);
  }, [config.requiredHoldMs, evaluation.isInside, setPhase]);

  const heldMs = evaluation.isInside && holdTimer.startedAt
    ? holdTimer.now - holdTimer.startedAt
    : 0;
  const holdProgress = Math.min(heldMs / config.requiredHoldMs, 1);
  const box = config.box;

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        <rect
          fill="rgba(34, 211, 238, 0.08)"
          height={box.yMax - box.yMin}
          stroke={evaluation.isInside ? '#22c55e' : '#22d3ee'}
          strokeDasharray="0.02 0.015"
          strokeWidth="0.008"
          width={box.xMax - box.xMin}
          x={box.xMin}
          y={box.yMin}
        />

        <g className="-scale-x-100 origin-center">
          {LANDMARK_LINES.map(([from, to]) => {
            const start = landmarks?.[from];
            const end = landmarks?.[to];
            if (!start || !end) {
              return null;
            }

            return (
              <line
                key={`${from}-${to}`}
                stroke={evaluation.isInside ? '#22c55e' : '#facc15'}
                strokeLinecap="round"
                strokeWidth="0.01"
                x1={start.x}
                x2={end.x}
                y1={start.y}
                y2={end.y}
              />
            );
          })}

          {Object.values(CALIBRATION_LANDMARKS).map(index => {
            const landmark = landmarks?.[index];
            if (!landmark) {
              return null;
            }

            return (
              <circle
                cx={landmark.x}
                cy={landmark.y}
                fill={evaluation.isInside ? '#22c55e' : '#facc15'}
                key={index}
                r="0.018"
              />
            );
          })}
        </g>
      </svg>

      <div className="absolute left-1/2 top-6 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950/85 p-4 text-center text-white shadow-xl">
        <p className="text-sm uppercase tracking-wide text-cyan-300">Calibration</p>
        <h1 className="mt-1 text-2xl font-bold">Fit your head, shoulders, and hips inside the box</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {evaluation.isInside ? 'Good position. Hold steady.' : 'Move into the target box.'}
        </p>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-[width,background-color] ${
              evaluation.isInside ? 'bg-green-400' : 'bg-cyan-400'
            }`}
            style={{ width: `${holdProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
