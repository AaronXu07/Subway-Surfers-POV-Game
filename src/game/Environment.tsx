import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { DIVIDER_X, LANE_X } from './constants';
import { GEO, GRAFFITI_COLORS, MATS } from './materials';
import { useWorld } from './useWorld';

const TRACK_DEPTH = 170;
const TRACK_CENTER_Z = 4 - TRACK_DEPTH / 2;

const tempMatrix = new Matrix4();
const tempPosition = new Vector3();
const identityQuaternion = new Quaternion();
const tempScale = new Vector3();

/**
 * The open-air rail yard: bright daylight, gravel ballast, wooden sleepers,
 * red-brick graffiti walls, lampposts and the occasional overpass. Continuous
 * elements are static long boxes; discrete repeating elements are
 * InstancedMeshes whose z wraps with playerS — those rushing past sell the
 * speed.
 */
export function Environment() {
  return (
    <>
      {/* Ballast bed under everything, plus per-lane gravel strips */}
      <mesh geometry={GEO.unitBox} material={MATS.gravelDark} position={[0, -0.22, TRACK_CENTER_Z]} scale={[12.4, 0.3, TRACK_DEPTH]} />
      {LANE_X.map((x) => (
        <mesh
          key={x}
          geometry={GEO.unitBox}
          material={MATS.gravel}
          position={[x, -0.15, TRACK_CENTER_Z]}
          scale={[2.35, 0.3, TRACK_DEPTH]}
        />
      ))}
      {/* Rails: two per lane */}
      {LANE_X.flatMap((x) => [x - 0.8, x + 0.8]).map((x, i) => (
        <mesh
          key={i}
          geometry={GEO.unitBox}
          material={MATS.rail}
          position={[x, 0.06, TRACK_CENTER_Z]}
          scale={[0.09, 0.12, TRACK_DEPTH]}
        />
      ))}
      {/* Brick walls fencing the yard, with cap stones */}
      <mesh geometry={GEO.unitBox} material={MATS.brick} position={[-6.1, 1.55, TRACK_CENTER_Z]} scale={[0.7, 3.6, TRACK_DEPTH]} />
      <mesh geometry={GEO.unitBox} material={MATS.brick} position={[6.1, 1.55, TRACK_CENTER_Z]} scale={[0.7, 3.6, TRACK_DEPTH]} />
      <mesh geometry={GEO.unitBox} material={MATS.brickCap} position={[-6.1, 3.42, TRACK_CENTER_Z]} scale={[0.85, 0.22, TRACK_DEPTH]} />
      <mesh geometry={GEO.unitBox} material={MATS.brickCap} position={[6.1, 3.42, TRACK_CENTER_Z]} scale={[0.85, 0.22, TRACK_DEPTH]} />

      {/* Wooden sleepers under the rails */}
      <WrappedInstances spacing={2.4} xs={[0]} y={-0.02} scale={[7.9, 0.1, 0.55]} material="sleeper" />
      {/* Lane divider dashes */}
      <WrappedInstances spacing={7} xs={[...DIVIDER_X]} y={0.02} scale={[0.08, 0.04, 3.5]} material="rail" />
      <GraffitiPanels />
      {/* Lampposts alternating sides */}
      <WrappedInstances spacing={44} xs={[-5.5]} y={2.6} scale={[0.14, 5.2, 0.14]} material="signalPole" />
      <WrappedInstances spacing={44} xs={[-5.15]} y={5.15} scale={[0.9, 0.12, 0.3]} material="signalPole" />
      <WrappedInstances spacing={44} xs={[-4.85]} y={5.05} scale={[0.42, 0.1, 0.42]} material="electricPanel" />
      <WrappedInstances spacing={44} offset={22} xs={[5.5]} y={2.6} scale={[0.14, 5.2, 0.14]} material="signalPole" />
      <WrappedInstances spacing={44} offset={22} xs={[5.15]} y={5.15} scale={[0.9, 0.12, 0.3]} material="signalPole" />
      <WrappedInstances spacing={44} offset={22} xs={[4.85]} y={5.05} scale={[0.42, 0.1, 0.42]} material="electricPanel" />
      {/* Overpass bridges: legs inset in front of the walls, railing sunk into
          the deck — no face may share a plane with the walls or the deck. */}
      <WrappedInstances spacing={72} offset={36} xs={[-5.2, 5.2]} y={2.875} scale={[0.9, 5.75, 1.6]} material="concrete" />
      <WrappedInstances spacing={72} offset={36} xs={[0]} y={5.9} scale={[13.4, 0.6, 2.4]} material="concreteDark" />
      <WrappedInstances spacing={72} offset={36} xs={[0]} y={6.4} scale={[13.2, 0.55, 0.25]} material="concrete" />
    </>
  );
}

const GRAFFITI_SPACING = 13;
/** Panels sit proud of the wall's inner face (x 5.75) — never coplanar with it. */
const GRAFFITI_X = 5.72;

/** Deterministic per-row randomness — stable while rows scroll and rebind. */
function hash01(row: number, salt: number): number {
  let h = Math.imul(row + salt * 374761393, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Wall graffiti: ONE InstancedMesh, tinted per instance. Each absolute track
 * row gets a deterministic side, size, height and color, and rows are spaced
 * so panels can never overlap — the previous multi-set version interleaved
 * four periodic layers on the same plane and z-fought wherever they met.
 */
function GraffitiPanels() {
  const world = useWorld();
  const ref = useRef<InstancedMesh>(null);
  const count = Math.ceil(TRACK_DEPTH / GRAFFITI_SPACING) + 1;

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const firstRow = Math.floor((world.playerS - 12) / GRAFFITI_SPACING);
    for (let i = 0; i < count; i++) {
      const row = firstRow + i;
      // Jitter (0..6) stays under the 13 spacing minus max panel length: no overlap.
      const s = row * GRAFFITI_SPACING + hash01(row, 1) * 6;
      const side = hash01(row, 2) < 0.5 ? -1 : 1;
      const bottom = 0.4 + hash01(row, 5) * 0.7;
      // Clamp so no panel pokes above the wall (top 3.35, cap from 3.31).
      const height = Math.min(1.1 + hash01(row, 3) * 1.2, 3.25 - bottom);
      const length = 2.6 + hash01(row, 4) * 2.6;
      const y = bottom + height / 2;
      tempPosition.set(side * GRAFFITI_X, y, -(s - world.playerS));
      tempScale.set(0.1, height, length);
      tempMatrix.compose(tempPosition, identityQuaternion, tempScale);
      mesh.setMatrixAt(i, tempMatrix);
      mesh.setColorAt(i, GRAFFITI_COLORS[Math.floor(hash01(row, 6) * GRAFFITI_COLORS.length)]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={ref}
      args={[GEO.unitBox, MATS.graffitiBase, count]}
      frustumCulled={false}
    />
  );
}

/**
 * One InstancedMesh whose instances repeat every `spacing` along the track at
 * the given x positions, wrapping with the player's position. `offset` phases
 * the pattern so different sets don't line up.
 */
function WrappedInstances({
  spacing,
  xs,
  y,
  scale,
  material,
  offset = 0,
}: {
  spacing: number;
  xs: number[];
  y: number;
  scale: [number, number, number];
  material: keyof typeof MATS;
  offset?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const world = useWorld();
  const rows = Math.ceil(TRACK_DEPTH / spacing) + 1;
  const count = rows * xs.length;

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const phase = (world.playerS + offset) % spacing;
    tempScale.set(...scale);
    let index = 0;
    for (let k = 0; k < rows; k++) {
      const z = 4 - (k * spacing - phase) - spacing;
      for (const x of xs) {
        tempPosition.set(x, y, z);
        tempMatrix.compose(tempPosition, identityQuaternion, tempScale);
        mesh.setMatrixAt(index++, tempMatrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={ref}
      args={[GEO.unitBox, MATS[material], count]}
      frustumCulled={false}
    />
  );
}
