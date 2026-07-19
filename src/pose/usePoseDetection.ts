import { useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { useGameStore } from '../state/gameStore';
import { classifyGesture } from '../gestures/gestureClassifier';

export function usePoseDetection(videoRef: React.RefObject<HTMLVideoElement>) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let stream: MediaStream;
    let rafId: number;

    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
      });

      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectLoop();
    }

    function detectLoop() {
      if (videoRef.current && landmarkerRef.current) {
        const result = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
        if (result.landmarks[0]) {
          useGameStore.getState().setGesture(classifyGesture(result.landmarks[0]));
        }
      }
      rafId = requestAnimationFrame(detectLoop);
    }

    setup();
    return () => {
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [videoRef]);
}