import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { LANE_X } from './constants';
import { GEO, MATS } from './materials';
import { useWorld } from './useWorld';

const MAX_COINS = 256;

const tempPosition = new Vector3();
const tempQuaternion = new Quaternion();
const tempEuler = new Euler();
const tempMatrix = new Matrix4();
const unitScale = new Vector3(1, 1, 1);

/**
 * Every live coin in one InstancedMesh; matrices rewritten each frame from the
 * active chunks. Collected coins are simply skipped (their slot bit is set).
 */
export function InstancedCoins() {
  const world = useWorld();
  const ref = useRef<InstancedMesh>(null);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    let count = 0;
    const spin = world.elapsed * 3;
    for (const slot of world.slots) {
      const chunk = slot.chunk;
      if (!chunk) continue;
      for (let i = 0; i < chunk.coins.length && count < MAX_COINS; i++) {
        if (slot.collected[i]) continue;
        const coin = chunk.coins[i];
        const z = -(coin.s - world.playerS);
        if (z > 2 || z < -140) continue;
        tempPosition.set(LANE_X[coin.lane], coin.y, z);
        tempQuaternion.setFromEuler(tempEuler.set(0, spin + coin.s * 0.7, 0));
        tempMatrix.compose(tempPosition, tempQuaternion, unitScale);
        mesh.setMatrixAt(count++, tempMatrix);
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, -1);

  return <instancedMesh ref={ref} args={[GEO.coin, MATS.coin, MAX_COINS]} frustumCulled={false} />;
}
