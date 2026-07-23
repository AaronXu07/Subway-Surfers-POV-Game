import { create } from 'zustand';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { GestureResult } from '../gestures/gestureClassifier';

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
  gesture: GestureResult;

  setPhase: (phase: GamePhase) => void;
  setCalibration: (calibration: CalibrationProfile) => void;
  clearCalibration: () => void;
  setPoseLandmarks: (landmarks: NormalizedLandmark[] | null) => void;
  setGesture: (g: GestureResult) => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'calibrating',
  calibration: null,
  poseLandmarks: null,
  gesture: {
    jump: false,
    duck: false,
    hipX: 0.5,
    hipY: 0.5,
    lane: 'center',
    ts: 0,
  },
  setPhase: (phase) => set({ phase }),
  setCalibration: (calibration) => set({ calibration }),
  clearCalibration: () => set({ calibration: null, phase: 'calibrating' }),
  setPoseLandmarks: (poseLandmarks) => set({ poseLandmarks }),
  setGesture: (g) => set({ gesture: g }),
}));
