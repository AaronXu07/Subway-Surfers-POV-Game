import { GRACE, TRACK, type LaneIndex } from '../constants';
import { collectCoins, resolveCollisions, type CollisionEvent } from './collision';
import { stepPlayer } from './player';
import { mulberry32 } from './rng';
import { generateChunk, speedAt } from './spawner';
import {
  INITIAL_ENTRY_STATE,
  type PlayerInput,
  type StepEvents,
  type SurfaceSpec,
  type World,
} from './types';

/** Patterns produce well under this many coins per chunk. */
const MAX_COINS_PER_CHUNK = 64;
/** Empty runway before the first chunk so a run never opens on an obstacle. */
const FIRST_CHUNK_AT = 20;

const STUMBLE_SPEED_SCALE = 0.6;
const STUMBLE_RECOVERY_SECONDS = 1.5;
const WARN_DURATION = 4;
const SHAKE_DURATION = 0.5;
/**
 * Oncoming trains sit parked until the player is this close to their chunk.
 * Tuned together with the spawn offset (+55) and train speeds (11..20): the
 * meeting point stays 7–21m into the train's own chunk — past the
 * validator's escape window, before the chunk ends — at every speed tier.
 */
const ONCOMING_TRIGGER = 25;
/** Obstacle kinds where clipping the top with your feet is a stumble, not a death. */
const TOP_GRACE_KINDS = new Set(['bin']);

export function createWorld(seed: number): World {
  const world: World = {
    seed,
    rng: mulberry32(seed),
    playerS: 0,
    prevS: 0,
    distance: 0,
    speed: speedAt(0),
    speedScale: 1,
    elapsed: 0,
    warnedUntil: 0,
    shakeUntil: 0,
    coinsCollected: 0,
    slots: Array.from({ length: TRACK.slots }, () => ({
      chunk: null,
      version: 0,
      collected: new Uint8Array(MAX_COINS_PER_CHUNK),
      entryState: INITIAL_ENTRY_STATE,
    })),
    frontierS: FIRST_CHUNK_AT,
    nextEntryState: INITIAL_ENTRY_STATE,
    player: { x: 0, y: 0, vy: 0, grounded: true, wasJumping: false, duck: false },
    nextObstacleId: 1,
    lastGrazeId: null,
    bounceLane: null,
    bounceInputLane: null,
    bounceObstacleId: null,
    bounceClearS: 0,
    gameOver: null,
  };
  maintainChunks(world);
  return world;
}

/** Keep the chunk ring filled ahead of the player, recycling slots that fell behind. */
export function maintainChunks(world: World): void {
  while (world.frontierS < world.playerS + TRACK.viewAhead) {
    const slot = world.slots.find(
      (s) => !s.chunk || s.chunk.startS + s.chunk.length < world.playerS - TRACK.keepBehind,
    );
    if (!slot) break;

    const nextId = () => world.nextObstacleId++;
    const { chunk, exit } = generateChunk(world.rng, world.frontierS, world.nextEntryState, nextId);
    slot.chunk = chunk;
    slot.version++;
    slot.collected.fill(0);
    slot.entryState = world.nextEntryState;
    world.nextEntryState = exit;
    world.frontierS += chunk.length;
  }
}

/** Advance oncoming trains once the player is near their chunk; retire passed ones. */
function advanceMovingObstacles(world: World, dt: number): void {
  for (const slot of world.slots) {
    const chunk = slot.chunk;
    if (!chunk?.hasMoving) continue;
    if (chunk.startS - world.playerS > ONCOMING_TRIGGER) continue;
    for (const obstacle of chunk.obstacles) {
      if (obstacle.velocity === undefined || obstacle.neutralized) continue;
      obstacle.s += obstacle.velocity * dt;
      if (obstacle.s + obstacle.length < world.playerS - 12) {
        obstacle.neutralized = true;
      }
    }
  }
}

/**
 * Two-strike stumble. Returns the run-ending reason, if any: stumbling while
 * the inspector-close window is still open means caught.
 */
function stumble(world: World, events: StepEvents): 'caught' | null {
  if (world.elapsed < world.warnedUntil) return 'caught';
  world.speedScale = STUMBLE_SPEED_SCALE;
  world.warnedUntil = world.elapsed + WARN_DURATION;
  world.shakeUntil = world.elapsed + SHAKE_DURATION;
  events.stumbled = true;
  return null;
}

/**
 * Hard-hit forgiveness. A shallow lateral clip (side graze) shoves the player
 * back out, stumbles them once per obstacle, and bounces them back to the
 * lane they came from (the lane switch is "rejected" until the driver asks
 * for a different lane). Feet shaving the top of a jumped obstacle stumbles
 * instead of killing. Everything else is fatal.
 */
function resolveHardHit(
  world: World,
  hit: CollisionEvent,
  inputLane: LaneIndex,
  events: StepEvents,
): 'hard' | 'caught' | null {
  const player = world.player;

  if (hit.xOverlap < GRACE.sideOverlap) {
    const side = player.x >= hit.obstacleX ? 1 : -1;
    player.x = hit.obstacleX + side * (hit.halfWidthSum + 0.02);
    const isRepeat =
      world.lastGrazeId === hit.obstacle.id || world.bounceObstacleId === hit.obstacle.id;
    world.bounceLane = Math.min(2, Math.max(0, hit.obstacle.lane + side)) as LaneIndex;
    world.bounceInputLane = inputLane;
    world.bounceObstacleId = hit.obstacle.id;
    world.bounceClearS = hit.obstacle.s + hit.obstacle.length + 1;
    world.lastGrazeId = hit.obstacle.id;
    if (isRepeat) return null;
    return stumble(world, events);
  }

  if (TOP_GRACE_KINDS.has(hit.obstacle.kind) && player.y >= hit.solidTop - GRACE.topClip) {
    hit.obstacle.neutralized = true;
    return stumble(world, events);
  }

  return 'hard';
}

// Reused scratch buffer — stepWorld runs once per frame on one world at a time.
const scratchSurfaces: SurfaceSpec[] = [];

export function stepWorld(world: World, input: PlayerInput, dt: number): StepEvents {
  const events: StepEvents = { coinsCollected: 0, stumbled: false, gameOver: null };
  if (world.gameOver) return events;

  world.elapsed += dt;
  world.speedScale = Math.min(
    1,
    world.speedScale + ((1 - STUMBLE_SPEED_SCALE) / STUMBLE_RECOVERY_SECONDS) * dt,
  );
  world.speed = speedAt(world.distance) * world.speedScale;
  world.prevS = world.playerS;
  world.playerS += world.speed * dt;
  world.distance = world.playerS;

  maintainChunks(world);
  advanceMovingObstacles(world, dt);

  // A bounced (rejected) lane switch overrides the driver's lane until the
  // driver asks for something new or the grazed obstacle is behind us.
  let effectiveLane = input.lane;
  if (world.bounceLane !== null) {
    if (input.lane !== world.bounceInputLane || world.playerS > world.bounceClearS) {
      world.bounceLane = null;
      world.bounceInputLane = null;
      world.bounceObstacleId = null;
    } else {
      effectiveLane = world.bounceLane;
    }
  }
  const effectiveInput = effectiveLane === input.lane ? input : { ...input, lane: effectiveLane };

  scratchSurfaces.length = 0;
  for (const slot of world.slots) {
    const chunk = slot.chunk;
    if (!chunk) continue;
    if (chunk.startS > world.playerS + 30 || chunk.startS + chunk.length < world.prevS - 5) continue;
    for (const surface of chunk.surfaces) scratchSurfaces.push(surface);
  }

  stepPlayer(
    world.player,
    effectiveInput,
    world.playerS,
    world.playerS - world.prevS,
    dt,
    scratchSurfaces,
  );

  let grazingThisFrame = false;
  for (const slot of world.slots) {
    const chunk = slot.chunk;
    if (!chunk) continue;
    // Moving obstacles roam outside their chunk's range, so their chunk is
    // never distance-gated out of collision checks.
    if (
      !chunk.hasMoving &&
      (chunk.startS > world.playerS + 3 || chunk.startS + chunk.length < world.prevS - 3)
    ) {
      continue;
    }

    for (const hit of resolveCollisions(world.player, world.prevS, world.playerS, chunk.obstacles)) {
      if (hit.severity === 'hard') {
        if (hit.xOverlap < GRACE.sideOverlap) grazingThisFrame = true;
        events.gameOver = resolveHardHit(world, hit, input.lane, events);
      } else {
        hit.obstacle.neutralized = true;
        events.gameOver = stumble(world, events);
      }
      if (events.gameOver) break;
    }
    if (events.gameOver) break;

    events.coinsCollected += collectCoins(
      world.player,
      world.prevS,
      world.playerS,
      chunk.coins,
      slot.collected,
    );
  }

  if (!grazingThisFrame) world.lastGrazeId = null;
  world.coinsCollected += events.coinsCollected;
  if (events.gameOver) world.gameOver = events.gameOver;
  return events;
}

/** Score formula shared by HUD snapshots and the final game-over stats. */
export function scoreOf(world: World): number {
  return Math.floor(world.distance) + world.coinsCollected * 10;
}
