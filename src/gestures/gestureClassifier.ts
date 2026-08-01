import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { resolveThresholds, type CalibrationThresholds } from './gestureThresholds';

/** Returns the midpoint between two landmarks (normalized 0-1). */
function midpoint(land1: number, land2: number, landmarks: NormalizedLandmark[]) {
  const l = landmarks[land1];
  const r = landmarks[land2];
  return {
    x: (l.x + r.x) / 2,
    y: (l.y + r.y) / 2,
  };
}

export interface GestureResult {
  jump: boolean;
  duck: boolean;
  hipX: number;
  hipY: number;
  lane: 'left' | 'center' | 'right';
  ts: number;
}

/**
 * Once the player has calibrated, their own standing pose sets the thresholds; before
 * that we fall back to the shared defaults so the classifier still works.
 */
export function classifyGesture(
  landmarks: NormalizedLandmark[],
  calibration?: CalibrationThresholds | null,
): GestureResult {
  const hips = midpoint(23, 24, landmarks);
  const thresholds = resolveThresholds(calibration);

  let lane: GestureResult['lane'] = 'center';
  if (hips.x > thresholds.laneLeftX) {
    lane = 'left';
  } else if (hips.x < thresholds.laneRightX) {
    lane = 'right';
  }

  return {
    jump: hips.y < thresholds.jumpY,
    duck: hips.y > thresholds.duckY,
    hipX: hips.x,
    hipY: hips.y,
    lane,
    ts: Date.now(),
  };
}
