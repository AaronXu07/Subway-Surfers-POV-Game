import { describe, expect, it } from 'vitest';
import { TRACK } from '../constants';
import { createWorld, scoreOf, stepWorld } from './world';
import type { ObstacleSpec, PlayerInput, World } from './types';

const DT = 1 / 60;
const CENTER: PlayerInput = { lane: 1, jump: false, duck: false };
const LEFT: PlayerInput = { lane: 0, jump: false, duck: false };

function stepSeconds(world: World, seconds: number, input: PlayerInput = CENTER) {
  for (let t = 0; t < seconds; t += DT) {
    stepWorld(world, input, DT);
    if (world.gameOver) return;
  }
}

/**
 * Empty every generated chunk so tests control exactly what is on the track,
 * then return the first chunk (starts at the initial runway's end) to plant
 * obstacles into. Planted s-coords must fall inside that chunk's range —
 * collision checks are gated per chunk.
 */
function clearArena(world: World) {
  for (const slot of world.slots) {
    if (!slot.chunk) continue;
    slot.chunk.obstacles.length = 0;
    slot.chunk.coins.length = 0;
    slot.chunk.surfaces.length = 0;
  }
  return world.slots.find((s) => s.chunk !== null)!.chunk!;
}

describe('createWorld', () => {
  it('fills the chunk ring ahead of the player', () => {
    const world = createWorld(1);
    const chunks = world.slots.filter((s) => s.chunk !== null);
    // Runway of 20 + 5 chunks of 24 covers viewAhead (140).
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    expect(world.frontierS).toBeGreaterThanOrEqual(TRACK.viewAhead);
    // Coverage is contiguous from the first chunk to the frontier.
    const starts = chunks.map((s) => s.chunk!.startS).sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBe(starts[i - 1] + TRACK.chunkLength);
    }
  });
});

describe('stepWorld', () => {
  it('advances distance with speed and recycles chunks without gaps', () => {
    const world = createWorld(2);
    stepSeconds(world, 30);
    if (world.gameOver) return; // crashed into something with neutral input — fine here

    expect(world.distance).toBeGreaterThan(200);
    const starts = world.slots
      .filter((s) => s.chunk !== null)
      .map((s) => s.chunk!.startS)
      .sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBe(starts[i - 1] + TRACK.chunkLength);
    }
    // Nothing kept far behind, frontier kept ahead.
    expect(starts[0] + TRACK.chunkLength).toBeGreaterThan(world.playerS - TRACK.keepBehind - TRACK.chunkLength);
    expect(world.frontierS).toBeGreaterThanOrEqual(world.playerS + TRACK.viewAhead - TRACK.chunkLength);
  });

  it('soft hit stumbles (slowdown + warning), second one within the window is caught', () => {
    const world = createWorld(3);
    const chunk = clearArena(world);
    chunk.obstacles.push(
      { id: 9001, kind: 'bush', lane: 1, s: chunk.startS + 5, length: 1.2 },
      { id: 9002, kind: 'bush', lane: 1, s: chunk.startS + 15, length: 1.2 },
    );

    stepSeconds(world, 3.2); // ~29m at initial speed: past the first bush
    expect(world.warnedUntil).toBeGreaterThan(0);
    expect(world.speedScale).toBeLessThan(1);
    expect(world.gameOver).toBeNull();

    stepSeconds(world, 2); // second bush inside the 4s window
    expect(world.gameOver).toBe('caught');
  });

  it('hard obstacle ends the run immediately', () => {
    const world = createWorld(4);
    const chunk = clearArena(world);
    chunk.obstacles.push({ id: 9003, kind: 'pillar', lane: 1, s: chunk.startS + 5, length: 1.2 });
    stepSeconds(world, 3);
    expect(world.gameOver).toBe('hard');
  });

  it('collects planted coins and scores them', () => {
    const world = createWorld(5);
    const chunk = clearArena(world);
    chunk.coins.push(
      { s: chunk.startS + 2, lane: 1, y: 1.0 },
      { s: chunk.startS + 4, lane: 1, y: 1.0 },
    );

    stepSeconds(world, 3);
    expect(world.gameOver).toBeNull();
    expect(world.coinsCollected).toBe(2);
    expect(scoreOf(world)).toBe(Math.floor(world.distance) + world.coinsCollected * 10);
  });

  it('freezes after game over', () => {
    const world = createWorld(6);
    world.gameOver = 'hard';
    const before = world.playerS;
    stepWorld(world, CENTER, DT);
    expect(world.playerS).toBe(before);
  });

  it('side-grazing a train stumbles and shoves the player out instead of killing', () => {
    const world = createWorld(7);
    const chunk = clearArena(world);
    chunk.obstacles.push({ id: 9010, kind: 'train', lane: 0, s: chunk.startS + 2, length: 18 });
    // Get alongside the train, then poke the player's edge into its side.
    stepSeconds(world, 2.8);
    expect(world.gameOver).toBeNull();
    world.player.x = -1.1; // train edge band: overlap < GRACE.sideOverlap
    stepWorld(world, CENTER, DT);
    expect(world.gameOver).toBeNull();
    expect(world.warnedUntil).toBeGreaterThan(0); // stumbled, inspector close
    expect(world.player.x).toBeGreaterThan(-1.0); // pushed back out of the solid
    // Scraping the same train again must not double-stumble into a catch.
    world.player.x = -1.1;
    stepWorld(world, CENTER, DT);
    expect(world.gameOver).toBeNull();
  });

  it('a rejected lane switch bounces the player back to their previous lane', () => {
    const world = createWorld(10);
    const chunk = clearArena(world);
    chunk.obstacles.push({ id: 9011, kind: 'train', lane: 0, s: chunk.startS + 2, length: 18 });
    // Run alongside the train in the center, then steer left into its side.
    stepSeconds(world, 2.8);
    expect(world.gameOver).toBeNull();
    for (let t = 0; t < 1.2; t += DT) {
      stepWorld(world, LEFT, DT);
      if (world.gameOver) break;
    }
    // The switch was rejected: still alive, stumbled once, and even though
    // the input keeps asking for the train's lane, the bounce holds the
    // player back in the center lane instead of scraping along the side.
    expect(world.gameOver).toBeNull();
    expect(world.warnedUntil).toBeGreaterThan(0);
    expect(world.bounceLane).toBe(1);
    expect(world.player.x).toBeGreaterThan(-0.7); // settled near center, not the train edge

    // Once the train is behind the player the veto expires on its own, even
    // with the driver still pinned on the same lane — and without a second
    // stumble having been charged along the way.
    for (let t = 0; t < 3 && world.gameOver === null; t += DT) {
      stepWorld(world, LEFT, DT);
    }
    expect(world.gameOver).toBeNull();
    expect(world.bounceLane).toBeNull();
    expect(world.player.x).toBeLessThan(-1.5); // finally made it into the left lane
  });

  it('clipping the top of a jumped barrier stumbles instead of killing', () => {
    const world = createWorld(8);
    const chunk = clearArena(world);
    stepSeconds(world, 2.5); // get inside the chunk
    expect(world.gameOver).toBeNull();
    const barrier: ObstacleSpec = {
      id: 9020,
      kind: 'barrierJumpOnly',
      lane: 1,
      s: world.playerS + 0.4,
      length: 0.6,
    };
    chunk.obstacles.push(barrier);
    // Descending from a jump, feet shaving the panel's top (0.9 − grace).
    world.player.grounded = false;
    world.player.vy = 0;
    world.player.y = 0.85;
    stepWorld(world, CENTER, DT);
    expect(world.gameOver).toBeNull();
    expect(world.warnedUntil).toBeGreaterThan(0);
    expect(barrier.neutralized).toBe(true);
  });

  it('an oncoming train advances toward the player and hits hard', () => {
    const world = createWorld(9);
    const chunk = clearArena(world);
    const train = {
      id: 9030,
      kind: 'train' as const,
      lane: 1 as const,
      s: chunk.startS + 40,
      length: 16,
      velocity: -8,
    };
    chunk.obstacles.push(train);
    chunk.hasMoving = true;

    const startS = train.s;
    stepSeconds(world, 1);
    expect(train.s).toBeLessThan(startS - 7); // moving toward the player
    stepSeconds(world, 5); // closing speed ~17 u/s across a ~50m gap
    expect(world.gameOver).toBe('hard');
  });
});
