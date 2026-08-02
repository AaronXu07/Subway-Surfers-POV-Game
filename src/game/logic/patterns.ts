import { DIVIDER_X, SIZES, type LaneIndex } from '../constants';
import { RAMP_LENGTH } from './collision';
import { pick, pickWeighted, randInt } from './rng';
import type { ChunkEntryState, ChunkSpec, CoinSpec, ObstacleSpec } from './types';

export interface PatternContext {
  rng: () => number;
  startS: number;
  length: number;
  /** Difficulty tier 0..3. */
  difficulty: number;
  entry: ChunkEntryState;
  nextId: () => number;
}

export type PatternBuild = Pick<ChunkSpec, 'obstacles' | 'coins' | 'surfaces' | 'decor'>;

export interface PatternTemplate {
  key: string;
  minDifficulty: number;
  weight: (difficulty: number) => number;
  build: (ctx: PatternContext) => PatternBuild;
}

const ALL_LANES: readonly LaneIndex[] = [0, 1, 2];

function emptyBuild(): PatternBuild {
  return { obstacles: [], coins: [], surfaces: [], decor: [] };
}

function pickLanes(rng: () => number, count: number): LaneIndex[] {
  const lanes = [...ALL_LANES];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return lanes.slice(0, count);
}

function coinLine(
  out: CoinSpec[],
  lane: LaneIndex,
  sFrom: number,
  sTo: number,
  y = 1.0,
  spacing = 2,
): void {
  for (let s = sFrom; s <= sTo; s += spacing) {
    out.push({ s, lane, y });
  }
}

/** Parabolic coin arc peaking over sCenter — mirrors a jump trajectory. */
function coinArc(out: CoinSpec[], lane: LaneIndex, sCenter: number, peakY: number): void {
  for (let k = -2; k <= 2; k++) {
    const s = sCenter + k * 1.6;
    const y = 1.0 + (peakY - 1.0) * (1 - (k / 2.5) ** 2);
    out.push({ s, lane, y });
  }
}

/** Train obstacle + its walkable surfaces. spec.s is the leading edge (ramp start if ramped). */
function addTrain(
  build: PatternBuild,
  ctx: PatternContext,
  lane: LaneIndex,
  s: number,
  bodyLength: number,
  hasRamp: boolean,
): void {
  const rampLength = hasRamp ? RAMP_LENGTH : 0;
  build.obstacles.push({
    id: ctx.nextId(),
    kind: 'train',
    lane,
    s,
    length: rampLength + bodyLength,
    hasRamp,
  });
  if (hasRamp) {
    build.surfaces.push({ lane, sStart: s, sEnd: s + rampLength, yStart: 0, yEnd: SIZES.trainRoofY });
  }
  build.surfaces.push({
    lane,
    sStart: s + rampLength,
    sEnd: s + rampLength + bodyLength,
    yStart: SIZES.trainRoofY,
    yEnd: SIZES.trainRoofY,
  });
}

const BARRIER_KINDS = ['barrierJumpOrRoll', 'barrierJumpOnly', 'barrierRollOnly'] as const;

function barrierWeights(difficulty: number): number[] {
  return [3, 2, difficulty >= 1 ? 2 : 0.5];
}

// --- Templates ------------------------------------------------------------

const coinRush: PatternTemplate = {
  key: 'coinRush',
  minDifficulty: 0,
  weight: (d) => Math.max(0.8, 2.5 - d),
  build: (ctx) => {
    const build = emptyBuild();
    for (const lane of pickLanes(ctx.rng, randInt(ctx.rng, 1, 2))) {
      coinLine(build.coins, lane, ctx.startS + 3, ctx.startS + ctx.length - 3);
    }
    return build;
  },
};

const laneBarriers: PatternTemplate = {
  key: 'laneBarriers',
  minDifficulty: 0,
  weight: () => 2.2,
  build: (ctx) => {
    const build = emptyBuild();
    const rows = randInt(ctx.rng, 1, 1 + Math.min(ctx.difficulty, 2));
    const spacing = (ctx.length - 10) / rows;
    for (let r = 0; r < rows; r++) {
      const s = ctx.startS + 5 + r * spacing + ctx.rng() * 2;
      const lanes = pickLanes(ctx.rng, randInt(ctx.rng, 1, ctx.difficulty >= 2 ? 3 : 2));
      for (const lane of lanes) {
        build.obstacles.push({
          id: ctx.nextId(),
          kind: pickWeighted(ctx.rng, BARRIER_KINDS, barrierWeights(ctx.difficulty)),
          lane,
          s,
          length: 0.6,
        });
      }
    }
    coinLine(build.coins, pick(ctx.rng, ALL_LANES), ctx.startS + 2, ctx.startS + 4.5, 1.0, 2.5);
    return build;
  },
};

const trainCorridor: PatternTemplate = {
  key: 'trainCorridor',
  minDifficulty: 0,
  weight: () => 2.5,
  build: (ctx) => {
    const build = emptyBuild();
    const trainLaneCount = ctx.difficulty >= 1 && ctx.rng() < 0.5 ? 2 : 1;
    const lanes = pickLanes(ctx.rng, trainLaneCount);
    for (const lane of lanes) {
      const s = ctx.startS + randInt(ctx.rng, 4, 6);
      const length = Math.min(randInt(ctx.rng, 12, 16), ctx.startS + ctx.length - 1 - s);
      addTrain(build, ctx, lane, s, length, false);
      // A walkable roof needs coins to make climbing worth it — but this train
      // has no ramp, so the coins go to an open lane instead.
    }
    const open = ALL_LANES.filter((l) => !lanes.includes(l));
    coinLine(build.coins, pick(ctx.rng, open), ctx.startS + 4, ctx.startS + ctx.length - 4);
    return build;
  },
};

const rampRun: PatternTemplate = {
  key: 'rampRun',
  minDifficulty: 1,
  weight: () => 2,
  build: (ctx) => {
    const build = emptyBuild();
    const lane = pick(ctx.rng, ALL_LANES);
    const s = ctx.startS + 4;
    const bodyLength = randInt(ctx.rng, 9, 11);
    addTrain(build, ctx, lane, s, bodyLength, true);
    // Coins climb the ramp, then run the roof.
    for (let k = 1; k <= 3; k++) {
      const rs = s + (k / 4) * RAMP_LENGTH;
      build.coins.push({ s: rs, lane, y: (rs - s) / RAMP_LENGTH * SIZES.trainRoofY + 1.0 });
    }
    coinLine(
      build.coins,
      lane,
      s + RAMP_LENGTH + 1,
      s + RAMP_LENGTH + bodyLength - 1,
      SIZES.trainRoofY + 1.0,
    );
    return build;
  },
};

const stationSegment: PatternTemplate = {
  key: 'stationSegment',
  minDifficulty: 1,
  weight: () => 2,
  build: (ctx) => {
    const build = emptyBuild();
    const [platformLane, trainLane] = pickLanes(ctx.rng, 2);
    const s = ctx.startS + 5;
    const length = randInt(ctx.rng, 14, 16);
    build.obstacles.push({ id: ctx.nextId(), kind: 'platform', lane: platformLane, s, length });
    build.surfaces.push({
      lane: platformLane,
      sStart: s,
      sEnd: s + length,
      yStart: SIZES.platformY,
      yEnd: SIZES.platformY,
    });
    coinLine(build.coins, platformLane, s + 2, s + length - 2, SIZES.platformY + 1.0);
    if (ctx.difficulty >= 2 && ctx.rng() < 0.5) {
      addTrain(build, ctx, trainLane, ctx.startS + 6, randInt(ctx.rng, 10, 13), false);
    }
    return build;
  },
};

const slalom: PatternTemplate = {
  key: 'slalom',
  minDifficulty: 0,
  weight: (d) => 1.5 + d * 0.4,
  build: (ctx) => {
    const build = emptyBuild();
    const signals = randInt(ctx.rng, 1, 1 + Math.min(ctx.difficulty, 2));
    for (let i = 0; i < signals; i++) {
      build.obstacles.push({
        id: ctx.nextId(),
        kind: 'lightSignal',
        lane: 1,
        x: pick(ctx.rng, DIVIDER_X),
        s: ctx.startS + 5 + i * 7 + ctx.rng() * 2,
        length: 0.5,
      });
    }
    const bushLanes = pickLanes(ctx.rng, randInt(ctx.rng, 1, 2));
    for (const lane of bushLanes) {
      const s = ctx.startS + randInt(ctx.rng, 6, ctx.length - 4);
      build.obstacles.push({ id: ctx.nextId(), kind: 'bush', lane, s, length: 1.2 });
      // Bushes are jump obstacles — reward the jump with a coin arc over them.
      coinArc(build.coins, lane, s + 0.6, 2.0);
    }
    const freeLanes = ALL_LANES.filter((l) => !bushLanes.includes(l));
    coinLine(build.coins, pick(ctx.rng, freeLanes), ctx.startS + 3, ctx.startS + ctx.length - 3);
    return build;
  },
};

const wallGate: PatternTemplate = {
  key: 'wallGate',
  minDifficulty: 1,
  weight: (d) => 1 + d * 0.5,
  build: (ctx) => {
    const build = emptyBuild();
    // A proper tunnel passage, not a thin gate: the wall runs deep and the
    // open lanes get a roofed tunnel bore through it.
    const length = randInt(ctx.rng, 10, 13);
    const s = ctx.startS + randInt(ctx.rng, 8, Math.floor(ctx.length - length - 2));
    const openCount = ctx.difficulty >= 2 && ctx.rng() < 0.5 ? 1 : 2;
    const open = pickLanes(ctx.rng, openCount);
    for (const lane of ALL_LANES) {
      if (open.includes(lane)) {
        build.decor.push({ kind: 'tunnelArch', s, lane, length });
      } else {
        build.obstacles.push({ id: ctx.nextId(), kind: 'wall', lane, s, length });
      }
    }
    coinLine(build.coins, pick(ctx.rng, open), s + 2, s + length - 1);
    return build;
  },
};

const oncomingTrain: PatternTemplate = {
  key: 'oncomingTrain',
  minDifficulty: 0,
  weight: (d) => (d === 0 ? 0.8 : 1.6 + d * 0.5),
  build: (ctx) => {
    const build = emptyBuild();
    const lane = pick(ctx.rng, ALL_LANES);
    // Spawns beyond the chunk and barrels toward the player once they get
    // near (world.ts trigger, tuned with this offset and speed so the meeting
    // point lands ~7-21m into this chunk — past the validator's escape
    // window — at every speed tier). No surfaces: moving trains can't be
    // ridden. A blinking warning sign marks the lane before the train arrives.
    build.obstacles.push({
      id: ctx.nextId(),
      kind: 'train',
      lane,
      s: ctx.startS + 55,
      length: 16,
      velocity: -(11 + ctx.difficulty * 3),
    });
    build.decor.push({ kind: 'oncomingWarning', s: ctx.startS + 2, lane });
    const open = ALL_LANES.filter((l) => l !== lane);
    coinLine(build.coins, pick(ctx.rng, open), ctx.startS + 4, ctx.startS + ctx.length - 4);
    return build;
  },
};

const pillarGap: PatternTemplate = {
  key: 'pillarGap',
  minDifficulty: 2,
  weight: () => 1.5,
  build: (ctx) => {
    const build = emptyBuild();
    const count = randInt(ctx.rng, 1, 2);
    for (let i = 0; i < count; i++) {
      build.obstacles.push({
        id: ctx.nextId(),
        kind: 'pillar',
        lane: 1,
        s: ctx.startS + 6 + i * 10,
        length: 1.2,
      });
    }
    const side = pick(ctx.rng, [0, 2] as const);
    const bushS = ctx.startS + randInt(ctx.rng, 11, 14);
    build.obstacles.push({ id: ctx.nextId(), kind: 'bush', lane: side, s: bushS, length: 1.2 });
    coinArc(build.coins, side, bushS + 0.6, 2.0);
    coinLine(build.coins, side === 0 ? 2 : 0, ctx.startS + 4, ctx.startS + ctx.length - 4);
    return build;
  },
};

const binRow: PatternTemplate = {
  key: 'binRow',
  minDifficulty: 1,
  weight: () => 1.5,
  build: (ctx) => {
    const build = emptyBuild();
    const rows = ctx.difficulty >= 2 && ctx.rng() < 0.5 ? 2 : 1;
    // Consecutive rows must never share a lane: at mid speeds two same-lane
    // bins a few meters apart leave no room to land and jump again, and the
    // validator can't see it (bins are switch-dodgeable, so it ignores them).
    let previousLanes: LaneIndex[] = [];
    for (let r = 0; r < rows; r++) {
      const s = ctx.startS + randInt(ctx.rng, 6, 9) + r * 9;
      const candidates = ALL_LANES.filter((l) => !previousLanes.includes(l));
      const lanes = pickLanes(ctx.rng, randInt(ctx.rng, 1, 2)).filter((l) =>
        candidates.includes(l),
      );
      if (lanes.length === 0) lanes.push(pick(ctx.rng, candidates));
      for (const lane of lanes) {
        build.obstacles.push({ id: ctx.nextId(), kind: 'bin', lane, s, length: 1.4 });
      }
      coinArc(build.coins, lanes[0], s + 0.7, 2.2);
      previousLanes = lanes;
    }
    return build;
  },
};

export const PATTERNS: readonly PatternTemplate[] = [
  coinRush,
  laneBarriers,
  trainCorridor,
  rampRun,
  stationSegment,
  slalom,
  wallGate,
  oncomingTrain,
  pillarGap,
  binRow,
];

/** The guaranteed-safe fallback when generation keeps failing validation. */
export const SAFE_PATTERN = coinRush;

export function pickPattern(rng: () => number, difficulty: number): PatternTemplate {
  const available = PATTERNS.filter((p) => p.minDifficulty <= difficulty);
  return pickWeighted(
    rng,
    available,
    available.map((p) => p.weight(difficulty)),
  );
}

/**
 * Obstacle list guard used by tests: everything must stay inside its chunk.
 * Moving obstacles are exempt — they roam by design.
 */
export function obstaclesWithinChunk(chunk: ChunkSpec): boolean {
  return chunk.obstacles.every(
    (o: ObstacleSpec) =>
      o.velocity !== undefined ||
      (o.s >= chunk.startS && o.s + o.length <= chunk.startS + chunk.length),
  );
}
