import { LANE_X, type LaneIndex } from '../constants';

/** Frame-rate independent exponential approach (same math as three's MathUtils.damp). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Nearest lane to an x position (mid-switch resolves to whichever side of the divider). */
export function laneFromX(x: number): LaneIndex {
  if (x < (LANE_X[0] + LANE_X[1]) / 2) return 0;
  if (x > (LANE_X[1] + LANE_X[2]) / 2) return 2;
  return 1;
}
