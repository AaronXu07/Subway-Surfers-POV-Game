import { create } from 'zustand';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { GestureResult } from '../gestures/gestureClassifier';
import type { DepthStatus } from '../gestures/depthGuard';

export type GamePhase = 'calibrating' | 'playing' | 'paused' | 'gameOver';

export interface CalibrationProfile {
  centerHipX: number;
  standingHipY: number;
  leftThreshold: number;
  rightThreshold: number;
  jumpThreshold: number;
  duckThreshold: number;
  neutralShoulderSpan: number;
}

interface GameState {
  phase: GamePhase;
  calibration: CalibrationProfile | null;
  poseLandmarks: NormalizedLandmark[] | null;
  gesture: GestureResult;
  depthStatus: DepthStatus;

  setPhase: (phase: GamePhase) => void;
  setCalibration: (calibration: CalibrationProfile) => void;
  clearCalibration: () => void;
  setPoseLandmarks: (landmarks: NormalizedLandmark[] | null) => void;
  setGesture: (g: GestureResult) => void;
  setDepthStatus: (status: DepthStatus) => void;
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
  depthStatus: 'unknown',
  setPhase: (phase) => set({ phase }),
  setCalibration: (calibration) => set({ calibration }),
  clearCalibration: () => set({ calibration: null, phase: 'calibrating', depthStatus: 'unknown' }),
  setPoseLandmarks: (poseLandmarks) => set({ poseLandmarks }),
  setGesture: (g) => set({ gesture: g }),
  setDepthStatus: (depthStatus) => set({ depthStatus }),
}));
