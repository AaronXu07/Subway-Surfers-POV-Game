import { useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { useGameStore } from '../state/gameStore';
import { classifyGesture } from '../gestures/gestureClassifier';

export function usePoseDetection(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number;

    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
      });

      if (isCancelled) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = videoRef.current;
      if (!video || isCancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();
      await waitForVideoDimensions(video);

      if (isCancelled) {
        return;
      }

      detectLoop();
    }

    function detectLoop() {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && isVideoReady(video)) {
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          if (result.landmarks[0]) {
            const landmarks = result.landmarks[0];
            const { setGesture, setPoseLandmarks } = useGameStore.getState();
            setPoseLandmarks(landmarks);
            setGesture(classifyGesture(landmarks));
          }
        } catch (error) {
          console.error('Pose detection failed:', error);
        }
      }

      if (!isCancelled) {
        rafId = requestAnimationFrame(detectLoop);
      }
    }

    setup().catch(error => {
      console.error('Pose detection setup failed:', error);
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(track => track.stop());
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [videoRef]);
}

function isVideoReady(video: HTMLVideoElement) {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && video.videoWidth > 0
    && video.videoHeight > 0;
}

function waitForVideoDimensions(video: HTMLVideoElement) {
  if (isVideoReady(video)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleReady = () => {
      if (isVideoReady(video)) {
        cleanup();
        resolve();
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Camera video did not become readable.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener('loadedmetadata', handleReady);
    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('canplay', handleReady);
    video.addEventListener('error', handleError);
  });
}
