import { LANE_X, SIZES } from '../constants';
import type { CoinSpec, ObstacleSpec, PlayerState } from './types';

/** Run-up ramps attached to trains are always this long. */
export const RAMP_LENGTH = 8;

export interface CollisionEvent {
  severity: 'hard' | 'soft';
  obstacle: ObstacleSpec;
  /** How deep the player's box penetrates the solid laterally (small = graze). */
  xOverlap: number;
  /** The solid's center x — for pushing a grazing player back out. */
  obstacleX: number;
  /** Combined player + obstacle half-widths (the no-overlap distance). */
  halfWidthSum: number;
  /** Top of the solid volume — for the feet-clipped-the-top grace. */
  solidTop: number;
}

/**
 * Top of a train at track position s: rises along the ramp (if any), then the
 * roof. Used both by the skip rule here and by ground-surface emission.
 */
export function trainTopAt(spec: ObstacleSpec, s: number): number {
  if (!spec.hasRamp) return SIZES.trainRoofY;
  const t = (s - spec.s) / RAMP_LENGTH;
  if (t >= 1) return SIZES.trainRoofY;
  return Math.max(0, t) * SIZES.trainRoofY;
}

interface Solid {
  halfWidth: number;
  yMin: number;
  yMax: number;
  severity: 'hard' | 'soft';
}

const Y_EPS = 0.02;

/**
 * The player's solid volume for an obstacle, or null when the obstacle doesn't
 * apply (walkable top the player is high enough for). `probeS` is where along
 * the obstacle the player first overlaps — matters for ramp tops.
 *
 * The one landing rule: solids with walkable tops (train, platform) only
 * collide if the player's feet are below top − landTolerance; otherwise ground
 * sampling puts the player on top instead. This uniformly covers frontal hits,
 * mid-air lane switches onto roofs, and falling short.
 */
function solidFor(spec: ObstacleSpec, probeS: number, playerY: number): Solid | null {
  switch (spec.kind) {
    case 'train': {
      const top = trainTopAt(spec, probeS);
      if (playerY >= top - SIZES.landTolerance) return null;
      return { halfWidth: 1.1, yMin: 0, yMax: top, severity: 'hard' };
    }
    // Barriers are stumble-first: hitting one costs a two-strike stumble, not
    // the run (unless the inspector-close window is already open).
    case 'barrierJumpOrRoll':
      return { halfWidth: 1.15, yMin: 0.85, yMax: 1.15, severity: 'soft' };
    case 'barrierJumpOnly':
      return { halfWidth: 1.15, yMin: 0, yMax: 0.9, severity: 'soft' };
    case 'barrierRollOnly':
      return { halfWidth: 1.15, yMin: 1.15, yMax: 1.55, severity: 'soft' };
    case 'bush':
      return { halfWidth: 0.9, yMin: 0, yMax: 0.55, severity: 'soft' };
    case 'lightSignal':
      return { halfWidth: 0.25, yMin: 0, yMax: 2.4, severity: 'soft' };
    case 'bin':
      return { halfWidth: 0.8, yMin: 0, yMax: 1.05, severity: 'hard' };
    case 'pillar':
      return { halfWidth: 0.6, yMin: 0, yMax: 4, severity: 'hard' };
    case 'wall':
      return { halfWidth: 1.25, yMin: 0, yMax: 4, severity: 'hard' };
    case 'platform': {
      if (playerY >= SIZES.platformY - SIZES.landTolerance) return null;
      return { halfWidth: 1.15, yMin: 0, yMax: SIZES.platformY, severity: 'hard' };
    }
  }
}

/**
 * Swept collision along s: the player's depth interval covers everything
 * between last frame's position and this one, so thin obstacles can't be
 * tunneled through at top speed.
 */
export function resolveCollisions(
  player: Pick<PlayerState, 'x' | 'y' | 'duck'>,
  sweptStart: number,
  sweptEnd: number,
  obstacles: readonly ObstacleSpec[],
): CollisionEvent[] {
  const events: CollisionEvent[] = [];
  const sMin = sweptStart - SIZES.playerHalfDepth;
  const sMax = sweptEnd + SIZES.playerHalfDepth;
  const playerTop = player.y + (player.duck ? SIZES.duckHeight : SIZES.standHeight);

  for (const spec of obstacles) {
    if (spec.neutralized) continue;
    if (spec.s >= sMax || spec.s + spec.length <= sMin) continue;

    const probeS = Math.min(Math.max(sMin, spec.s), spec.s + spec.length);
    const solid = solidFor(spec, probeS, player.y);
    if (!solid) continue;

    const obstacleX = spec.x ?? LANE_X[spec.lane];
    const halfWidthSum = SIZES.playerHalfWidth + solid.halfWidth;
    const xOverlap = halfWidthSum - Math.abs(player.x - obstacleX);
    if (xOverlap <= 0) continue;
    if (player.y >= solid.yMax - Y_EPS || playerTop <= solid.yMin + Y_EPS) continue;

    events.push({
      severity: solid.severity,
      obstacle: spec,
      xOverlap,
      obstacleX,
      halfWidthSum,
      solidTop: solid.yMax,
    });
  }
  return events;
}

/**
 * Coin pickup: swept along s, lane-width tolerant in x, and the player's chest
 * (feet + 1) must be near the coin's height — ground lines need a grounded
 * player, arc/roof coins need the matching jump or elevation.
 */
export function collectCoins(
  player: Pick<PlayerState, 'x' | 'y'>,
  sweptStart: number,
  sweptEnd: number,
  coins: readonly CoinSpec[],
  collected: Uint8Array,
): number {
  let count = 0;
  for (let i = 0; i < coins.length; i++) {
    if (collected[i]) continue;
    const coin = coins[i];
    if (coin.s < sweptStart - 0.5 || coin.s > sweptEnd + 0.5) continue;
    if (Math.abs(player.x - LANE_X[coin.lane]) >= 1.0) continue;
    if (Math.abs(player.y + 1.0 - coin.y) >= 0.9) continue;
    collected[i] = 1;
    count++;
  }
  return count;
}
