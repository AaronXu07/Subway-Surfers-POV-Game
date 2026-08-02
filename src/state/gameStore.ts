import { create } from 'zustand';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { GestureResult } from '../gestures/gestureClassifier';
import type { DepthStatus } from '../gestures/depthGuard';

export type GamePhase = 'menu' | 'calibrating' | 'playing' | 'paused' | 'gameOver';
export type ControlMode = 'keyboard' | 'cv';
export type GameOverReason = 'hard' | 'caught';

export interface CalibrationProfile {
  centerHipX: number;
  standingHipY: number;
  leftThreshold: number;
  rightThreshold: number;
  jumpThreshold: number;
  duckThreshold: number;
  neutralShoulderSpan: number;
}

export interface RunStats {
  score: number;
  coins: number;
  distance: number;
  speed: number;
}

const NEUTRAL_GESTURE: GestureResult = {
  jump: false,
  duck: false,
  hipX: 0.5,
  hipY: 0.5,
  lane: 'center',
  ts: 0,
};

const ZERO_STATS: RunStats = { score: 0, coins: 0, distance: 0, speed: 0 };

interface GameState {
  phase: GamePhase;
  controlMode: ControlMode;
  /** Increments per run; keys World creation and resets input intent. */
  runId: number;
  /** Throttled snapshot for the HUD (~7Hz) — per-frame truth lives in World. */
  runStats: RunStats;
  stumbleWarning: boolean;
  gameOverReason: GameOverReason | null;
  calibration: CalibrationProfile | null;
  poseLandmarks: NormalizedLandmark[] | null;
  gesture: GestureResult;
  depthStatus: DepthStatus;

  setPhase: (phase: GamePhase) => void;
  setControlMode: (mode: ControlMode) => void;
  startRun: () => void;
  endRun: (final: RunStats, reason: GameOverReason) => void;
  togglePause: () => void;
  updateRunStats: (stats: RunStats) => void;
  setStumbleWarning: (warning: boolean) => void;
  setCalibration: (calibration: CalibrationProfile) => void;
  clearCalibration: () => void;
  setPoseLandmarks: (landmarks: NormalizedLandmark[] | null) => void;
  setGesture: (g: GestureResult) => void;
  setDepthStatus: (status: DepthStatus) => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'menu',
  controlMode: 'keyboard',
  runId: 0,
  runStats: ZERO_STATS,
  stumbleWarning: false,
  gameOverReason: null,
  calibration: null,
  poseLandmarks: null,
  gesture: NEUTRAL_GESTURE,
  depthStatus: 'unknown',

  setPhase: (phase) => set({ phase }),
  setControlMode: (controlMode) => set({ controlMode }),
  startRun: () =>
    set((state) => ({
      runId: state.runId + 1,
      runStats: ZERO_STATS,
      stumbleWarning: false,
      gameOverReason: null,
      gesture: { ...NEUTRAL_GESTURE, lane: state.gesture.lane },
      phase: 'playing',
    })),
  endRun: (runStats, gameOverReason) =>
    set({ runStats, gameOverReason, stumbleWarning: false, phase: 'gameOver' }),
  togglePause: () =>
    set((state) => {
      if (state.phase === 'playing') return { phase: 'paused' };
      if (state.phase === 'paused') return { phase: 'playing' };
      return {};
    }),
  updateRunStats: (runStats) => set({ runStats }),
  setStumbleWarning: (stumbleWarning) => set({ stumbleWarning }),
  setCalibration: (calibration) => set({ calibration }),
  clearCalibration: () => set({ calibration: null, phase: 'calibrating', depthStatus: 'unknown' }),
  setPoseLandmarks: (poseLandmarks) => set({ poseLandmarks }),
  setGesture: (g) => set({ gesture: g }),
  setDepthStatus: (depthStatus) => set({ depthStatus }),
}));
