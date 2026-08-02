import { describe, expect, it } from 'vitest';
import { PHYSICS, SIZES } from '../constants';
import { stepPlayer } from './player';
import type { PlayerInput, PlayerState, SurfaceSpec } from './types';

const DT = 1 / 60;
const SPEED = 12;

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return { x: 0, y: 0, vy: 0, grounded: true, wasJumping: false, duck: false, ...overrides };
}

function input(overrides: Partial<PlayerInput> = {}): PlayerInput {
  return { lane: 1, jump: false, duck: false, ...overrides };
}

/** Advance the player over track distance, returning trace of (s, y). */
function run(
  player: PlayerState,
  inputs: (s: number) => PlayerInput,
  sFrom: number,
  sTo: number,
  surfaces: SurfaceSpec[],
): Array<{ s: number; y: number }> {
  const trace: Array<{ s: number; y: number }> = [];
  let s = sFrom;
  while (s < sTo) {
    const ds = SPEED * DT;
    s += ds;
    stepPlayer(player, inputs(s), s, ds, DT, surfaces);
    trace.push({ s, y: player.y });
  }
  return trace;
}

describe('stepPlayer', () => {
  it('jumps on rising edge and returns to ground', () => {
    const player = makePlayer();
    let jumped = false;
    const trace = run(
      player,
      () => {
        if (!jumped) {
          jumped = true;
          return input({ jump: true });
        }
        return input();
      },
      0,
      12,
      [],
    );
    const apex = Math.max(...trace.map((t) => t.y));
    expect(apex).toBeGreaterThan(1.3);
    expect(apex).toBeLessThan(1.6);
    expect(player.grounded).toBe(true);
    expect(player.y).toBe(0);
  });

  it('does not re-jump while jump is held', () => {
    const player = makePlayer();
    run(player, () => input({ jump: true }), 0, 14, []);
    // One arc only: by 14u at speed 12 the jump (0.85s ≈ 10.2u) has landed.
    expect(player.grounded).toBe(true);
  });

  it('follows a ramp up onto a train roof', () => {
    const surfaces: SurfaceSpec[] = [
      { lane: 1, sStart: 10, sEnd: 18, yStart: 0, yEnd: SIZES.trainRoofY },
      { lane: 1, sStart: 18, sEnd: 30, yStart: SIZES.trainRoofY, yEnd: SIZES.trainRoofY },
    ];
    const player = makePlayer();
    run(player, () => input(), 0, 20, surfaces);
    expect(player.grounded).toBe(true);
    expect(player.y).toBeCloseTo(SIZES.trainRoofY, 1);
  });

  it('falls off the end of a roof', () => {
    const surfaces: SurfaceSpec[] = [
      { lane: 1, sStart: 0, sEnd: 10, yStart: SIZES.trainRoofY, yEnd: SIZES.trainRoofY },
    ];
    const player = makePlayer({ y: SIZES.trainRoofY });
    run(player, () => input(), 5, 11.5, surfaces);
    expect(player.grounded).toBe(false);
    expect(player.y).toBeLessThan(SIZES.trainRoofY);
    run(player, () => input(), 11.5, 25, surfaces);
    expect(player.grounded).toBe(true);
    expect(player.y).toBe(0);
  });

  it('does NOT step up a platform face while grounded', () => {
    const surfaces: SurfaceSpec[] = [
      { lane: 1, sStart: 10, sEnd: 26, yStart: SIZES.platformY, yEnd: SIZES.platformY },
    ];
    const player = makePlayer();
    run(player, () => input(), 0, 14, surfaces);
    // Stays at ground level "inside" the face — the collision table turns this into a crash.
    expect(player.y).toBe(0);
  });

  it('lands on a platform when jumping over its leading edge', () => {
    const surfaces: SurfaceSpec[] = [
      { lane: 1, sStart: 10, sEnd: 40, yStart: SIZES.platformY, yEnd: SIZES.platformY },
    ];
    const player = makePlayer();
    let jumped = false;
    run(
      player,
      (s) => {
        if (s > 8 && !jumped) {
          jumped = true;
          return input({ jump: true });
        }
        return input();
      },
      0,
      25,
      surfaces,
    );
    expect(player.grounded).toBe(true);
    expect(player.y).toBeCloseTo(SIZES.platformY, 5);
  });

  it('jump velocity clears a bin with margin but not a train roof', () => {
    const apex = PHYSICS.jumpVelocity ** 2 / (2 * PHYSICS.gravity);
    expect(apex).toBeGreaterThan(1.05 + 0.3); // bin top + real margin
    expect(apex).toBeLessThan(SIZES.trainRoofY - SIZES.landTolerance);
  });
});
