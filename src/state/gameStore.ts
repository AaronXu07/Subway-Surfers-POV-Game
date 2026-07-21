import { create } from 'zustand';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type GamePhase = 'calibrating' | 'playing' | 'paused' | 'gameOver';

export interface CalibrationProfile {
  centerHipX: number;
  standingHipY: number;
  leftThreshold: number;
  rightThreshold: number;
  jumpThreshold: number;
  duckThreshold: number;
}

interface GameState {
  phase: GamePhase;
  calibration: CalibrationProfile | null;
  poseLandmarks: NormalizedLandmark[] | null;
  gesture: { 
    jump: boolean; 
    duck: boolean; 
    hipY: number; 
    hipX: number; 
    lane: string; 
    ts: number 
  };

  setPhase: (phase: GamePhase) => void;
  setCalibration: (calibration: CalibrationProfile) => void;
  clearCalibration: () => void;
  setPoseLandmarks: (landmarks: NormalizedLandmark[] | null) => void;
  setGesture: (g: GameState['gesture']) => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'calibrating',
  calibration: null,
  poseLandmarks: null,
  gesture: { 
    jump: false, 
    duck: false, 
    hipY: 0, 
    hipX: 0,
    lane: 'middle',  
    ts: 0 
  },
  setPhase: (phase) => set({ phase }),
  setCalibration: (calibration) => set({ calibration }),
  clearCalibration: () => set({ calibration: null, phase: 'calibrating' }),
  setPoseLandmarks: (poseLandmarks) => set({ poseLandmarks }),
  setGesture: (g) => set({ gesture: g }),
}));
