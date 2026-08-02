import { createContext, useContext } from 'react';
import type { World } from './logic/types';

export const WorldContext = createContext<World | null>(null);

export function useWorld(): World {
  const world = useContext(WorldContext);
  if (!world) throw new Error('useWorld must be used inside a WorldProvider');
  return world;
}
