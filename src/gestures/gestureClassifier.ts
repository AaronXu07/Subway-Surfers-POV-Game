import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GESTURE_THRESHOLDS } from './gestureThresholds';

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

export function classifyGesture(landmarks: NormalizedLandmark[]): GestureResult {
  const hips = midpoint(23, 24, landmarks);

  let lane: GestureResult['lane'] = 'center';
  if (hips.x > GESTURE_THRESHOLDS.laneLeftX) {
    lane = 'left';
  } else if (hips.x < GESTURE_THRESHOLDS.laneRightX) {
    lane = 'right';
  }

  return {
    jump: hips.y < GESTURE_THRESHOLDS.jumpY,
    duck: hips.y > GESTURE_THRESHOLDS.duckY,
    hipX: hips.x,
    hipY: hips.y,
    lane,
    ts: Date.now(),
  };
}
