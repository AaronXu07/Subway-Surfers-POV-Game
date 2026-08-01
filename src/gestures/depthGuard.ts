import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type DepthStatus = 'unknown' | 'valid' | 'tooFar' | 'tooClose';

export function shoulderSpan(landmarks: NormalizedLandmark[]) {
  const left = landmarks[11];
  const right = landmarks[12];
  if (!left || !right || (left.visibility ?? 1) < 0.5 || (right.visibility ?? 1) < 0.5) {
    return null;
  }

  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function classifyDepth(
  span: number,
  baseline: number,
  previous: DepthStatus,
): DepthStatus {
  const ratio = span / baseline;
  if (previous === 'tooClose') return ratio > 1.3 ? 'tooClose' : 'valid';
  if (previous === 'tooFar') return ratio < 0.7 ? 'tooFar' : 'valid';
  if (ratio > 1.3) return 'tooClose';
  if (ratio < 0.7) return 'tooFar';
  return 'valid';
}
