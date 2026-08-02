import { describe, expect, it } from 'vitest';
import { SIZES, SPEED, TRACK } from '../constants';
import { obstaclesWithinChunk } from './patterns';
import { mulberry32 } from './rng';
import { difficultyAt, generateChunk, speedAt, validateChunk } from './spawner';
import { INITIAL_ENTRY_STATE, type ChunkEntryState, type ChunkSpec } from './types';

describe('speed & difficulty curves', () => {
  it('ramps speed from initial to max, gently at the start', () => {
    expect(speedAt(0)).toBe(SPEED.initial);
    expect(speedAt(10000)).toBe(SPEED.max);
    // Early game stays slow: barely +1.5 over the first 150m.
    expect(speedAt(150)).toBeLessThan(SPEED.initial + 1.6);
    // Monotonic non-decreasing.
    let last = 0;
    for (let d = 0; d <= 3000; d += 100) {
      const v = speedAt(d);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('unlocks tiers at the documented distances', () => {
    expect(difficultyAt(0)).toBe(0);
    expect(difficultyAt(150)).toBe(1);
    expect(difficultyAt(400)).toBe(2);
    expect(difficultyAt(800)).toBe(3);
  });
});

describe('validateChunk', () => {
  const emptyChunk = (startS = 0): ChunkSpec => ({
    startS,
    length: TRACK.chunkLength,
    patternKey: 'test',
    obstacles: [],
    coins: [],
    surfaces: [],
    decor: [],
  });

  it('an empty chunk is fair from anywhere and exits everywhere', () => {
    const result = validateChunk(emptyChunk(), INITIAL_ENTRY_STATE, SPEED.max);
    expect(result.ok).toBe(true);
    expect(result.exit.possibleLanes).toEqual([0, 1, 2]);
  });

  it('a wall with no openings is unfair', () => {
    const chunk = emptyChunk();
    for (const lane of [0, 1, 2] as const) {
      chunk.obstacles.push({ id: lane + 1, kind: 'wall', lane, s: 12, length: 1.5 });
    }
    expect(validateChunk(chunk, INITIAL_ENTRY_STATE, SPEED.max).ok).toBe(false);
  });

  it('a wall with one opening is fair and funnels the exit lanes', () => {
    const chunk = emptyChunk();
    chunk.obstacles.push({ id: 1, kind: 'wall', lane: 0, s: 12, length: 1.5 });
    chunk.obstacles.push({ id: 2, kind: 'wall', lane: 1, s: 12, length: 1.5 });
    const result = validateChunk(chunk, INITIAL_ENTRY_STATE, speedAt(0));
    expect(result.ok).toBe(true);
    expect(result.exit.possibleLanes).toContain(2);
  });

  it('rejects a wall the player has no room to reach the opening of', () => {
    const chunk = emptyChunk();
    // Wall at the very start of the chunk with only lane 2 open: a player
    // entering in lane 0 cannot cross two lanes in ~1 meter.
    chunk.obstacles.push({ id: 1, kind: 'wall', lane: 0, s: 1, length: 1.5 });
    chunk.obstacles.push({ id: 2, kind: 'wall', lane: 1, s: 1, length: 1.5 });
    expect(validateChunk(chunk, INITIAL_ENTRY_STATE, SPEED.max).ok).toBe(false);
  });

  it('a fully-trained chunk is fair only when entered on the roof', () => {
    const roof = SIZES.trainRoofY;
    const chunk = emptyChunk();
    chunk.obstacles.push({ id: 1, kind: 'train', lane: 1, s: 0, length: TRACK.chunkLength });
    chunk.surfaces.push({ lane: 1, sStart: 0, sEnd: TRACK.chunkLength, yStart: roof, yEnd: roof });

    const groundEntry: ChunkEntryState = { possibleLanes: [1], laneY: [0, 0, 0] };
    expect(validateChunk(chunk, groundEntry, SPEED.max).ok).toBe(false);

    const roofEntry: ChunkEntryState = { possibleLanes: [1], laneY: [0, roof, 0] };
    expect(validateChunk(chunk, roofEntry, SPEED.max).ok).toBe(true);
  });

  it("an oncoming train's lane is deadly past a short escape window", () => {
    const chunk = emptyChunk();
    chunk.obstacles.push({
      id: 1,
      kind: 'train',
      lane: 1,
      s: chunk.startS + 55,
      length: 16,
      velocity: -9,
    });
    // Entering IN the train's lane is fine — there's room to vacate...
    const inLane: ChunkEntryState = { possibleLanes: [1], laneY: [0, 0, 0] };
    const result = validateChunk(chunk, inLane, speedAt(0));
    expect(result.ok).toBe(true);
    // ...but nobody exits the chunk still in that lane.
    expect(result.exit.possibleLanes).not.toContain(1);

    // If the escape lanes are walled off, the chunk is unfair and rejected.
    chunk.obstacles.push(
      { id: 2, kind: 'wall', lane: 0, s: chunk.startS, length: TRACK.chunkLength },
      { id: 3, kind: 'wall', lane: 2, s: chunk.startS, length: TRACK.chunkLength },
    );
    expect(validateChunk(chunk, inLane, speedAt(0)).ok).toBe(false);
  });

  it('oncomingTrain chunks actually generate (the pattern is not validated away)', () => {
    const rng = mulberry32(1234);
    let id = 1;
    let entry = INITIAL_ENTRY_STATE;
    let startS = 200; // tier 1
    const keys = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const { chunk, exit } = generateChunk(rng, startS, entry, () => id++);
      keys.add(chunk.patternKey);
      entry = exit;
      startS += chunk.length;
    }
    expect(keys).toContain('oncomingTrain');
  });
});

describe('generateChunk (property tests)', () => {
  it('1000 seeded chunks per tier all validate and chain their entry states', () => {
    for (const tierStart of [0, 200, 500, 1000]) {
      const rng = mulberry32(tierStart + 7);
      let nextObstacleId = 1;
      const nextId = () => nextObstacleId++;
      let entry = INITIAL_ENTRY_STATE;
      let startS = tierStart;

      for (let i = 0; i < 1000; i++) {
        const { chunk, exit } = generateChunk(rng, startS, entry, nextId);
        expect(obstaclesWithinChunk(chunk)).toBe(true);
        expect(chunk.coins.length).toBeLessThanOrEqual(64);
        // The generator only returns chunks that already passed validation —
        // revalidate against the *chained* entry (at the same speed the
        // generator used) to catch state-threading bugs.
        const maxSpeed = Math.min(SPEED.max, speedAt(startS) * 1.15);
        const check = validateChunk(chunk, entry, maxSpeed);
        expect(check.ok).toBe(true);
        expect(exit.possibleLanes.length).toBeGreaterThan(0);
        entry = exit;
        startS += chunk.length;
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const build = (seed: number) => {
      const rng = mulberry32(seed);
      let id = 1;
      const chunks: string[] = [];
      let entry = INITIAL_ENTRY_STATE;
      for (let i = 0; i < 50; i++) {
        const { chunk, exit } = generateChunk(rng, i * TRACK.chunkLength, entry, () => id++);
        chunks.push(JSON.stringify(chunk));
        entry = exit;
      }
      return chunks.join('\n');
    };
    expect(build(42)).toBe(build(42));
    expect(build(42)).not.toBe(build(43));
  });
});
