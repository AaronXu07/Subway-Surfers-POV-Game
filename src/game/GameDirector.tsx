import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LANE_INDEX } from './constants';
import { scoreOf, stepWorld } from './logic/world';
import type { World } from './logic/types';
import { useGameStore, type RunStats } from '../state/gameStore';
import { useWorld } from './useWorld';

const HUD_PUSH_MS = 150;

function snapshot(world: World): RunStats {
  return {
    score: scoreOf(world),
    coins: world.coinsCollected,
    distance: world.distance,
    speed: world.speed,
  };
}

/**
 * The one simulation driver. Runs before every transform-writing component
 * (priority -2), reads input imperatively, steps the pure world, and converts
 * events into the few discrete store writes the UI needs.
 */
export function GameDirector() {
  const world = useWorld();
  const lastHudPush = useRef(0);

  useFrame((_, delta) => {
    const store = useGameStore.getState();
    if (store.phase !== 'playing' || world.gameOver) return;

    const dt = Math.min(delta, 0.05);
    const gesture = store.gesture;
    const events = stepWorld(
      world,
      { lane: LANE_INDEX[gesture.lane], jump: gesture.jump, duck: gesture.duck },
      dt,
    );

    const warning = world.elapsed < world.warnedUntil;
    if (warning !== store.stumbleWarning) store.setStumbleWarning(warning);

    if (events.gameOver) {
      store.endRun(snapshot(world), events.gameOver);
      return;
    }

    const now = performance.now();
    if (now - lastHudPush.current > HUD_PUSH_MS) {
      lastHudPush.current = now;
      store.updateRunStats(snapshot(world));
    }
  }, -2);

  return null;
}
