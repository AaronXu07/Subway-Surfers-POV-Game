import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

function extractCoord(land1: number, land2: number, landmarks: NormalizedLandmark[]) {
    const l = landmarks[land1]; 
    const r = landmarks[land2]; 

    return {
        y: Math.max(l.y, r.y), 
        x: (l.x + r.x) / 2
    }
}

export function classifyGesture(landmarks: NormalizedLandmark[]) {

  const shoulders = extractCoord(11, 12, landmarks); 
  const hips = extractCoord(23, 24, landmarks)

  let lane = 'center'; 

  if (hips.x > 0.66) {
    lane = 'left'; 
  } else if (hips.x < 0.33) {
    lane = 'right'
  }

  return {
    jump: hips.y < 0.6, // placeholder threshold, tune once you see real numbers
    duck: hips.y > 1.0,
    shouldY: hips.y,
    shouldX: hips.x,
    lane: lane, 
    ts: Date.now(),
  };
}