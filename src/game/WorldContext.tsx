import { useEffect, useMemo, type ReactNode } from 'react';
import { useGameStore } from '../state/gameStore';
import { createWorld } from './logic/world';
import { WorldContext } from './useWorld';

// Module-level salt: run #1 differs between page loads while each render stays pure.
const SESSION_SALT = Math.floor(Math.random() * 0x7fffffff);

/**
 * Owns the per-run mutable World. Keyed on runId: every restart builds a
 * fresh world, which is the entire reset story — no manual state flushing.
 * Must live INSIDE the R3F <Canvas> (contexts don't cross renderer roots).
 */
export function WorldProvider({ children }: { children: ReactNode }) {
  const runId = useGameStore((s) => s.runId);
  const world = useMemo(
    () => createWorld(((Math.imul(runId + 1, 2654435761) ^ SESSION_SALT) >>> 0) || 1),
    [runId],
  );

  // Dev-only escape hatch for debugging and automated soak tests.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __world?: unknown }).__world = world;
    }
  }, [world]);

  return <WorldContext.Provider value={world}>{children}</WorldContext.Provider>;
}
