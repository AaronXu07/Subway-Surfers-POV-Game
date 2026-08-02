import type { LaneIndex } from '../constants';

export type GameOverReason = 'hard' | 'caught';

/**
 * Track coordinates: `s` is absolute distance along the track (increases as the
 * player runs). An object at track position s renders at world z = -(s - playerS).
 */
export type ObstacleKind =
  | 'train' // full-height blocker; walkable roof; `hasRamp` adds a run-up ramp
  | 'barrierJumpOrRoll' // beam at mid height — jump over or roll under
  | 'barrierJumpOnly' // bottom blocked — jump over
  | 'barrierRollOnly' // overhead bar — roll under
  | 'bush' // soft: stumble
  | 'lightSignal' // soft, sits between lanes: stumble
  | 'bin' // tall garbage bin — jump over (barely) or crash
  | 'pillar' // center-lane full blocker
  | 'wall' // per-blocked-lane wall segment; open lanes are the tunnels
  | 'platform'; // station platform: elevated ground, hard leading face

export interface ObstacleSpec {
  id: number;
  kind: ObstacleKind;
  lane: LaneIndex;
  /** Leading edge, absolute track coordinate. */
  s: number;
  /** Extent along s. */
  length: number;
  /** Trains only: run-up ramp attached in front of the body. */
  hasRamp?: boolean;
  /** Light signals only: explicit x (between lanes) instead of lane center. */
  x?: number;
  /**
   * Units/s along s; negative = moving toward the player (oncoming train).
   * Moving obstacles have no walkable surfaces and their `s` mutates per frame.
   */
  velocity?: number;
  /** Runtime flag — obstacle already dealt with (stumbled on / passed), ignore. */
  neutralized?: boolean;
}

export interface CoinSpec {
  /** Absolute track coordinate. */
  s: number;
  lane: LaneIndex;
  /** Coin center height (absolute y, ground = 0). */
  y: number;
}

/** A walkable top: flat when yStart === yEnd, a ramp otherwise. */
export interface SurfaceSpec {
  lane: LaneIndex;
  sStart: number;
  sEnd: number;
  yStart: number;
  yEnd: number;
}

/** Decorative extras a pattern wants rendered (tunnel passages, warning signs). */
export interface DecorSpec {
  kind: 'tunnelArch' | 'oncomingWarning';
  s: number;
  lane: LaneIndex;
  /** tunnelArch: how deep the tunnel passage runs. */
  length?: number;
}

export interface ChunkSpec {
  startS: number;
  length: number;
  patternKey: string;
  obstacles: ObstacleSpec[];
  coins: CoinSpec[];
  surfaces: SurfaceSpec[];
  decor: DecorSpec[];
  /** True when any obstacle has velocity — exempts the chunk from range gating. */
  hasMoving?: boolean;
}

/**
 * What the spawner needs to know about the state of play at a chunk boundary
 * to generate (and validate) the next chunk fairly.
 */
export interface ChunkEntryState {
  /** Lanes the player could possibly be in when crossing the boundary. */
  possibleLanes: LaneIndex[];
  /** Ground height per lane at the boundary (0 unless a surface touches it). */
  laneY: [number, number, number];
}

export const INITIAL_ENTRY_STATE: ChunkEntryState = {
  possibleLanes: [0, 1, 2],
  laneY: [0, 0, 0],
};

export interface ChunkSlot {
  chunk: ChunkSpec | null;
  /** Bumped on recycle so the slot's React view re-renders. */
  version: number;
  /** Per-coin collected flags, indexed like chunk.coins. */
  collected: Uint8Array;
  /** Entry state used to generate chunk — kept for debugging/tests. */
  entryState: ChunkEntryState;
}

export interface PlayerState {
  /** Damped actual x (mid lane-switch this is between lane centers). */
  x: number;
  /** Feet height above ground 0. */
  y: number;
  vy: number;
  grounded: boolean;
  /** Rising-edge detection for the jump level-signal. */
  wasJumping: boolean;
  duck: boolean;
}

export interface PlayerInput {
  lane: LaneIndex;
  jump: boolean;
  duck: boolean;
}

export interface World {
  seed: number;
  rng: () => number;
  playerS: number;
  /** playerS at the start of the current step (for swept collision). */
  prevS: number;
  distance: number;
  speed: number;
  /** Stumble slowdown factor, recovers toward 1. */
  speedScale: number;
  /** Run-clock seconds (only advances while playing, so pause freezes timers). */
  elapsed: number;
  /** Two-strike window: a soft hit before this run-time means caught. */
  warnedUntil: number;
  shakeUntil: number;
  coinsCollected: number;
  slots: ChunkSlot[];
  /** Track coordinate where the next chunk starts. */
  frontierS: number;
  /** Entry state for the next chunk to be generated. */
  nextEntryState: ChunkEntryState;
  player: PlayerState;
  nextObstacleId: number;
  /** Obstacle currently being side-scraped — suppresses repeat graze stumbles. */
  lastGrazeId: number | null;
  /**
   * A rejected lane switch (side graze) bounces the player back here. The
   * override clears when the driver asks for a different lane OR when the
   * grazed obstacle is behind the player (bounceClearS) — otherwise a driver
   * pinned on the same lane value could stay vetoed forever.
   */
  bounceLane: LaneIndex | null;
  bounceInputLane: LaneIndex | null;
  bounceObstacleId: number | null;
  bounceClearS: number;
  gameOver: GameOverReason | null;
}

export interface StepEvents {
  coinsCollected: number;
  stumbled: boolean;
  gameOver: GameOverReason | null;
}
