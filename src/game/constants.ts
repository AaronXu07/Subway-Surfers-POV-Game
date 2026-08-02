/**
 * Shared gameplay constants — the single source for lane geometry and the
 * interlocked physics/size numbers. These depend on each other:
 *
 * - jump apex = jumpVelocity² / (2 · gravity) = 6.8² / 32 ≈ 1.45u
 * - platformY (0.9) < apex − landTolerance slack, so station platforms are
 *   reachable with a ground jump; trainRoofY (3.0) is not — roofs need a ramp.
 * - garbage bins top out at 1.05: clearable with a real jump and ~0.4 to
 *   spare, and the top-clip grace turns a shave into a stumble, not a death.
 * - roll-only bars span [1.15, 1.55]: the duck height (0.6) slides under, and
 *   the apex (1.45) still lands inside the bar, so jumping never clears them.
 * - duckCameraDrop puts the rolling eye at 2 − 1.45 = 0.55 — just inside the
 *   0.6 duck hitbox, safely under the jump-or-roll beam's 0.85 underside.
 * - the train ramp rises trainRoofY over RAMP_LENGTH (8): slope 0.375, safely
 *   under the grounded ground-follow slope limit (0.55).
 */
export type LaneName = 'left' | 'center' | 'right';
export type LaneIndex = 0 | 1 | 2;

export const LANE_X = [-2.5, 0, 2.5] as const;
export const DIVIDER_X = [-1.25, 1.25] as const;

export const LANE_INDEX: Record<LaneName, LaneIndex> = {
  left: 0,
  center: 1,
  right: 2,
};

export const LANE_NAME: readonly LaneName[] = ['left', 'center', 'right'];

export const PHYSICS = {
  jumpVelocity: 6.8,
  gravity: 16,
  laneDampLambda: 8,
  heightDampLambda: 12,
} as const;

export const SIZES = {
  standHeight: 1.7,
  duckHeight: 0.6,
  playerHalfWidth: 0.5,
  playerHalfDepth: 0.3,
  landTolerance: 0.3,
  trainRoofY: 3.0,
  platformY: 0.9,
  cameraEyeAboveFeet: 2,
  duckCameraDrop: 1.45,
} as const;

/**
 * Forgiveness margins: marginal contact stumbles (two-strike) instead of
 * ending the run. sideOverlap = max lateral penetration that counts as a
 * graze; topClip = how far feet may dip into a jumped obstacle's top.
 */
export const GRACE = {
  sideOverlap: 0.4,
  topClip: 0.18,
} as const;

export const TRACK = {
  chunkLength: 24,
  viewAhead: 140,
  keepBehind: 15,
  slots: 8,
} as const;

export const SPEED = {
  initial: 9,
  max: 26,
} as const;

/**
 * Piecewise-linear speed over distance: gentle for the first few hundred
 * meters, then steepening. [distance, speed] control points.
 */
export const SPEED_CURVE: readonly (readonly [number, number])[] = [
  [0, 9],
  [250, 11.5],
  [700, 16],
  [1500, 22],
  [2400, 26],
] as const;
