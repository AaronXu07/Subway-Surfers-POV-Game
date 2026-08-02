import { Canvas } from '@react-three/fiber';
import { PALETTE } from './materials';
import { RunnerScene } from './RunnerScene';
import { WorldProvider } from './WorldContext';

export function GameCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 2, 0], fov: 70, near: 0.1, far: 150 }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 35, 120]} />
      <hemisphereLight args={[PALETTE.sky, PALETTE.gravelDark, 0.9]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 16, 6]} intensity={2.2} />
      <directionalLight position={[-6, 8, -10]} intensity={0.5} />
      <WorldProvider>
        <RunnerScene />
      </WorldProvider>
    </Canvas>
  );
}
