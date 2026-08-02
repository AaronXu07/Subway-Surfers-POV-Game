import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { PHYSICS, SIZES } from './constants';
import { useWorld } from './useWorld';

const SHAKE_DURATION = 0.5;
/** Slight downward tilt so the track ahead reads well from eye height. */
const CAMERA_PITCH = -0.08;

/**
 * Camera applier — no physics here. The world's player state (already damped
 * laterally, physically integrated vertically) maps to the POV camera; the
 * vertical damp only smooths duck dips and landings.
 */
export function PlayerRig() {
  const world = useWorld();

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const player = world.player;

    const targetY =
      player.y +
      SIZES.cameraEyeAboveFeet -
      (player.duck && player.grounded ? SIZES.duckCameraDrop : 0);

    // Own the full camera pose: R3F's default camera aims at the origin,
    // which from [0, 2, 0] would stare at the floor.
    camera.rotation.set(CAMERA_PITCH, 0, 0);
    camera.position.z = 0;
    camera.position.x = player.x;
    camera.position.y = MathUtils.damp(
      camera.position.y,
      targetY,
      PHYSICS.heightDampLambda,
      dt,
    );

    if (world.elapsed < world.shakeUntil) {
      const falloff = (world.shakeUntil - world.elapsed) / SHAKE_DURATION;
      const amp = 0.14 * falloff;
      camera.position.x += Math.sin(world.elapsed * 55) * amp;
      camera.position.y += Math.cos(world.elapsed * 47) * amp * 0.6;
    }
  });

  return null;
}
