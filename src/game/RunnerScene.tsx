import { PlayerRig } from './PlayerRig';

const LANE_X = [-2.5, 0, 2.5];
const DIVIDER_X = [-1.25, 1.25];

export function RunnerScene() {
  return (
    <>
      <PlayerRig />

      {LANE_X.map((x) => (
        <mesh key={x} position={[x, -0.15, -44]} receiveShadow>
          <boxGeometry args={[2.35, 0.3, 100]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}

      {DIVIDER_X.map((x) =>
        Array.from({ length: 14 }, (_, index) => (
          <mesh key={`${x}-${index}`} position={[x, 0.02, 2 - index * 7]}>
            <boxGeometry args={[0.08, 0.03, 3.5]} />
            <meshBasicMaterial color="#dbeafe" />
          </mesh>
        )),
      )}
    </>
  );
}
