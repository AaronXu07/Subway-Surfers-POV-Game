import { LANE_X, PHYSICS } from '../constants';
import { sampleGround, sampleGroundFollow } from './elevation';
import { damp, laneFromX } from './math';
import type { PlayerInput, PlayerState, SurfaceSpec } from './types';

/** Below this drop the player just follows the ground; above it they go airborne. */
const FALL_EPS = 0.05;

/**
 * Advance the player one frame. `s` is the (already advanced) track position,
 * `ds` how far it advanced this frame. Vertical model uses absolute feet
 * height: grounded players follow the ground (which is how ramps are climbed),
 * airborne players integrate gravity and land on whatever eligible surface
 * they reach.
 */
export function stepPlayer(
  player: PlayerState,
  input: PlayerInput,
  s: number,
  ds: number,
  dt: number,
  surfaces: readonly SurfaceSpec[],
): void {
  player.x = damp(player.x, LANE_X[input.lane], PHYSICS.laneDampLambda, dt);
  const lane = laneFromX(player.x);

  if (player.grounded) {
    const ground = sampleGroundFollow(s, lane, player.y, ds, surfaces);
    if (ground < player.y - FALL_EPS) {
      // Ground fell away — roof end, ramp crest overshoot, or a lane switch
      // off an elevated surface. Start falling from rest.
      player.grounded = false;
      player.vy = 0;
    } else {
      player.y = ground;
    }
  }

  if (player.grounded && input.jump && !player.wasJumping) {
    player.vy = PHYSICS.jumpVelocity;
    player.grounded = false;
  }

  if (!player.grounded) {
    player.vy -= PHYSICS.gravity * dt;
    player.y += player.vy * dt;
    const ground = sampleGround(s, lane, player.y, surfaces);
    if (player.vy <= 0 && player.y <= ground) {
      player.y = ground;
      player.vy = 0;
      player.grounded = true;
    }
  }

  player.wasJumping = input.jump;
  player.duck = input.duck;
}
