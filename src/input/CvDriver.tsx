import { usePoseDetection } from '../pose/usePoseDetection';

/**
 * Mount point for the CV input pipeline. Rendering this component starts the
 * webcam + MediaPipe; unmounting it releases both (usePoseDetection's effect
 * cleanup stops the tracks and closes the landmarker). App only renders it in
 * CV mode, so keyboard mode never triggers a camera permission prompt.
 */
export function CvDriver({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  usePoseDetection(videoRef);
  return null;
}
