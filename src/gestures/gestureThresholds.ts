/**
 * Hip-midpoint thresholds in normalized (0-1) landmark space.
 * Shared by the classifier and the on-screen guides so they can never drift apart.
 */
export const GESTURE_THRESHOLDS = {
  /** hipX above this => player stepped to their left */
  laneLeftX: 0.66,
  /** hipX below this => player stepped to their right */
  laneRightX: 0.33,
  /** hipY above (visually higher than) this => jump */
  jumpY: 0.6,
  /** hipY below (visually lower than) this => duck */
  duckY: 1.0,
} as const;

/** The subset of the calibration profile that overrides the default thresholds. */
export interface CalibrationThresholds {
  leftThreshold: number;
  rightThreshold: number;
  jumpThreshold: number;
  duckThreshold: number;
}

export type ResolvedThresholds = {
  -readonly [K in keyof typeof GESTURE_THRESHOLDS]: number;
};

/**
 * A calibrated player gets thresholds measured from their own standing pose; everyone
 * else gets the defaults. Both the classifier and the on-screen guides resolve through
 * here so what is drawn is always what is actually being tested.
 */
export function resolveThresholds(
  calibration?: CalibrationThresholds | null,
): ResolvedThresholds {
  if (!calibration) {
    return { ...GESTURE_THRESHOLDS };
  }

  return {
    laneLeftX: calibration.leftThreshold,
    laneRightX: calibration.rightThreshold,
    jumpY: calibration.jumpThreshold,
    duckY: calibration.duckThreshold,
  };
}

/**
 * Landmarks come from the raw camera frame, but the video is displayed mirrored,
 * so every x has to be flipped before it is positioned on screen.
 */
export function toScreenX(x: number) {
  return 1 - x;
}
