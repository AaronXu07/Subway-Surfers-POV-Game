import { SIZES, type LaneIndex } from '../constants';
import { lerp } from './math';
import type { SurfaceSpec } from './types';

/** Height of one surface at track position s (assumes s is inside [sStart, sEnd]). */
export function surfaceYAt(surface: SurfaceSpec, s: number): number {
  if (surface.yStart === surface.yEnd) return surface.yStart;
  const t = (s - surface.sStart) / (surface.sEnd - surface.sStart);
  return lerp(surface.yStart, surface.yEnd, t);
}

/**
 * Ground height under the player. A surface only counts if the player is high
 * enough to stand on it (feet ≥ top − landTolerance) — approaching a raised
 * surface from below is NOT a step-up; it's a collision, handled by the
 * collision table's matching skip rule.
 */
export function sampleGround(
  s: number,
  lane: LaneIndex,
  playerY: number,
  surfaces: readonly SurfaceSpec[],
): number {
  let ground = 0;
  for (const surface of surfaces) {
    if (surface.lane !== lane) continue;
    if (s < surface.sStart || s > surface.sEnd) continue;
    const y = surfaceYAt(surface, s);
    if (playerY >= y - SIZES.landTolerance && y > ground) {
      ground = y;
    }
  }
  return ground;
}

/** Steeper than any ramp; far shallower than a platform/train face over one frame. */
export const MAX_FOLLOW_SLOPE = 0.55;

/**
 * Ground height for a *grounded* player who advanced `ds` this frame. Instead of
 * the landing-tolerance rule this uses slope continuity: the player follows any
 * surface rising no faster than a ramp. A vertical face (platform 0→0.9, train
 * 0→2.2 between two frames) exceeds the limit, is not followed, and is left for
 * the collision table to turn into a crash.
 */
export function sampleGroundFollow(
  s: number,
  lane: LaneIndex,
  playerY: number,
  ds: number,
  surfaces: readonly SurfaceSpec[],
): number {
  const maxStepUp = MAX_FOLLOW_SLOPE * ds + 0.02;
  let ground = 0;
  for (const surface of surfaces) {
    if (surface.lane !== lane) continue;
    if (s < surface.sStart || s > surface.sEnd) continue;
    const y = surfaceYAt(surface, s);
    if (y <= playerY + maxStepUp && y > ground) {
      ground = y;
    }
  }
  return ground;
}
