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

/**
 * Landmarks come from the raw camera frame, but the video is displayed mirrored,
 * so every x has to be flipped before it is positioned on screen.
 */
export function toScreenX(x: number) {
  return 1 - x;
}
