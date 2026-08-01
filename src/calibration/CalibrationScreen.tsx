import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { toScreenX } from '../gestures/gestureThresholds';
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

const pct = (value: number) => `${value * 100}%`;

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
  const secondsLeft = Math.max(0, Math.ceil((config.requiredHoldMs - heldMs) / 1000));
  const isInside = evaluation.isInside;
  const box = config.box;

  // The video is mirrored, so the box's screen-left comes from the box's xMax.
  const boxStyle = {
    left: pct(toScreenX(box.xMax)),
    top: pct(box.yMin),
    width: pct(box.xMax - box.xMin),
    height: pct(box.yMax - box.yMin),
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Dim everything outside the target so the zone reads as the place to stand. */}
      <div className="absolute inset-0 bg-black/30" style={{ clipPath: outsideBoxClip(box) }} />

      <div
        className={`absolute rounded-2xl border-2 border-dashed transition-colors duration-200 ${
          isInside
            ? 'border-emerald-300/90 bg-emerald-400/10 shadow-[0_0_40px_rgba(52,211,153,0.25)_inset]'
            : 'border-sky-300/80 bg-sky-400/10'
        }`}
        style={boxStyle}
      >
        <span
          className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] transition-colors duration-200 ${
            isInside ? 'bg-emerald-300 text-emerald-950' : 'bg-sky-300 text-sky-950'
          }`}
        >
          {isInside ? 'Holding' : 'Stand here'}
        </span>
      </div>

      {/* Hairline skeleton: enough to show what is tracked, thin enough to ignore. */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        {LANDMARK_LINES.map(([from, to]) => {
          const start = landmarks?.[from];
          const end = landmarks?.[to];
          if (!start || !end) {
            return null;
          }

          return (
            <line
              key={`${from}-${to}`}
              stroke={isInside ? 'rgba(110, 231, 183, 0.85)' : 'rgba(255, 255, 255, 0.7)'}
              strokeLinecap="round"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              x1={toScreenX(start.x)}
              x2={toScreenX(end.x)}
              y1={start.y}
              y2={end.y}
            />
          );
        })}
      </svg>

      {Object.values(CALIBRATION_LANDMARKS).map(index => {
        const landmark = landmarks?.[index];
        if (!landmark) {
          return null;
        }

        return (
          <div
            className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/30 transition-colors duration-200 ${
              isInside ? 'bg-emerald-300' : 'bg-white'
            }`}
            key={index}
            style={{ left: pct(toScreenX(landmark.x)), top: pct(landmark.y) }}
          />
        );
      })}

      <div className="absolute left-1/2 top-4 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-950/80 px-5 py-4 text-center text-white shadow-xl backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
          Calibration
        </p>
        <h1 className="mt-2 text-xl font-semibold">
          Fit your head, shoulders, and hips in the box
        </h1>
        <p className="mt-1.5 text-base text-zinc-300">
          {isInside
            ? `Good position — hold still${secondsLeft > 0 ? ` for ${secondsLeft}s` : ''}.`
            : 'Step back until your whole upper body is inside the dashed zone.'}
        </p>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-100 ${
              isInside ? 'bg-emerald-400' : 'bg-sky-400/60'
            }`}
            style={{ width: `${holdProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Even-odd style cutout: full frame minus the calibration box. */
function outsideBoxClip(box: CalibrationBoundsConfig['box']) {
  const left = toScreenX(box.xMax) * 100;
  const right = toScreenX(box.xMin) * 100;
  const top = box.yMin * 100;
  const bottom = box.yMax * 100;

  return `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${left}% ${top}%,
    ${left}% ${bottom}%,
    ${right}% ${bottom}%,
    ${right}% ${top}%,
    ${left}% ${top}%
  )`;
}
