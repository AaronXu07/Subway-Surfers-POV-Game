import { useReducer, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { LANE_X, SIZES } from './constants';
import { RAMP_LENGTH } from './logic/collision';
import type { ChunkSpec, DecorSpec, ObstacleSpec } from './logic/types';
import { GEO, MATS, TRAIN_BODY_MATS } from './materials';
import { useWorld } from './useWorld';

/**
 * Renders one chunk slot. The obstacle meshes re-render only when the slot is
 * recycled (~1/s, detected via the slot's version counter); per frame the
 * whole group just slides along z with the player's track position. Moving
 * trains and blinking signs additionally animate themselves via useFrame.
 */
export function ChunkView({ index }: { index: number }) {
  const world = useWorld();
  const slot = world.slots[index];
  const [, forceRender] = useReducer((c: number) => c + 1, 0);
  const seenVersion = useRef(slot.version);
  const group = useRef<Group>(null);

  useFrame(() => {
    if (slot.version !== seenVersion.current) {
      seenVersion.current = slot.version;
      forceRender();
    }
    const g = group.current;
    if (!g) return;
    if (slot.chunk) {
      g.visible = true;
      g.position.z = -(slot.chunk.startS - world.playerS);
    } else {
      g.visible = false;
    }
  }, -1);

  const chunk = slot.chunk;
  if (!chunk) return null;

  // Walls and tunnel bores merge contiguous lanes into ONE box each —
  // per-lane boxes with identical extents would overlap and z-fight.
  const wallRuns = contiguousLaneRuns(chunk.obstacles.filter((o) => o.kind === 'wall'));
  const boreRuns = contiguousLaneRuns(chunk.decor.filter((d) => d.kind === 'tunnelArch'));

  return (
    <group ref={group}>
      {chunk.obstacles
        .filter((spec) => spec.kind !== 'wall')
        .map((spec) => (
          <Obstacle key={spec.id} spec={spec} chunk={chunk} />
        ))}
      {wallRuns.map((run, i) => (
        <MergedWall key={`wall-${i}`} specs={run} chunk={chunk} />
      ))}
      {boreRuns.map((run, i) => (
        <MergedBore key={`bore-${i}`} decors={run} chunk={chunk} />
      ))}
      {chunk.decor
        .filter((d) => d.kind === 'oncomingWarning')
        .map((decor, i) => (
          <OncomingWarning key={i} decor={decor} chunk={chunk} />
        ))}
    </group>
  );
}

/** Group items sharing the same s into runs of adjacent lanes. */
function contiguousLaneRuns<T extends { lane: number; s: number }>(items: T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.s - b.s || a.lane - b.lane);
  const runs: T[][] = [];
  for (const item of sorted) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (last && last.s === item.s && item.lane === last.lane + 1) {
      run.push(item);
    } else {
      runs.push([item]);
    }
  }
  return runs;
}

/** z of a track coordinate inside the chunk group (leading edge of the chunk = 0). */
function relZ(chunk: ChunkSpec, s: number): number {
  return -(s - chunk.startS);
}

function Obstacle({ spec, chunk }: { spec: ObstacleSpec; chunk: ChunkSpec }) {
  switch (spec.kind) {
    case 'train':
      return <Train spec={spec} chunk={chunk} />;
    case 'barrierJumpOrRoll':
      return <BarrierJumpOrRoll spec={spec} chunk={chunk} />;
    case 'barrierJumpOnly':
      return <BarrierJumpOnly spec={spec} chunk={chunk} />;
    case 'barrierRollOnly':
      return <BarrierRollOnly spec={spec} chunk={chunk} />;
    case 'bush':
      return <Bush spec={spec} chunk={chunk} />;
    case 'lightSignal':
      return <LightSignal spec={spec} chunk={chunk} />;
    case 'bin':
      return <Bin spec={spec} chunk={chunk} />;
    case 'pillar':
      return <Pillar spec={spec} chunk={chunk} />;
    case 'wall':
      return null; // rendered merged by ChunkView
    case 'platform':
      return <Platform spec={spec} chunk={chunk} />;
  }
}

interface Props {
  spec: ObstacleSpec;
  chunk: ChunkSpec;
}

const ROOF = SIZES.trainRoofY;
const RAMP_ANGLE = Math.atan2(ROOF, RAMP_LENGTH);
const RAMP_SLAB = Math.hypot(ROOF, RAMP_LENGTH);

/**
 * Subway car: dark skirt, colored livery body, white accent stripe, dark
 * glass band, pale roof cap, windshield + glowing headlights on the leading
 * face. Moving (oncoming) trains track their mutating `s` every frame.
 */
function Train({ spec, chunk }: Props) {
  const group = useRef<Group>(null);
  const rampLength = spec.hasRamp ? RAMP_LENGTH : 0;
  const bodyLength = spec.length - rampLength;
  const centerZFor = (s: number) => relZ(chunk, s + rampLength + bodyLength / 2);
  const moving = spec.velocity !== undefined;

  useFrame(() => {
    if (!moving || !group.current) return;
    group.current.position.z = centerZFor(spec.s);
    group.current.visible = !spec.neutralized;
  });

  const body = TRAIN_BODY_MATS[spec.id % TRAIN_BODY_MATS.length];
  const front = bodyLength / 2;

  return (
    <group ref={group} position={[LANE_X[spec.lane], 0, centerZFor(spec.s)]}>
      <mesh geometry={GEO.unitBox} material={MATS.trainSkirt} position={[0, 0.19, 0]} scale={[2.08, 0.38, bodyLength - 0.06]} />
      <mesh geometry={GEO.unitBox} material={body} position={[0, 1.46, 0]} scale={[2.2, 2.18, bodyLength]} />
      <mesh geometry={GEO.unitBox} material={MATS.trainRoof} position={[0, 2.78, 0]} scale={[2.04, 0.46, bodyLength - 0.12]} />
      <mesh geometry={GEO.unitBox} material={MATS.barrierWhite} position={[0, 1.02, 0]} scale={[2.26, 0.18, bodyLength - 0.3]} />
      <mesh geometry={GEO.unitBox} material={MATS.trainWindow} position={[0, 1.98, 0]} scale={[2.26, 0.56, bodyLength * 0.86]} />
      {/* Leading face: windshield + headlights */}
      <mesh geometry={GEO.unitBox} material={MATS.trainWindow} position={[0, 2.12, front + 0.02]} scale={[1.66, 0.86, 0.08]} />
      <mesh geometry={GEO.unitBox} material={MATS.headlight} position={[-0.72, 0.86, front + 0.03]} scale={[0.3, 0.22, 0.08]} />
      <mesh geometry={GEO.unitBox} material={MATS.headlight} position={[0.72, 0.86, front + 0.03]} scale={[0.3, 0.22, 0.08]} />
      {spec.hasRamp && (
        <mesh
          geometry={GEO.unitBox}
          material={MATS.ramp}
          position={[0, ROOF / 2 - 0.06, front + RAMP_LENGTH / 2]}
          rotation-x={RAMP_ANGLE}
          scale={[2.2, 0.16, RAMP_SLAB]}
        />
      )}
    </group>
  );
}

function BarrierPosts({ height, z }: { height: number; z: number }) {
  return (
    <>
      <mesh geometry={GEO.unitBox} material={MATS.barrierPost} position={[-1.08, height / 2, z]} scale={[0.14, height, 0.14]} />
      <mesh geometry={GEO.unitBox} material={MATS.barrierPost} position={[1.08, height / 2, z]} scale={[0.14, height, 0.14]} />
    </>
  );
}

/** White beam with proud red stripes — dimensions all differ so no faces are coplanar. */
function StripedBeam({ y, height, z }: { y: number; height: number; z: number }) {
  return (
    <>
      <mesh geometry={GEO.unitBox} material={MATS.barrierWhite} position={[0, y, z]} scale={[2.3, height, 0.2]} />
      {[-0.77, 0, 0.77].map((x) => (
        <mesh
          key={x}
          geometry={GEO.unitBox}
          material={MATS.barrierRed}
          position={[x, y, z]}
          scale={[0.38, height - 0.06, 0.24]}
        />
      ))}
    </>
  );
}

/** Mid-height beam: jump over or roll (well) under. */
function BarrierJumpOrRoll({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position-x={LANE_X[spec.lane]}>
      <BarrierPosts height={1.22} z={z} />
      <StripedBeam y={1.0} height={0.3} z={z} />
    </group>
  );
}

/** Bottom blocked: jump only. */
function BarrierJumpOnly({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position-x={LANE_X[spec.lane]}>
      <BarrierPosts height={1.12} z={z} />
      <mesh geometry={GEO.unitBox} material={MATS.barrierRed} position={[0, 0.45, z]} scale={[2.3, 0.9, 0.2]} />
      <mesh geometry={GEO.unitBox} material={MATS.barrierWhite} position={[0, 0.45, z]} scale={[2.34, 0.3, 0.24]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardDark} position={[0, 0.96, z]} scale={[2.34, 0.2, 0.24]} />
    </group>
  );
}

/** Overhead bar with a blocked top: roll under only. The underpass gap spans [0, 1.15]. */
function BarrierRollOnly({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position-x={LANE_X[spec.lane]}>
      <BarrierPosts height={1.5} z={z} />
      <StripedBeam y={1.35} height={0.4} z={z} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardDark} position={[0, 2.56, z]} scale={[2.3, 1.88, 0.16]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardYellow} position={[0, 1.72, z]} scale={[2.34, 0.14, 0.2]} />
    </group>
  );
}

function Bush({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position={[LANE_X[spec.lane], 0, z]}>
      <mesh geometry={GEO.bush} material={MATS.bush} position={[-0.35, 0.28, 0.1]} scale={[0.9, 0.65, 0.9]} />
      <mesh geometry={GEO.bush} material={MATS.bushDark} position={[0.4, 0.25, -0.15]} scale={[0.8, 0.6, 0.8]} />
      <mesh geometry={GEO.bush} material={MATS.bush} position={[0.05, 0.38, 0.2]} scale={[0.7, 0.55, 0.7]} />
      <mesh geometry={GEO.unitBox} material={MATS.electricBox} position={[0.15, 0.3, -0.1]} scale={[0.5, 0.6, 0.45]} />
      <mesh geometry={GEO.unitBox} material={MATS.electricPanel} position={[0.15, 0.34, 0.14]} scale={[0.3, 0.28, 0.04]} />
    </group>
  );
}

function LightSignal({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  const x = spec.x ?? LANE_X[spec.lane];
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={GEO.pole} material={MATS.signalPole} position={[0, 1.1, 0]} scale={[1, 2.2, 1]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardDark} position={[0, 2.08, 0]} scale={[0.36, 0.78, 0.3]} />
      <mesh geometry={GEO.unitBox} material={MATS.signalRed} position={[0, 2.28, 0.16]} scale={[0.18, 0.18, 0.05]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardYellow} position={[0, 2.0, 0.16]} scale={[0.18, 0.18, 0.05]} />
    </group>
  );
}

/** Big green dumpster — boxy, lidded, 1.05 tall to match its collision volume. */
function Bin({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position={[LANE_X[spec.lane], 0, z]}>
      <mesh geometry={GEO.unitBox} material={MATS.bin} position={[0, 0.52, 0]} scale={[1.5, 0.96, 1.24]} />
      <mesh geometry={GEO.unitBox} material={MATS.binLid} position={[0, 1.0, 0]} scale={[1.58, 0.12, 1.32]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardDark} position={[0, 0.32, 0.64]} scale={[1.2, 0.22, 0.04]} />
    </group>
  );
}

function Pillar({ spec, chunk }: Props) {
  const z = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position={[LANE_X[spec.lane], 0, z]}>
      <mesh geometry={GEO.unitBox} material={MATS.pillar} position={[0, 2.5, 0]} scale={[1.2, 5, 1.2]} />
      <mesh geometry={GEO.unitBox} material={MATS.concreteDark} position={[0, 4.9, 0]} scale={[1.6, 0.3, 1.6]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardYellow} position={[0, 0.5, 0.62]} scale={[1.2, 1, 0.02]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardDark} position={[0, 0.28, 0.63]} scale={[1.2, 0.2, 0.02]} />
    </group>
  );
}

/** A contiguous run of blocked wall lanes rendered as ONE brick slab with cap and base. */
function MergedWall({ specs, chunk }: { specs: ObstacleSpec[]; chunk: ChunkSpec }) {
  const first = specs[0];
  const last = specs[specs.length - 1];
  const centerX = (LANE_X[first.lane] + LANE_X[last.lane]) / 2;
  const width = LANE_X[last.lane] - LANE_X[first.lane] + 2.5;
  const z = relZ(chunk, first.s + first.length / 2);

  return (
    <group position={[centerX, 0, z]}>
      <mesh geometry={GEO.unitBox} material={MATS.brick} position={[0, 2, 0]} scale={[width, 4, first.length]} />
      <mesh geometry={GEO.unitBox} material={MATS.brickCap} position={[0, 4.06, 0]} scale={[width + 0.1, 0.24, first.length + 0.2]} />
      <mesh geometry={GEO.unitBox} material={MATS.brickDark} position={[0, 0.35, 0]} scale={[width + 0.06, 0.7, first.length + 0.1]} />
    </group>
  );
}

/**
 * A contiguous run of open lanes through a wall, rendered as ONE tunnel bore:
 * portal frames at both ends, a roof, and an interior light strip per lane.
 */
function MergedBore({ decors, chunk }: { decors: DecorSpec[]; chunk: ChunkSpec }) {
  const first = decors[0];
  const last = decors[decors.length - 1];
  const length = first.length ?? 1.5;
  const centerX = (LANE_X[first.lane] + LANE_X[last.lane]) / 2;
  const width = LANE_X[last.lane] - LANE_X[first.lane] + 2.5;
  const entranceZ = relZ(chunk, first.s);
  const centerZ = relZ(chunk, first.s + length / 2);
  const exitZ = relZ(chunk, first.s + length);
  const columnX = width / 2 - 0.175;

  return (
    <group position-x={centerX}>
      {[entranceZ, exitZ].map((z) => (
        <group key={z}>
          <mesh geometry={GEO.unitBox} material={MATS.brickDark} position={[-columnX, 1.75, z]} scale={[0.35, 3.5, 0.6]} />
          <mesh geometry={GEO.unitBox} material={MATS.brickDark} position={[columnX, 1.75, z]} scale={[0.35, 3.5, 0.6]} />
          <mesh geometry={GEO.unitBox} material={MATS.brickCap} position={[0, 3.72, z]} scale={[width + 0.2, 0.5, 0.6]} />
        </group>
      ))}
      <mesh geometry={GEO.unitBox} material={MATS.brickDark} position={[0, 3.68, centerZ]} scale={[width - 0.1, 0.4, length]} />
      {decors.map((d) => (
        <mesh
          key={d.lane}
          geometry={GEO.unitBox}
          material={MATS.electricPanel}
          position={[LANE_X[d.lane] - centerX, 3.44, centerZ]}
          scale={[0.5, 0.08, length * 0.55]}
        />
      ))}
    </group>
  );
}

/** Blinking red sign warning that a train is oncoming in this lane. */
function OncomingWarning({ decor, chunk }: { decor: DecorSpec; chunk: ChunkSpec }) {
  const world = useWorld();
  const sign = useRef<Mesh>(null);
  useFrame(() => {
    if (sign.current) sign.current.visible = Math.floor(world.elapsed * 4) % 2 === 0;
  });

  return (
    <group position={[LANE_X[decor.lane], 0, relZ(chunk, decor.s)]}>
      <mesh geometry={GEO.pole} material={MATS.signalPole} position={[0.9, 1.4, 0]} scale={[1, 2.8, 1]} />
      <mesh geometry={GEO.unitBox} material={MATS.hazardDark} position={[0.9, 2.95, 0]} scale={[0.92, 0.92, 0.12]} />
      <mesh ref={sign} geometry={GEO.unitBox} material={MATS.warningSign} position={[0.9, 2.95, 0.07]} scale={[0.72, 0.72, 0.06]} />
    </group>
  );
}

function Platform({ spec, chunk }: Props) {
  const centerZ = relZ(chunk, spec.s + spec.length / 2);
  return (
    <group position-x={LANE_X[spec.lane]}>
      <mesh
        geometry={GEO.unitBox}
        material={MATS.platform}
        position={[0, SIZES.platformY / 2, centerZ]}
        scale={[2.4, SIZES.platformY, spec.length]}
      />
      {/* Safety stripe along the top leading edge, plus one down each long side. */}
      <mesh
        geometry={GEO.unitBox}
        material={MATS.platformEdge}
        position={[0, SIZES.platformY - 0.03, relZ(chunk, spec.s + 0.18)]}
        scale={[2.4, 0.06, 0.36]}
      />
      <mesh
        geometry={GEO.unitBox}
        material={MATS.platformEdge}
        position={[-1.14, SIZES.platformY - 0.03, centerZ]}
        scale={[0.12, 0.06, spec.length]}
      />
      <mesh
        geometry={GEO.unitBox}
        material={MATS.platformEdge}
        position={[1.14, SIZES.platformY - 0.03, centerZ]}
        scale={[0.12, 0.06, spec.length]}
      />
    </group>
  );
}
