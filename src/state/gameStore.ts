import { create } from 'zustand';

interface GameState {
  gesture: { 
    jump: boolean; 
    duck: boolean; 
    hipY: number; 
    hipX: number; 
    lane: string; 
    ts: number 
  };

  setGesture: (g: GameState['gesture']) => void;
}

export const useGameStore = create<GameState>((set) => ({
  gesture: { 
    jump: false, 
    duck: false, 
    hipY: 0, 
    hipX: 0,
    lane: 'middle',  
    ts: 0 
  },
  setGesture: (g) => set({ gesture: g }),
}));