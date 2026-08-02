import { SIZES, SPEED, SPEED_CURVE, TRACK, type LaneIndex } from '../constants';
import { surfaceYAt } from './elevation';
import { pickPattern, SAFE_PATTERN, type PatternContext } from './patterns';
import type { ChunkEntryState, ChunkSpec } from './types';

/** Piecewise-linear interpolation over SPEED_CURVE, clamped at both ends. */
export function speedAt(distance: number): number {
  const curve = SPEED_CURVE;
  if (distance <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [d1, v1] = curve[i];
    if (distance <= d1) {
      const [d0, v0] = curve[i - 1];
      return v0 + ((distance - d0) / (d1 - d0)) * (v1 - v0);
    }
  }
  return Math.min(SPEED.max, curve[curve.length - 1][1]);
}

const DIFFICULTY_THRESHOLDS = [150, 400, 800] as const;

/** Difficulty tier 0..3, gating which patterns can spawn. */
export function difficultyAt(s: number): number {
  let tier = 0;
  for (const threshold of DIFFICULTY_THRESHOLDS) {
    if (s >= threshold) tier++;
  }
  return tier;
}

// --- Fairness validator ---------------------------------------------------
//
// BFS over a discretized (step, lane) grid. A state's height is implied by the
// lane's surface profile at that step (under-surface positions are always
// deadly for our obstacle set, so height needs no separate dimension). The
// chunk is fair iff a surviving path to the far edge exists from EVERY lane
// the player could be in at entry.

const DS = 1.5;
const SWITCH_TIME = 0.3;
/** Max rise a (jumping) runner can mount: platforms yes, train roofs no. */
const JUMPABLE_RISE = SIZES.platformY + 0.15;
/** Max rise allowed while mid-lane-switch (equal-height or downward only). */
const SWITCH_RISE = 0.3;
const DEADLY_MARGIN = 0.4;
/**
 * An oncoming train's lane is deadly from this many meters into the chunk —
 * the spawn distance + trigger radius guarantee the meeting point falls after
 * it at every speed tier, and the first meters give an entering player room
 * to vacate the lane. (Marking the lane deadly from step 0 would reject the
 * pattern any time the player *could* enter in that lane — i.e. always.)
 */
const ONCOMING_FREE_METERS = 6;

export interface ValidationResult {
  ok: boolean;
  exit: ChunkEntryState;
}

export function validateChunk(
  chunk: ChunkSpec,
  entry: ChunkEntryState,
  maxSpeed: number,
): ValidationResult {
  const steps = Math.round(chunk.length / DS);
  const cols = steps + 1;

  // Per-lane standable height and instant-death cells.
  const profile: number[][] = [new Array(cols).fill(0), new Array(cols).fill(0), new Array(cols).fill(0)];
  const deadly: boolean[][] = [new Array(cols).fill(false), new Array(cols).fill(false), new Array(cols).fill(false)];

  for (let i = 0; i < cols; i++) {
    const s = chunk.startS + i * DS;
    for (const surface of chunk.surfaces) {
      if (s < surface.sStart || s > surface.sEnd) continue;
      const y = surfaceYAt(surface, s);
      if (y > profile[surface.lane][i]) profile[surface.lane][i] = y;
    }
    for (const obstacle of chunk.obstacles) {
      // A moving (oncoming) train sweeps its lane during the chunk: deadly
      // everywhere except the first few meters, which are the escape window.
      if (obstacle.velocity) {
        if (i * DS >= ONCOMING_FREE_METERS) deadly[obstacle.lane][i] = true;
        continue;
      }
      if (obstacle.kind !== 'pillar' && obstacle.kind !== 'wall') continue;
      if (s < obstacle.s - DEADLY_MARGIN || s > obstacle.s + obstacle.length + DEADLY_MARGIN) continue;
      deadly[obstacle.lane][i] = true;
    }
  }

  const switchSteps = Math.max(1, Math.ceil((SWITCH_TIME * maxSpeed) / DS));

  /** Lanes reachable at the far edge starting from one entry lane, or null if doomed. */
  function survive(entryLane: LaneIndex): LaneIndex[] | null {
    const reach: boolean[][] = [new Array(cols).fill(false), new Array(cols).fill(false), new Array(cols).fill(false)];

    const entryRise = profile[entryLane][0] - entry.laneY[entryLane];
    if (deadly[entryLane][0] || entryRise > JUMPABLE_RISE) return null;
    reach[entryLane][0] = true;

    for (let i = 0; i < steps; i++) {
      for (let lane = 0 as LaneIndex; lane <= 2; lane++) {
        if (!reach[lane][i]) continue;
        const y = profile[lane][i];

        // Stay in lane: walk, ramp, jump onto a platform, or drop off an edge.
        if (!deadly[lane][i + 1] && profile[lane][i + 1] - y <= JUMPABLE_RISE) {
          reach[lane][i + 1] = true;
        }

        // Switch to an adjacent lane over switchSteps columns.
        for (const target of [lane - 1, lane + 1] as const) {
          if (target < 0 || target > 2) continue;
          const arrive = i + switchSteps;
          if (arrive > steps) continue;
          let ok = true;
          // Second half of the switch: fully exposed in the target lane.
          for (let j = i + 1; j <= arrive && ok; j++) {
            if (deadly[target][j] || profile[target][j] - y > SWITCH_RISE) ok = false;
          }
          // First half: still exposed in the origin lane.
          const half = i + Math.ceil(switchSteps / 2);
          for (let j = i + 1; j <= Math.min(half, steps) && ok; j++) {
            if (deadly[lane][j] || profile[lane][j] - y > SWITCH_RISE) ok = false;
          }
          if (ok) reach[target as LaneIndex][arrive] = true;
        }
      }
    }

    const out: LaneIndex[] = [];
    for (let lane = 0 as LaneIndex; lane <= 2; lane++) {
      if (reach[lane][steps]) out.push(lane);
    }
    return out.length > 0 ? out : null;
  }

  const exitLanes = new Set<LaneIndex>();
  for (const lane of entry.possibleLanes) {
    const result = survive(lane);
    if (!result) {
      return { ok: false, exit: entry };
    }
    for (const l of result) exitLanes.add(l);
  }

  return {
    ok: true,
    exit: {
      possibleLanes: [...exitLanes].sort(),
      laneY: [profile[0][steps], profile[1][steps], profile[2][steps]],
    },
  };
}

// --- Generation -----------------------------------------------------------

const MAX_ATTEMPTS = 3;

export function generateChunk(
  rng: () => number,
  startS: number,
  entry: ChunkEntryState,
  nextId: () => number,
): { chunk: ChunkSpec; exit: ChunkEntryState } {
  const difficulty = difficultyAt(startS);
  const maxSpeed = Math.min(SPEED.max, speedAt(startS) * 1.15);

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    const template = attempt < MAX_ATTEMPTS ? pickPattern(rng, difficulty) : SAFE_PATTERN;
    const ctx: PatternContext = {
      rng,
      startS,
      length: TRACK.chunkLength,
      difficulty,
      entry,
      nextId,
    };
    const chunk: ChunkSpec = {
      startS,
      length: TRACK.chunkLength,
      patternKey: template.key,
      ...template.build(ctx),
    };
    chunk.hasMoving = chunk.obstacles.some((o) => o.velocity !== undefined);
    const result = validateChunk(chunk, entry, maxSpeed);
    if (result.ok) {
      return { chunk, exit: result.exit };
    }
  }

  // Unreachable in practice (SAFE_PATTERN has no obstacles), but keep a hard floor.
  const empty: ChunkSpec = {
    startS,
    length: TRACK.chunkLength,
    patternKey: 'empty',
    obstacles: [],
    coins: [],
    surfaces: [],
    decor: [],
  };
  return { chunk: empty, exit: validateChunk(empty, entry, maxSpeed).exit };
}
