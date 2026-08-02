import { describe, expect, it } from 'vitest';
import { SIZES } from '../constants';
import { collectCoins, resolveCollisions } from './collision';
import type { CoinSpec, ObstacleSpec } from './types';

let id = 0;
function spec(partial: Partial<ObstacleSpec> & Pick<ObstacleSpec, 'kind'>): ObstacleSpec {
  return { id: ++id, lane: 1, s: 10, length: 0.6, ...partial };
}

const standing = { x: 0, y: 0, duck: false };
const ducking = { x: 0, y: 0, duck: true };

function hit(player: typeof standing, obstacles: ObstacleSpec[], from = 9, to = 10.5) {
  return resolveCollisions(player, from, to, obstacles);
}

describe('resolveCollisions', () => {
  it('barrierJumpOrRoll: soft-hits standing, cleared by duck and by jump', () => {
    const barrier = [spec({ kind: 'barrierJumpOrRoll' })];
    const events = hit(standing, barrier);
    expect(events).toHaveLength(1);
    expect(events[0].severity).toBe('soft'); // barriers stumble, they don't kill
    expect(hit(ducking, barrier)).toHaveLength(0); // duck height 0.6 < beam bottom 0.85
    expect(hit({ ...standing, y: 1.2 }, barrier)).toHaveLength(0); // feet above beam top 1.15
  });

  it('barrierJumpOnly: duck does not help, jump does', () => {
    const barrier = [spec({ kind: 'barrierJumpOnly' })];
    expect(hit(standing, barrier)).toHaveLength(1);
    expect(hit(standing, barrier)[0].severity).toBe('soft');
    expect(hit(ducking, barrier)).toHaveLength(1);
    expect(hit({ ...standing, y: 1.0 }, barrier)).toHaveLength(0);
  });

  it('barrierRollOnly: jump cannot clear it, duck can', () => {
    const barrier = [spec({ kind: 'barrierRollOnly' })];
    expect(hit(standing, barrier)).toHaveLength(1);
    expect(hit(standing, barrier)[0].severity).toBe('soft');
    expect(hit({ ...standing, y: 1.3 }, barrier)).toHaveLength(1); // apex height still hits the bar
    expect(hit(ducking, barrier)).toHaveLength(0); // duck top 0.6 < bar bottom 1.15
  });

  it('train: collides at ground, skipped on the roof', () => {
    const train = [spec({ kind: 'train', length: 14 })];
    const events = hit(standing, train);
    expect(events).toHaveLength(1);
    expect(events[0].severity).toBe('hard');
    expect(hit({ ...standing, y: SIZES.trainRoofY }, train)).toHaveLength(0);
  });

  it('ramped train: following the ramp surface never collides, undercutting it does', () => {
    const train = [spec({ kind: 'train', length: 18, hasRamp: true, s: 10 })];
    // Mid-ramp at s=13 the top is 1.1; a player at ramp height is skipped...
    expect(resolveCollisions({ x: 0, y: 1.1, duck: false }, 12.9, 13.1, train)).toHaveLength(0);
    // ...a grounded player who lane-switched under the ramp is not.
    expect(resolveCollisions(standing, 12.9, 13.1, train)).toHaveLength(1);
  });

  it('platform: face crashes a grounded runner, landing on top is free', () => {
    const platform = [spec({ kind: 'platform', length: 16 })];
    expect(hit(standing, platform)).toHaveLength(1);
    expect(hit({ ...standing, y: SIZES.platformY }, platform)).toHaveLength(0);
    expect(hit({ ...standing, y: SIZES.platformY - 0.2 }, platform)).toHaveLength(0); // within tolerance
  });

  it('bush and light signal are soft; bush is cleared by jump height', () => {
    const bush = [spec({ kind: 'bush', length: 1.2 })];
    const softEvents = hit(standing, bush);
    expect(softEvents[0].severity).toBe('soft');
    expect(hit({ ...standing, y: 0.7 }, bush)).toHaveLength(0);

    const signal = [spec({ kind: 'lightSignal', x: 1.25, length: 0.5 })];
    expect(hit(standing, signal)).toHaveLength(0); // centered in lane: clear of divider
    expect(hit({ ...standing, x: 1.0 }, signal)).toHaveLength(1); // drifting through the divider
  });

  it('neutralized soft obstacles stop colliding', () => {
    const bush = spec({ kind: 'bush', length: 1.2, neutralized: true });
    expect(hit(standing, [bush])).toHaveLength(0);
  });

  it('swept interval prevents tunneling through a thin obstacle at speed', () => {
    const bin = [spec({ kind: 'bin', s: 10, length: 0.6 })];
    // One 26 u/s frame at 30fps: prev 9.2 → 10.9 jumps clean past the volume.
    expect(resolveCollisions(standing, 9.2, 10.9, bin)).toHaveLength(1);
  });

  it('only hits obstacles in the player lane', () => {
    const train = [spec({ kind: 'train', lane: 0, length: 14 })];
    expect(hit(standing, train)).toHaveLength(0);
  });
});

describe('collectCoins', () => {
  it('collects a ground line only once, needs height match for arcs', () => {
    const coins: CoinSpec[] = [
      { s: 10, lane: 1, y: 1.0 },
      { s: 12, lane: 1, y: 2.4 },
    ];
    const collected = new Uint8Array(8);
    expect(collectCoins({ x: 0, y: 0 }, 9, 11, coins, collected)).toBe(1);
    expect(collectCoins({ x: 0, y: 0 }, 9, 11, coins, collected)).toBe(0); // already taken
    expect(collectCoins({ x: 0, y: 0 }, 11, 13, coins, collected)).toBe(0); // arc too high
    expect(collectCoins({ x: 0, y: 1.2 }, 11, 13, coins, collected)).toBe(1); // jumping through it
  });
});
