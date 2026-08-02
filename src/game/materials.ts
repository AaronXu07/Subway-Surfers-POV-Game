import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
} from 'three';

/**
 * Module-singleton geometries and materials: created once, shared by every
 * mesh, so chunk recycling never allocates GPU resources or recompiles
 * shaders. All boxes reuse ONE unit geometry and size via mesh scale.
 *
 * Palette follows the classic Subway Surfers look — bright daylight, vivid
 * orange/blue/white with bold accents (electric red #E31902, apricot #F7BE76,
 * shandy yellow #FFED6D, electric blue #6AEEFD, pigment blue #354093), warm
 * gravel track bed, red-brick graffiti walls.
 */
export const PALETTE = {
  sky: '#56c5ea',
  haze: '#b5e3f4',
  gravel: '#98939b',
  gravelDark: '#7c7781',
  sleeper: '#7c5836',
  rail: '#dde3ea',
  brick: '#b3543c',
  brickDark: '#8e4230',
  brickCap: '#e8dcc4',
  concrete: '#a9a5a0',
  concreteDark: '#7d7973',
  graffitiBlue: '#3fa9f5',
  graffitiPink: '#f26d9c',
  graffitiYellow: '#ffed6d',
  graffitiGreen: '#4cc94c',
  trainTeal: '#28b8cf',
  trainOrange: '#f7941d',
  trainRed: '#e31902',
  trainBlue: '#354093',
  trainRoof: '#f2efe6',
  trainSkirt: '#3c3c44',
  trainWindow: '#1b2431',
  headlight: '#fff6c8',
  ramp: '#8b8f97',
  barrierRed: '#e31902',
  barrierWhite: '#f8f6f0',
  barrierPost: '#5b6470',
  bush: '#3fae4a',
  bushDark: '#2c853a',
  electricBox: '#6b7280',
  electricPanel: '#ffed6d',
  signalPole: '#3f4753',
  signalRed: '#ff5147',
  bin: '#2e8b3a',
  binLid: '#226b2d',
  pillar: '#a9a5a0',
  hazardYellow: '#ffc821',
  hazardDark: '#33302c',
  platform: '#b9b5ae',
  platformEdge: '#ffd23e',
  warningSign: '#ff3b30',
  coin: '#ffc821',
} as const;

export const GEO = {
  unitBox: new BoxGeometry(1, 1, 1),
  coin: new CylinderGeometry(0.35, 0.35, 0.09, 16).rotateX(Math.PI / 2),
  bush: new IcosahedronGeometry(0.55, 1),
  pole: new CylinderGeometry(0.06, 0.06, 1, 8),
} as const;

function standard(color: string, extra?: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  return new MeshStandardMaterial({ color, ...extra });
}

function emissive(color: string, intensity: number) {
  return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });
}

export const MATS = {
  gravel: standard(PALETTE.gravel),
  gravelDark: standard(PALETTE.gravelDark),
  sleeper: standard(PALETTE.sleeper),
  rail: standard(PALETTE.rail, { metalness: 0.75, roughness: 0.3 }),
  brick: standard(PALETTE.brick),
  brickDark: standard(PALETTE.brickDark),
  brickCap: standard(PALETTE.brickCap),
  concrete: standard(PALETTE.concrete),
  concreteDark: standard(PALETTE.concreteDark),
  /** White base tinted per instance via instanceColor (graffiti panels). */
  graffitiBase: standard('#ffffff'),
  trainRoof: standard(PALETTE.trainRoof),
  trainSkirt: standard(PALETTE.trainSkirt),
  trainWindow: standard(PALETTE.trainWindow, { metalness: 0.3, roughness: 0.2 }),
  headlight: emissive(PALETTE.headlight, 2.5),
  ramp: standard(PALETTE.ramp),
  barrierRed: standard(PALETTE.barrierRed),
  barrierWhite: standard(PALETTE.barrierWhite),
  barrierPost: standard(PALETTE.barrierPost, { metalness: 0.5, roughness: 0.4 }),
  bush: standard(PALETTE.bush),
  bushDark: standard(PALETTE.bushDark),
  electricBox: standard(PALETTE.electricBox),
  electricPanel: emissive(PALETTE.electricPanel, 0.7),
  signalPole: standard(PALETTE.signalPole),
  signalRed: emissive(PALETTE.signalRed, 1.6),
  bin: standard(PALETTE.bin),
  binLid: standard(PALETTE.binLid),
  pillar: standard(PALETTE.pillar),
  hazardYellow: standard(PALETTE.hazardYellow),
  hazardDark: standard(PALETTE.hazardDark),
  platform: standard(PALETTE.platform),
  platformEdge: emissive(PALETTE.platformEdge, 0.55),
  warningSign: emissive(PALETTE.warningSign, 2.2),
  coin: emissive(PALETTE.coin, 0.55),
} as const;

/** Train body colors cycle by obstacle id — the classic SS liveries. */
export const TRAIN_BODY_MATS = [
  standard(PALETTE.trainTeal),
  standard(PALETTE.trainOrange),
  standard(PALETTE.trainRed),
  standard(PALETTE.trainBlue),
] as const;

/** Instance tints for the wall graffiti pieces. */
export const GRAFFITI_COLORS = [
  new Color(PALETTE.graffitiBlue),
  new Color(PALETTE.graffitiPink),
  new Color(PALETTE.graffitiYellow),
  new Color(PALETTE.graffitiGreen),
  new Color(PALETTE.trainOrange),
  new Color(PALETTE.brickCap),
] as const;
