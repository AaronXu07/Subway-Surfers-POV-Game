import { create } from 'zustand';
import type { GestureResult } from '../gestures/gestureClassifier';

interface GameState {
  gesture: GestureResult;
  setGesture: (g: GestureResult) => void;
}

export const useGameStore = create<GameState>((set) => ({
  gesture: {
    jump: false,
    duck: false,
    hipX: 0.5,
    hipY: 0.5,
    lane: 'center',
    ts: 0,
  },
  setGesture: (g) => set({ gesture: g }),
}));