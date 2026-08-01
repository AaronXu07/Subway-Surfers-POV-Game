import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { useGameStore } from '../state/gameStore';

const LANE_X = { left: -2.5, center: 0, right: 2.5 } as const;
const CAMERA_HEIGHT = 2;

export function PlayerRig() {
  const jumpHeight = useRef(0);
  const jumpVelocity = useRef(0);
  const wasJumping = useRef(false);

  useFrame(({ camera }, delta) => {
    const { lane, jump, duck } = useGameStore.getState().gesture;
    const frameDelta = Math.min(delta, 0.05);

    if (jump && !wasJumping.current && jumpHeight.current === 0) {
      jumpVelocity.current = 6;
    }
    wasJumping.current = jump;

    if (jumpVelocity.current !== 0 || jumpHeight.current > 0) {
      jumpVelocity.current -= 16 * frameDelta;
      jumpHeight.current += jumpVelocity.current * frameDelta;

      if (jumpHeight.current <= 0) {
        jumpHeight.current = 0;
        jumpVelocity.current = 0;
      }
    }

    camera.position.x = MathUtils.damp(camera.position.x, LANE_X[lane], 8, frameDelta);
    camera.position.y = MathUtils.damp(
      camera.position.y,
      CAMERA_HEIGHT + jumpHeight.current - (duck && jumpHeight.current === 0 ? 0.85 : 0),
      12,
      frameDelta,
    );
  });

  return null;
}
