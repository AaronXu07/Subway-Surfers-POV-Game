import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import calibrationConfig from './calibrationConfig.json';

export interface CalibrationBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface CalibrationBoundsConfig {
  box: CalibrationBox;
  requiredHoldMs: number;
}

export const DEFAULT_CALIBRATION_CONFIG: CalibrationBoundsConfig = calibrationConfig;

export const CALIBRATION_LANDMARKS = {
  head: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

const REQUIRED_LANDMARKS = Object.values(CALIBRATION_LANDMARKS);

export function evaluateCalibrationPose(
  landmarks: NormalizedLandmark[] | null,
  config: CalibrationBoundsConfig = DEFAULT_CALIBRATION_CONFIG,
) {
  if (!landmarks) {
    return { isInside: false, missingLandmarks: REQUIRED_LANDMARKS };
  }

  const missingLandmarks = REQUIRED_LANDMARKS.filter(index => !landmarks[index]);
  if (missingLandmarks.length > 0) {
    return { isInside: false, missingLandmarks };
  }

  const isInside = REQUIRED_LANDMARKS.every(index => {
    const landmark = landmarks[index];
    return landmark.x >= config.box.xMin
      && landmark.x <= config.box.xMax
      && landmark.y >= config.box.yMin
      && landmark.y <= config.box.yMax;
  });

  return { isInside, missingLandmarks };
}
