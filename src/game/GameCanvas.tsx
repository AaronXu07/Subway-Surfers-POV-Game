import { Canvas } from '@react-three/fiber';
import { RunnerScene } from './RunnerScene';

export function GameCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 2, 6], fov: 70, near: 0.1, far: 120 }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={['#07111f']} />
      <fog attach="fog" args={['#07111f', 30, 90]} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[6, 10, 4]} intensity={2} />
      <RunnerScene />
    </Canvas>
  );
}
