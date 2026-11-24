import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  ARENA_DISH_CURVATURE,
  ARENA_DISH_RADIUS,
  ARENA_WALL_RADIUS,
  BattleSimulationState,
  LAUNCH_SPEED_BASE,
  LAUNCH_SPEED_RANGE,
  SPIRAL_BASE_DRAG,
  arenaFloorHeight,
  computeBowlRadialAccel,
  evaluateDynamicHazardPosition,
  evaluateDynamicPillarState,
} from '../simulation/physicsEngine';
import {
  ArenaDefinition,
  ArenaHazardZone,
  ArenaId,
  ArenaPillarObstacle,
  BattleMutators,
  BattlePhase,
  CameraPreset,
  ComponentCategory,
  CosmeticCustomization,
  ElementType,
  EquippedComponents,
  FinishReason,
  GraphicsQuality,
  HighlightStatDebuff,
  MatchHighlightClip,
  MatchHighlightFrame,
  MatchMode,
  PartDurabilityKey,
  PartDurabilityMap,
  SceneTelemetry,
  StatusEffectType,
  VictoryEmoteId,
  WeatherType,
} from '../domain/types';
import {
  TopVisualRig,
  applyRigExplodeFactor,
  buildSpinningTopVisual,
  createDetachedPartFragment,
  disposeObject3D,
  syncRigBrokenParts,
} from './topBuilder';
import {
  ELEMENTS,
  getArenaDefinition,
  getVictoryEmoteDefinition,
  getWeatherDefinition,
} from '../domain/catalog';
import { getPlayerActiveStatuses } from '../domain/statusManager';
import { DEFAULT_BATTLE_MUTATORS, sanitizeBattleMutators } from '../domain/rules';
import {
  REPLAY_CLIMAX_HOLD_SEC,
  REPLAY_SLOWMO_SPEED,
  REPLAY_WINDOW_SEC,
  sampleReplayFrame,
  selectReplayWindowFrames,
} from '../domain/replay';

export type SceneCameraMode = 'title' | 'workshop' | 'battle' | 'replay';

export interface ProjectedScreenPoint {
  xPct: number;
  yPct: number;
  visible: boolean;
}

export interface ReplayHudTelemetry {
  angleIndex: 0 | 1 | 2;
  angleCode: string;
  angleLabel: string;
  progress: number;
  speed: number;
  passCount: number;
  inClimaxHold: boolean;
  finishReason: FinishReason;
  winnerSide: 'player' | 'opponent';
  playerShield?: boolean;
  playerFire?: boolean;
  playerActiveSlotIdx?: number;
  playerActiveSlots?: [boolean, boolean, boolean, boolean];
  playerStatuses?: StatusEffectType[];
  playerPartDurability?: PartDurabilityMap;
  playerBrokenParts?: PartDurabilityKey[];
  playerStatDebuffs?: HighlightStatDebuff[];
  opponentShield?: boolean;
  opponentFire?: boolean;
  opponentActiveSlotIdx?: number;
  opponentActiveSlots?: [boolean, boolean, boolean, boolean];
  opponentStatuses?: StatusEffectType[];
  opponentPartDurability?: PartDurabilityMap;
  opponentBrokenParts?: PartDurabilityKey[];
  opponentStatDebuffs?: HighlightStatDebuff[];
  playerRpm?: number;
  playerStaminaPct?: number;
  playerDurabilityPct?: number;
  playerEnergyPct?: number;
  playerResonance?: number;
  opponentRpm?: number;
  opponentStaminaPct?: number;
  opponentDurabilityPct?: number;
}

export interface BattleEnvironmentConfig {
  matchMode: MatchMode;
  mutators?: Partial<BattleMutators>;
  survivalWave?: number | null;
}

// Pre-allocated scratch math helpers (Zero GC inside render loop)
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();
const _color2 = new THREE.Color();
const _color3 = new THREE.Color();
const _flashColor = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
const _hitPoint = new THREE.Vector3();
const _dirVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _partBox = new THREE.Box3();

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
  gravity: number;
  drag: number;
  kind: number; // 0 = elemental/energy streak, 1 = incandescent steel grinder spark
  seed: number;
  heat: number;
  bouncesLeft: number;
  forkDone: boolean;
}

interface ArcFlareSlot {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  rollAngle: number;
}

interface SlashArcSlot {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  baseSpin: number;
  spinDelta: number;
  tiltX: number;
  tiltZ: number;
  baseOpacity: number;
}

interface CleaveBeamSlot {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  startScaleY: number;
  endScaleY: number;
  width: number;
  rollAngle: number;
}

interface DebrisParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  life: number;
  maxLife: number;
  baseSize: number;
  colorHex: number;
}

interface WeatherParticleSlot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  length: number;
  thickness: number;
  phase: number;
}

interface ShockwaveSlot {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

interface EjectedPartSlot {
  mesh: THREE.Object3D;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
  maxLife: number;
  baseScale: THREE.Vector3;
  partSize: number;
  colorHex: number;
  landingEmissionsLeft: number;
  wasAirborne: boolean;
}

interface TopKinematicsState {
  dropY: number;
  dropVy: number;
  dropActive: boolean;
  dropDelay: number;
  bouncesLeft: number;
  didPrimaryLand: boolean;
  recoilTiltX: number;
  recoilTiltZ: number;
  recoilVelX: number;
  recoilVelZ: number;
  scrapeCooldown: number;
  lastPowerRatio: number;
}

interface ThermalScorchSlot {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  baseOpacity: number;
  hotHex: number;
  coolHex: number;
}

interface ModeMovingTrapSlot {
  group: THREE.Group;
  spinner: THREE.Object3D;
  ringMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshStandardMaterial;
  orbitRadius: number;
  baseX: number;
  baseZ: number;
  speed: number;
  phaseOffset: number;
  motionKind: 'orbit' | 'oscillate';
  ampX: number;
  ampZ: number;
  spinSpeed: number;
  baseColorHex: number;
}

interface ModeRingVisualSlot {
  mesh: THREE.Object3D;
  mat: THREE.MeshBasicMaterial;
  baseOpacity: number;
  spinSpeed: number;
  pulseOffset: number;
  baseColorHex: number;
}

const MAX_PARTICLES = 560;
const MAX_DEBRIS_PARTICLES = 180;
const MAX_WEATHER_PARTICLES = 180;
const MAX_SHOCKWAVES = 6;
const MAX_ARC_FLARES = 8;
const MAX_SLASH_ARCS = 12;
const MAX_CLEAVE_BEAMS = 6;
const MAX_THERMAL_SCORCHES = 12;
const MAX_EJECTED_PARTS = 18;
const RIBBON_TRAIL_POINTS = 22;
const SCUFF_RES = 1024;
const HEATMAP_RES = 96;
const HEATMAP_DECAY_RATE = 0.04; // Slow decay so hot combat zones persist clearly across match

const CRITICAL_CRIMSON_HEX = 0xf43f5e;
const CRITICAL_AMBER_HEX = 0xf59e0b;
const CRITICAL_FOG_HEX = 0x260612;
const CRITICAL_HEMI_GROUND_HEX = 0x4c0519;

const _projVec = new THREE.Vector3();

interface RibbonTrailTrack {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  positions: Float32Array;
  alphas: Float32Array;
  ptsX: Float32Array;
  ptsY: Float32Array;
  ptsZ: Float32Array;
  count: number;
  sampleAccum: number;
}

function createRibbonTrailTrack(colorHex: number): RibbonTrailTrack {
  const vertexCount = RIBBON_TRAIL_POINTS * 2;
  const positions = new Float32Array(vertexCount * 3);
  const alphas = new Float32Array(vertexCount);
  const indices: number[] = [];
  for (let i = 0; i < RIBBON_TRAIL_POINTS - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aAlpha', alphaAttr);
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: 0.68 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha * uOpacity);
      }
    `,
  }) as unknown as THREE.MeshBasicMaterial;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.userData.skipGtao = true;
  mesh.renderOrder = 3;

  return {
    mesh,
    geometry,
    material,
    positions,
    alphas,
    ptsX: new Float32Array(RIBBON_TRAIL_POINTS),
    ptsY: new Float32Array(RIBBON_TRAIL_POINTS),
    ptsZ: new Float32Array(RIBBON_TRAIL_POINTS),
    count: 0,
    sampleAccum: 0,
  };
}

interface ModeVisualProfile {
  accentHex: number;
  rimHex: number;
  modeTintWeight: number;
  movingTrapCount: number;
  trapKind: 'overload' | 'wave' | 'championship' | 'arc' | 'relay' | 'hazard';
  trapSpeedMult: number;
  showCrestRing: boolean;
}

function resolveModeVisualProfile(
  mode: MatchMode,
  survivalWave: number,
  arenaTrimHex: number
): ModeVisualProfile {
  switch (mode) {
    case 'Boss':
      return {
        accentHex: 0xf43f5e,
        rimHex: 0xfb7185,
        modeTintWeight: 0.48,
        movingTrapCount: 2,
        trapKind: 'overload',
        trapSpeedMult: 1.25,
        showCrestRing: false,
      };
    case 'Survival':
      return {
        accentHex: 0x10b981,
        rimHex: 0x34d399,
        modeTintWeight: 0.34,
        movingTrapCount: Math.min(4, 1 + Math.floor(Math.max(0, survivalWave - 1) / 2)),
        trapKind: 'wave',
        trapSpeedMult: 0.9 + Math.min(0.65, Math.max(0, survivalWave - 1) * 0.08),
        showCrestRing: false,
      };
    case 'Tournament':
      return {
        accentHex: 0xf59e0b,
        rimHex: 0xfbbf24,
        modeTintWeight: 0.36,
        movingTrapCount: 2,
        trapKind: 'championship',
        trapSpeedMult: 0.85,
        showCrestRing: true,
      };
    case 'OnlineRanked':
    case 'ShadowPvP':
      return {
        accentHex: 0x818cf8,
        rimHex: 0x38bdf8,
        modeTintWeight: 0.32,
        movingTrapCount: 2,
        trapKind: 'arc',
        trapSpeedMult: 1.05,
        showCrestRing: false,
      };
    case 'TeamBattle':
      return {
        accentHex: 0x22d3ee,
        rimHex: 0x34d399,
        modeTintWeight: 0.28,
        movingTrapCount: 2,
        trapKind: 'relay',
        trapSpeedMult: 0.8,
        showCrestRing: false,
      };
    case 'OnlineFriendly':
    case 'Training':
    default:
      return {
        accentHex: arenaTrimHex,
        rimHex: 0x38bdf8,
        modeTintWeight: 0.0,
        movingTrapCount: 0,
        trapKind: 'hazard',
        trapSpeedMult: 1.0,
        showCrestRing: false,
      };
  }
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface ArenaFloorMaps {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture | null;
  roughnessMap: THREE.CanvasTexture | null;
  aoMap: THREE.CanvasTexture | null;
}

interface StadiumSurfaceMaps {
  wallNormal: THREE.CanvasTexture;
  wallRoughness: THREE.CanvasTexture;
  wallAo: THREE.CanvasTexture;
  deckNormal: THREE.CanvasTexture;
  deckRoughness: THREE.CanvasTexture;
}

function makeScenePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildSceneNormalCanvas(
  heightField: Float32Array,
  size: number,
  strength: number,
  wrapEdges: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const mask = size - 1;

  for (let y = 0; y < size; y++) {
    const ym = wrapEdges ? (y - 1 + size) & mask : Math.max(0, y - 1);
    const yp = wrapEdges ? (y + 1) & mask : Math.min(size - 1, y + 1);
    for (let x = 0; x < size; x++) {
      const xm = wrapEdges ? (x - 1 + size) & mask : Math.max(0, x - 1);
      const xp = wrapEdges ? (x + 1) & mask : Math.min(size - 1, x + 1);
      const dx = (heightField[y * size + xp] - heightField[y * size + xm]) * strength;
      const dy = (heightField[yp * size + x] - heightField[ym * size + x]) * strength;
      const invLen = 1 / Math.hypot(-dx, -dy, 1);
      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = invLen;
      const idx = (y * size + x) * 4;
      d[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function buildSceneGrayCanvas(
  values: Float32Array,
  size: number,
  minOut: number,
  maxOut: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const span = maxOut - minOut;
  for (let i = 0; i < values.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round((minOut + values[i] * span) * 255)));
    const idx = i * 4;
    d[idx] = v;
    d[idx + 1] = v;
    d[idx + 2] = v;
    d[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function createStadiumSurfaceMaps(maxAnisotropy: number): StadiumSurfaceMaps {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));
  const rand = makeScenePrng(81337);

  // Rolled-steel armor plate grain + subtle weld seam bands for walls, buttresses, pillars & pylons
  const wSize = 256;
  const wHeight = new Float32Array(wSize * wSize);
  const wRough = new Float32Array(wSize * wSize);
  const wAo = new Float32Array(wSize * wSize);
  for (let y = 0; y < wSize; y++) {
    const isSeam = y % 64 === 0 || y % 64 === 1;
    const band = Math.sin((y / wSize) * Math.PI * 16) * 0.14;
    for (let x = 0; x < wSize; x++) {
      const idx = y * wSize + x;
      const isCrossSeam = x % 128 === 0;
      const micro = (rand() - 0.5) * 0.18 + Math.sin((x / wSize) * Math.PI * 8 + y * 0.25) * 0.08;
      const seamDip = isSeam || isCrossSeam ? -0.34 : 0;
      const h = Math.max(0.04, Math.min(1, 0.58 + band + micro + seamDip));
      wHeight[idx] = h;
      wRough[idx] = Math.max(0.1, Math.min(1, (isSeam || isCrossSeam ? 0.9 : 0.45) - band * 0.25 + Math.abs(micro) * 0.65));
      wAo[idx] = isSeam || isCrossSeam ? 0.48 : Math.max(0.75, Math.min(1, 0.9 + band * 0.15));
    }
  }

  const mkWallTex = (canvas: HTMLCanvasElement, rx: number, ry: number): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    tex.anisotropy = aniso;
    tex.needsUpdate = true;
    return tex;
  };

  const wallNormal = mkWallTex(buildSceneNormalCanvas(wHeight, wSize, 2.2, true), 0.55, 0.55);
  const wallRoughness = mkWallTex(buildSceneGrayCanvas(wRough, wSize, 0.34, 0.92), 0.55, 0.55);
  const wallAo = mkWallTex(buildSceneGrayCanvas(wAo, wSize, 0.45, 1.0), 0.55, 0.55);
  wallAo.channel = 0;

  // Industrial diamond-tread / anti-slip deck plate for stadium outer apron
  const dSize = 256;
  const dHeight = new Float32Array(dSize * dSize);
  const dRough = new Float32Array(dSize * dSize);
  for (let y = 0; y < dSize; y++) {
    for (let x = 0; x < dSize; x++) {
      const idx = y * dSize + x;
      const u = (x / dSize) * Math.PI * 8;
      const v = (y / dSize) * Math.PI * 8;
      const tread = Math.pow(Math.max(0, Math.sin(u + v) * Math.sin(u - v)), 2);
      const grain = (rand() - 0.5) * 0.12;
      dHeight[idx] = Math.max(0, Math.min(1, 0.35 + tread * 0.55 + grain));
      dRough[idx] = Math.max(0.1, Math.min(1, 0.92 - tread * 0.34 + Math.abs(grain) * 0.4));
    }
  }
  const deckNormal = mkWallTex(buildSceneNormalCanvas(dHeight, dSize, 2.5, true), 18, 18);
  const deckRoughness = mkWallTex(buildSceneGrayCanvas(dRough, dSize, 0.58, 0.98), 18, 18);

  return { wallNormal, wallRoughness, wallAo, deckNormal, deckRoughness };
}

function createArenaFloorMaps(
  arena: ArenaDefinition,
  maxAnisotropy: number,
  includePbr: boolean
): ArenaFloorMaps {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const rand = makeScenePrng(
    arena.id.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 17)
  );

  const [cInner, cMid, cOuter] = arena.floorPalette;
  const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, size * 0.5);
  grad.addColorStop(0, cInner);
  grad.addColorStop(0.52, cMid);
  grad.addColorStop(1, cOuter);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Machined hex-cell stadium plating (or frosted crystal facets / temple masonry)
  const dishUvR = (ARENA_DISH_RADIUS / (ARENA_WALL_RADIUS * 2)) * size;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, dishUvR + 6, 0, Math.PI * 2);
  ctx.clip();
  if (arena.id !== 'temple') {
    const hexR = arena.id === 'frozen' ? 38 : 34;
    const hexDx = hexR * 1.5;
    const hexDy = hexR * Math.sqrt(3);
    ctx.strokeStyle =
      arena.id === 'frozen' ? 'rgba(186, 230, 253, 0.14)' : 'rgba(6, 10, 22, 0.42)';
    ctx.lineWidth = arena.id === 'frozen' ? 1.4 : 2.1;
    for (let col = -2; col <= Math.ceil(size / hexDx) + 2; col++) {
      const hx = col * hexDx;
      const yOffset = (col & 1) === 1 ? hexDy * 0.5 : 0;
      for (let row = -2; row <= Math.ceil(size / hexDy) + 2; row++) {
        const hy = row * hexDy + yOffset;
        if (Math.hypot(hx - cx, hy - cy) > dishUvR + hexR * 1.5) continue;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = (k * Math.PI) / 3;
          const vx = hx + Math.cos(ang) * (hexR - 1.2);
          const vy = hy + Math.sin(ang) * (hexR - 1.2);
          if (k === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Subtle industrial surface grain & worn combat spin-track arcs in center bowl
  for (let i = 0; i < 42; i++) {
    const r = size * (0.08 + rand() * 0.34);
    const a0 = rand() * Math.PI * 2;
    const arcSpan = 0.25 + rand() * 0.85;
    ctx.strokeStyle =
      arena.id === 'frozen'
        ? `rgba(224, 242, 254, ${0.06 + rand() * 0.1})`
        : arena.id === 'temple'
          ? `rgba(217, 119, 6, ${0.05 + rand() * 0.08})`
          : `rgba(255, 255, 255, ${0.03 + rand() * 0.07})`;
    ctx.lineWidth = 1 + rand() * 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + arcSpan);
    ctx.stroke();
  }

  for (let r = 18; r < size * 0.49; r += 6) {
    ctx.strokeStyle =
      r % 24 === 0 ? `${arena.primaryColor}38` : `${arena.accentColor}14`;
    ctx.lineWidth = r % 24 === 0 ? 1.8 : 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 12 radial steel expansion plate seams & edge rivets
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.36)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (size * 0.11), cy + Math.sin(a) * (size * 0.11));
    ctx.lineTo(cx + Math.cos(a) * (size * 0.47), cy + Math.sin(a) * (size * 0.47));
    ctx.stroke();

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.16)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (size * 0.11), cy + Math.sin(a) * (size * 0.11));
    ctx.lineTo(cx + Math.cos(a) * (size * 0.47), cy + Math.sin(a) * (size * 0.47));
    ctx.stroke();

    for (const rFrac of [0.22, 0.34, 0.445]) {
      const rx = cx + Math.cos(a + 0.035) * (size * rFrac);
      const ry = cy + Math.sin(a + 0.035) * (size * rFrac);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
      ctx.beginPath();
      ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Luminous Stadium Telemetry Markings (drawn onto both diffuse & emissive canvases)
  const emCanvas = document.createElement('canvas');
  emCanvas.width = size;
  emCanvas.height = size;
  const emCtx = emCanvas.getContext('2d')!;
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, size, size);

  const outerGuideR = dishUvR * 0.8;
  const innerGuideR = dishUvR * 0.34;
  const sectorMidAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
  const gateAngles = [Math.PI / 3, Math.PI, -Math.PI / 3];

  const drawLuminousMarkings = (target: CanvasRenderingContext2D, isEmissive: boolean) => {
    target.save();
    // 1. Wide Outer Orbital Guide Ring
    target.lineCap = 'round';
    target.strokeStyle = arena.primaryColor;
    target.globalAlpha = isEmissive ? 0.28 : 0.24;
    target.lineWidth = 16;
    target.beginPath();
    target.arc(cx, cy, outerGuideR, 0, Math.PI * 2);
    target.stroke();

    target.globalAlpha = isEmissive ? 0.65 : 0.55;
    target.lineWidth = 7.5;
    target.beginPath();
    target.arc(cx, cy, outerGuideR, 0, Math.PI * 2);
    target.stroke();

    target.strokeStyle = isEmissive ? '#dff8ff' : '#ffffff';
    target.globalAlpha = isEmissive ? 0.88 : 0.82;
    target.lineWidth = 3.2;
    target.beginPath();
    target.arc(cx, cy, outerGuideR, 0, Math.PI * 2);
    target.stroke();

    // 2. Inner Center-Pocket Orbital Ring + Cardinal Calibration Ticks
    target.strokeStyle = arena.primaryColor;
    target.globalAlpha = isEmissive ? 0.26 : 0.22;
    target.lineWidth = 10;
    target.beginPath();
    target.arc(cx, cy, innerGuideR, 0, Math.PI * 2);
    target.stroke();

    target.strokeStyle = isEmissive ? '#cffafe' : arena.primaryColor;
    target.globalAlpha = isEmissive ? 0.82 : 0.78;
    target.lineWidth = 3;
    target.beginPath();
    target.arc(cx, cy, innerGuideR, 0, Math.PI * 2);
    target.stroke();

    // Subtle 4-way cross-axis reticle ticks bridging inner pocket
    target.strokeStyle = arena.primaryColor;
    target.globalAlpha = isEmissive ? 0.45 : 0.38;
    target.lineWidth = 2.2;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      target.beginPath();
      target.moveTo(cx + Math.cos(a) * (innerGuideR - 10), cy + Math.sin(a) * (innerGuideR - 10));
      target.lineTo(cx + Math.cos(a) * (innerGuideR + 12), cy + Math.sin(a) * (innerGuideR + 12));
      target.stroke();
    }

    // 3. Sector Center T-Junction Standoffs + Twin Accent Nodes (clear of Ring-Out gates)
    const lugEndR = dishUvR * 0.935;
    for (const sa of sectorMidAngles) {
      const x0 = cx + Math.cos(sa) * outerGuideR;
      const y0 = cy + Math.sin(sa) * outerGuideR;
      const x1 = cx + Math.cos(sa) * lugEndR;
      const y1 = cy + Math.sin(sa) * lugEndR;

      target.strokeStyle = arena.primaryColor;
      target.globalAlpha = isEmissive ? 0.34 : 0.3;
      target.lineWidth = 15;
      target.beginPath();
      target.moveTo(x0, y0);
      target.lineTo(x1, y1);
      target.stroke();

      target.strokeStyle = isEmissive ? '#cffafe' : arena.primaryColor;
      target.globalAlpha = isEmissive ? 0.85 : 0.82;
      target.lineWidth = 6;
      target.beginPath();
      target.moveTo(x0, y0);
      target.lineTo(x1, y1);
      target.stroke();

      target.fillStyle = isEmissive ? '#e0f2fe' : '#ffffff';
      target.globalAlpha = isEmissive ? 0.92 : 0.88;
      target.beginPath();
      target.arc(x1, y1, 9.5, 0, Math.PI * 2);
      target.fill();

      // Flanking accent calibration dots (reference-inspired twin gold/accent dots)
      for (const side of [-1, 1]) {
        const da = sa + side * 0.085;
        const dr = outerGuideR + 26;
        const dx = cx + Math.cos(da) * dr;
        const dy = cy + Math.sin(da) * dr;
        target.fillStyle = arena.accentColor;
        target.globalAlpha = isEmissive ? 0.88 : 0.92;
        target.beginPath();
        target.arc(dx, dy, 4.6, 0, Math.PI * 2);
        target.fill();
      }
    }

    // 4. Open Ring-Out Exit Gate floor thresholds at 60°, 180°, 300°
    target.strokeStyle = '#f43f5e';
    target.globalAlpha = isEmissive ? 0.42 : 0.62;
    target.lineWidth = 4;
    for (const ga of gateAngles) {
      target.beginPath();
      target.arc(cx, cy, dishUvR - 8, ga - 0.21, ga + 0.21);
      target.stroke();
      const rBase = dishUvR - 28;
      const rTip = dishUvR - 6;
      target.beginPath();
      target.moveTo(cx + Math.cos(ga - 0.08) * rBase, cy + Math.sin(ga - 0.08) * rBase);
      target.lineTo(cx + Math.cos(ga) * rTip, cy + Math.sin(ga) * rTip);
      target.lineTo(cx + Math.cos(ga + 0.08) * rBase, cy + Math.sin(ga + 0.08) * rBase);
      target.stroke();
    }
    target.restore();
  };

  drawLuminousMarkings(ctx, false);
  drawLuminousMarkings(emCtx, true);

  // Paint Stationary Arena Hazard Zones directly onto floor texture; moving trap zones render via dynamic 3D meshes
  for (const hz of arena.hazardZones) {
    if (hz.motion) continue;
    const px = cx + (hz.x / (ARENA_WALL_RADIUS * 2)) * size;
    const py = cy + (hz.z / (ARENA_WALL_RADIUS * 2)) * size;
    const pr = (hz.radius / (ARENA_WALL_RADIUS * 2)) * size;
    const hzGrad = ctx.createRadialGradient(px, py, 2, px, py, pr);
    const col =
      hz.kind === 'heat'
        ? 'rgba(255, 90, 47, 0.58)'
        : hz.kind === 'shock'
          ? 'rgba(250, 204, 21, 0.5)'
          : hz.kind === 'sand'
            ? 'rgba(217, 119, 6, 0.48)'
            : 'rgba(168, 85, 247, 0.55)';
    hzGrad.addColorStop(0, col);
    hzGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hzGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const aniso = Math.max(1, Math.min(8, maxAnisotropy));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = aniso;
  map.needsUpdate = true;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = aniso;
  emissiveMap.needsUpdate = true;

  if (!includePbr) {
    return { map, emissiveMap, normalMap: null, roughnessMap: null, aoMap: null };
  }

  // Generate matching 512x512 procedural normalMap, roughnessMap, and seam/wall-contact aoMap
  const pSize = 512;
  const pHalf = pSize / 2;
  const fHeight = new Float32Array(pSize * pSize);
  const fRough = new Float32Array(pSize * pSize);
  const fAo = new Float32Array(pSize * pSize);
  const wallUvR = ARENA_DISH_RADIUS / (ARENA_WALL_RADIUS * 2);
  const isIce = arena.id === 'frozen';
  const isTemple = arena.id === 'temple';

  for (let py = 0; py < pSize; py++) {
    const dy = (py - pHalf) / pSize;
    for (let px = 0; px < pSize; px++) {
      const dx = (px - pHalf) / pSize;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const idx = py * pSize + px;

      const microGrain = (rand() - 0.5) * (isTemple ? 0.14 : isIce ? 0.05 : 0.08);
      const concentricRidge = isTemple
        ? Math.sin(dist * 110) * 0.08
        : Math.sin(dist * 190) * 0.09 + Math.cos(dist * 380) * 0.04;

      // 12 radial panel seam grooves (from inner hub r=0.11 to rim r=0.47)
      let radialSeam = 0;
      if (dist > 0.11 && dist < 0.47) {
        const modAngle = Math.abs((((angle % (Math.PI / 6)) + Math.PI / 6) % (Math.PI / 6)) - Math.PI / 12);
        const arcDist = (Math.PI / 12 - modAngle) * dist;
        if (arcDist < 0.0045) {
          radialSeam = 1 - arcDist / 0.0045;
        }
      }

      // Arena-specific crystal/stone surface fractures
      let fracture = 0;
      if (isIce) {
        const crackWave = Math.abs(Math.sin(angle * 7 + dist * 24) * Math.cos(angle * 11 - dist * 16));
        if (crackWave < 0.045 && dist > 0.08 && dist < 0.45) {
          fracture = 1 - crackWave / 0.045;
        }
      } else if (isTemple) {
        const slabRing = Math.abs((dist * 16) % 1 - 0.5);
        if (slabRing > 0.46) {
          fracture = (slabRing - 0.46) / 0.04;
        }
      }

      const h = Math.max(
        0.02,
        Math.min(1, 0.62 + concentricRidge + microGrain - radialSeam * 0.32 - fracture * 0.25)
      );
      fHeight[idx] = h;

      // Burnished smoother central spin pocket vs matte seams/rim
      const spinBurnish = dist < 0.26 ? (1 - dist / 0.26) * 0.28 : 0;
      const baseRough = isIce ? 0.22 : isTemple ? 0.68 : 0.52;
      fRough[idx] = Math.max(
        0.04,
        Math.min(1, baseRough - spinBurnish + radialSeam * 0.42 + fracture * 0.45 + Math.abs(microGrain) * 0.7)
      );

      // Wall-dish junction contact AO (skipped across the 3 open Ring-Out exit chutes)
      let inExitChute = false;
      for (const ga of gateAngles) {
        let diff = Math.abs(angle - ga);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.24) {
          inExitChute = true;
          break;
        }
      }
      const wallProximity =
        !inExitChute && dist > wallUvR - 0.042 && dist <= wallUvR + 0.015
          ? Math.max(0, 1 - Math.abs(dist - wallUvR) / 0.042)
          : 0;
      const centerPitAo = dist < 0.06 ? (1 - dist / 0.06) * 0.14 : 0;
      fAo[idx] = Math.max(
        0.35,
        Math.min(1, 0.98 - radialSeam * 0.34 - fracture * 0.22 - wallProximity * 0.44 - centerPitAo)
      );
    }
  }

  const mkDataTex = (c: HTMLCanvasElement): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = aniso;
    tex.needsUpdate = true;
    return tex;
  };

  const normalMap = mkDataTex(buildSceneNormalCanvas(fHeight, pSize, isTemple ? 2.8 : 2.1, false));
  const roughnessRange: [number, number] = isIce
    ? [0.08, 0.44]
    : isTemple
      ? [0.46, 0.92]
      : [0.24, 0.72];
  const roughnessMap = mkDataTex(
    buildSceneGrayCanvas(fRough, pSize, roughnessRange[0], roughnessRange[1])
  );
  const aoMap = mkDataTex(buildSceneGrayCanvas(fAo, pSize, 0.42, 1.0));
  aoMap.channel = 0;

  return { map, emissiveMap, normalMap, roughnessMap, aoMap };
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.97)');
  grad.addColorStop(0.24, 'rgba(2, 6, 23, 0.84)');
  grad.addColorStop(0.56, 'rgba(2, 6, 23, 0.36)');
  grad.addColorStop(0.84, 'rgba(2, 6, 23, 0.1)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWallContactAoTexture(): THREE.CanvasTexture {
  const w = 16;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // v = 1 (top of canvas / y=0 in canvas 2D) sits against the inner wall base; v = 0 fades into dish floor
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.92)');
  grad.addColorStop(0.18, 'rgba(2, 6, 23, 0.72)');
  grad.addColorStop(0.5, 'rgba(2, 6, 23, 0.32)');
  grad.addColorStop(0.8, 'rgba(2, 6, 23, 0.09)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

class OpaqueOnlyGTAOPass extends GTAOPass {
  private hiddenForGtao: THREE.Object3D[] = [];

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    this.hiddenForGtao.length = 0;
    this.scene.traverse((obj) => {
      if (!obj.visible) return;
      if (obj.userData?.skipGtao) {
        obj.visible = false;
        this.hiddenForGtao.push(obj);
        return;
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat && mat.transparent) {
          obj.visible = false;
          this.hiddenForGtao.push(obj);
        }
      }
    });
    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      for (let i = 0; i < this.hiddenForGtao.length; i++) {
        this.hiddenForGtao[i].visible = true;
      }
      this.hiddenForGtao.length = 0;
    }
  }
}

function createSparkStreakGeometry(): THREE.BufferGeometry {
  // 3 intersecting planes rotated 0°, 60°, 120° around local +Y (velocity direction).
  // Pivot is near the leading tip (y = +0.08) with trailing tail down to y = -0.92.
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];

  for (let p = 0; p < angles.length; p++) {
    const a = angles[p];
    const cosA = Math.cos(a) * 0.5;
    const sinA = Math.sin(a) * 0.5;
    const baseVertex = p * 4;

    // Bottom-left, bottom-right, top-right, top-left
    positions.push(-cosA, -0.92, -sinA);
    positions.push(cosA, -0.92, sinA);
    positions.push(cosA, 0.08, sinA);
    positions.push(-cosA, 0.08, -sinA);

    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(baseVertex, baseVertex + 1, baseVertex + 2, baseVertex, baseVertex + 2, baseVertex + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createClashFlareTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';

  // Soft hot thermal halo + blinding arc core
  const coreGrad = ctx.createRadialGradient(half, half, 1, half, half, half);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  coreGrad.addColorStop(0.12, 'rgba(255, 246, 200, 0.92)');
  coreGrad.addColorStop(0.32, 'rgba(255, 168, 56, 0.42)');
  coreGrad.addColorStop(0.65, 'rgba(255, 92, 16, 0.12)');
  coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);

  // Sharp anamorphic/starburst diffraction rays for metal-on-metal arc snap
  const rayAngles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI / 7, -Math.PI / 7];
  for (let i = 0; i < rayAngles.length; i++) {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(rayAngles[i]);
    const len = i < 2 ? half * 0.98 : i < 4 ? half * 0.78 : half * 0.56;
    const thick = i < 2 ? 3.2 : 2.0;
    const rayGrad = ctx.createLinearGradient(-len, 0, len, 0);
    rayGrad.addColorStop(0, 'rgba(255, 140, 40, 0)');
    rayGrad.addColorStop(0.35, 'rgba(255, 215, 130, 0.45)');
    rayGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    rayGrad.addColorStop(0.65, 'rgba(255, 215, 130, 0.45)');
    rayGrad.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, len, thick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createShockwaveRingTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, half * 0.34, half, half, half);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.45, 'rgba(255, 200, 120, 0.14)');
  grad.addColorStop(0.72, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.84, 'rgba(255, 175, 80, 0.52)');
  grad.addColorStop(1, 'rgba(255, 100, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSlashArcGeometry(
  innerR = 0.46,
  outerR = 0.96,
  arcSpan = Math.PI * 1.18,
  segments = 28
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const a = (u - 0.5) * arcSpan;
    const taper = Math.sin(u * Math.PI);
    const rIn = innerR + (outerR - innerR) * 0.16 * (1 - taper);
    const rOut = innerR + (outerR - innerR) * (0.28 + 0.72 * taper);
    const yLift = Math.sin(u * Math.PI) * 0.045;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    positions.push(cosA * rIn, yLift * 0.4, sinA * rIn);
    positions.push(cosA * rOut, yLift, sinA * rOut);
    uvs.push(u, 0, u, 1);
    if (i < segments) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createSlashArcTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  // Tapered anime blade-slash ribbon: bright white core + soft speed-streak outer edge
  const horiz = ctx.createLinearGradient(0, 0, w, 0);
  horiz.addColorStop(0, 'rgba(255, 255, 255, 0)');
  horiz.addColorStop(0.16, 'rgba(255, 255, 255, 0.55)');
  horiz.addColorStop(0.48, 'rgba(255, 255, 255, 1)');
  horiz.addColorStop(0.84, 'rgba(255, 255, 255, 0.55)');
  horiz.addColorStop(1, 'rgba(255, 255, 255, 0)');

  const vert = ctx.createLinearGradient(0, 0, 0, h);
  vert.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vert.addColorStop(0.24, 'rgba(255, 255, 255, 0.35)');
  vert.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
  vert.addColorStop(0.76, 'rgba(255, 255, 255, 0.35)');
  vert.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = horiz;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.5);
  ctx.lineTo(w * 0.92, h * 0.5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.24);
  ctx.lineTo(w * 0.86, h * 0.24);
  ctx.moveTo(w * 0.18, h * 0.76);
  ctx.lineTo(w * 0.82, h * 0.76);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCleaveStreakTexture(): THREE.CanvasTexture {
  const w = 96;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, h * 0.48);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(255, 245, 200, 0.85)');
  grad.addColorStop(0.55, 'rgba(255, 200, 120, 0.28)');
  grad.addColorStop(1, 'rgba(255, 160, 60, 0)');

  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.scale(0.18, 1);
  ctx.translate(-w * 0.5, -h * 0.5);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const core = ctx.createLinearGradient(0, 0, 0, h);
  core.addColorStop(0, 'rgba(255, 255, 255, 0)');
  core.addColorStop(0.32, 'rgba(255, 255, 255, 0.75)');
  core.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
  core.addColorStop(0.68, 'rgba(255, 255, 255, 0.75)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.04);
  ctx.lineTo(w * 0.57, h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.96);
  ctx.lineTo(w * 0.43, h * 0.5);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createScorchGlowTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
  grad.addColorStop(0, 'rgba(255, 245, 210, 0.96)');
  grad.addColorStop(0.28, 'rgba(255, 145, 45, 0.72)');
  grad.addColorStop(0.62, 'rgba(220, 58, 12, 0.34)');
  grad.addColorStop(1, 'rgba(60, 12, 2, 0)');
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.scale(1, 0.38);
  ctx.translate(-w * 0.5, -h * 0.5);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Sharp glowing central gouge streak
  const streak = ctx.createLinearGradient(w * 0.12, 0, w * 0.88, 0);
  streak.addColorStop(0, 'rgba(255, 180, 70, 0)');
  streak.addColorStop(0.5, 'rgba(255, 250, 220, 0.95)');
  streak.addColorStop(1, 'rgba(255, 180, 70, 0)');
  ctx.strokeStyle = streak;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.5);
  ctx.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.88, h * 0.5);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWorkshopPedestalTextures(): {
  colorMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d')!;

  const eCanvas = document.createElement('canvas');
  eCanvas.width = size;
  eCanvas.height = size;
  const eCtx = eCanvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Carbon slate radial base
  const bg = ctx.createRadialGradient(cx, cy, 18, cx, cy, size * 0.5);
  bg.addColorStop(0, '#0f1b33');
  bg.addColorStop(0.55, '#070d1c');
  bg.addColorStop(1, '#03060e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  // Subtle hex grid across the turntable face
  const hexR = 26;
  const dx = hexR * 1.5;
  const dy = hexR * Math.sqrt(3);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 1.2;
  eCtx.strokeStyle = 'rgba(14, 165, 233, 0.22)';
  eCtx.lineWidth = 1.1;
  for (let col = -2; col <= 16; col++) {
    for (let row = -2; row <= 16; row++) {
      const hx = col * dx;
      const hy = row * dy + (col % 2 === 0 ? 0 : dy * 0.5);
      const drawHex = (target: CanvasRenderingContext2D) => {
        target.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = hx + Math.cos(a) * hexR;
          const py = hy + Math.sin(a) * hexR;
          if (k === 0) target.moveTo(px, py);
          else target.lineTo(px, py);
        }
        target.closePath();
        target.stroke();
      };
      drawHex(ctx);
      drawHex(eCtx);
    }
  }

  // Concentric machined gear rings + luminous circuit arcs
  const ringRadii = [78, 134, 188, 224];
  for (let i = 0; i < ringRadii.length; i++) {
    const r = ringRadii[i];
    ctx.strokeStyle = i === 1 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = i === 1 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    eCtx.strokeStyle = i === 1 ? 'rgba(56, 189, 248, 0.92)' : 'rgba(56, 189, 248, 0.42)';
    eCtx.lineWidth = i === 1 ? 3.2 : 1.6;
    eCtx.beginPath();
    eCtx.arc(cx, cy, r, 0, Math.PI * 2);
    eCtx.stroke();
  }

  // 12 precision degree ticks + 6 radial data spokes
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const isMajor = k % 2 === 0;
    const r0 = isMajor ? 84 : 188;
    const r1 = 224;
    ctx.strokeStyle = isMajor ? 'rgba(125, 211, 252, 0.58)' : 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = isMajor ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();

    if (isMajor) {
      eCtx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      eCtx.lineWidth = 2.2;
      eCtx.beginPath();
      eCtx.moveTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86);
      eCtx.lineTo(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130);
      eCtx.stroke();
    }
  }

  const colorMap = new THREE.CanvasTexture(cCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(eCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { colorMap, emissiveMap };
}

function createEmptyTopKinematics(): TopKinematicsState {
  return {
    dropY: 0,
    dropVy: 0,
    dropActive: false,
    dropDelay: 0,
    bouncesLeft: 0,
    didPrimaryLand: false,
    recoilTiltX: 0,
    recoilTiltZ: 0,
    recoilVelX: 0,
    recoilVelZ: 0,
    scrapeCooldown: 0,
    lastPowerRatio: 0.8,
  };
}

export class ArenaSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private compactLandscape = false;
  private isSoftwareGl: boolean;
  private webglContextLost = false;
  private currentQuality: GraphicsQuality;
  private userQualityCap: GraphicsQuality;
  private qualityAutoAdjusted = false;
  private highFpsStreak = 0;

  private arenaEnvTarget: THREE.WebGLRenderTarget | null = null;
  private contactShadowTex!: THREE.CanvasTexture;
  private innerWallAoTex!: THREE.CanvasTexture;
  private stadiumGroup: THREE.Group | null = null;
  private wallRecoilGroup: THREE.Group | null = null;
  private activeArenaTextures: THREE.Texture[] = [];
  private stadiumSurfaceMaps: StadiumSurfaceMaps | null = null;
  private modeReactiveGroup: THREE.Group | null = null;
  private mistMesh: THREE.Mesh | null = null;
  private neonTrimMat: THREE.MeshStandardMaterial | null = null;
  private innerRimBandMat: THREE.MeshStandardMaterial | null = null;
  private lightBarMat: THREE.MeshStandardMaterial | null = null;
  private gateBeaconMat: THREE.MeshStandardMaterial | null = null;
  private criticalWarningRing: THREE.Object3D | null = null;
  private criticalWarningMat: THREE.MeshBasicMaterial | null = null;
  private dynamicPillarMeshes: { mesh: THREE.Group; pillar: ArenaPillarObstacle }[] = [];
  private dynamicHazardMeshes: { group: THREE.Group; hz: ArenaHazardZone; discMat: THREE.MeshBasicMaterial }[] = [];
  private modeMovingTraps: ModeMovingTrapSlot[] = [];
  private modeRingVisuals: ModeRingVisualSlot[] = [];
  private currentArenaId: ArenaId = 'standard';
  private baseSkyHex = 0x070b14;
  private baseFogDensity = 0.022;
  private baseArenaTrimHex = 0x38bdf8;
  private baseRimHex = 0x38bdf8;
  private battleEnv: {
    matchMode: MatchMode;
    mutators: BattleMutators;
    survivalWave: number;
  } = {
    matchMode: 'Training',
    mutators: { ...DEFAULT_BATTLE_MUTATORS },
    survivalWave: 1,
  };
  private criticalBlend = 0;
  private lastObservedPhase: BattlePhase | null = null;
  private envTime = 0;

  private playerRig: TopVisualRig | null = null;
  private opponentRig: TopVisualRig | null = null;
  private playerShadow: THREE.Mesh;
  private opponentShadow: THREE.Mesh;
  private playerTrailRing: THREE.Mesh;
  private opponentTrailRing: THREE.Mesh;
  private playerInnerTrailRing: THREE.Mesh;
  private opponentInnerTrailRing: THREE.Mesh;
  private playerGhostRing: THREE.Mesh;
  private opponentGhostRing: THREE.Mesh;
  private playerRibbon: RibbonTrailTrack | null = null;
  private opponentRibbon: RibbonTrailTrack | null = null;
  private workshopExploded = false;
  private workshopExplodeBlend = 0;
  private workshopPedestalGroup: THREE.Group | null = null;
  private workshopPedestalRing: THREE.Mesh | null = null;
  private workshopPedestalInnerGear: THREE.Mesh | null = null;
  private workshopPedestalColorTex: THREE.CanvasTexture | null = null;
  private workshopPedestalEmissiveTex: THREE.CanvasTexture | null = null;
  private workshopSatellitePads: {
    group: THREE.Group;
    baseY: number;
    phase: number;
    rimMat: THREE.MeshBasicMaterial;
  }[] = [];
  private workshopHoloCurtain: THREE.Mesh | null = null;
  private workshopLayerReticleGroup: THREE.Group | null = null;
  private workshopLayerReticleRing: THREE.Mesh | null = null;
  private workshopLayerReticleMat: THREE.MeshBasicMaterial | null = null;
  private workshopSelectedCategory: ComponentCategory = 'AttackBlade';
  private workshopReticleCurrentY = 0.39;

  // Weight & Kinematics: Launch Slam, Impact Recoil Spring, Wall Tremor, and Floor Scuffs/Scorches
  private playerKinematics: TopKinematicsState = createEmptyTopKinematics();
  private opponentKinematics: TopKinematicsState = createEmptyTopKinematics();
  private wallTremorPos = new THREE.Vector3();
  private wallTremorVel = new THREE.Vector3();
  private camDipY = 0;
  private camDipVelY = 0;
  private camRecoilPos = new THREE.Vector3();
  private camRecoilVel = new THREE.Vector3();
  private scuffCanvas: HTMLCanvasElement | null = null;
  private scuffCtx: CanvasRenderingContext2D | null = null;
  private scuffTex: THREE.CanvasTexture | null = null;
  private scuffMesh: THREE.Mesh | null = null;
  private scuffDirty = false;
  private scuffUploadAccum = 0;
  private scuffHasMarks = false;
  private thermalScorches: ThermalScorchSlot[] = [];
  private thermalScorchCursor = 0;
  private scorchGlowTex: THREE.CanvasTexture | null = null;

  // Postprocessing (High quality + hardware WebGL only)
  private composer: EffectComposer | null = null;
  private gtaoPass: OpaqueOnlyGTAOPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  // 3D Launch Aim Reticle + 0-90 deg Sector Guide + Spiral Trajectory Line
  private aimGroup: THREE.Group;
  private aimRing: THREE.Mesh;
  private aimLine: THREE.Line;
  private aimSectorZeroLine: THREE.Line;
  private aimSectorLimitLine: THREE.Line;
  private aimSectorArc: THREE.Line;

  // Dynamic Lighting Flash, Reactive Stadium Illumination & Shockwaves on Collision
  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillRimLight!: THREE.DirectionalLight;
  private clashLight!: THREE.PointLight;
  private criticalOverheadLight!: THREE.PointLight;
  private clashLightIntensity = 0;
  private flashTimer = 0;
  private flashMaxDuration = 0.16;
  private flashPeakIntensity = 0;
  private flashColorHex = 0xff6b2b;
  private shockwaves: ShockwaveSlot[] = [];
  private shockwaveCursor = 0;
  private arcFlares: ArcFlareSlot[] = [];
  private arcFlareCursor = 0;
  private slashArcs: SlashArcSlot[] = [];
  private slashArcCursor = 0;
  private cleaveBeams: CleaveBeamSlot[] = [];
  private cleaveBeamCursor = 0;
  private clashFlareTex: THREE.CanvasTexture | null = null;
  private slashArcTex: THREE.CanvasTexture | null = null;
  private cleaveStreakTex: THREE.CanvasTexture | null = null;
  private shockwaveTex: THREE.CanvasTexture | null = null;
  private ejectedParts: EjectedPartSlot[] = [];

  // 3D Training Diagnostics Overlay (Velocity arrows + predicted arc + Collision Heatmap)
  private diagnosticsGroup: THREE.Group;
  private playerVelArrow: THREE.ArrowHelper;
  private oppVelArrow: THREE.ArrowHelper;
  private predictedArcLine: THREE.Line;
  private showDiagnostics = false;
  private heatmapGrid = new Float32Array(HEATMAP_RES * HEATMAP_RES);
  private heatmapPixels = new Uint8Array(HEATMAP_RES * HEATMAP_RES * 4);
  private heatmapTex: THREE.DataTexture;
  private heatmapMesh: THREE.Mesh | null = null;
  private heatmapDirty = false;
  private heatmapUploadAccum = 0;
  private heatmapImpacts = 0;
  private heatmapPeakZone = 'Center Pocket';
  private heatmapPeakIntensity = 0;

  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private sparkMetaArray = new Float32Array(MAX_PARTICLES * 4);
  private sparkMetaAttr = new THREE.InstancedBufferAttribute(this.sparkMetaArray, 4);
  private debrisParticleMesh: THREE.InstancedMesh;
  private debrisParticles: DebrisParticleSlot[] = [];
  private debrisParticleCursor = 0;
  private baseArenaFloorHex = 0x64748b;

  private currentWeather: WeatherType = 'Clear';
  private weatherParticleMesh: THREE.InstancedMesh;
  private weatherParticles: WeatherParticleSlot[] = [];

  private playerVisualSpinAngle = 0;
  private opponentVisualSpinAngle = 0;
  private playerVictoryEmote: VictoryEmoteId = 'apex_flare';
  private opponentVictoryEmote: VictoryEmoteId = 'apex_flare';
  private workshopEmotePreviewId: VictoryEmoteId | null = null;
  private workshopEmotePreviewTimer = 0;
  private victoryEmoteTime = 0;
  private victoryEmoteFxCooldown = 0;

  private cameraMode: SceneCameraMode = 'title';
  private cameraPreset: CameraPreset = 'Broadcast';
  private cameraYaw = 0;
  private cameraPitch = 0.58;
  private cameraZoom = 1.0;
  private cameraSensitivity = 1.0;

  private currentLookAt = new THREE.Vector3(0, 0.25, 0);
  private stableCamPos = new THREE.Vector3(0, 4.5, 6.2);
  private stableCamPosValid = false;
  private burstShakeTimer = 0;
  private burstShakeDuration = 0.42;
  private burstShakePhase = 0;
  private burstShakeStrength = 0;
  private burstShakeTriggeredForFinish = false;
  private clashCamEnabled = true;
  private clashCamTimer = 0;
  private clashCamDuration = 0.32;
  private clashCamStrength = 0;
  private clashCamFocus = new THREE.Vector3();
  private lastRawDt = 0.016;

  // Football-broadcast multi-angle slow-motion instant replay state
  private replayClip: MatchHighlightClip | null = null;
  private replayFrames: MatchHighlightFrame[] = [];
  private replayTimeOffset = 0;
  private replayClimaxHoldTimer = 0;
  private replaySpeed = REPLAY_SLOWMO_SPEED;
  private replayPassCount = 0;
  private replayFirstPassNotified = false;
  private replayLastClashRawIdx = -1;
  private replayBurstTriggeredInPass = false;
  private replayLastBrokenPlayer = new Set<PartDurabilityKey>();
  private replayLastBrokenOpponent = new Set<PartDurabilityKey>();
  private replayLastAngleIdx = -1;
  private replayBaseAngle = 0.85;
  private replayClimaxX = 0;
  private replayClimaxZ = 0;
  private replayLastTelemetryEmitMs = 0;
  private onReplayTelemetry?: (telemetry: ReplayHudTelemetry) => void;
  private onReplayFirstPassComplete?: () => void;
  private onReplayImpactSfx?: (kind: 'clash' | 'burst', intensity: number) => void;

  private frameId = 0;
  private disposed = false;
  private initFailed = false;
  private reducedMotion = false;
  private lastTimeMs = 0;
  private titleSpinAngle = 0;
  private fpsAccumTime = 0;
  private fpsFrames = 0;
  private telemetryAccumTime = 0;
  private telemetryFrames = 0;
  private lastSimStepMs = 0;
  private lastDroppedSteps = 0;

  private simGetter: () => BattleSimulationState | null;
  private onFrameTick: (dt: number) => void;
  private onAimPoint?: (x: number, z: number, lockPower: boolean) => void;
  private onContextLostChange?: (lost: boolean) => void;
  private onTelemetry?: (telemetry: SceneTelemetry) => void;
  private onLaunchSlamSfx?: (power: number) => void;
  private onSelectWorkshopPart?: (category: ComponentCategory) => void;

  private resizeObserver: ResizeObserver;
  private activePointers = new Map<
    number,
    { x: number; y: number; downX: number; downY: number; mode: 'aim' | 'orbit'; pointerType: string }
  >();
  private lastPinchDist: number | null = null;

  constructor(params: {
    container: HTMLElement;
    getSimulation: () => BattleSimulationState | null;
    onFrameTick: (dt: number) => void;
    onAimPoint?: (x: number, z: number, lockPower: boolean) => void;
    onContextLostChange?: (lost: boolean) => void;
    onTelemetry?: (telemetry: SceneTelemetry) => void;
    onLaunchSlamSfx?: (power: number) => void;
    onSelectWorkshopPart?: (category: ComponentCategory) => void;
    onInitError?: (message: string) => void;
    quality: GraphicsQuality;
  }) {
    this.container = params.container;
    this.simGetter = params.getSimulation;
    this.onFrameTick = params.onFrameTick;
    this.onAimPoint = params.onAimPoint;
    this.onContextLostChange = params.onContextLostChange;
    this.onTelemetry = params.onTelemetry;
    this.onLaunchSlamSfx = params.onLaunchSlamSfx;
    this.onSelectWorkshopPart = params.onSelectWorkshopPart;
    this.currentQuality = params.quality;
    this.userQualityCap = params.quality;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 120);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());

    this.heatmapTex = new THREE.DataTexture(
      this.heatmapPixels,
      HEATMAP_RES,
      HEATMAP_RES,
      THREE.RGBAFormat
    );
    this.heatmapTex.colorSpace = THREE.SRGBColorSpace;
    this.heatmapTex.minFilter = THREE.LinearFilter;
    this.heatmapTex.magFilter = THREE.LinearFilter;
    this.heatmapTex.wrapS = THREE.ClampToEdgeWrapping;
    this.heatmapTex.wrapT = THREE.ClampToEdgeWrapping;
    this.heatmapTex.needsUpdate = true;

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      this.initFailed = true;
      this.disposed = true;
      this.playerShadow = new THREE.Mesh();
      this.opponentShadow = new THREE.Mesh();
      this.playerTrailRing = new THREE.Mesh();
      this.opponentTrailRing = new THREE.Mesh();
      this.playerInnerTrailRing = new THREE.Mesh();
      this.opponentInnerTrailRing = new THREE.Mesh();
      this.playerGhostRing = new THREE.Mesh();
      this.opponentGhostRing = new THREE.Mesh();
      this.aimGroup = new THREE.Group();
      this.aimRing = new THREE.Mesh();
      this.aimLine = new THREE.Line();
      this.aimSectorZeroLine = new THREE.Line();
      this.aimSectorLimitLine = new THREE.Line();
      this.aimSectorArc = new THREE.Line();
      this.diagnosticsGroup = new THREE.Group();
      this.playerVelArrow = new THREE.ArrowHelper();
      this.oppVelArrow = new THREE.ArrowHelper();
      this.predictedArcLine = new THREE.Line();
      this.particleMesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0);
      this.debrisParticleMesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0);
      this.weatherParticleMesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0);
      this.renderer = null as unknown as THREE.WebGLRenderer;
      params.onInitError?.(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL stadium context.'
      );
      return;
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && params.quality !== 'Low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    this.renderer.setSize(w, h);
    this.applyQuality(params.quality);
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.webglContextLost = true;
      this.onContextLostChange?.(true);
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.webglContextLost = false;
      this.onContextLostChange?.(false);
    });

    this.scene.background = new THREE.Color(0x070b14);
    this.scene.fog = new THREE.FogExp2(0x070b14, 0.022);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 5.2, 7.6);
    this.camera.lookAt(0, 0.2, 0);

    this.contactShadowTex = createContactShadowTexture();
    this.innerWallAoTex = createWallContactAoTexture();
    this.setupLighting();
    this.buildArenaStadium('standard');
    this.syncComposerState(w, h);

    // Contact shadows
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowGeo = new THREE.CircleGeometry(0.58, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.userData.skipGtao = true;
    this.opponentShadow = new THREE.Mesh(shadowGeo, shadowMat.clone());
    this.opponentShadow.userData.skipGtao = true;
    this.scene.add(this.playerShadow);
    this.scene.add(this.opponentShadow);

    // Dual-layer kinetic spin arc trails (outer arc + fast harmonic inner slipstream)
    const ringGeo = new THREE.RingGeometry(0.44, 0.485, 32, 1, 0, Math.PI * 1.15);
    ringGeo.rotateX(-Math.PI / 2);
    const innerRingGeo = new THREE.RingGeometry(0.32, 0.355, 28, 1, 0, Math.PI * 0.85);
    innerRingGeo.rotateX(-Math.PI / 2);

    this.playerTrailRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff5a2f,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.playerInnerTrailRing = new THREE.Mesh(
      innerRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff9b71,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.opponentTrailRing = new THREE.Mesh(
      ringGeo.clone(),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.opponentInnerTrailRing = new THREE.Mesh(
      innerRingGeo.clone(),
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.scene.add(this.playerTrailRing);
    this.scene.add(this.playerInnerTrailRing);
    this.scene.add(this.opponentTrailRing);
    this.scene.add(this.opponentInnerTrailRing);

    // High-RPM Outer Ghost Spin Aura Rings + Floor Tip Laser Ribbon Trails
    const ghostGeo = new THREE.RingGeometry(0.55, 0.582, 42, 1, 0, Math.PI * 1.65);
    ghostGeo.rotateX(-Math.PI / 2);
    this.playerGhostRing = new THREE.Mesh(
      ghostGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.opponentGhostRing = new THREE.Mesh(
      ghostGeo.clone(),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.playerGhostRing.userData.skipGtao = true;
    this.opponentGhostRing.userData.skipGtao = true;
    this.scene.add(this.playerGhostRing);
    this.scene.add(this.opponentGhostRing);

    this.playerRibbon = createRibbonTrailTrack(0x38bdf8);
    this.opponentRibbon = createRibbonTrailTrack(0xf43f5e);
    this.scene.add(this.playerRibbon.mesh);
    this.scene.add(this.opponentRibbon.mesh);

    // Glowing Cyber-Hex Hangar Turntable, 6 Floating Satellite Hex Pads & Layer Reticle
    this.workshopPedestalGroup = new THREE.Group();
    const pedTextures = createWorkshopPedestalTextures();
    this.workshopPedestalColorTex = pedTextures.colorMap;
    this.workshopPedestalEmissiveTex = pedTextures.emissiveMap;

    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.96, 0.08, 6),
      new THREE.MeshStandardMaterial({
        color: 0x0b1222,
        metalness: 0.88,
        roughness: 0.28,
      })
    );
    pedBase.position.y = 0.05;
    pedBase.receiveShadow = true;
    this.workshopPedestalGroup.add(pedBase);

    const pedTopCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.695, 0.695, 0.008, 6),
      new THREE.MeshStandardMaterial({
        map: this.workshopPedestalColorTex,
        emissive: 0xffffff,
        emissiveMap: this.workshopPedestalEmissiveTex,
        emissiveIntensity: 0.88,
        metalness: 0.52,
        roughness: 0.45,
      })
    );
    pedTopCap.position.y = 0.091;
    pedTopCap.receiveShadow = true;
    this.workshopPedestalGroup.add(pedTopCap);

    const pedHexRingGeo = new THREE.RingGeometry(0.695, 0.755, 6);
    pedHexRingGeo.rotateX(-Math.PI / 2);
    const pedHexRing = new THREE.Mesh(
      pedHexRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pedHexRing.rotation.y = Math.PI / 6;
    pedHexRing.position.y = 0.096;
    this.workshopPedestalGroup.add(pedHexRing);

    const pedInnerGearGeo = new THREE.RingGeometry(0.41, 0.46, 36, 1, 0, Math.PI * 1.65);
    pedInnerGearGeo.rotateX(-Math.PI / 2);
    this.workshopPedestalInnerGear = new THREE.Mesh(
      pedInnerGearGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.workshopPedestalInnerGear.position.y = 0.097;
    this.workshopPedestalGroup.add(this.workshopPedestalInnerGear);

    const pedOuterRingGeo = new THREE.RingGeometry(0.84, 0.88, 48, 1, 0, Math.PI * 1.55);
    pedOuterRingGeo.rotateX(-Math.PI / 2);
    this.workshopPedestalRing = new THREE.Mesh(
      pedOuterRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.workshopPedestalRing.position.y = 0.098;
    this.workshopPedestalGroup.add(this.workshopPedestalRing);

    // 6 floating satellite hexagon pads framing the cyber-hex stage
    const satPadGeo = new THREE.CylinderGeometry(0.18, 0.21, 0.032, 6);
    const satRimGeo = new THREE.RingGeometry(0.15, 0.178, 6);
    satRimGeo.rotateX(-Math.PI / 2);
    const satPadMat = new THREE.MeshStandardMaterial({
      color: 0x091020,
      metalness: 0.82,
      roughness: 0.32,
    });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const satGroup = new THREE.Group();
      const satBody = new THREE.Mesh(satPadGeo, satPadMat);
      satBody.receiveShadow = true;
      satGroup.add(satBody);

      const rimMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const satRim = new THREE.Mesh(satRimGeo, rimMat);
      satRim.position.y = 0.018;
      satRim.rotation.y = Math.PI / 6;
      satGroup.add(satRim);

      const baseY = 0.055;
      satGroup.position.set(Math.cos(a) * 1.12, baseY, Math.sin(a) * 1.12);
      satGroup.rotation.y = -a;
      this.workshopPedestalGroup.add(satGroup);
      this.workshopSatellitePads.push({
        group: satGroup,
        baseY,
        phase: k * 1.047,
        rimMat,
      });
    }

    // Translucent hex holo-scan curtain framing exploded layers
    this.workshopHoloCurtain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.72, 1.12, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.workshopHoloCurtain.position.y = 0.66;
    this.workshopHoloCurtain.rotation.y = Math.PI / 6;
    this.workshopPedestalGroup.add(this.workshopHoloCurtain);

    // Selected-layer holographic hex reticle tracking the active workshop part
    this.workshopLayerReticleGroup = new THREE.Group();
    const reticleHexGeo = new THREE.RingGeometry(0.45, 0.485, 6);
    reticleHexGeo.rotateX(-Math.PI / 2);
    this.workshopLayerReticleMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.workshopLayerReticleRing = new THREE.Mesh(reticleHexGeo, this.workshopLayerReticleMat);
    this.workshopLayerReticleRing.rotation.y = Math.PI / 6;
    this.workshopLayerReticleGroup.add(this.workshopLayerReticleRing);

    const reticleArcGeo = new THREE.RingGeometry(0.51, 0.53, 24, 1, 0, Math.PI * 1.25);
    reticleArcGeo.rotateX(-Math.PI / 2);
    const reticleArcMesh = new THREE.Mesh(
      reticleArcGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.workshopLayerReticleGroup.add(reticleArcMesh);
    this.workshopLayerReticleGroup.position.y = 0.39;
    this.workshopPedestalGroup.add(this.workshopLayerReticleGroup);

    this.workshopPedestalGroup.visible = false;
    this.workshopPedestalGroup.userData.skipGtao = true;
    this.scene.add(this.workshopPedestalGroup);

    // 3D Launch Aim Reticle + 0-90 deg Sector Cone
    this.aimGroup = new THREE.Group();
    const aimRingGeo = new THREE.RingGeometry(0.28, 0.36, 32);
    aimRingGeo.rotateX(-Math.PI / 2);
    this.aimRing = new THREE.Mesh(
      aimRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    const aimPreviewPts: THREE.Vector3[] = [];
    for (let i = 0; i < 28; i++) {
      aimPreviewPts.push(new THREE.Vector3(0, 0.2, 0));
    }
    this.aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(aimPreviewPts),
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.94 })
    );
    this.aimSectorZeroLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.14, 0),
        new THREE.Vector3(0, 0.14, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.42 })
    );
    this.aimSectorLimitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.14, 0),
        new THREE.Vector3(0, 0.14, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.48 })
    );
    const sectorArcPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) sectorArcPts.push(new THREE.Vector3(0, 0.14, 0));
    this.aimSectorArc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(sectorArcPts),
      new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.36 })
    );
    this.aimGroup.add(this.aimRing);
    this.aimGroup.add(this.aimLine);
    this.aimGroup.add(this.aimSectorZeroLine);
    this.aimGroup.add(this.aimSectorLimitLine);
    this.aimGroup.add(this.aimSectorArc);
    this.aimGroup.userData.skipGtao = true;
    this.aimGroup.visible = false;
    this.scene.add(this.aimGroup);

    // 3D Diagnostics Overlay
    this.diagnosticsGroup = new THREE.Group();
    this.diagnosticsGroup.userData.skipGtao = true;
    this.playerVelArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0.4, 0),
      1,
      0x38bdf8
    );
    this.oppVelArrow = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0.4, 0),
      1,
      0xf43f5e
    );
    const arcPts: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) arcPts.push(new THREE.Vector3(0, 0.2, 0));
    this.predictedArcLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(arcPts),
      new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.78 })
    );
    this.diagnosticsGroup.add(this.playerVelArrow);
    this.diagnosticsGroup.add(this.oppVelArrow);
    this.diagnosticsGroup.add(this.predictedArcLine);
    this.diagnosticsGroup.visible = false;
    this.scene.add(this.diagnosticsGroup);

    // Pooled Shockwave Rings (soft radial plasma pulse instead of flat polygon ring)
    this.shockwaveTex = createShockwaveRingTexture();
    const swGeo = new THREE.PlaneGeometry(0.76, 0.76);
    swGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const swMat = new THREE.MeshBasicMaterial({
        map: this.shockwaveTex,
        color: 0xff7b29,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const swMesh = new THREE.Mesh(swGeo, swMat);
      swMesh.visible = false;
      this.scene.add(swMesh);
      this.shockwaves.push({
        mesh: swMesh,
        active: false,
        life: 0,
        maxLife: 0.24,
        startScale: 0.65,
        endScale: 2.8,
      });
    }

    // Pooled Contact Arc Flares (camera-facing blinding metal-on-metal arc starburst)
    this.clashFlareTex = createClashFlareTexture();
    const flareGeo = new THREE.PlaneGeometry(1.0, 1.0);
    for (let i = 0; i < MAX_ARC_FLARES; i++) {
      const flareMat = new THREE.MeshBasicMaterial({
        map: this.clashFlareTex,
        color: 0xfff3c4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const flareMesh = new THREE.Mesh(flareGeo, flareMat);
      flareMesh.visible = false;
      flareMesh.renderOrder = 6;
      this.scene.add(flareMesh);
      this.arcFlares.push({
        mesh: flareMesh,
        active: false,
        life: 0,
        maxLife: 0.11,
        startScale: 0.75,
        endScale: 1.9,
        rollAngle: 0,
      });
    }

    // Pooled Anime Rim Slash Arcs (curved directional motion-blur crescent arcs wrapping clashes)
    this.slashArcTex = createSlashArcTexture();
    const slashGeo = createSlashArcGeometry(0.44, 0.96, Math.PI * 1.18, 28);
    for (let i = 0; i < MAX_SLASH_ARCS; i++) {
      const slashMat = new THREE.MeshBasicMaterial({
        map: this.slashArcTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const slashMesh = new THREE.Mesh(slashGeo, slashMat);
      slashMesh.visible = false;
      slashMesh.renderOrder = 7;
      slashMesh.userData.skipGtao = true;
      this.scene.add(slashMesh);
      this.slashArcs.push({
        mesh: slashMesh,
        active: false,
        life: 0,
        maxLife: 0.18,
        startScale: 0.78,
        endScale: 1.42,
        baseSpin: 0,
        spinDelta: 1.6,
        tiltX: 0,
        tiltZ: 0,
        baseOpacity: 0.95,
      });
    }

    // Pooled Anime Contact Cleave Beams (razor-sharp vertical/tangential impact bisect line)
    this.cleaveStreakTex = createCleaveStreakTexture();
    const cleaveGeo = new THREE.PlaneGeometry(0.48, 1.35);
    for (let i = 0; i < MAX_CLEAVE_BEAMS; i++) {
      const cleaveMat = new THREE.MeshBasicMaterial({
        map: this.cleaveStreakTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const cleaveMesh = new THREE.Mesh(cleaveGeo, cleaveMat);
      cleaveMesh.visible = false;
      cleaveMesh.renderOrder = 7;
      cleaveMesh.userData.skipGtao = true;
      this.scene.add(cleaveMesh);
      this.cleaveBeams.push({
        mesh: cleaveMesh,
        active: false,
        life: 0,
        maxLife: 0.15,
        startScaleY: 0.65,
        endScaleY: 1.45,
        width: 1.0,
        rollAngle: 0,
      });
    }

    // Offscreen CanvasTexture for physical floor scratches, scuff arcs & scorch marks
    this.scuffCanvas = document.createElement('canvas');
    this.scuffCanvas.width = SCUFF_RES;
    this.scuffCanvas.height = SCUFF_RES;
    this.scuffCtx = this.scuffCanvas.getContext('2d');
    this.scuffTex = new THREE.CanvasTexture(this.scuffCanvas);
    this.scuffTex.flipY = false;
    this.scuffTex.colorSpace = THREE.SRGBColorSpace;
    this.scuffTex.minFilter = THREE.LinearFilter;
    this.scuffTex.magFilter = THREE.LinearFilter;
    this.scuffTex.wrapS = THREE.ClampToEdgeWrapping;
    this.scuffTex.wrapT = THREE.ClampToEdgeWrapping;
    this.scuffTex.anisotropy = Math.max(1, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    // Pooled transient incandescent thermal scorch streaks that cool into permanent canvas scars
    this.scorchGlowTex = createScorchGlowTexture();
    const scorchGeo = new THREE.PlaneGeometry(0.95, 0.28);
    scorchGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_THERMAL_SCORCHES; i++) {
      const sMat = new THREE.MeshBasicMaterial({
        map: this.scorchGlowTex,
        color: 0xff8a30,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        toneMapped: false,
      });
      const sMesh = new THREE.Mesh(scorchGeo, sMat);
      sMesh.visible = false;
      sMesh.renderOrder = 2;
      sMesh.userData.skipGtao = true;
      this.scene.add(sMesh);
      this.thermalScorches.push({
        mesh: sMesh,
        active: false,
        life: 0,
        maxLife: 1.1,
        baseOpacity: 0.85,
        hotHex: 0xffd166,
        coolHex: 0xb91c1c,
      });
    }

    // Zero-GC pooled InstancedMesh particles: incandescent crossed-ribbon grinder streaks & embers
    const sparkGeo = createSparkStreakGeometry();
    this.sparkMetaAttr.setUsage(THREE.DynamicDrawUsage);
    sparkGeo.setAttribute('aSparkMeta', this.sparkMetaAttr);

    const sparkMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: /* glsl */ `
        attribute vec4 aSparkMeta;
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec4 vSparkMeta;

        void main() {
          vUv = uv;
          vSparkMeta = aSparkMeta;
          #ifdef USE_INSTANCING_COLOR
            vInstanceColor = instanceColor;
          #else
            vInstanceColor = vec3(1.0);
          #endif
          vec4 mvPosition = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vInstanceColor;
        varying vec4 vSparkMeta;

        void main() {
          float life = clamp(vSparkMeta.x, 0.0, 1.0);
          float kind = vSparkMeta.y;
          float seed = vSparkMeta.z;
          float heat = vSparkMeta.w;

          if (life <= 0.001 || heat <= 0.001) discard;

          // Tapered needle profile: crisp glowing tip near vUv.y = 0.90, smooth fiery tail toward 0.0
          float headFade = smoothstep(1.0, 0.86, vUv.y);
          float tailFade = pow(smoothstep(0.0, 0.90, vUv.y), 1.4);
          float longitudinal = headFade * tailFade;

          float widthFactor = mix(0.24, 1.0, pow(vUv.y, 0.55));
          float crossDist = abs(vUv.x - 0.5) * 2.0;
          float normCross = crossDist / max(0.08, widthFactor);

          float core = exp(-normCross * normCross * 15.0);
          float halo = exp(-normCross * normCross * 3.4) * 0.52;
          float shapeAlpha = (core + halo) * longitudinal;

          if (shapeAlpha < 0.008) discard;

          float flicker = 1.0;
          if (kind > 0.5) {
            float sputter = pow(max(0.0, sin(life * 54.0 + seed * 127.0)), 6.0);
            flicker = 0.85 + 0.24 * sin(life * 28.0 + seed * 43.0) + (seed > 0.52 ? sputter * 0.85 : 0.0);
          }

          vec3 finalColor;
          if (kind > 0.5) {
            // Blackbody cooling curve for burning steel/iron sparks
            float temp = clamp(life * 1.08 + (vUv.y - 0.5) * 0.25, 0.0, 1.0);
            vec3 whiteHot = vec3(1.0, 0.97, 0.86);
            vec3 moltenGold = vec3(1.0, 0.64, 0.14);
            vec3 orangeRed = vec3(1.0, 0.27, 0.03);
            vec3 deepEmber = vec3(0.58, 0.05, 0.005);

            vec3 bodyCol = mix(deepEmber, orangeRed, smoothstep(0.0, 0.34, temp));
            bodyCol = mix(bodyCol, moltenGold, smoothstep(0.32, 0.72, temp));
            bodyCol = mix(bodyCol, whiteHot, smoothstep(0.66, 0.98, temp));

            finalColor = mix(bodyCol, whiteHot * 1.28, core * smoothstep(0.08, 0.85, life) * 0.78);
            finalColor = mix(finalColor, vInstanceColor * 1.35, 0.12 * (1.0 - temp));
          } else {
            // Elemental / shield / ability energy streaks with luminous core
            vec3 hotCore = mix(vInstanceColor, vec3(1.0), 0.76);
            finalColor = mix(vInstanceColor * 1.25, hotCore * 1.55, core * 0.75);
          }

          float lifeFade = smoothstep(0.0, 0.22, life);
          float intensity = shapeAlpha * lifeFade * heat * flicker;
          gl_FragColor = vec4(finalColor * intensity, clamp(intensity, 0.0, 1.0));
        }
      `,
    });

    this.particleMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.renderOrder = 5;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        size: 1,
        colorHex: 0xffffff,
        gravity: 9.5,
        drag: 0.98,
        kind: 0,
        seed: 0,
        heat: 1.0,
        bouncesLeft: 0,
        forkDone: false,
      });
      _pos.set(0, -100, 0);
      _scale.setScalar(0);
      _mat4.compose(_pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.setHex(0xffffff));
      this.sparkMetaAttr.setXYZW(i, 0, 0, 0, 0);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    this.sparkMetaAttr.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // Zero-GC pooled InstancedMesh for grounded debris chips & arena dust when fallen top parts strike the floor
    const debrisGeo = new THREE.DodecahedronGeometry(0.042, 0);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.62,
    });
    this.debrisParticleMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, MAX_DEBRIS_PARTICLES);
    this.debrisParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisParticleMesh.frustumCulled = false;
    this.debrisParticleMesh.castShadow = !this.isSoftwareGl;

    for (let i = 0; i < MAX_DEBRIS_PARTICLES; i++) {
      this.debrisParticles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        life: 0,
        maxLife: 1.2,
        baseSize: 1,
        colorHex: 0x94a3b8,
      });
      _pos.set(0, -100, 0);
      _scale.setScalar(0);
      _mat4.compose(_pos, _quat, _scale);
      this.debrisParticleMesh.setMatrixAt(i, _mat4);
      this.debrisParticleMesh.setColorAt(i, _color.setHex(0x94a3b8));
    }
    this.debrisParticleMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisParticleMesh.instanceColor) this.debrisParticleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.debrisParticleMesh);

    // Zero-GC pooled InstancedMesh for Dynamic Arena Weather (rain streaks, dust motes, gale wind streaks)
    const weatherGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 5);
    const weatherMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.weatherParticleMesh = new THREE.InstancedMesh(weatherGeo, weatherMat, MAX_WEATHER_PARTICLES);
    this.weatherParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.weatherParticleMesh.frustumCulled = false;
    this.weatherParticleMesh.visible = false;
    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      this.weatherParticles.push({
        x: (Math.random() - 0.5) * 14,
        y: 0.2 + Math.random() * 6.5,
        z: (Math.random() - 0.5) * 14,
        vx: 0,
        vy: -1,
        vz: 0,
        length: 0.35,
        thickness: 1,
        phase: Math.random() * Math.PI * 2,
      });
      _pos.set(0, -100, 0);
      _scale.setScalar(0);
      _mat4.compose(_pos, _quat, _scale);
      this.weatherParticleMesh.setMatrixAt(i, _mat4);
    }
    this.weatherParticleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.weatherParticleMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    this.bindPointerControls();

    this.lastTimeMs = performance.now();
    this.startLoop();
  }

  public isSoftwareRenderer(): boolean {
    return this.isSoftwareGl;
  }

  public isContextLost(): boolean {
    return this.webglContextLost;
  }

  public attemptContextRestore(): boolean {
    try {
      const gl = this.renderer?.getContext();
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (ext) {
        ext.restoreContext();
        return true;
      }
    } catch {
      // fallback to caller scene remount
    }
    return false;
  }

  public setShowDiagnostics(show: boolean): void {
    this.showDiagnostics = show;
    if (this.heatmapMesh) {
      this.heatmapMesh.visible = show && this.cameraMode === 'battle';
    }
  }

  public clearCollisionHeatmap(): void {
    this.heatmapGrid.fill(0);
    this.heatmapPixels.fill(0);
    this.heatmapImpacts = 0;
    this.heatmapPeakZone = 'Center Pocket';
    this.heatmapPeakIntensity = 0;
    this.heatmapDirty = false;
    this.heatmapUploadAccum = 0;
    if (this.heatmapTex) {
      this.heatmapTex.needsUpdate = true;
    }
  }

  public clearFloorScuffs(): void {
    if (this.scuffHasMarks && this.scuffCtx && this.scuffCanvas) {
      this.scuffCtx.clearRect(0, 0, SCUFF_RES, SCUFF_RES);
      if (this.scuffTex) {
        this.scuffTex.needsUpdate = true;
      }
    }
    this.scuffDirty = false;
    this.scuffUploadAccum = 0;
    this.scuffHasMarks = false;
    for (let i = 0; i < this.thermalScorches.length; i++) {
      const slot = this.thermalScorches[i];
      slot.active = false;
      slot.mesh.visible = false;
    }
  }

  public resetCombatKinematics(): void {
    this.playerKinematics = createEmptyTopKinematics();
    this.opponentKinematics = createEmptyTopKinematics();
    this.wallTremorPos.set(0, 0, 0);
    this.wallTremorVel.set(0, 0, 0);
    if (this.wallRecoilGroup) {
      this.wallRecoilGroup.position.set(0, 0, 0);
      this.wallRecoilGroup.rotation.set(0, 0, 0);
    }
    this.camDipY = 0;
    this.camDipVelY = 0;
    this.camRecoilPos.set(0, 0, 0);
    this.camRecoilVel.set(0, 0, 0);
    this.clashCamTimer = 0;
    this.resetRibbonTrack(this.playerRibbon);
    this.resetRibbonTrack(this.opponentRibbon);
  }

  private resetRibbonTrack(track: RibbonTrailTrack | null): void {
    if (!track) return;
    track.count = 0;
    track.sampleAccum = 0;
    track.geometry.setDrawRange(0, 0);
    track.mesh.visible = false;
  }

  private updateRibbonTrack(
    track: RibbonTrailTrack | null,
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    active: boolean,
    dt: number
  ): void {
    if (!track) return;
    const speed = Math.hypot(vx, vz);
    if (!active || this.currentQuality === 'Low' || speed < 0.45) {
      if (track.count > 0) {
        track.sampleAccum += dt;
        if (track.sampleAccum > 0.045) {
          track.sampleAccum = 0;
          track.count = Math.max(0, track.count - 2);
        }
      }
      if (track.count < 2) {
        track.geometry.setDrawRange(0, 0);
        track.mesh.visible = false;
        return;
      }
    } else {
      track.sampleAccum += dt;
      if (track.sampleAccum >= 0.016 || track.count === 0) {
        track.sampleAccum = 0;
        const limit = Math.min(track.count, RIBBON_TRAIL_POINTS - 1);
        for (let i = limit; i > 0; i--) {
          track.ptsX[i] = track.ptsX[i - 1];
          track.ptsY[i] = track.ptsY[i - 1];
          track.ptsZ[i] = track.ptsZ[i - 1];
        }
        track.ptsX[0] = x;
        track.ptsY[0] = y + 0.055;
        track.ptsZ[0] = z;
        track.count = Math.min(RIBBON_TRAIL_POINTS, track.count + 1);
      }
    }

    if (track.count < 2) {
      track.geometry.setDrawRange(0, 0);
      track.mesh.visible = false;
      return;
    }

    const n = track.count;
    for (let i = 0; i < n; i++) {
      const px = track.ptsX[i];
      const py = track.ptsY[i];
      const pz = track.ptsZ[i];

      let tx = 0;
      let tz = 1;
      if (i < n - 1) {
        tx = track.ptsX[i] - track.ptsX[i + 1];
        tz = track.ptsZ[i] - track.ptsZ[i + 1];
      } else if (i > 0) {
        tx = track.ptsX[i - 1] - track.ptsX[i];
        tz = track.ptsZ[i - 1] - track.ptsZ[i];
      }
      const tLen = Math.hypot(tx, tz) || 1;
      const nx = -tz / tLen;
      const nz = tx / tLen;

      const tNorm = Math.min(1, i / (n - 1));
      const halfW = (1 - tNorm) * 0.082 + 0.008;
      const alpha = (1 - tNorm) * (1 - tNorm);

      const vIdx = i * 2;
      track.positions[vIdx * 3] = px + nx * halfW;
      track.positions[vIdx * 3 + 1] = py;
      track.positions[vIdx * 3 + 2] = pz + nz * halfW;
      track.alphas[vIdx] = alpha;

      track.positions[(vIdx + 1) * 3] = px - nx * halfW;
      track.positions[(vIdx + 1) * 3 + 1] = py;
      track.positions[(vIdx + 1) * 3 + 2] = pz - nz * halfW;
      track.alphas[vIdx + 1] = alpha;
    }

    const posAttr = track.geometry.attributes.position as THREE.BufferAttribute;
    const alphaAttr = track.geometry.attributes.aAlpha as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    track.geometry.setDrawRange(0, (n - 1) * 6);
    track.mesh.visible = true;
  }

  public triggerLaunchSlam(sim?: BattleSimulationState | null): void {
    if (this.initFailed) return;
    const pPower = sim?.launchSelection?.powerRatio ?? 0.8;
    const dropHeight = this.reducedMotion ? 0.16 : 0.41;

    this.playerKinematics.dropY = dropHeight;
    this.playerKinematics.dropVy = this.reducedMotion ? -1.1 : -1.55;
    this.playerKinematics.dropActive = true;
    this.playerKinematics.dropDelay = 0;
    this.playerKinematics.bouncesLeft = this.reducedMotion ? 1 : 2;
    this.playerKinematics.didPrimaryLand = false;
    this.playerKinematics.lastPowerRatio = pPower;

    this.opponentKinematics.dropY = dropHeight + (this.reducedMotion ? 0.02 : 0.04);
    this.opponentKinematics.dropVy = this.reducedMotion ? -1.15 : -1.65;
    this.opponentKinematics.dropActive = true;
    this.opponentKinematics.dropDelay = this.reducedMotion ? 0.015 : 0.032;
    this.opponentKinematics.bouncesLeft = this.reducedMotion ? 1 : 2;
    this.opponentKinematics.didPrimaryLand = false;
    this.opponentKinematics.lastPowerRatio = 0.8;
  }

  public triggerImpactRecoil(
    side: 'player' | 'opponent' | 'both',
    nx: number,
    nz: number,
    intensity: number,
    isCritical = false
  ): void {
    if (this.initFailed) return;
    const len = Math.hypot(nx, nz);
    const ix = len > 0.001 ? nx / len : 1;
    const iz = len > 0.001 ? nz / len : 0;
    const clampedInt = Math.max(0.25, Math.min(1.6, intensity));
    const critMult = isCritical ? 1.35 : 1.0;
    const motionMult = this.reducedMotion ? 0.35 : 1.0;
    const velKick = (2.15 + clampedInt * 1.95) * critMult * motionMult;

    const applyKick = (k: TopKinematicsState, dirSign: number) => {
      const dx = ix * dirSign;
      const dz = iz * dirSign;
      // Rotate Z negative tilts +Y toward +X; rotate X positive tilts +Y toward +Z
      k.recoilVelZ -= dx * velKick;
      k.recoilVelX += dz * velKick;
      // Gyroscopic cross-axis precession coupling for heavy spinning steel
      k.recoilVelX += dx * velKick * 0.34;
      k.recoilVelZ += dz * velKick * 0.34;
    };

    if (side === 'player' || side === 'both') {
      applyKick(this.playerKinematics, -1);
    }
    if (side === 'opponent' || side === 'both') {
      applyKick(this.opponentKinematics, 1);
    }

    // Fast-damped directional camera impulse & arena wall shudder
    if (!this.reducedMotion) {
      const camKick = (0.14 + clampedInt * 0.18) * critMult;
      this.camRecoilVel.x += (ix * 0.65 + (Math.random() - 0.5) * 0.7) * camKick * 3.8;
      this.camRecoilVel.y -= (0.35 + clampedInt * 0.35) * critMult * 2.4;
      this.camRecoilVel.z += (iz * 0.65 + (Math.random() - 0.5) * 0.7) * camKick * 3.8;
      this.triggerWallTremor(clampedInt * 0.75, ix, iz, isCritical);
    }
  }

  public triggerWallTremor(
    intensity: number,
    nx = 1,
    nz = 0,
    isCritical = false
  ): void {
    if (this.initFailed || this.reducedMotion) return;
    const len = Math.hypot(nx, nz);
    const dx = len > 0.001 ? nx / len : 1;
    const dz = len > 0.001 ? nz / len : 0;
    const amp = Math.min(1.5, Math.max(0.2, intensity)) * (isCritical ? 1.35 : 1.0);
    this.wallTremorVel.x -= dx * amp * 0.52;
    this.wallTremorVel.y -= amp * 0.36;
    this.wallTremorVel.z -= dz * amp * 0.52;
  }

  private triggerCameraDip(strength: number): void {
    if (this.reducedMotion) return;
    this.camDipVelY -= Math.min(1.8, Math.max(0.25, strength)) * 1.15;
  }

  private worldToScuffCanvas(wx: number, wz: number): { px: number; py: number } {
    const span = ARENA_DISH_RADIUS * 2;
    return {
      px: (wx / span + 0.5) * SCUFF_RES,
      py: (wz / span + 0.5) * SCUFF_RES,
    };
  }

  private spawnThermalScorch(
    x: number,
    z: number,
    tx: number,
    tz: number,
    intensity: number,
    isCritical: boolean,
    isBurst: boolean
  ): void {
    if (this.initFailed || this.thermalScorches.length === 0) return;
    const slot = this.thermalScorches[this.thermalScorchCursor];
    this.thermalScorchCursor = (this.thermalScorchCursor + 1) % MAX_THERMAL_SCORCHES;

    const len = Math.hypot(tx, tz);
    const dirX = len > 0.001 ? tx / len : 1;
    const dirZ = len > 0.001 ? tz / len : 0;

    // Build orthonormal basis aligned with dish normal N and tangent direction T
    _dirVec.set(-2 * ARENA_DISH_CURVATURE * x, 1, -2 * ARENA_DISH_CURVATURE * z).normalize();
    _pos.set(dirX, 0, dirZ);
    // Project tangent onto dish plane perpendicular to normal N
    const dotTN = _pos.dot(_dirVec);
    _pos.addScaledVector(_dirVec, -dotTN);
    if (_pos.lengthSq() < 0.0001) {
      _pos.set(1, 0, 0);
    } else {
      _pos.normalize();
    }
    _targetLookAt.crossVectors(_pos, _dirVec).normalize(); // bitangent B = T x N
    // Reuse _mat4 to construct rotation from basis (X=T, Y=N, Z=B)
    _mat4.makeBasis(_pos, _dirVec, _targetLookAt);
    slot.mesh.quaternion.setFromRotationMatrix(_mat4);

    const floorY = arenaFloorHeight(x, z);
    slot.mesh.position.set(x, floorY + 0.008, z);

    const scaleLen = (0.55 + Math.min(1.4, intensity) * 0.55) * (isBurst ? 1.55 : isCritical ? 1.28 : 1.0);
    const scaleWid = (0.62 + Math.min(1.2, intensity) * 0.42) * (isBurst ? 1.5 : 1.0);
    slot.mesh.scale.set(scaleLen, 1, scaleWid);

    const isIce = this.currentArenaId === 'frozen';
    slot.hotHex = isIce ? 0xe0f2fe : isCritical || isBurst ? 0xfff0b3 : 0xff9a3c;
    slot.coolHex = isIce ? 0x38bdf8 : 0xb91c1c;
    slot.maxLife = isBurst ? 1.45 : isCritical ? 1.15 : 0.85;
    slot.life = slot.maxLife;
    slot.baseOpacity = Math.min(0.95, 0.42 + intensity * 0.34) * (isIce ? 0.72 : 1.0);
    slot.active = true;
    slot.mesh.visible = true;

    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(slot.hotHex);
    mat.opacity = slot.baseOpacity;
  }

  public recordLaunchScuff(x: number, z: number, vx: number, vz: number): void {
    if (this.initFailed || !this.scuffCtx) return;
    if (Math.hypot(x, z) > ARENA_DISH_RADIUS - 0.08) return;

    const ctx = this.scuffCtx;
    const { px, py } = this.worldToScuffCanvas(x, z);
    const spd = Math.hypot(vx, vz);
    const dirX = spd > 0.05 ? vx / spd : -x / (Math.hypot(x, z) || 1);
    const dirZ = spd > 0.05 ? vz / spd : -z / (Math.hypot(x, z) || 1);
    const pxPerM = SCUFF_RES / (ARENA_DISH_RADIUS * 2);
    const skidLen = Math.min(0.55, 0.22 + spd * 0.035) * pxPerM;
    const ringR = 0.14 * pxPerM;

    const isIce = this.currentArenaId === 'frozen';
    const isTemple = this.currentArenaId === 'temple';
    const isFlame = this.currentArenaId === 'volcanic';

    ctx.save();
    // Contact ring from metal tip slam
    ctx.strokeStyle = isIce
      ? 'rgba(224, 242, 254, 0.42)'
      : isTemple
        ? 'rgba(214, 198, 172, 0.36)'
        : 'rgba(15, 23, 42, 0.42)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright metal bite mark
    ctx.strokeStyle = isIce
      ? 'rgba(186, 230, 253, 0.55)'
      : isFlame
        ? 'rgba(251, 146, 60, 0.32)'
        : 'rgba(203, 213, 225, 0.26)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(px, py, ringR * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    // Short entry skid gouge along launch vector
    const endX = px + dirX * skidLen;
    const endY = py + dirZ * skidLen;
    const ctrlX = px + dirX * skidLen * 0.52 - dirZ * 6;
    const ctrlY = py + dirZ * skidLen * 0.52 + dirX * 6;

    ctx.strokeStyle = isIce
      ? 'rgba(240, 249, 255, 0.48)'
      : isTemple
        ? 'rgba(28, 25, 23, 0.38)'
        : 'rgba(10, 15, 28, 0.46)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();

    ctx.strokeStyle = isIce
      ? 'rgba(125, 211, 252, 0.38)'
      : isFlame
        ? 'rgba(249, 115, 22, 0.3)'
        : 'rgba(226, 232, 240, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
    ctx.stroke();
    ctx.restore();

    this.scuffHasMarks = true;
    this.scuffDirty = true;
    if (this.scuffTex) {
      this.scuffTex.needsUpdate = true;
      this.scuffDirty = false;
      this.scuffUploadAccum = 0;
    }
  }

  public recordImpactScuff(
    x: number,
    z: number,
    tangentX: number,
    tangentZ: number,
    intensity: number,
    isCritical = false,
    isBurst = false
  ): void {
    if (this.initFailed || !this.scuffCtx) return;
    if (Math.hypot(x, z) > ARENA_DISH_RADIUS - 0.06) return;

    const ctx = this.scuffCtx;
    const { px, py } = this.worldToScuffCanvas(x, z);
    const pxPerM = SCUFF_RES / (ARENA_DISH_RADIUS * 2);
    const clampedInt = Math.max(0.3, Math.min(1.6, intensity));
    const len = Math.hypot(tangentX, tangentZ);
    const tx = len > 0.001 ? tangentX / len : Math.cos(Math.random() * Math.PI * 2);
    const tz = len > 0.001 ? tangentZ / len : Math.sin(Math.random() * Math.PI * 2);

    const isIce = this.currentArenaId === 'frozen';
    const isTemple = this.currentArenaId === 'temple';

    // 1. Charred thermal scorch smudge (or frosted ice fracture cloud)
    const scorchR = (0.16 + clampedInt * 0.14) * (isBurst ? 1.55 : isCritical ? 1.25 : 1.0) * pxPerM;
    ctx.save();
    const grad = ctx.createRadialGradient(px, py, 1, px, py, scorchR);
    if (isIce) {
      grad.addColorStop(0, `rgba(224, 242, 254, ${0.38 + clampedInt * 0.16})`);
      grad.addColorStop(0.55, 'rgba(125, 211, 252, 0.22)');
      grad.addColorStop(1, 'rgba(125, 211, 252, 0)');
    } else if (isTemple) {
      grad.addColorStop(0, `rgba(28, 25, 23, ${0.42 + clampedInt * 0.18})`);
      grad.addColorStop(0.55, 'rgba(68, 64, 60, 0.22)');
      grad.addColorStop(1, 'rgba(28, 25, 23, 0)');
    } else {
      grad.addColorStop(0, `rgba(8, 10, 18, ${0.46 + clampedInt * 0.2})`);
      grad.addColorStop(0.48, `rgba(120, 42, 12, ${isCritical || isBurst ? 0.28 : 0.14})`);
      grad.addColorStop(1, 'rgba(8, 10, 18, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, scorchR, 0, Math.PI * 2);
    ctx.fill();

    // 2. Curved metallic scratch gouges along the contact tangent
    const scratchCount = isBurst ? 5 : isCritical ? 4 : 2;
    const baseLen = (0.28 + clampedInt * 0.24) * (isBurst ? 1.35 : 1.0) * pxPerM;
    ctx.lineCap = 'round';
    for (let i = 0; i < scratchCount; i++) {
      const spread = (i - (scratchCount - 1) * 0.5) * 7.5 + (Math.random() - 0.5) * 4;
      const sx = px - tz * spread;
      const sy = py + tx * spread;
      const segLen = baseLen * (0.65 + Math.random() * 0.55);
      const sx0 = sx - tx * segLen * 0.45;
      const sy0 = sy - tz * segLen * 0.45;
      const sx1 = sx + tx * segLen * 0.55;
      const sy1 = sy + tz * segLen * 0.55;
      const curve = (Math.random() - 0.5) * 14;
      const cxp = sx - tz * curve;
      const cyp = sy + tx * curve;

      // Dark metal/charred groove
      ctx.strokeStyle = isIce
        ? 'rgba(186, 230, 253, 0.58)'
        : 'rgba(9, 13, 24, 0.56)';
      ctx.lineWidth = (isCritical || isBurst ? 2.6 : 1.9) + Math.random() * 0.9;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.quadraticCurveTo(cxp, cyp, sx1, sy1);
      ctx.stroke();

      // Bright exposed metal scrape edge
      ctx.strokeStyle = isIce
        ? 'rgba(255, 255, 255, 0.72)'
        : isCritical || isBurst
          ? 'rgba(251, 191, 36, 0.42)'
          : 'rgba(226, 232, 240, 0.36)';
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.moveTo(sx0 - tz * 1.2, sy0 + tx * 1.2);
      ctx.quadraticCurveTo(cxp - tz * 1.2, cyp + tx * 1.2, sx1 - tz * 1.2, sy1 + tx * 1.2);
      ctx.stroke();
    }
    ctx.restore();

    this.scuffHasMarks = true;
    this.scuffDirty = true;
    if (this.scuffTex) {
      this.scuffTex.needsUpdate = true;
      this.scuffDirty = false;
      this.scuffUploadAccum = 0;
    }

    if (clampedInt >= 0.45 || isCritical || isBurst) {
      this.spawnThermalScorch(x, z, tx, tz, clampedInt, isCritical, isBurst);
    }
  }

  private recordScrapeMark(x: number, z: number, vx: number, vz: number, tiltMag: number): void {
    if (this.initFailed || !this.scuffCtx) return;
    if (Math.hypot(x, z) > ARENA_DISH_RADIUS - 0.12) return;
    const spd = Math.hypot(vx, vz);
    if (spd < 0.75) return;

    const ctx = this.scuffCtx;
    const { px, py } = this.worldToScuffCanvas(x, z);
    const pxPerM = SCUFF_RES / (ARENA_DISH_RADIUS * 2);
    const tx = vx / spd;
    const tz = vz / spd;
    const rimOffset = 0.24 * pxPerM;
    const side = Math.random() < 0.5 ? 1 : -1;
    const sx = px - tz * rimOffset * side;
    const sy = py + tx * rimOffset * side;
    const lenPx = Math.min(26, 8 + spd * 3.2);
    const alpha = Math.min(0.32, 0.1 + tiltMag * 0.55);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle =
      this.currentArenaId === 'frozen'
        ? `rgba(224, 242, 254, ${alpha})`
        : `rgba(15, 23, 42, ${alpha})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx - tx * lenPx * 0.5, sy - tz * lenPx * 0.5);
    ctx.lineTo(sx + tx * lenPx * 0.5, sy + tz * lenPx * 0.5);
    ctx.stroke();

    ctx.strokeStyle =
      this.currentArenaId === 'frozen'
        ? `rgba(255, 255, 255, ${alpha * 0.9})`
        : `rgba(203, 213, 225, ${alpha * 0.65})`;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(sx - tx * lenPx * 0.45 + 1, sy - tz * lenPx * 0.45 + 1);
    ctx.lineTo(sx + tx * lenPx * 0.45 + 1, sy + tz * lenPx * 0.45 + 1);
    ctx.stroke();
    ctx.restore();

    this.scuffHasMarks = true;
    this.scuffDirty = true;
  }

  public recordHeatmapImpact(worldX: number, worldZ: number, intensity: number): void {
    if (this.initFailed) return;
    const clampedInt = Math.max(0.25, Math.min(2.2, intensity));
    const u = worldX / (ARENA_DISH_RADIUS * 2) + 0.5;
    const v = worldZ / (ARENA_DISH_RADIUS * 2) + 0.5;
    const gx = Math.round(u * (HEATMAP_RES - 1));
    const gz = Math.round(v * (HEATMAP_RES - 1));
    const splatRadius = 5;
    const sigmaSq = 5.2;

    const minX = Math.max(0, gx - splatRadius);
    const maxX = Math.min(HEATMAP_RES - 1, gx + splatRadius);
    const minZ = Math.max(0, gz - splatRadius);
    const maxZ = Math.min(HEATMAP_RES - 1, gz + splatRadius);

    for (let z = minZ; z <= maxZ; z++) {
      const dz = z - gz;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - gx;
        const dSq = dx * dx + dz * dz;
        if (dSq > splatRadius * splatRadius) continue;
        const weight = Math.exp(-dSq / sigmaSq) * clampedInt * 0.65;
        const idx = z * HEATMAP_RES + x;
        this.heatmapGrid[idx] = Math.min(3.0, this.heatmapGrid[idx] + weight);
      }
    }

    this.heatmapImpacts += 1;
    this.heatmapDirty = true;
  }

  private classifyHeatmapZone(gx: number, gz: number): string {
    const wx = (gx / (HEATMAP_RES - 1) - 0.5) * (ARENA_DISH_RADIUS * 2);
    const wz = (gz / (HEATMAP_RES - 1) - 0.5) * (ARENA_DISH_RADIUS * 2);
    const r = Math.hypot(wx, wz);
    if (r < 1.15) return 'Center Pocket';
    if (r < 2.75) return 'Mid Slope';
    const gateAngles = [Math.PI / 3, Math.PI, -Math.PI / 3];
    const angle = Math.atan2(wz, wx);
    for (const ga of gateAngles) {
      let diff = Math.abs(angle - ga);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.34) return 'Exit Gate';
    }
    return 'Outer Rim';
  }

  private updateHeatmap(dt: number, sim: BattleSimulationState | null): void {
    const activeBattle =
      this.cameraMode === 'battle' &&
      Boolean(sim && (sim.phase === 'Combat' || sim.phase === 'Critical'));

    if (this.heatmapMesh) {
      this.heatmapMesh.visible = this.showDiagnostics && this.cameraMode === 'battle';
    }
    if (!this.showDiagnostics && !this.heatmapDirty) return;

    let maxVal = 0;
    let maxGx = Math.floor(HEATMAP_RES / 2);
    let maxGz = Math.floor(HEATMAP_RES / 2);
    const decayFactor = activeBattle ? Math.exp(-HEATMAP_DECAY_RATE * dt) : 1.0;

    if (activeBattle && this.heatmapImpacts > 0) {
      for (let i = 0; i < this.heatmapGrid.length; i++) {
        const nextVal = this.heatmapGrid[i] * decayFactor;
        this.heatmapGrid[i] = nextVal < 0.004 ? 0 : nextVal;
      }
      this.heatmapDirty = true;
    }

    if (!this.heatmapDirty) return;
    this.heatmapUploadAccum += dt;
    if (this.heatmapUploadAccum < 0.065) return;
    this.heatmapUploadAccum = 0;

    for (let z = 0; z < HEATMAP_RES; z++) {
      for (let x = 0; x < HEATMAP_RES; x++) {
        const idx = z * HEATMAP_RES + x;
        const val = this.heatmapGrid[idx];
        if (val > maxVal) {
          maxVal = val;
          maxGx = x;
          maxGz = z;
        }
        const pIdx = idx * 4;
        const norm = Math.min(1, val / 1.8);
        if (norm < 0.015) {
          this.heatmapPixels[pIdx] = 0;
          this.heatmapPixels[pIdx + 1] = 0;
          this.heatmapPixels[pIdx + 2] = 0;
          this.heatmapPixels[pIdx + 3] = 0;
          continue;
        }
        let r = 0;
        let g = 0;
        let b = 0;
        if (norm < 0.35) {
          const t = norm / 0.35;
          r = Math.round(14 + t * 20);
          g = Math.round(165 + t * 50);
          b = Math.round(233 - t * 30);
        } else if (norm < 0.7) {
          const t = (norm - 0.35) / 0.35;
          r = Math.round(34 + t * 216);
          g = Math.round(215 - t * 15);
          b = Math.round(203 - t * 182);
        } else {
          const t = (norm - 0.7) / 0.3;
          r = Math.round(250 - t * 6);
          g = Math.round(200 - t * 137);
          b = Math.round(21 + t * 73);
        }
        this.heatmapPixels[pIdx] = r;
        this.heatmapPixels[pIdx + 1] = g;
        this.heatmapPixels[pIdx + 2] = b;
        this.heatmapPixels[pIdx + 3] = Math.round(Math.min(220, 42 + norm * 178));
      }
    }

    this.heatmapPeakIntensity = Number(Math.min(100, (maxVal / 1.8) * 100).toFixed(0));
    this.heatmapPeakZone = maxVal > 0.03 ? this.classifyHeatmapZone(maxGx, maxGz) : 'Center Pocket';
    this.heatmapTex.needsUpdate = true;
    this.heatmapDirty = false;
  }

  private disposeComposer(): void {
    if (this.gtaoPass) {
      this.gtaoPass.dispose();
      this.gtaoPass = null;
    }
    if (this.bloomPass) {
      this.bloomPass.dispose();
      this.bloomPass = null;
    }
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
  }

  private syncComposerState(width?: number, height?: number): void {
    if (this.initFailed || !this.renderer) return;
    const shouldUseComposer = !this.isSoftwareGl && this.currentQuality === 'High';
    if (!shouldUseComposer) {
      this.disposeComposer();
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, width ?? (rect.width || window.innerWidth));
    const h = Math.max(1, height ?? (rect.height || window.innerHeight));
    const dpr = this.renderer.getPixelRatio();

    if (!this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));

      this.gtaoPass = new OpaqueOnlyGTAOPass(
        this.scene,
        this.camera,
        Math.max(1, Math.round(w * dpr)),
        Math.max(1, Math.round(h * dpr))
      );
      this.gtaoPass.output = GTAOPass.OUTPUT.Default;
      this.gtaoPass.blendIntensity = 0.76;
      this.gtaoPass.updateGtaoMaterial({
        radius: 0.36,
        distanceExponent: 1.35,
        thickness: 0.65,
        distanceFallOff: 0.85,
        scale: 1.15,
        samples: 16,
      });
      this.gtaoPass.updatePdMaterial({
        lumaPhi: 10,
        depthPhi: 2.0,
        normalPhi: 3.0,
        radius: 4,
        rings: 2,
        samples: 12,
      });
      this.composer.addPass(this.gtaoPass);

      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.5, 0.9);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloomPass?.resolution.set(w, h);
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    if (preset === 'LowAction') {
      this.cameraPitch = 0.28;
      this.cameraZoom = 0.85;
    } else if (preset === 'TopDown') {
      this.cameraPitch = 1.24;
      this.cameraZoom = 1.15;
    } else {
      this.cameraPitch = 0.62;
      this.cameraZoom = 1.0;
    }
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }

  public setLastSimMetrics(simStepMs: number, droppedSteps: number): void {
    this.lastSimStepMs = simStepMs;
    this.lastDroppedSteps = droppedSteps;
  }

  public getParticleBudget(): number {
    return this.currentQuality === 'Low' ? 140 : this.currentQuality === 'Medium' ? 320 : MAX_PARTICLES;
  }

  public applyQuality(quality: GraphicsQuality, isAutoAdjustment = false): void {
    if (this.initFailed || !this.renderer) return;
    if (!isAutoAdjustment) {
      this.userQualityCap = quality;
      this.qualityAutoAdjusted = false;
      this.highFpsStreak = 0;
    } else {
      this.qualityAutoAdjusted = quality !== this.userQualityCap;
    }
    this.currentQuality = quality;
    const isTouchDevice =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    const maxDprHigh = isTouchDevice ? 1.75 : 2.0;
    const maxDprMed = isTouchDevice ? 1.35 : 1.5;
    const dpr = this.isSoftwareGl
      ? 1
      : quality === 'Low'
        ? 1
        : quality === 'Medium'
          ? Math.min(window.devicePixelRatio || 1, maxDprMed)
          : Math.min(window.devicePixelRatio || 1, maxDprHigh);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && quality !== 'Low';
    if (this.keyLight?.shadow) {
      const targetShadowRes = quality === 'High' && !this.isSoftwareGl ? 2048 : 1024;
      if (this.keyLight.shadow.mapSize.x !== targetShadowRes) {
        this.keyLight.shadow.mapSize.set(targetShadowRes, targetShadowRes);
        this.keyLight.shadow.map?.dispose();
        this.keyLight.shadow.map = null;
        this.keyLight.shadow.needsUpdate = true;
      }
    }
    if (this.scene && this.stadiumGroup) {
      this.syncComposerState();
    }
  }

  public setCameraSensitivity(sens: number): void {
    this.cameraSensitivity = Math.max(0.3, Math.min(2.5, sens));
  }

  public setWorkshopExploded(exploded: boolean): void {
    this.workshopExploded = exploded;
  }

  public setWorkshopSelectedCategory(category: ComponentCategory): void {
    this.workshopSelectedCategory = category;
  }

  public setOnSelectWorkshopPart(cb?: (category: ComponentCategory) => void): void {
    this.onSelectWorkshopPart = cb;
  }

  public setClashCameraEnabled(enabled: boolean): void {
    this.clashCamEnabled = enabled;
    if (!enabled) {
      this.clashCamTimer = 0;
    }
  }

  public projectWorldToScreen(x: number, y: number, z: number): ProjectedScreenPoint {
    if (this.initFailed || !this.camera) {
      return { xPct: 50, yPct: 45, visible: false };
    }
    _projVec.set(x, y, z).project(this.camera);
    const inFront = _projVec.z >= -1 && _projVec.z <= 1;
    const xPct = Math.max(8, Math.min(92, (_projVec.x * 0.5 + 0.5) * 100));
    const yPct = Math.max(12, Math.min(84, (-_projVec.y * 0.5 + 0.5) * 100));
    return { xPct, yPct, visible: inFront };
  }

  public triggerClashCameraImpulse(
    x: number,
    y: number,
    z: number,
    strength = 1.0
  ): void {
    if (
      this.initFailed ||
      this.reducedMotion ||
      !this.clashCamEnabled ||
      this.cameraMode !== 'battle'
    ) {
      return;
    }
    this.clashCamFocus.set(x, y, z);
    this.clashCamDuration = 0.32;
    this.clashCamTimer = this.clashCamDuration;
    this.clashCamStrength = Math.max(0.4, Math.min(1.25, strength));
  }

  public setCameraMode(mode: SceneCameraMode, initialYaw?: number): void {
    this.cameraMode = mode;
    this.stableCamPosValid = false;
    this.burstShakeTimer = 0;
    this.burstShakeTriggeredForFinish = false;
    if (mode !== 'workshop') {
      this.workshopExploded = false;
      this.workshopExplodeBlend = 0;
    }
    this.resetCombatKinematics();
    if (mode === 'title' || mode === 'workshop') {
      this.clearFloorScuffs();
    }
    if (typeof initialYaw === 'number' && Number.isFinite(initialYaw)) {
      this.cameraYaw = initialYaw;
    }
    if (mode === 'battle') {
      this.setCameraPreset(this.cameraPreset);
    } else if (mode === 'workshop') {
      this.cameraPitch = 0.36;
      this.cameraZoom = 0.92;
    } else if (mode === 'title') {
      this.cameraPitch = 0.48;
      this.cameraZoom = 1.0;
    }
  }

  public hasReplayClip(): boolean {
    return Boolean(this.replayClip && this.replayFrames.length >= 2);
  }

  public setReplayClip(
    clip: MatchHighlightClip | null,
    options?: {
      speed?: number;
      onTelemetry?: (telemetry: ReplayHudTelemetry) => void;
      onFirstPassComplete?: () => void;
      onImpactSfx?: (kind: 'clash' | 'burst', intensity: number) => void;
    }
  ): void {
    if (!clip || clip.frames.length < 2) {
      this.replayClip = null;
      this.replayFrames = [];
      this.replayTimeOffset = 0;
      this.replayClimaxHoldTimer = 0;
      this.replayPassCount = 0;
      this.replayFirstPassNotified = false;
      this.replayLastClashRawIdx = -1;
      this.replayBurstTriggeredInPass = false;
      this.replayLastBrokenPlayer.clear();
      this.replayLastBrokenOpponent.clear();
      this.replayLastAngleIdx = -1;
      this.onReplayTelemetry = undefined;
      this.onReplayFirstPassComplete = undefined;
      this.onReplayImpactSfx = undefined;
      return;
    }

    const frames = selectReplayWindowFrames(clip, REPLAY_WINDOW_SEC);
    const lastFrame = frames[frames.length - 1];
    const fallbackX = clip.winnerSide === 'player' ? lastFrame.ox : lastFrame.px;
    const fallbackZ = clip.winnerSide === 'player' ? lastFrame.oz : lastFrame.pz;
    const rawCx = lastFrame.clashX ?? fallbackX;
    const rawCz = lastFrame.clashZ ?? fallbackZ;
    const rawCr = Math.hypot(rawCx, rawCz);
    const clampScale = rawCr > 3.2 && rawCr > 0.001 ? 3.2 / rawCr : 1;

    this.replayClip = clip;
    this.replayFrames = frames;
    this.replayClimaxX = rawCx * clampScale;
    this.replayClimaxZ = rawCz * clampScale;
    this.replayBaseAngle = rawCr > 0.25 ? Math.atan2(rawCz, rawCx) : 0.85;
    this.replayTimeOffset = 0;
    this.replayClimaxHoldTimer = 0;
    this.replaySpeed = options?.speed ?? REPLAY_SLOWMO_SPEED;
    this.replayPassCount = 0;
    this.replayFirstPassNotified = false;
    this.replayLastClashRawIdx = -1;
    this.replayBurstTriggeredInPass = false;
    this.replayLastBrokenPlayer.clear();
    this.replayLastBrokenOpponent.clear();
    this.replayLastAngleIdx = -1;
    this.replayLastTelemetryEmitMs = 0;
    this.onReplayTelemetry = options?.onTelemetry;
    this.onReplayFirstPassComplete = options?.onFirstPassComplete;
    this.onReplayImpactSfx = options?.onImpactSfx;

    this.clearEjectedParts();
    this.clearFloorScuffs();
    this.setArena(clip.arenaId);
    this.setCameraMode('replay');
  }

  public triggerBurstShake(intensity = 1.0, duration = 0.42): void {
    this.burstShakeTriggeredForFinish = true;
    if (this.reducedMotion) return;
    this.burstShakeDuration = Math.max(0.2, duration);
    this.burstShakeTimer = this.burstShakeDuration;
    this.burstShakeStrength = Math.max(0.4, Math.min(1.5, intensity));
    this.burstShakePhase = 0;
  }

  public setArena(arenaId: ArenaId): void {
    if (this.initFailed) return;
    if (this.currentArenaId === arenaId && this.stadiumGroup) return;
    this.currentArenaId = arenaId;
    this.clearEjectedParts();
    this.buildArenaStadium(arenaId);
  }

  public setBattleEnvironment(config?: BattleEnvironmentConfig | null): void {
    if (this.initFailed) return;
    const nextMode: MatchMode = config?.matchMode ?? 'Training';
    const nextMutators = sanitizeBattleMutators(config?.mutators ?? DEFAULT_BATTLE_MUTATORS);
    const nextWave = Math.max(1, Math.round(config?.survivalWave ?? 1));

    const mutatorsUnchanged =
      nextMutators.noAbilities === this.battleEnv.mutators.noAbilities &&
      nextMutators.doubleGravity === this.battleEnv.mutators.doubleGravity &&
      nextMutators.turboSpin === this.battleEnv.mutators.turboSpin &&
      nextMutators.ringOutOnly === this.battleEnv.mutators.ringOutOnly &&
      nextMutators.doubleHazards === this.battleEnv.mutators.doubleHazards;

    const sameEnv =
      this.battleEnv.matchMode === nextMode &&
      this.battleEnv.survivalWave === nextWave &&
      mutatorsUnchanged;

    this.battleEnv = {
      matchMode: nextMode,
      mutators: nextMutators,
      survivalWave: nextWave,
    };
    this.criticalBlend = 0;
    this.lastObservedPhase = null;

    if (!sameEnv || !this.modeReactiveGroup) {
      this.rebuildModeReactiveElements();
    }
  }

  public setWeather(weather: WeatherType): void {
    if (this.initFailed) return;
    this.currentWeather = weather;
    const def = getWeatherDefinition(weather);
    const mat = this.weatherParticleMesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(def.particleHex);
    mat.opacity =
      weather === 'LightRain'
        ? 0.52
        : weather === 'DustStorm'
          ? 0.44
          : weather === 'GaleWind'
            ? 0.42
            : 0;
    this.weatherParticleMesh.visible = weather !== 'Clear';

    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      const wp = this.weatherParticles[i];
      if (!wp) continue;
      wp.x = (Math.random() - 0.5) * 14;
      wp.y = 0.25 + Math.random() * 6.4;
      wp.z = (Math.random() - 0.5) * 14;
      wp.phase = Math.random() * Math.PI * 2;
      if (weather === 'LightRain') {
        wp.vx = -0.8 + (Math.random() - 0.5) * 0.35;
        wp.vy = -(9.5 + Math.random() * 3.5);
        wp.vz = 0.45 + (Math.random() - 0.5) * 0.25;
        wp.length = 0.28 + Math.random() * 0.18;
        wp.thickness = 0.65;
      } else if (weather === 'DustStorm') {
        wp.vx = 2.6 + Math.random() * 2.2;
        wp.vy = -0.25 + (Math.random() - 0.5) * 0.45;
        wp.vz = 1.2 + (Math.random() - 0.5) * 1.4;
        wp.length = 0.045 + Math.random() * 0.045;
        wp.thickness = 1.65;
      } else if (weather === 'GaleWind') {
        wp.vx = 6.2 + Math.random() * 3.4;
        wp.vy = -0.35 + (Math.random() - 0.5) * 0.3;
        wp.vz = 2.4 + (Math.random() - 0.5) * 1.2;
        wp.length = 0.45 + Math.random() * 0.32;
        wp.thickness = 0.72;
      }
    }
  }

  public setVictoryEmotes(
    playerEmote: VictoryEmoteId = 'apex_flare',
    opponentEmote: VictoryEmoteId = 'apex_flare'
  ): void {
    this.playerVictoryEmote = playerEmote;
    this.opponentVictoryEmote = opponentEmote;
  }

  public previewVictoryEmote(emote: VictoryEmoteId): void {
    this.playerVictoryEmote = emote;
    this.workshopEmotePreviewId = emote;
    this.workshopEmotePreviewTimer = 2.6;
    this.victoryEmoteTime = 0;
    this.victoryEmoteFxCooldown = 0;
  }

  public clearEjectedParts(): void {
    for (const slot of this.ejectedParts) {
      this.scene.remove(slot.mesh);
      disposeObject3D(slot.mesh);
    }
    this.ejectedParts = [];
    let debrisCleared = false;
    for (let i = 0; i < MAX_DEBRIS_PARTICLES; i++) {
      const dp = this.debrisParticles[i];
      if (dp && dp.active) {
        dp.active = false;
        debrisCleared = true;
        _pos.set(0, -100, 0);
        _scale.setScalar(0);
        _mat4.compose(_pos, _quat, _scale);
        this.debrisParticleMesh.setMatrixAt(i, _mat4);
      }
    }
    if (debrisCleared) {
      this.debrisParticleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public spawnPartEjection(
    actor: 'player' | 'opponent',
    partKeys: PartDurabilityKey[],
    impulseVx = 0,
    impulseVz = 0
  ): void {
    if (this.initFailed || !this.scene || partKeys.length === 0) return;
    const rig = actor === 'player' ? this.playerRig : this.opponentRig;
    if (!rig) return;

    const motionScale = this.reducedMotion ? 0.55 : 1.0;
    const keysToSpawn = this.reducedMotion ? partKeys.slice(0, 2) : partKeys;
    const baseAngle =
      Math.hypot(impulseVx, impulseVz) > 0.25
        ? Math.atan2(impulseVz, impulseVx)
        : Math.random() * Math.PI * 2;

    keysToSpawn.forEach((partKey, idx) => {
      const fragment = createDetachedPartFragment(rig, partKey);
      if (!fragment) return;

      while (this.ejectedParts.length >= MAX_EJECTED_PARTS) {
        const oldest = this.ejectedParts.shift();
        if (oldest) {
          this.scene.remove(oldest.mesh);
          disposeObject3D(oldest.mesh);
        }
      }

      fragment.updateMatrixWorld(true);
      _partBox.setFromObject(fragment);
      _partBox.getSize(_dirVec);
      const partDiagonal = Math.hypot(_dirVec.x, _dirVec.y, _dirVec.z);
      const partSize = Math.max(0.45, Math.min(1.9, partDiagonal * 1.65));

      let partColorHex = rig.baseEmissiveHex;
      fragment.traverse((child) => {
        if (partColorHex !== rig.baseEmissiveHex) return;
        const mat = (child as THREE.Mesh).material;
        if (mat && !Array.isArray(mat) && 'color' in mat && mat.color instanceof THREE.Color) {
          partColorHex = mat.color.getHex();
        }
      });

      const spread =
        keysToSpawn.length > 1
          ? (idx / keysToSpawn.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.45
          : (Math.random() - 0.5) * 1.1;
      const launchAngle = baseAngle + spread;
      const launchSpeed = (2.1 + Math.random() * 2.4) * motionScale;

      fragment.position.set(
        rig.root.position.x + Math.cos(launchAngle) * 0.14,
        rig.root.position.y + 0.16,
        rig.root.position.z + Math.sin(launchAngle) * 0.14
      );
      fragment.rotation.set(
        (Math.random() - 0.5) * 0.4,
        rig.spinGroup.rotation.y,
        (Math.random() - 0.5) * 0.4
      );
      this.scene.add(fragment);

      this.ejectedParts.push({
        mesh: fragment,
        vx: Math.cos(launchAngle) * launchSpeed + impulseVx * 0.35,
        vy: (2.4 + Math.random() * 2.1) * motionScale,
        vz: Math.sin(launchAngle) * launchSpeed + impulseVz * 0.35,
        rx: (Math.random() - 0.5) * 14 * motionScale,
        ry: (Math.random() - 0.5) * 18 * motionScale,
        rz: (Math.random() - 0.5) * 14 * motionScale,
        life: this.reducedMotion ? 2.1 : 4.2,
        maxLife: this.reducedMotion ? 2.1 : 4.2,
        baseScale: fragment.scale.clone(),
        partSize,
        colorHex: partColorHex,
        landingEmissionsLeft: 2,
        wasAirborne: true,
      });
    });
  }

  private emitDebrisLandingParticles(
    x: number,
    y: number,
    z: number,
    impactSpeed: number,
    partSize: number,
    partColorHex: number,
    isPrimaryImpact: boolean
  ): void {
    if (this.initFailed || this.debrisParticles.length === 0) return;
    const qualityMult =
      this.currentQuality === 'Low' ? 0.4 : this.currentQuality === 'Medium' ? 0.72 : 1.0;
    const motionMult = this.reducedMotion ? 0.45 : 1.0;
    const baseCount = (isPrimaryImpact ? 11 : 5) * (0.55 + partSize * 0.65);
    const count = Math.max(2, Math.round(baseCount * qualityMult * motionMult));

    for (let i = 0; i < count; i++) {
      const slot = this.debrisParticles[this.debrisParticleCursor];
      this.debrisParticleCursor = (this.debrisParticleCursor + 1) % MAX_DEBRIS_PARTICLES;

      const angle = Math.random() * Math.PI * 2;
      const spawnRad = (0.04 + Math.random() * 0.16) * partSize;
      const radialSpeed =
        (0.75 + Math.random() * 1.5) *
        (0.62 + Math.min(4.5, impactSpeed) * 0.22) *
        Math.sqrt(partSize) *
        (isPrimaryImpact ? 1.0 : 0.68);
      const liftSpeed =
        (0.75 + Math.random() * 1.35) *
        (0.7 + Math.min(4.5, impactSpeed) * 0.16) *
        (0.7 + partSize * 0.22) *
        (isPrimaryImpact ? 1.0 : 0.65);

      const paletteRoll = Math.random();
      const chipColor =
        paletteRoll < 0.45
          ? partColorHex
          : paletteRoll < 0.8
            ? 0x94a3b8
            : this.baseArenaFloorHex;

      slot.active = true;
      slot.x = x + Math.cos(angle) * spawnRad;
      slot.y = y + 0.02 + Math.random() * 0.04;
      slot.z = z + Math.sin(angle) * spawnRad;
      slot.vx = Math.cos(angle) * radialSpeed;
      slot.vy = liftSpeed;
      slot.vz = Math.sin(angle) * radialSpeed;
      slot.rx = Math.random() * Math.PI * 2;
      slot.ry = Math.random() * Math.PI * 2;
      slot.rz = Math.random() * Math.PI * 2;
      slot.vrx = (Math.random() - 0.5) * 16;
      slot.vry = (Math.random() - 0.5) * 16;
      slot.vrz = (Math.random() - 0.5) * 16;
      slot.maxLife =
        (isPrimaryImpact ? 1.15 : 0.78) +
        Math.random() * 0.65 +
        partSize * 0.26;
      slot.life = slot.maxLife;
      slot.baseSize =
        (0.45 + Math.random() * 0.85) * partSize * (isPrimaryImpact ? 1.0 : 0.72);
      slot.colorHex = chipColor;
    }

    if (isPrimaryImpact && impactSpeed > 1.35) {
      this.spawnBurstParticles(
        x,
        y + 0.02,
        z,
        Math.max(3, Math.round(4 + partSize * 4.5)),
        partColorHex,
        2.6 + partSize * 0.85,
        {
          gravity: 11.5,
          drag: 0.93,
          maxLife: 0.28,
          sizeMult: 0.65 + partSize * 0.35,
          kind: 'metal',
          heat: 1.25,
          bounces: 2,
        }
      );
    }
  }

  public setPlayerTopVisual(params: {
    equipped: EquippedComponents;
    element: ElementType;
    secondaryElement?: ElementType | null;
    evolutionStage: number;
    scaleMultiplier?: number;
    cosmetics?: CosmeticCustomization;
  }): void {
    this.clearEjectedParts();
    if (this.playerRig) {
      this.scene.remove(this.playerRig.root);
      disposeObject3D(this.playerRig.root);
    }
    this.playerRig = buildSpinningTopVisual({
      ...params,
      quality: this.currentQuality,
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });
    this.scene.add(this.playerRig.root);
    applyRigExplodeFactor(this.playerRig, this.cameraMode === 'workshop' ? this.workshopExplodeBlend : 0);
    const trailCol = params.cosmetics?.trailColor
      ? parseInt(params.cosmetics.trailColor.replace('#', ''), 16)
      : ELEMENTS[params.element].primaryHex;
    const safeTrailCol = Number.isFinite(trailCol) ? trailCol : ELEMENTS[params.element].primaryHex;
    (this.playerTrailRing.material as THREE.MeshBasicMaterial).color.setHex(safeTrailCol);
    (this.playerInnerTrailRing.material as THREE.MeshBasicMaterial).color.setHex(safeTrailCol);
    (this.playerGhostRing.material as THREE.MeshBasicMaterial).color.setHex(safeTrailCol);
    if (this.playerRibbon) {
      const mat = this.playerRibbon.material as unknown as THREE.ShaderMaterial;
      mat.uniforms.uColor.value.setHex(safeTrailCol);
    }
  }

  public setOpponentTopVisual(params: {
    equipped: EquippedComponents;
    element: ElementType;
    secondaryElement?: ElementType | null;
    evolutionStage: number;
    cosmetics?: CosmeticCustomization;
  }): void {
    if (this.opponentRig) {
      this.scene.remove(this.opponentRig.root);
      disposeObject3D(this.opponentRig.root);
    }
    this.opponentRig = buildSpinningTopVisual({
      ...params,
      quality: this.currentQuality,
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });
    this.scene.add(this.opponentRig.root);
    const trailCol = params.cosmetics?.trailColor
      ? parseInt(params.cosmetics.trailColor.replace('#', ''), 16)
      : ELEMENTS[params.element].primaryHex;
    const safeTrailCol = Number.isFinite(trailCol) ? trailCol : ELEMENTS[params.element].primaryHex;
    (this.opponentTrailRing.material as THREE.MeshBasicMaterial).color.setHex(safeTrailCol);
    (this.opponentInnerTrailRing.material as THREE.MeshBasicMaterial).color.setHex(safeTrailCol);
    (this.opponentGhostRing.material as THREE.MeshBasicMaterial).color.setHex(safeTrailCol);
    if (this.opponentRibbon) {
      const mat = this.opponentRibbon.material as unknown as THREE.ShaderMaterial;
      mat.uniforms.uColor.value.setHex(safeTrailCol);
    }
  }

  private spectatorMode = false;

  public setSpectatorMode(enabled: boolean): void {
    this.spectatorMode = enabled;
    if (enabled) {
      this.aimGroup.visible = false;
    }
  }

  public triggerPerfectLaunchEffects(x: number, y: number, z: number): void {
    this.spawnBurstParticles(x, y, z, 36, 0xfacc15, 6.2, {
      gravity: 6.5,
      maxLife: 0.42,
      sizeMult: 1.35,
    });
    this.spawnShockwave(x, y, z, 0xfacc15, 3.8, 0.34);
    this.clashLight.position.set(x, y + 0.55, z);
    this.clashLight.color.setHex(0xfde047);
    this.clashLightIntensity = 6.4;
    this.clashLight.intensity = this.clashLightIntensity;
    this.flashColorHex = 0xfacc15;
    this.flashMaxDuration = 0.24;
    this.flashTimer = 0.24;
    this.flashPeakIntensity = 0.9;
  }

  private emitSparkParticle(params: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    maxLife: number;
    size: number;
    colorHex: number;
    gravity: number;
    drag: number;
    kind: number;
    heat: number;
    bouncesLeft: number;
    forkDone?: boolean;
  }): void {
    if (this.initFailed || this.particles.length === 0) return;
    const budget = this.getParticleBudget();
    const slot = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % budget;

    slot.active = true;
    slot.x = params.x;
    slot.y = params.y;
    slot.z = params.z;
    slot.vx = params.vx;
    slot.vy = params.vy;
    slot.vz = params.vz;
    slot.maxLife = params.maxLife;
    slot.life = params.maxLife;
    slot.size = params.size;
    slot.colorHex = params.colorHex;
    slot.gravity = params.gravity;
    slot.drag = params.drag;
    slot.kind = params.kind;
    slot.seed = Math.random();
    slot.heat = params.heat;
    slot.bouncesLeft = params.bouncesLeft;
    slot.forkDone = Boolean(params.forkDone);
  }

  private spawnArcFlare(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    endScale: number,
    duration: number
  ): void {
    if (this.initFailed || this.arcFlares.length === 0) return;
    const flare = this.arcFlares[this.arcFlareCursor];
    this.arcFlareCursor = (this.arcFlareCursor + 1) % MAX_ARC_FLARES;
    flare.active = true;
    flare.life = duration;
    flare.maxLife = duration;
    flare.startScale = endScale * 0.42;
    flare.endScale = endScale;
    flare.rollAngle = Math.random() * Math.PI * 2;

    flare.mesh.visible = true;
    flare.mesh.position.set(x, y + 0.08, z);
    flare.mesh.scale.setScalar(flare.startScale);
    const mat = flare.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = 1.0;
  }

  private spawnSlashArc(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    baseSpin: number,
    spinDelta: number,
    startScale: number,
    endScale: number,
    duration: number,
    tiltX = 0,
    tiltZ = 0,
    opacity = 0.95
  ): void {
    if (this.initFailed || this.slashArcs.length === 0) return;
    const slot = this.slashArcs[this.slashArcCursor];
    this.slashArcCursor = (this.slashArcCursor + 1) % MAX_SLASH_ARCS;
    slot.active = true;
    slot.life = duration;
    slot.maxLife = duration;
    slot.startScale = startScale;
    slot.endScale = endScale;
    slot.baseSpin = baseSpin;
    slot.spinDelta = spinDelta;
    slot.tiltX = tiltX;
    slot.tiltZ = tiltZ;
    slot.baseOpacity = opacity;

    slot.mesh.visible = true;
    slot.mesh.position.set(x, y + 0.09, z);
    slot.mesh.rotation.set(tiltX, baseSpin, tiltZ, 'YXZ');
    slot.mesh.scale.setScalar(startScale);
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = opacity;
  }

  private spawnCleaveBeam(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    rollAngle: number,
    width: number,
    endScaleY: number,
    duration: number
  ): void {
    if (this.initFailed || this.cleaveBeams.length === 0) return;
    const slot = this.cleaveBeams[this.cleaveBeamCursor];
    this.cleaveBeamCursor = (this.cleaveBeamCursor + 1) % MAX_CLEAVE_BEAMS;
    slot.active = true;
    slot.life = duration;
    slot.maxLife = duration;
    slot.startScaleY = endScaleY * 0.55;
    slot.endScaleY = endScaleY;
    slot.width = width;
    slot.rollAngle = rollAngle;

    slot.mesh.visible = true;
    slot.mesh.position.set(x, y + 0.1, z);
    slot.mesh.quaternion.copy(this.camera.quaternion);
    slot.mesh.rotateZ(rollAngle);
    slot.mesh.scale.set(width, slot.startScaleY, 1);
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = 1.0;
  }

  public spawnBurstParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 4.2,
    options?: {
      gravity?: number;
      drag?: number;
      maxLife?: number;
      lifetimeSec?: number;
      sizeMult?: number;
      kind?: 'metal' | 'energy';
      heat?: number;
      bounces?: number;
    }
  ): void {
    const grav = options?.gravity ?? 9.5;
    const drag = options?.drag ?? 0.96;
    const baseLife = options?.maxLife ?? options?.lifetimeSec ?? 0.28;
    const sizeMult = options?.sizeMult ?? 1.0;
    const kind = options?.kind === 'metal' ? 1 : 0;
    const heat = options?.heat ?? (kind === 1 ? 1.45 : 1.15);
    const bounces = options?.bounces ?? (kind === 1 ? 2 : 0);
    const qualityMult =
      this.currentQuality === 'Low' ? 0.35 : this.currentQuality === 'Medium' ? 0.65 : 1.0;
    const motionMult = this.reducedMotion ? 0.4 : 1.0;
    const scaledCount = Math.max(count > 0 ? 1 : 0, Math.round(count * qualityMult * motionMult));

    for (let i = 0; i < scaledCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.45 + Math.random() * 0.95) * speed;
      this.emitSparkParticle({
        x,
        y: y + 0.08,
        z,
        vx: Math.cos(angle) * spd,
        vy: 1.4 + Math.random() * (speed * 0.78),
        vz: Math.sin(angle) * spd,
        maxLife: baseLife + Math.random() * 0.24,
        size: (0.75 + Math.random() * 0.85) * sizeMult,
        colorHex,
        gravity: grav,
        drag,
        kind,
        heat,
        bouncesLeft: bounces,
      });
    }
  }

  public spawnShockwave(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    endScale = 3.2,
    duration = 0.26
  ): void {
    const sw = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % MAX_SHOCKWAVES;
    sw.active = true;
    sw.life = duration;
    sw.maxLife = duration;
    sw.startScale = 0.65;
    sw.endScale = endScale;

    sw.mesh.visible = true;
    sw.mesh.position.set(x, y + 0.08, z);
    _dirVec.set(-2 * ARENA_DISH_CURVATURE * x, 1, -2 * ARENA_DISH_CURVATURE * z).normalize();
    sw.mesh.quaternion.setFromUnitVectors(_upVec, _dirVec);
    sw.mesh.scale.setScalar(sw.startScale);
    const mat = sw.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = 0.72;
  }

  public triggerClashEffects(
    x: number,
    y: number,
    z: number,
    intensity: number,
    isCritical: boolean,
    accentHex?: number,
    options?: {
      tangentX?: number;
      tangentZ?: number;
      sparkMode?: 'metal' | 'energy';
    }
  ): void {
    const power = Math.max(0.45, Math.min(1.65, intensity));
    const sparkMode = options?.sparkMode ?? 'metal';
    const hotHex = isCritical ? 0xfef08a : accentHex ?? 0xff7b29;

    // 1. Dynamic point light burst + stadium lighting flash
    this.clashLight.position.set(x, y + 0.42, z);
    this.clashLight.color.setHex(sparkMode === 'metal' ? (isCritical ? 0xfff3c4 : 0xff9f43) : hotHex);
    const flashScale = this.reducedMotion ? 0.3 : 1.0;
    this.clashLightIntensity = (isCritical ? 24 : 14) * power * flashScale;
    this.clashLight.intensity = this.clashLightIntensity;

    this.flashMaxDuration = isCritical ? 0.22 : 0.14;
    this.flashTimer = this.flashMaxDuration;
    this.flashPeakIntensity = (isCritical ? 1.0 : 0.65 * Math.min(1.2, power)) * flashScale;
    this.flashColorHex = sparkMode === 'metal' ? 0xffb347 : hotHex;

    // 2. Blinding contact arc flash at the exact impact point
    const flareCol = sparkMode === 'metal' ? (isCritical ? 0xffffff : 0xffe4a0) : hotHex;
    this.spawnArcFlare(
      x,
      y,
      z,
      flareCol,
      (isCritical ? 2.25 : 1.45) * power,
      isCritical ? 0.15 : 0.1
    );
    if (isCritical || power > 0.95) {
      this.spawnArcFlare(x, y + 0.02, z, 0xffffff, 1.15 * power, 0.085);
    }

    const qualityMult =
      this.currentQuality === 'Low' ? 0.38 : this.currentQuality === 'Medium' ? 0.68 : 1.0;
    const motionMult = this.reducedMotion ? 0.4 : 1.0;
    const scaleCount = (n: number) => Math.max(n > 0 ? 1 : 0, Math.round(n * qualityMult * motionMult));

    if (sparkMode === 'metal') {
      // Resolve contact tangent plane where spinning metal rings grind against each other
      let tx = options?.tangentX ?? 0;
      let tz = options?.tangentZ ?? 0;
      let len = Math.hypot(tx, tz);
      if (len < 0.001 && this.playerRig && this.opponentRig) {
        const dx = this.opponentRig.root.position.x - this.playerRig.root.position.x;
        const dz = this.opponentRig.root.position.z - this.playerRig.root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 2.6) {
          tx = -dz / dist;
          tz = dx / dist;
          len = 1;
        }
      }
      if (len < 0.001) {
        const a = Math.random() * Math.PI * 2;
        tx = Math.cos(a);
        tz = Math.sin(a);
      } else {
        tx /= len;
        tz /= len;
      }
      const baseTangentAngle = Math.atan2(tz, tx);

      // 2A. Primary high-velocity tangential grinder fan (sharp blazing streaks shooting along contact tangent)
      const jetCount = scaleCount((isCritical ? 36 : 22) * (0.75 + power * 0.35));
      for (let i = 0; i < jetCount; i++) {
        // Biased toward the dominant grinder spin jet (70% forward tangent, 30% reverse fan)
        const dirSign = i % 10 < 7 ? 0 : Math.PI;
        const fanSpread = (Math.random() - 0.5) * 0.85;
        const angle = baseTangentAngle + dirSign + fanSpread;
        const speed = (8.2 + Math.random() * 7.8) * (0.78 + power * 0.42);
        const vy = (0.45 + Math.random() * 3.8) * (0.75 + power * 0.35);
        this.emitSparkParticle({
          x: x + (Math.random() - 0.5) * 0.06,
          y: y + 0.06 + Math.random() * 0.06,
          z: z + (Math.random() - 0.5) * 0.06,
          vx: Math.cos(angle) * speed,
          vy,
          vz: Math.sin(angle) * speed,
          maxLife: 0.22 + Math.random() * 0.26,
          size: 0.72 + Math.random() * 0.55,
          colorHex: hotHex,
          gravity: 13.8,
          drag: 0.935,
          kind: 1,
          heat: 1.5 + Math.random() * 0.45,
          bouncesLeft: 2,
        });
      }

      // 2B. White-hot core flash needles exploding radially from the bite point
      const coreCount = scaleCount(isCritical ? 18 : 10);
      for (let i = 0; i < coreCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (9.5 + Math.random() * 7.5) * power;
        this.emitSparkParticle({
          x,
          y: y + 0.08,
          z,
          vx: Math.cos(angle) * speed,
          vy: 1.4 + Math.random() * 4.8 * power,
          vz: Math.sin(angle) * speed,
          maxLife: 0.1 + Math.random() * 0.1,
          size: 0.75 + Math.random() * 0.4,
          colorHex: 0xffffff,
          gravity: 11.0,
          drag: 0.92,
          kind: 1,
          heat: 2.0,
          bouncesLeft: 1,
          forkDone: true,
        });
      }

      // 2C. High-arcing ricochet embers that rain down, skip off the dish, and sputter/fork
      const emberCount = scaleCount(isCritical ? 24 : 13);
      for (let i = 0; i < emberCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (3.4 + Math.random() * 4.6) * power;
        this.emitSparkParticle({
          x,
          y: y + 0.08,
          z,
          vx: Math.cos(angle) * speed,
          vy: (2.8 + Math.random() * 4.6) * power,
          vz: Math.sin(angle) * speed,
          maxLife: 0.38 + Math.random() * 0.34,
          size: 0.75 + Math.random() * 0.6,
          colorHex: 0xff6b2b,
          gravity: 12.0,
          drag: 0.96,
          kind: 1,
          heat: 1.35,
          bouncesLeft: 3,
        });
      }

      // 2D. Accent highlight streaks for non-standard impact colors (cyan wall/shield deflection, crimson part break)
      if (accentHex !== undefined && accentHex !== 0xff6b2b && accentHex !== 0xff7b29 && accentHex !== 0xfacc15) {
        const accentCount = scaleCount(isCritical ? 14 : 8);
        for (let i = 0; i < accentCount; i++) {
          const angle = baseTangentAngle + (Math.random() - 0.5) * 1.4 + (i % 2 === 0 ? 0 : Math.PI);
          const speed = (6.0 + Math.random() * 5.2) * power;
          this.emitSparkParticle({
            x,
            y: y + 0.08,
            z,
            vx: Math.cos(angle) * speed,
            vy: 1.2 + Math.random() * 3.8 * power,
            vz: Math.sin(angle) * speed,
            maxLife: 0.18 + Math.random() * 0.16,
            size: 0.8 + Math.random() * 0.5,
            colorHex: accentHex,
            gravity: 9.0,
            drag: 0.94,
            kind: 0,
            heat: 1.45,
            bouncesLeft: 1,
          });
        }
      }
    } else {
      // Energy / ability / boss phase burst streaks
      this.spawnBurstParticles(x, y, z, isCritical ? 28 : 18, hotHex, 6.2 * power, {
        gravity: 6.8,
        drag: 0.94,
        maxLife: 0.3,
        sizeMult: 1.15,
        kind: 'energy',
        heat: 1.5,
      });
      this.spawnBurstParticles(x, y + 0.04, z, isCritical ? 14 : 8, 0xffffff, 7.6 * power, {
        gravity: 5.5,
        drag: 0.93,
        maxLife: 0.18,
        sizeMult: 0.95,
        kind: 'energy',
        heat: 1.75,
      });
    }

    // 3. Soft thermal shockwave pulse
    this.spawnShockwave(
      x,
      y,
      z,
      sparkMode === 'metal' ? (isCritical ? 0xfacc15 : 0xff7b29) : hotHex,
      isCritical ? 3.8 : 2.35,
      isCritical ? 0.26 : 0.18
    );
    if (isCritical) {
      this.spawnShockwave(x, y + 0.03, z, 0xffffff, 2.4, 0.15);
    }

    // 4. Anime Rim Slash Arcs & Contact Cleave Beam (high-impulse clashes, criticals & bursts)
    if (!this.reducedMotion && (isCritical || power >= 0.84)) {
      const baseAngle =
        options?.tangentX !== undefined && options?.tangentZ !== undefined
          ? Math.atan2(options.tangentZ, options.tangentX)
          : Math.random() * Math.PI * 2;
      const slashCol = sparkMode === 'metal' ? (isCritical ? 0xfef08a : 0x7dd3fc) : hotHex;
      // Primary crisp white outer rim slash wrapping around the clash perimeter
      this.spawnSlashArc(
        x,
        y,
        z,
        0xffffff,
        baseAngle,
        1.75,
        0.74 * power,
        (isCritical ? 1.48 : 1.18) * power,
        isCritical ? 0.2 : 0.16,
        (Math.random() - 0.5) * 0.24,
        (Math.random() - 0.5) * 0.22,
        0.96
      );
      // Secondary counter-sweeping colored blade crescent
      this.spawnSlashArc(
        x,
        y + 0.04,
        z,
        slashCol,
        baseAngle + Math.PI,
        -1.55,
        0.62 * power,
        (isCritical ? 1.32 : 1.05) * power,
        isCritical ? 0.18 : 0.14,
        0.34,
        -0.28,
        0.88
      );
      if (isCritical || power >= 1.08) {
        // Angled 3D anime cross-slash & vertical-ish contact cleave seam
        this.spawnSlashArc(
          x,
          y + 0.06,
          z,
          0xffffff,
          baseAngle + Math.PI * 0.5,
          2.1,
          0.66 * power,
          1.38 * power,
          0.17,
          0.62,
          0.42,
          0.92
        );
        this.spawnCleaveBeam(
          x,
          y,
          z,
          isCritical ? 0xfff3c4 : slashCol,
          (Math.random() - 0.5) * 0.34,
          isCritical ? 1.25 : 0.9,
          (isCritical ? 1.65 : 1.2) * power,
          isCritical ? 0.16 : 0.12
        );
      }
    }
  }

  private buildStadiumEnvironmentMap(arena: ArenaDefinition): void {
    if (this.arenaEnvTarget) {
      this.arenaEnvTarget.dispose();
      this.arenaEnvTarget = null;
    }
    const envScene = new THREE.Scene();

    // High-contrast enclosed stadium dome: deep dark roof & canopy framing razor-sharp HDR projector banks
    const skyCol = new THREE.Color(arena.skyColorHex).multiplyScalar(0.18);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(16, 24, 16),
      new THREE.MeshBasicMaterial({ color: skyCol, side: THREE.BackSide })
    );
    envScene.add(dome);

    const roofCap = new THREE.Mesh(
      new THREE.CircleGeometry(14.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x02050c, side: THREE.DoubleSide })
    );
    roofCap.rotation.x = Math.PI / 2;
    roofCap.position.y = 11.4;
    envScene.add(roofCap);

    const floorBounceCol = new THREE.Color(arena.floorPalette[1] ?? '#1e293b').multiplyScalar(0.14);
    const lowerFloor = new THREE.Mesh(
      new THREE.CircleGeometry(15, 24),
      new THREE.MeshBasicMaterial({ color: floorBounceCol })
    );
    lowerFloor.rotation.x = -Math.PI / 2;
    lowerFloor.position.y = -4.5;
    envScene.add(lowerFloor);

    // 6 Sharp elongated HDR overhead stadium projector strips for crisp metallic specular ribbons on WeightDisc & walls
    const stripGeo = new THREE.PlaneGeometry(8.2, 0.56);
    const coolBankMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xf8fafc).multiplyScalar(6.8),
      side: THREE.DoubleSide,
    });
    const warmBankMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfff1d6).multiplyScalar(6.4),
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const bank = new THREE.Mesh(stripGeo, i % 2 === 0 ? coolBankMat : warmBankMat);
      bank.position.set(Math.cos(a) * 9.4, 8.4, Math.sin(a) * 9.4);
      bank.lookAt(0, 0, 0);
      envScene.add(bank);
    }

    // Dual crossing overhead zenith projector trusses
    const zenithGeo = new THREE.PlaneGeometry(9.2, 0.42);
    const zenithMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xeef6ff).multiplyScalar(5.6),
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 2; i++) {
      const bar = new THREE.Mesh(zenithGeo, zenithMat);
      bar.position.set(0, 10.9, i === 0 ? -2.2 : 2.2);
      bar.rotation.x = Math.PI / 2;
      envScene.add(bar);
    }

    // Focused warm key spotlight panel aligned toward primary directional key light
    const keyPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.8),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffe7c2).multiplyScalar(5.4),
        side: THREE.DoubleSide,
      })
    );
    keyPanel.position.set(6.8, 8.2, 5.6);
    keyPanel.lookAt(0, 0, 0);
    envScene.add(keyPanel);

    // Slim high-contrast arena trim horizon rim ribbons
    const rimStripA = new THREE.Mesh(
      new THREE.PlaneGeometry(10.0, 0.72),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(arena.trimColorHex).multiplyScalar(3.8),
        side: THREE.DoubleSide,
      })
    );
    rimStripA.position.set(-9.4, 2.0, -5.8);
    rimStripA.lookAt(0, 0.4, 0);
    envScene.add(rimStripA);

    const rimStripB = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 0.64),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(arena.primaryColor).multiplyScalar(3.0),
        side: THREE.DoubleSide,
      })
    );
    rimStripB.position.set(8.6, 1.8, -6.8);
    rimStripB.lookAt(0, 0.4, 0);
    envScene.add(rimStripB);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.arenaEnvTarget = pmrem.fromScene(envScene, 0.018);
    pmrem.dispose();
    disposeObject3D(envScene);

    this.scene.environment = this.arenaEnvTarget.texture;
    this.scene.environmentIntensity = 1.22;
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x101324, 0.42);
    this.scene.add(this.hemiLight);

    const shadowRes = this.currentQuality === 'High' && !this.isSoftwareGl ? 2048 : 1024;
    this.keyLight = new THREE.DirectionalLight(0xfff2dc, 2.65);
    this.keyLight.position.set(6.2, 11.2, 5.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.keyLight.shadow.camera.left = -4.6;
    this.keyLight.shadow.camera.right = 4.6;
    this.keyLight.shadow.camera.top = 4.6;
    this.keyLight.shadow.camera.bottom = -4.6;
    this.keyLight.shadow.camera.near = 4.5;
    this.keyLight.shadow.camera.far = 19.0;
    this.keyLight.shadow.bias = -0.00025;
    this.keyLight.shadow.normalBias = 0.012;
    this.keyLight.shadow.radius = 1.75;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    this.rimLight.position.set(-7.2, 5.2, -6.2);
    this.scene.add(this.rimLight);

    this.fillRimLight = new THREE.DirectionalLight(0x93c5fd, 0.36);
    this.fillRimLight.position.set(-3.5, 2.1, 6.8);
    this.scene.add(this.fillRimLight);

    this.clashLight = new THREE.PointLight(0xff7b29, 0, 10, 1.5);
    this.clashLight.position.set(0, 0.6, 0);
    this.scene.add(this.clashLight);

    this.criticalOverheadLight = new THREE.PointLight(CRITICAL_CRIMSON_HEX, 0, 14, 1.4);
    this.criticalOverheadLight.position.set(0, 3.8, 0);
    this.scene.add(this.criticalOverheadLight);
  }

  private buildArenaStadium(arenaId: ArenaId): void {
    for (const tex of this.activeArenaTextures) {
      tex.dispose();
    }
    this.activeArenaTextures = [];
    if (this.stadiumGroup) {
      this.scene.remove(this.stadiumGroup);
      disposeObject3D(this.stadiumGroup);
      this.stadiumGroup = null;
      this.wallRecoilGroup = null;
      this.modeReactiveGroup = null;
      this.mistMesh = null;
      this.neonTrimMat = null;
      this.innerRimBandMat = null;
      this.lightBarMat = null;
      this.gateBeaconMat = null;
      this.criticalWarningRing = null;
      this.criticalWarningMat = null;
      this.heatmapMesh = null;
      this.scuffMesh = null;
    }
    this.dynamicPillarMeshes = [];
    this.dynamicHazardMeshes = [];
    this.modeMovingTraps = [];
    this.modeRingVisuals = [];

    const arena = getArenaDefinition(arenaId);
    this.baseSkyHex = arena.skyColorHex;
    this.baseFogDensity = arena.hasMist ? 0.065 : 0.022;
    this.baseArenaTrimHex = arena.trimColorHex;
    this.baseRimHex = arena.trimColorHex;
    this.buildStadiumEnvironmentMap(arena);
    const parsedFloorHex = parseInt(
      (arena.floorPalette[1] ?? arena.floorPalette[0] ?? '#64748b').replace('#', ''),
      16
    );
    this.baseArenaFloorHex = Number.isFinite(parsedFloorHex) ? parsedFloorHex : 0x64748b;
    this.scene.background = new THREE.Color(arena.skyColorHex);
    this.scene.fog = new THREE.FogExp2(arena.skyColorHex, this.baseFogDensity);

    const stadium = new THREE.Group();
    const wallStructure = new THREE.Group();
    this.wallRecoilGroup = wallStructure;
    stadium.add(wallStructure);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const includePbr = this.currentQuality !== 'Low';
    if (includePbr && !this.stadiumSurfaceMaps) {
      this.stadiumSurfaceMaps = createStadiumSurfaceMaps(maxAniso);
    }
    const stadiumMaps = includePbr ? this.stadiumSurfaceMaps : null;

    const dishEdgeY = ARENA_DISH_CURVATURE * ARENA_DISH_RADIUS * ARENA_DISH_RADIUS;
    const dishPoints: THREE.Vector2[] = [];
    // End the concave bowl cleanly at ARENA_DISH_RADIUS so Ring-Out exit gates drop straight down with zero outer lip
    dishPoints.push(new THREE.Vector2(ARENA_DISH_RADIUS + 0.07, 0.0));
    dishPoints.push(new THREE.Vector2(ARENA_DISH_RADIUS + 0.04, dishEdgeY - 0.03));
    dishPoints.push(new THREE.Vector2(ARENA_DISH_RADIUS, dishEdgeY));
    const steps = 26;
    for (let i = steps; i >= 0; i--) {
      const r = (i / steps) * ARENA_DISH_RADIUS;
      const y = ARENA_DISH_CURVATURE * r * r;
      dishPoints.push(new THREE.Vector2(r, y));
    }

    const dishGeo = new THREE.LatheGeometry(dishPoints, 64);
    const posAttr = dishGeo.attributes.position;
    const uvs = new Float32Array(posAttr.count * 2);
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      uvs[i * 2] = x / (ARENA_WALL_RADIUS * 2) + 0.5;
      uvs[i * 2 + 1] = z / (ARENA_WALL_RADIUS * 2) + 0.5;
    }
    dishGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (includePbr && dishGeo.index !== null) {
      dishGeo.computeTangents();
    }

    const floorMaps = createArenaFloorMaps(arena, maxAniso, includePbr);
    this.activeArenaTextures.push(floorMaps.map);
    this.activeArenaTextures.push(floorMaps.emissiveMap);
    if (floorMaps.normalMap) this.activeArenaTextures.push(floorMaps.normalMap);
    if (floorMaps.roughnessMap) this.activeArenaTextures.push(floorMaps.roughnessMap);
    if (floorMaps.aoMap) this.activeArenaTextures.push(floorMaps.aoMap);

    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorMaps.map,
      emissive: 0xffffff,
      emissiveMap: floorMaps.emissiveMap,
      emissiveIntensity: 0.95,
      normalMap: floorMaps.normalMap,
      normalScale: new THREE.Vector2(
        arena.id === 'temple' ? 0.52 : arena.id === 'frozen' ? 0.28 : 0.34,
        arena.id === 'temple' ? 0.52 : arena.id === 'frozen' ? 0.28 : 0.34
      ),
      roughnessMap: floorMaps.roughnessMap,
      aoMap: floorMaps.aoMap,
      aoMapIntensity: 0.78,
      roughness: floorMaps.roughnessMap
        ? 1.0
        : arena.id === 'frozen'
          ? 0.14
          : arena.id === 'temple'
            ? 0.65
            : 0.42,
      metalness: arena.id === 'frozen' ? 0.55 : arena.id === 'temple' ? 0.08 : 0.28,
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.receiveShadow = true;
    stadium.add(dishMesh);

    // Arena Collision Heatmap parabolic overlay (visible only when Diagnostics is enabled)
    const hmPoints: THREE.Vector2[] = [];
    const hmSteps = 24;
    for (let i = hmSteps; i >= 0; i--) {
      const r = (i / hmSteps) * (ARENA_DISH_RADIUS - 0.04);
      const y = ARENA_DISH_CURVATURE * r * r + 0.014;
      hmPoints.push(new THREE.Vector2(r, y));
    }
    const hmGeo = new THREE.LatheGeometry(hmPoints, 64);
    const hmPos = hmGeo.attributes.position;
    const hmUvs = new Float32Array(hmPos.count * 2);
    for (let i = 0; i < hmPos.count; i++) {
      const x = hmPos.getX(i);
      const z = hmPos.getZ(i);
      hmUvs[i * 2] = x / (ARENA_DISH_RADIUS * 2) + 0.5;
      hmUvs[i * 2 + 1] = z / (ARENA_DISH_RADIUS * 2) + 0.5;
    }
    hmGeo.setAttribute('uv', new THREE.BufferAttribute(hmUvs, 2));
    const hmMat = new THREE.MeshBasicMaterial({
      map: this.heatmapTex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const hmMesh = new THREE.Mesh(hmGeo, hmMat);
    hmMesh.visible = this.showDiagnostics && this.cameraMode === 'battle';
    hmMesh.renderOrder = 2;
    hmMesh.userData.skipGtao = true;
    stadium.add(hmMesh);
    this.heatmapMesh = hmMesh;

    // Parabolic floor scuff, gouge & thermal scorch canvas overlay
    if (this.scuffTex) {
      const scPoints: THREE.Vector2[] = [];
      const scSteps = 24;
      for (let i = scSteps; i >= 0; i--) {
        const r = (i / scSteps) * (ARENA_DISH_RADIUS - 0.03);
        const y = ARENA_DISH_CURVATURE * r * r + 0.005;
        scPoints.push(new THREE.Vector2(r, y));
      }
      const scGeo = new THREE.LatheGeometry(scPoints, 64);
      const scPos = scGeo.attributes.position;
      const scUvs = new Float32Array(scPos.count * 2);
      for (let i = 0; i < scPos.count; i++) {
        const x = scPos.getX(i);
        const z = scPos.getZ(i);
        scUvs[i * 2] = x / (ARENA_DISH_RADIUS * 2) + 0.5;
        scUvs[i * 2 + 1] = z / (ARENA_DISH_RADIUS * 2) + 0.5;
      }
      scGeo.setAttribute('uv', new THREE.BufferAttribute(scUvs, 2));
      const scMat = new THREE.MeshBasicMaterial({
        map: this.scuffTex,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const scMesh = new THREE.Mesh(scGeo, scMat);
      scMesh.visible = this.cameraMode === 'battle' || this.cameraMode === 'replay';
      scMesh.renderOrder = 1;
      scMesh.userData.skipGtao = true;
      stadium.add(scMesh);
      this.scuffMesh = scMesh;
    }

    const wallInnerR = ARENA_DISH_RADIUS;
    const wallOuterR = ARENA_WALL_RADIUS + 0.08;
    const shoulderOuterR = ARENA_WALL_RADIUS + 0.54;
    const wallMidR = (wallInnerR + wallOuterR) * 0.5;
    const wallHeight = 0.56;
    const wallBaseY = dishEdgeY - 0.02;
    const wallBevel = 0.03;
    const gateAngles = [Math.PI / 3, Math.PI, (5 * Math.PI) / 3];
    const gateHalfSpan = 0.24;

    const wallArcMat = new THREE.MeshStandardMaterial({
      color: arena.wallColorHex,
      metalness: 0.78,
      roughness: stadiumMaps ? 0.54 : 0.28,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
      aoMap: stadiumMaps?.wallAo ?? null,
      aoMapIntensity: 0.65,
      side: THREE.DoubleSide,
    });
    const wallShoulderMat = new THREE.MeshStandardMaterial({
      color: arena.wallColorHex,
      metalness: 0.48,
      roughness: stadiumMaps ? 0.84 : 0.62,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
      aoMap: stadiumMaps?.wallAo ?? null,
      aoMapIntensity: 0.65,
      side: THREE.DoubleSide,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.86,
      roughness: stadiumMaps ? 0.56 : 0.34,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
    });
    const gunmetalRibMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.84,
      roughness: stadiumMaps ? 0.48 : 0.28,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
      aoMap: stadiumMaps?.wallAo ?? null,
      aoMapIntensity: 0.6,
    });
    const rivetMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.94,
      roughness: 0.18,
    });
    const neonTrimMat = new THREE.MeshStandardMaterial({
      color: arena.trimColorHex,
      emissive: arena.trimColorHex,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.14,
    });
    this.neonTrimMat = neonTrimMat;
    const innerBandHex = parseInt(arena.accentColor.replace('#', ''), 16);
    const resolvedInnerBandHex = Number.isFinite(innerBandHex) ? innerBandHex : arena.trimColorHex;
    const innerRimBandMat = new THREE.MeshStandardMaterial({
      color: resolvedInnerBandHex,
      emissive: resolvedInnerBandHex,
      emissiveIntensity: 1.25,
      metalness: 0.15,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    this.innerRimBandMat = innerRimBandMat;

    const buttressGeo = new THREE.BoxGeometry(0.16, 0.44, 0.42);
    const rivetBoltGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.032, 6);
    const clampBracketGeo = new THREE.BoxGeometry(0.09, 0.085, 0.17);
    const ribsPerArc = 7;
    const totalButtresses = 3 * ribsPerArc;
    const buttressMesh = new THREE.InstancedMesh(buttressGeo, gunmetalRibMat, totalButtresses);
    buttressMesh.castShadow = false;
    buttressMesh.receiveShadow = true;
    const wallRivetsMesh = new THREE.InstancedMesh(rivetBoltGeo, rivetMat, totalButtresses * 2);
    const railClampsMesh = new THREE.InstancedMesh(clampBracketGeo, darkSteelMat, totalButtresses);
    let buttressIdx = 0;
    let wallRivetIdx = 0;

    for (let g = 0; g < 3; g++) {
      const startA = gateAngles[g] + gateHalfSpan;
      const endA =
        (g === 2 ? gateAngles[0] + Math.PI * 2 : gateAngles[g + 1]) - gateHalfSpan;
      const span = endA - startA;

      // Solid 3D beveled wall sector (inset by wallBevel so beveled inner face sits strictly at ARENA_DISH_RADIUS)
      const arcSegs = 32;
      const wallShape = new THREE.Shape();
      const wOutBevel = wallOuterR - wallBevel;
      const wInBevel = wallInnerR + wallBevel;
      for (let s = 0; s <= arcSegs; s++) {
        const a = startA + (s / arcSegs) * span;
        const sx = Math.cos(a) * wOutBevel;
        const sy = -Math.sin(a) * wOutBevel;
        if (s === 0) wallShape.moveTo(sx, sy);
        else wallShape.lineTo(sx, sy);
      }
      for (let s = arcSegs; s >= 0; s--) {
        const a = startA + (s / arcSegs) * span;
        wallShape.lineTo(Math.cos(a) * wInBevel, -Math.sin(a) * wInBevel);
      }
      wallShape.closePath();

      const arcGeo = new THREE.ExtrudeGeometry(wallShape, {
        depth: wallHeight - wallBevel * 2 + 0.02,
        bevelEnabled: true,
        bevelThickness: wallBevel,
        bevelSize: wallBevel,
        bevelSegments: 2,
      });
      arcGeo.rotateX(-Math.PI / 2);
      arcGeo.computeVertexNormals();
      const arcMesh = new THREE.Mesh(arcGeo, wallArcMat);
      arcMesh.position.y = wallBaseY + wallBevel;
      arcMesh.castShadow = false;
      arcMesh.receiveShadow = true;
      wallStructure.add(arcMesh);

      // Stepped heavy steel outer shoulder apron with chamfered outer curb
      const shoulderShape = new THREE.Shape();
      const shOutBevel = shoulderOuterR - wallBevel;
      const shInBevel = wallOuterR - 0.02 + wallBevel;
      for (let s = 0; s <= arcSegs; s++) {
        const a = startA + (s / arcSegs) * span;
        const sx = Math.cos(a) * shOutBevel;
        const sy = -Math.sin(a) * shOutBevel;
        if (s === 0) shoulderShape.moveTo(sx, sy);
        else shoulderShape.lineTo(sx, sy);
      }
      for (let s = arcSegs; s >= 0; s--) {
        const a = startA + (s / arcSegs) * span;
        shoulderShape.lineTo(Math.cos(a) * shInBevel, -Math.sin(a) * shInBevel);
      }
      shoulderShape.closePath();

      const shoulderGeo = new THREE.ExtrudeGeometry(shoulderShape, {
        depth: dishEdgeY + 0.14,
        bevelEnabled: true,
        bevelThickness: 0.028,
        bevelSize: 0.028,
        bevelSegments: 2,
      });
      shoulderGeo.rotateX(-Math.PI / 2);
      shoulderGeo.computeVertexNormals();
      const shoulderMesh = new THREE.Mesh(shoulderGeo, wallShoulderMat);
      shoulderMesh.position.y = 0.008;
      shoulderMesh.castShadow = false;
      shoulderMesh.receiveShadow = true;
      wallStructure.add(shoulderMesh);

      // Machined dark steel channel housing + recessed emissive trim rail
      const channelGeo = new THREE.TorusGeometry(wallMidR, 0.062, 6, 36, span);
      channelGeo.rotateX(Math.PI / 2);
      const channelMesh = new THREE.Mesh(channelGeo, darkSteelMat);
      channelMesh.rotation.y = -startA;
      channelMesh.position.y = dishEdgeY + wallHeight + 0.004;
      channelMesh.castShadow = false;
      channelMesh.receiveShadow = true;
      wallStructure.add(channelMesh);

      const trimGeo = new THREE.TorusGeometry(wallMidR, 0.032, 10, 36, span);
      trimGeo.rotateX(Math.PI / 2);
      const trimMesh = new THREE.Mesh(trimGeo, neonTrimMat);
      trimMesh.rotation.y = -startA;
      trimMesh.position.y = dishEdgeY + wallHeight + 0.024;
      wallStructure.add(trimMesh);

      // Luminous inner rim band running inside the guard wall sectors (leaving Ring-Out exit gates open)
      const innerBandGeo = new THREE.CylinderGeometry(
        wallInnerR - 0.004,
        wallInnerR - 0.004,
        0.13,
        32,
        1,
        true,
        Math.PI * 0.5 - endA,
        span
      );
      const innerBandMesh = new THREE.Mesh(innerBandGeo, innerRimBandMat);
      innerBandMesh.position.y = wallBaseY + 0.37;
      wallStructure.add(innerBandMesh);

      // Grounding contact-AO seam where the inner steel wall meets the curved dish floor (skipped at Ring-Out gates)
      const innerWallAoMat = new THREE.MeshBasicMaterial({
        map: this.innerWallAoTex,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const innerAoInR = ARENA_DISH_RADIUS - 0.44;
      const innerAoOutR = ARENA_DISH_RADIUS + 0.02;
      const innerAoInY = ARENA_DISH_CURVATURE * innerAoInR * innerAoInR + 0.007;
      const innerAoOutY = ARENA_DISH_CURVATURE * innerAoOutR * innerAoOutR + 0.007;
      const innerAoPositions: number[] = [];
      const innerAoUvs: number[] = [];
      const innerAoIndices: number[] = [];
      for (let s = 0; s <= arcSegs; s++) {
        const u = s / arcSegs;
        const a = startA + u * span;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        innerAoPositions.push(cosA * innerAoInR, innerAoInY, sinA * innerAoInR);
        innerAoPositions.push(cosA * innerAoOutR, innerAoOutY, sinA * innerAoOutR);
        innerAoUvs.push(u, 0, u, 1);
        if (s < arcSegs) {
          const base = s * 2;
          innerAoIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
      }
      const innerAoGeo = new THREE.BufferGeometry();
      innerAoGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerAoPositions, 3));
      innerAoGeo.setAttribute('uv', new THREE.Float32BufferAttribute(innerAoUvs, 2));
      innerAoGeo.setIndex(innerAoIndices);
      const innerAoMesh = new THREE.Mesh(innerAoGeo, innerWallAoMat);
      innerAoMesh.userData.skipGtao = true;
      innerAoMesh.renderOrder = 1;
      stadium.add(innerAoMesh);

      // Grounding contact-AO seam along outer shoulder base meeting the stadium curb
      const shoulderAoGeo = new THREE.RingGeometry(
        shoulderOuterR - 0.14,
        shoulderOuterR + 0.36,
        32,
        1,
        -endA,
        span
      );
      shoulderAoGeo.rotateX(-Math.PI / 2);
      const shoulderAoMesh = new THREE.Mesh(
        shoulderAoGeo,
        new THREE.MeshBasicMaterial({
          color: 0x020617,
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      shoulderAoMesh.userData.skipGtao = true;
      shoulderAoMesh.position.y = 0.006;
      stadium.add(shoulderAoMesh);

      // Populate structural steel buttresses, top rail clamps, and armor rivets along each wall arc
      for (let r = 0; r < ribsPerArc; r++) {
        const t = (r + 0.5) / ribsPerArc;
        const a = startA + t * span;

        // Angled structural buttress bracing the outer wall onto the shoulder apron
        const buttressR = wallOuterR + 0.14;
        _pos.set(Math.cos(a) * buttressR, dishEdgeY + 0.2, Math.sin(a) * buttressR);
        _euler.set(0, -a + Math.PI / 2, 0);
        _quat.setFromEuler(_euler);
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        buttressMesh.setMatrixAt(buttressIdx, _mat4);

        // Protective steel bracket clamping the recessed light rail
        _pos.set(Math.cos(a) * wallMidR, dishEdgeY + wallHeight + 0.028, Math.sin(a) * wallMidR);
        _euler.set(0, -a + Math.PI / 2, 0);
        _quat.setFromEuler(_euler);
        _mat4.compose(_pos, _quat, _scale);
        railClampsMesh.setMatrixAt(buttressIdx, _mat4);
        buttressIdx++;

        // Dual hex deck bolts flanking the light channel
        for (const rOffset of [-0.115, 0.115]) {
          const boltR = wallMidR + rOffset;
          _pos.set(Math.cos(a) * boltR, dishEdgeY + wallHeight + 0.014, Math.sin(a) * boltR);
          _quat.identity();
          _mat4.compose(_pos, _quat, _scale);
          wallRivetsMesh.setMatrixAt(wallRivetIdx++, _mat4);
        }
      }
    }

    buttressMesh.computeBoundingSphere();
    railClampsMesh.computeBoundingSphere();
    wallRivetsMesh.computeBoundingSphere();
    wallStructure.add(buttressMesh);
    wallStructure.add(railClampsMesh);
    wallStructure.add(wallRivetsMesh);

    // Flanking Multi-Part Architectural Gate Pillars framing each open Ring-Out exit gap
    const gateBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 1.55,
      metalness: 0.15,
      roughness: 0.14,
    });
    this.gateBeaconMat = gateBeaconMat;
    const pillarPlinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.45,
      roughness: stadiumMaps ? 0.88 : 0.72,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
    });
    const pillarShaftMat = new THREE.MeshStandardMaterial({
      color: arena.wallColorHex,
      metalness: 0.84,
      roughness: stadiumMaps ? 0.44 : 0.24,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
      aoMap: stadiumMaps?.wallAo ?? null,
      aoMapIntensity: 0.65,
    });
    const pillarCollarMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.72,
      roughness: stadiumMaps ? 0.64 : 0.42,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
    });
    const baseFlangeGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.075, 8);
    const flangeBoltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 6);
    const plinthGeo = new THREE.CylinderGeometry(0.24, 0.29, dishEdgeY + 0.12, 8);
    const shaftGeo = new THREE.CylinderGeometry(0.16, 0.19, 0.96, 8);
    const shaftRibGeo = new THREE.BoxGeometry(0.052, 0.78, 0.08);
    const collarGeo = new THREE.CylinderGeometry(0.225, 0.235, 0.125, 8);
    const capGeo = new THREE.CylinderGeometry(0.11, 0.205, 0.15, 8);
    const gateFinGeo = new THREE.BoxGeometry(0.075, 0.7, 0.075);
    const beaconBandGeo = new THREE.TorusGeometry(0.18, 0.024, 8, 16);
    beaconBandGeo.rotateX(Math.PI / 2);
    const beaconOrbGeo = new THREE.OctahedronGeometry(0.068, 1);
    const cageRingGeo = new THREE.TorusGeometry(0.105, 0.012, 6, 16);
    cageRingGeo.rotateX(Math.PI / 2);
    const cageStrutGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6);

    const pillarContactAoMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const gatePillarContactGeo = new THREE.CircleGeometry(0.62, 20);
    gatePillarContactGeo.rotateX(-Math.PI / 2);

    const pillarR = wallMidR + 0.07;
    for (const ga of gateAngles) {
      for (const side of [-1, 1] as const) {
        const a = ga + side * (gateHalfSpan + 0.032);
        const pillarGroup = new THREE.Group();
        pillarGroup.position.set(Math.cos(a) * pillarR, 0, Math.sin(a) * pillarR);
        pillarGroup.rotation.y = -a;

        const gateContactAo = new THREE.Mesh(gatePillarContactGeo, pillarContactAoMat);
        gateContactAo.position.y = 0.008;
        pillarGroup.add(gateContactAo);

        // Anchored base flange plate + 4 corner anchor bolts
        const baseFlange = new THREE.Mesh(baseFlangeGeo, darkSteelMat);
        baseFlange.position.y = 0.035;
        baseFlange.castShadow = false;
        baseFlange.receiveShadow = true;
        pillarGroup.add(baseFlange);
        for (let b = 0; b < 4; b++) {
          const ba = (b / 4) * Math.PI * 2 + Math.PI / 4;
          const anchorBolt = new THREE.Mesh(flangeBoltGeo, rivetMat);
          anchorBolt.position.set(Math.cos(ba) * 0.27, 0.076, Math.sin(ba) * 0.27);
          pillarGroup.add(anchorBolt);
        }

        const plinth = new THREE.Mesh(plinthGeo, pillarPlinthMat);
        plinth.position.y = (dishEdgeY + 0.12) * 0.5 - 0.01;
        plinth.castShadow = false;
        plinth.receiveShadow = true;
        pillarGroup.add(plinth);

        const shaft = new THREE.Mesh(shaftGeo, pillarShaftMat);
        shaft.position.y = dishEdgeY + 0.5;
        shaft.castShadow = false;
        shaft.receiveShadow = true;
        pillarGroup.add(shaft);

        // 4 structural steel ribs reinforcing the pillar shaft
        for (let rb = 0; rb < 4; rb++) {
          const rba = (rb / 4) * Math.PI * 2;
          const rib = new THREE.Mesh(shaftRibGeo, pillarCollarMat);
          rib.position.set(Math.cos(rba) * 0.17, dishEdgeY + 0.48, Math.sin(rba) * 0.17);
          rib.rotation.y = -rba;
          pillarGroup.add(rib);
        }

        const midCollar = new THREE.Mesh(collarGeo, pillarCollarMat);
        midCollar.position.y = dishEdgeY + wallHeight - 0.01;
        midCollar.castShadow = false;
        midCollar.receiveShadow = true;
        pillarGroup.add(midCollar);

        const gateFin = new THREE.Mesh(gateFinGeo, gateBeaconMat);
        gateFin.position.set(0, dishEdgeY + 0.54, -side * 0.16);
        pillarGroup.add(gateFin);

        const beaconBand = new THREE.Mesh(beaconBandGeo, gateBeaconMat);
        beaconBand.position.y = dishEdgeY + 0.9;
        pillarGroup.add(beaconBand);

        const capFinial = new THREE.Mesh(capGeo, pillarShaftMat);
        capFinial.position.y = dishEdgeY + 1.05;
        capFinial.castShadow = false;
        pillarGroup.add(capFinial);

        // Caged industrial beacon lantern at summit
        const beaconOrb = new THREE.Mesh(beaconOrbGeo, gateBeaconMat);
        beaconOrb.position.y = dishEdgeY + 1.19;
        pillarGroup.add(beaconOrb);

        const lanternCageRing = new THREE.Mesh(cageRingGeo, darkSteelMat);
        lanternCageRing.position.y = dishEdgeY + 1.26;
        pillarGroup.add(lanternCageRing);
        for (let cs = 0; cs < 4; cs++) {
          const csa = (cs / 4) * Math.PI * 2;
          const strut = new THREE.Mesh(cageStrutGeo, darkSteelMat);
          strut.position.set(Math.cos(csa) * 0.098, dishEdgeY + 1.18, Math.sin(csa) * 0.098);
          pillarGroup.add(strut);
        }

        wallStructure.add(pillarGroup);
      }
    }

    // Solid & Dynamic Moving Pillars (synced 1-to-1 with physicsEngine evaluateDynamicPillarState)
    if (arena.pillars.length > 0) {
      for (const pil of arena.pillars) {
        const pGroup = new THREE.Group();
        const isMoving = Boolean(pil.motion);
        const pGeo = new THREE.CylinderGeometry(pil.radius * 0.9, pil.radius * 1.04, pil.height, 16);
        const pMat = new THREE.MeshStandardMaterial({
          color: isMoving ? 0x334155 : 0x785630,
          emissive: isMoving ? arena.trimColorHex : 0x000000,
          emissiveIntensity: isMoving ? 0.35 : 0,
          metalness: isMoving ? 0.72 : 0.42,
          roughness: stadiumMaps ? (isMoving ? 0.56 : 0.84) : isMoving ? 0.32 : 0.62,
          normalMap: stadiumMaps?.wallNormal ?? null,
          normalScale: new THREE.Vector2(isMoving ? 0.32 : 0.48, isMoving ? 0.32 : 0.48),
          roughnessMap: stadiumMaps?.wallRoughness ?? null,
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.castShadow = true;
        pMesh.receiveShadow = true;
        pMesh.position.y = pil.height * 0.5;
        pGroup.add(pMesh);

        // Heavy beveled steel base flange & top cap plate on each arena bumper pillar
        const pilFlange = new THREE.Mesh(
          new THREE.CylinderGeometry(pil.radius * 1.06, pil.radius * 1.16, 0.08, 16),
          darkSteelMat
        );
        pilFlange.position.y = 0.04;
        pilFlange.castShadow = true;
        pilFlange.receiveShadow = true;
        pGroup.add(pilFlange);

        const pilCap = new THREE.Mesh(
          new THREE.CylinderGeometry(pil.radius * 0.78, pil.radius * 0.96, 0.075, 16),
          gunmetalRibMat
        );
        pilCap.position.y = pil.height + 0.02;
        pilCap.castShadow = true;
        pilCap.receiveShadow = true;
        pGroup.add(pilCap);

        // Grounding contact-AO decal under each static/moving arena bumper pillar
        const pilAoGeo = new THREE.CircleGeometry(pil.radius * 1.65, 20);
        pilAoGeo.rotateX(-Math.PI / 2);
        const pilAoMesh = new THREE.Mesh(pilAoGeo, pillarContactAoMat);
        pilAoMesh.position.y = 0.008;
        pGroup.add(pilAoMesh);

        if (isMoving || pil.debuffKind) {
          const haloCol =
            pil.debuffKind === 'ArcDisruption'
              ? 0xfacc15
              : pil.debuffKind === 'DragSnare'
                ? 0x7dd3fc
                : 0xf43f5e;
          const haloGeo = new THREE.TorusGeometry(pil.radius * 1.03, 0.03, 8, 24);
          haloGeo.rotateX(Math.PI / 2);
          const haloMat = new THREE.MeshStandardMaterial({
            color: haloCol,
            emissive: haloCol,
            emissiveIntensity: 1.35,
            metalness: 0.25,
            roughness: 0.16,
          });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          halo.position.y = pil.height * 0.62;
          pGroup.add(halo);

          const haloCollarGeo = new THREE.TorusGeometry(pil.radius * 1.06, 0.016, 6, 24);
          haloCollarGeo.rotateX(Math.PI / 2);
          const haloUpper = new THREE.Mesh(haloCollarGeo, darkSteelMat);
          haloUpper.position.y = pil.height * 0.62 + 0.042;
          pGroup.add(haloUpper);
          const haloLower = new THREE.Mesh(haloCollarGeo, darkSteelMat);
          haloLower.position.y = pil.height * 0.62 - 0.042;
          pGroup.add(haloLower);
        }

        const fy = arenaFloorHeight(pil.x, pil.z);
        pGroup.position.set(pil.x, fy, pil.z);
        stadium.add(pGroup);
        this.dynamicPillarMeshes.push({ mesh: pGroup, pillar: pil });
      }
    }

    // Hazard & Debuff Trap Zone glowing indicators (static & orbiting/oscillating)
    for (const hz of arena.hazardZones) {
      const hzGroup = new THREE.Group();
      const hzCol =
        hz.kind === 'heat'
          ? 0xff5a2f
          : hz.kind === 'shock'
            ? 0xfacc15
            : hz.kind === 'sand'
              ? 0xd97706
              : 0xa855f7;

      const hRingGeo = new THREE.RingGeometry(hz.radius * 0.84, hz.radius, 32);
      hRingGeo.rotateX(-Math.PI / 2);
      const hRing = new THREE.Mesh(
        hRingGeo,
        new THREE.MeshBasicMaterial({
          color: hzCol,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      hzGroup.add(hRing);

      const discGeo = new THREE.CircleGeometry(hz.radius * 0.84, 32);
      discGeo.rotateX(-Math.PI / 2);
      const discMat = new THREE.MeshBasicMaterial({
        color: hzCol,
        transparent: true,
        opacity: hz.motion ? 0.28 : 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const hDisc = new THREE.Mesh(discGeo, discMat);
      hDisc.position.y = -0.005;
      hzGroup.add(hDisc);

      const rimLift = ARENA_DISH_CURVATURE * hz.radius * hz.radius;
      hzGroup.position.set(hz.x, arenaFloorHeight(hz.x, hz.z) + rimLift + 0.028, hz.z);
      _dirVec.set(-2 * ARENA_DISH_CURVATURE * hz.x, 1, -2 * ARENA_DISH_CURVATURE * hz.z).normalize();
      hzGroup.quaternion.setFromUnitVectors(_upVec, _dirVec);
      stadium.add(hzGroup);
      this.dynamicHazardMeshes.push({ group: hzGroup, hz, discMat });
    }

    // Shadow Dimension Veil Mist Ring
    if (arena.hasMist) {
      const mistGeo = new THREE.RingGeometry(0.5, ARENA_DISH_RADIUS, 40);
      mistGeo.rotateX(-Math.PI / 2);
      this.mistMesh = new THREE.Mesh(
        mistGeo,
        new THREE.MeshBasicMaterial({
          color: 0x9333ea,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
        })
      );
      this.mistMesh.position.y = 0.45;
      stadium.add(this.mistMesh);
    }

    const outerDeck = new THREE.Mesh(
      new THREE.RingGeometry(ARENA_DISH_RADIUS - 0.1, 16, 64),
      new THREE.MeshStandardMaterial({
        color: arena.skyColorHex,
        roughness: stadiumMaps ? 0.96 : 0.85,
        metalness: 0.15,
        normalMap: stadiumMaps?.deckNormal ?? null,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: stadiumMaps?.deckRoughness ?? null,
      })
    );
    outerDeck.rotation.x = -Math.PI / 2;
    outerDeck.position.y = -0.02;
    outerDeck.receiveShadow = true;
    stadium.add(outerDeck);

    // Heavy stepped stadium floor curb & outer structural service ring
    const outerCurbGeo = new THREE.RingGeometry(shoulderOuterR + 0.08, 7.6, 48);
    outerCurbGeo.rotateX(-Math.PI / 2);
    const outerCurb = new THREE.Mesh(outerCurbGeo, darkSteelMat);
    outerCurb.position.y = -0.005;
    outerCurb.receiveShadow = true;
    stadium.add(outerCurb);

    const pylonCount = 12;
    const pylonFootingGeo = new THREE.CylinderGeometry(0.54, 0.66, 0.24, 6);
    const pylonGeo = new THREE.CylinderGeometry(0.2, 0.34, 3.6, 6);
    const pylonMat = new THREE.MeshStandardMaterial({
      color: arena.wallColorHex,
      metalness: 0.72,
      roughness: stadiumMaps ? 0.56 : 0.32,
      normalMap: stadiumMaps?.wallNormal ?? null,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: stadiumMaps?.wallRoughness ?? null,
    });
    const pylonFootings = new THREE.InstancedMesh(pylonFootingGeo, gunmetalRibMat, pylonCount);
    pylonFootings.castShadow = false;
    pylonFootings.receiveShadow = true;
    const pylons = new THREE.InstancedMesh(pylonGeo, pylonMat, pylonCount);
    pylons.castShadow = false;
    pylons.receiveShadow = true;
    const pylonAoGeo = new THREE.CircleGeometry(0.95, 20);
    pylonAoGeo.rotateX(-Math.PI / 2);
    const pylonAoDecals = new THREE.InstancedMesh(pylonAoGeo, pillarContactAoMat, pylonCount);

    const lightShroudGeo = new THREE.BoxGeometry(0.76, 0.34, 0.38);
    const lightShrouds = new THREE.InstancedMesh(lightShroudGeo, darkSteelMat, pylonCount);

    const lightBarGeo = new THREE.BoxGeometry(0.56, 0.18, 0.12);
    const lightBarMat = new THREE.MeshStandardMaterial({
      color: arena.trimColorHex,
      emissive: arena.trimColorHex,
      emissiveIntensity: 1.65,
      metalness: 0.15,
      roughness: 0.12,
    });
    this.lightBarMat = lightBarMat;
    const lightBars = new THREE.InstancedMesh(lightBarGeo, lightBarMat, pylonCount);

    for (let i = 0; i < pylonCount; i++) {
      const a = (i / pylonCount) * Math.PI * 2;
      const dist = 6.7;

      _pos.set(Math.cos(a) * (dist + 0.25), 0.1, Math.sin(a) * (dist + 0.25));
      _euler.set(0, -a, 0);
      _quat.setFromEuler(_euler);
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      pylonFootings.setMatrixAt(i, _mat4);

      _pos.set(Math.cos(a) * (dist + 0.25), 0.006, Math.sin(a) * (dist + 0.25));
      _quat.identity();
      _mat4.compose(_pos, _quat, _scale);
      pylonAoDecals.setMatrixAt(i, _mat4);

      _pos.set(Math.cos(a) * dist, 1.5, Math.sin(a) * dist);
      _euler.set(0, -a, 0.18);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      pylons.setMatrixAt(i, _mat4);

      _pos.set(Math.cos(a) * (dist - 0.34), 3.16, Math.sin(a) * (dist - 0.34));
      _euler.set(0, -a + Math.PI / 2, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      lightShrouds.setMatrixAt(i, _mat4);

      _pos.set(Math.cos(a) * (dist - 0.5), 3.14, Math.sin(a) * (dist - 0.5));
      _euler.set(0, -a + Math.PI / 2, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      lightBars.setMatrixAt(i, _mat4);
    }
    pylonFootings.computeBoundingSphere();
    pylons.computeBoundingSphere();
    pylonAoDecals.computeBoundingSphere();
    lightShrouds.computeBoundingSphere();
    lightBars.computeBoundingSphere();
    stadium.add(pylonFootings);
    stadium.add(pylonAoDecals);
    stadium.add(pylons);
    stadium.add(lightShrouds);
    stadium.add(lightBars);

    // Critical Phase Perimeter Surge Ring (3 segmented wall-side arcs keeping Ring-Out exit gates unobstructed)
    const critRingMat = new THREE.MeshBasicMaterial({
      color: CRITICAL_CRIMSON_HEX,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const critGroup = new THREE.Group();
    for (let g = 0; g < 3; g++) {
      const startA = gateAngles[g] + gateHalfSpan;
      const endA =
        (g === 2 ? gateAngles[0] + Math.PI * 2 : gateAngles[g + 1]) - gateHalfSpan;
      const span = endA - startA;
      const segGeo = new THREE.RingGeometry(
        ARENA_DISH_RADIUS - 0.22,
        ARENA_DISH_RADIUS - 0.05,
        28,
        1,
        -endA,
        span
      );
      segGeo.rotateX(-Math.PI / 2);
      critGroup.add(new THREE.Mesh(segGeo, critRingMat));
    }
    critGroup.position.y = dishEdgeY + 0.035;
    critGroup.visible = false;
    stadium.add(critGroup);
    this.criticalWarningRing = critGroup;
    this.criticalWarningMat = critRingMat;

    this.stadiumGroup = stadium;
    this.scene.add(stadium);
    this.rebuildModeReactiveElements();
  }

  private createMovingTrapVisual(params: {
    colorHex: number;
    radius: number;
    orbitRadius: number;
    baseX: number;
    baseZ: number;
    speed: number;
    phaseOffset: number;
    motionKind: 'orbit' | 'oscillate';
    ampX: number;
    ampZ: number;
    spinSpeed: number;
  }): ModeMovingTrapSlot {
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(params.radius * 0.78, params.radius, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: params.colorHex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const outerRing = new THREE.Mesh(ringGeo, ringMat);
    group.add(outerRing);

    const discGeo = new THREE.CircleGeometry(params.radius * 0.76, 28);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: params.colorHex,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.004;
    group.add(disc);

    // Spinning mechanical hazard blades/emitter core
    const spinner = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: params.colorHex,
      emissiveIntensity: 0.65,
      metalness: 0.75,
      roughness: 0.25,
    });
    const coreHub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 8), coreMat);
    coreHub.position.y = 0.07;
    spinner.add(coreHub);

    const vaneGeo = new THREE.BoxGeometry(params.radius * 1.45, 0.04, 0.07);
    const vaneA = new THREE.Mesh(vaneGeo, coreMat);
    vaneA.position.y = 0.09;
    spinner.add(vaneA);
    const vaneB = new THREE.Mesh(vaneGeo, coreMat);
    vaneB.position.y = 0.09;
    vaneB.rotation.y = Math.PI / 2;
    spinner.add(vaneB);
    group.add(spinner);

    return {
      group,
      spinner,
      ringMat,
      coreMat,
      orbitRadius: params.orbitRadius,
      baseX: params.baseX,
      baseZ: params.baseZ,
      speed: params.speed,
      phaseOffset: params.phaseOffset,
      motionKind: params.motionKind,
      ampX: params.ampX,
      ampZ: params.ampZ,
      spinSpeed: params.spinSpeed,
      baseColorHex: params.colorHex,
    };
  }

  private rebuildModeReactiveElements(): void {
    if (!this.stadiumGroup) return;
    if (this.modeReactiveGroup) {
      this.stadiumGroup.remove(this.modeReactiveGroup);
      disposeObject3D(this.modeReactiveGroup);
      this.modeReactiveGroup = null;
    }
    this.modeMovingTraps = [];
    this.modeRingVisuals = [];

    const group = new THREE.Group();
    const profile = resolveModeVisualProfile(
      this.battleEnv.matchMode,
      this.battleEnv.survivalWave,
      this.baseArenaTrimHex
    );
    const mut = this.battleEnv.mutators;

    // 1. Battle-mode dynamic moving traps (orbiting / sweeping dish elements)
    const dishEdgeY = ARENA_DISH_CURVATURE * ARENA_DISH_RADIUS * ARENA_DISH_RADIUS;
    for (let i = 0; i < profile.movingTrapCount; i++) {
      const angle = (i / Math.max(1, profile.movingTrapCount)) * Math.PI * 2 + 0.35;
      const orbitRadius = profile.trapKind === 'overload' ? 2.15 : profile.trapKind === 'championship' ? 3.15 : 2.55;
      const trap = this.createMovingTrapVisual({
        colorHex: profile.accentHex,
        radius: profile.trapKind === 'overload' ? 0.56 : 0.48,
        orbitRadius,
        baseX: Math.cos(angle) * orbitRadius,
        baseZ: Math.sin(angle) * orbitRadius,
        speed: (i % 2 === 0 ? 0.68 : -0.58) * profile.trapSpeedMult,
        phaseOffset: angle,
        motionKind: profile.trapKind === 'overload' && i === 1 ? 'oscillate' : 'orbit',
        ampX: 1.65,
        ampZ: 0.85,
        spinSpeed: i % 2 === 0 ? 3.4 : -3.4,
      });
      group.add(trap.group);
      this.modeMovingTraps.push(trap);
    }

    // 2. Double Hazards mutator: spawns two extra volatile sweeping hazard traps in any mode
    if (mut.doubleHazards) {
      for (let i = 0; i < 2; i++) {
        const angle = i * Math.PI + Math.PI * 0.25;
        const trap = this.createMovingTrapVisual({
          colorHex: 0xff5a2f,
          radius: 0.62,
          orbitRadius: 1.9,
          baseX: 0,
          baseZ: i === 0 ? -1.75 : 1.75,
          speed: i === 0 ? 0.92 : -0.92,
          phaseOffset: angle,
          motionKind: i === 0 ? 'oscillate' : 'orbit',
          ampX: 1.85,
          ampZ: 0.45,
          spinSpeed: 4.5,
        });
        group.add(trap.group);
        this.modeMovingTraps.push(trap);
      }
    }

    // 3. Championship floating stadium crest arcs (Tournament, segmented between Ring-Out gates)
    if (profile.showCrestRing) {
      const gateAngles = [Math.PI / 3, Math.PI, (5 * Math.PI) / 3];
      const gateHalfSpan = 0.26;
      const crestMat = new THREE.MeshBasicMaterial({
        color: profile.accentHex,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const crestGroup = new THREE.Group();
      for (let g = 0; g < 3; g++) {
        const startA = gateAngles[g] + gateHalfSpan;
        const endA =
          (g === 2 ? gateAngles[0] + Math.PI * 2 : gateAngles[g + 1]) - gateHalfSpan;
        const span = endA - startA;
        const arcCrestGeo = new THREE.TorusGeometry(ARENA_WALL_RADIUS + 0.22, 0.038, 8, 28, span);
        arcCrestGeo.rotateX(Math.PI / 2);
        const arcCrestMesh = new THREE.Mesh(arcCrestGeo, crestMat);
        arcCrestMesh.rotation.y = -startA;
        crestGroup.add(arcCrestMesh);
      }
      crestGroup.position.y = dishEdgeY + 1.04;
      group.add(crestGroup);
      this.modeRingVisuals.push({
        mesh: crestGroup,
        mat: crestMat,
        baseOpacity: 0.42,
        spinSpeed: 0,
        pulseOffset: 0,
        baseColorHex: profile.accentHex,
      });
    }

    // 4. Double Gravity mutator: inward gravity-well core pulse ring
    if (mut.doubleGravity) {
      const gravGeo = new THREE.RingGeometry(0.95, 1.15, 36);
      gravGeo.rotateX(-Math.PI / 2);
      const gravMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.46,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const gravMesh = new THREE.Mesh(gravGeo, gravMat);
      gravMesh.position.y = arenaFloorHeight(1.05, 0) + 0.03;
      group.add(gravMesh);
      this.modeRingVisuals.push({
        mesh: gravMesh,
        mat: gravMat,
        baseOpacity: 0.46,
        spinSpeed: -0.9,
        pulseOffset: 0.7,
        baseColorHex: 0xa855f7,
      });
    }

    // 5. Turbo Spin mutator: outer high-RPM slipstream ring
    if (mut.turboSpin) {
      const turboGeo = new THREE.RingGeometry(3.48, 3.62, 48, 1, 0, Math.PI * 1.6);
      turboGeo.rotateX(-Math.PI / 2);
      const turboMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.44,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const turboMesh = new THREE.Mesh(turboGeo, turboMat);
      turboMesh.position.y = arenaFloorHeight(3.55, 0) + 0.03;
      group.add(turboMesh);
      this.modeRingVisuals.push({
        mesh: turboMesh,
        mat: turboMat,
        baseOpacity: 0.44,
        spinSpeed: 2.2,
        pulseOffset: 1.4,
        baseColorHex: 0x38bdf8,
      });
    }

    // 6. Ring-Out Only mutator: amplified exit gate beacons
    if (mut.ringOutOnly) {
      const gateAngles = [Math.PI / 3, Math.PI, -Math.PI / 3];
      for (let i = 0; i < gateAngles.length; i++) {
        const ga = gateAngles[i];
        const gateGeo = new THREE.RingGeometry(0.28, 0.42, 16);
        gateGeo.rotateX(-Math.PI / 2);
        const gateMat = new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const gateRing = new THREE.Mesh(gateGeo, gateMat);
        gateRing.position.set(
          Math.cos(ga) * (ARENA_DISH_RADIUS - 0.15),
          dishEdgeY + 0.04,
          Math.sin(ga) * (ARENA_DISH_RADIUS - 0.15)
        );
        group.add(gateRing);
        this.modeRingVisuals.push({
          mesh: gateRing,
          mat: gateMat,
          baseOpacity: 0.65,
          spinSpeed: 1.5,
          pulseOffset: i * 1.1,
          baseColorHex: 0xf43f5e,
        });
      }
    }

    this.modeReactiveGroup = group;
    this.stadiumGroup.add(group);
  }

  private raycastDishFloor(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, this.camera);
    _aimPlane.constant = -0.32;
    if (_raycaster.ray.intersectPlane(_aimPlane, _hitPoint)) {
      // Refine onto parabolic dish surface y = arenaFloorHeight(x, z)
      for (let iter = 0; iter < 2; iter++) {
        _aimPlane.constant = -arenaFloorHeight(_hitPoint.x, _hitPoint.z);
        _raycaster.ray.intersectPlane(_aimPlane, _hitPoint);
      }
      const r = Math.hypot(_hitPoint.x, _hitPoint.z);
      if (r <= ARENA_DISH_RADIUS) {
        return _hitPoint;
      }
      const s = (ARENA_DISH_RADIUS * 0.96) / Math.max(0.01, r);
      _hitPoint.x *= s;
      _hitPoint.z *= s;
      return _hitPoint;
    }
    return null;
  }

  private raycastWorkshopPart(clientX: number, clientY: number): ComponentCategory | null {
    if (!this.playerRig) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, this.camera);
    const hits = _raycaster.intersectObjects(this.playerRig.spinGroup.children, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      let isVisible = true;
      let cat: ComponentCategory | undefined;
      while (obj) {
        if (!obj.visible) {
          isVisible = false;
          break;
        }
        if (!cat && obj.userData?.workshopCategory) {
          cat = obj.userData.workshopCategory as ComponentCategory;
        }
        obj = obj.parent;
      }
      if (isVisible && cat) {
        return cat;
      }
    }
    return null;
  }

  private bindPointerControls(): void {
    const el = this.renderer.domElement;

    const getPinchDistance = (): number | null => {
      if (this.activePointers.size < 2) return null;
      const pts = Array.from(this.activePointers.values());
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onDown = (e: PointerEvent) => {
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore unsupported pointer capture
      }

      const sim = this.simGetter();
      let mode: 'aim' | 'orbit' = 'orbit';
      if (
        this.activePointers.size === 0 &&
        sim &&
        sim.phase === 'Launch' &&
        this.cameraMode === 'battle'
      ) {
        const hit = this.raycastDishFloor(e.clientX, e.clientY);
        if (hit && e.pointerType !== 'mouse') {
          // On touch screens, dragging on the dish aims continuously without rotating the camera
          mode = 'aim';
          this.onAimPoint?.(hit.x, hit.z, false);
        }
      }

      this.activePointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        downX: e.clientX,
        downY: e.clientY,
        mode,
        pointerType: e.pointerType,
      });

      if (this.activePointers.size === 2) {
        this.lastPinchDist = getPinchDistance();
      } else {
        this.lastPinchDist = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      const sim = this.simGetter();
      const tracked = this.activePointers.get(e.pointerId);

      // Desktop mouse hover updates live trajectory reticle without needing drag
      if (!tracked && e.pointerType === 'mouse') {
        if (sim && sim.phase === 'Launch' && this.cameraMode === 'battle') {
          const hit = this.raycastDishFloor(e.clientX, e.clientY);
          if (hit) {
            this.onAimPoint?.(hit.x, hit.z, false);
          }
        }
        return;
      }

      if (!tracked) return;
      const dx = e.clientX - tracked.x;
      const dy = e.clientY - tracked.y;
      tracked.x = e.clientX;
      tracked.y = e.clientY;

      // Two-finger pinch zoom
      if (this.activePointers.size >= 2) {
        const dist = getPinchDistance();
        if (dist !== null && this.lastPinchDist !== null) {
          const delta = this.lastPinchDist - dist;
          this.cameraZoom = Math.max(0.65, Math.min(1.45, this.cameraZoom + delta * 0.0032));
        }
        this.lastPinchDist = dist;
        return;
      }

      if (tracked.mode === 'aim' && sim && sim.phase === 'Launch' && this.cameraMode === 'battle') {
        const hit = this.raycastDishFloor(e.clientX, e.clientY);
        if (hit) {
          this.onAimPoint?.(hit.x, hit.z, false);
        }
        return;
      }

      this.cameraYaw -= dx * 0.006 * this.cameraSensitivity;
      this.cameraPitch = Math.max(
        0.22,
        Math.min(1.26, this.cameraPitch + dy * 0.004 * this.cameraSensitivity)
      );
    };

    const onUpOrCancel = (e: PointerEvent) => {
      const tracked = this.activePointers.get(e.pointerId);
      const wasMulti = this.activePointers.size > 1;
      this.activePointers.delete(e.pointerId);
      this.lastPinchDist = getPinchDistance();

      try {
        if (el.hasPointerCapture?.(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      if (!tracked || wasMulti || e.type === 'pointercancel') return;

      const moved = Math.hypot(e.clientX - tracked.downX, e.clientY - tracked.downY);
      if (this.cameraMode === 'workshop' && moved < 8) {
        const pickedCategory = this.raycastWorkshopPart(e.clientX, e.clientY);
        if (pickedCategory) {
          this.onSelectWorkshopPart?.(pickedCategory);
        }
        return;
      }
      const sim = this.simGetter();
      if (sim && sim.phase === 'Launch' && this.cameraMode === 'battle') {
        const hit = this.raycastDishFloor(e.clientX, e.clientY);
        if (hit) {
          // Quick tap commits launch on both desktop & touch; dragged touch leaves aim positioned for Lock & Launch confirmation
          const tapThreshold = tracked.pointerType === 'mouse' ? 8 : 12;
          this.onAimPoint?.(hit.x, hit.z, moved < tapThreshold);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      this.cameraZoom = Math.max(0.65, Math.min(1.45, this.cameraZoom + e.deltaY * 0.0008));
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUpOrCancel);
    el.addEventListener('pointercancel', onUpOrCancel);
    el.addEventListener('wheel', onWheel, { passive: true });

    this.unbindPointer = () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUpOrCancel);
      el.removeEventListener('pointercancel', onUpOrCancel);
      el.removeEventListener('wheel', onWheel);
    };
  }

  private unbindPointer: () => void = () => {};

  private handleResize(): void {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    this.compactLandscape = w > h && h <= 520;
    this.camera.fov = this.compactLandscape ? 48 : 44;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      this.bloomPass?.resolution.set(w, h);
    }
  }

  private updateParticles(dt: number): void {
    let anyDirty = false;
    const rimRadius = ARENA_DISH_RADIUS - 0.06;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyDirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _pos.set(0, -100, 0);
        _scale.setScalar(0);
        _mat4.compose(_pos, _quat, _scale);
        this.particleMesh.setMatrixAt(i, _mat4);
        this.sparkMetaAttr.setXYZW(i, 0, 0, 0, 0);
        continue;
      }

      const dragPow = Math.pow(p.drag, dt * 60);
      p.vx *= dragPow;
      p.vz *= dragPow;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Ricochet fast grinder sparks off the steel arena wall
      const rad = Math.hypot(p.x, p.z);
      if (rad > rimRadius && rad > 0.01) {
        const nx = p.x / rad;
        const nz = p.z / rad;
        p.x = nx * rimRadius;
        p.z = nz * rimRadius;
        const vn = p.vx * nx + p.vz * nz;
        if (vn > 0) {
          p.vx -= 1.55 * vn * nx;
          p.vz -= 1.55 * vn * nz;
          p.vx *= 0.72;
          p.vz *= 0.72;
        }
      }

      // Crisp multi-skip ricochet across the curved arena floor with slight lateral scatter
      const floorY = arenaFloorHeight(p.x, p.z) + 0.025;
      if (p.y < floorY && p.vy < 0) {
        p.y = floorY;
        if (p.bouncesLeft > 0 && Math.abs(p.vy) > 0.55) {
          p.bouncesLeft -= 1;
          p.vy = -p.vy * (p.kind > 0.5 ? 0.42 + Math.random() * 0.24 : 0.32);
          p.vx = p.vx * 0.8 + (Math.random() - 0.5) * 1.6;
          p.vz = p.vz * 0.8 + (Math.random() - 0.5) * 1.6;
        } else {
          p.vy = -p.vy * 0.25;
          p.vx *= 0.78;
          p.vz *= 0.78;
        }
      }

      const lifeRatio = Math.max(0, p.life / p.maxLife);

      // Authentic carbon-steel grinder spark mid-air starburst micro-forking
      if (
        p.kind > 0.5 &&
        !p.forkDone &&
        lifeRatio < 0.36 &&
        lifeRatio > 0.14 &&
        p.seed > 0.64 &&
        this.currentQuality !== 'Low' &&
        !this.reducedMotion
      ) {
        p.forkDone = true;
        const speedHoriz = Math.hypot(p.vx, p.vz);
        if (speedHoriz > 1.8) {
          const baseAng = Math.atan2(p.vz, p.vx);
          for (let fIdx = 0; fIdx < 2; fIdx++) {
            const branchAng = baseAng + (fIdx === 0 ? 1 : -1) * (0.45 + Math.random() * 0.42);
            const branchSpd = speedHoriz * (0.68 + Math.random() * 0.32);
            this.emitSparkParticle({
              x: p.x,
              y: p.y,
              z: p.z,
              vx: Math.cos(branchAng) * branchSpd,
              vy: p.vy * 0.65 + 0.6 + Math.random() * 1.4,
              vz: Math.sin(branchAng) * branchSpd,
              maxLife: 0.12 + Math.random() * 0.08,
              size: p.size * 0.62,
              colorHex: 0xfef08a,
              gravity: 11.5,
              drag: 0.91,
              kind: 1,
              heat: 1.75,
              bouncesLeft: 1,
              forkDone: true,
            });
          }
        }
      }

      _pos.set(p.x, p.y, p.z);
      _dirVec.set(p.vx, p.vy, p.vz);
      const speedSq = _dirVec.lengthSq();
      if (speedSq > 0.02) {
        const speed = Math.sqrt(speedSq);
        _dirVec.divideScalar(speed);
        _quat.setFromUnitVectors(_upVec, _dirVec);
        const streakLen = Math.min(0.72, Math.max(0.055, speed * 0.044)) * p.size * (0.45 + 0.55 * lifeRatio);
        const ribbonWidth = (p.kind > 0.5 ? 0.032 : 0.048) * p.size * (0.42 + 0.58 * lifeRatio);
        _scale.set(ribbonWidth, streakLen, ribbonWidth);
      } else {
        _quat.identity();
        const dotSize = 0.042 * p.size * lifeRatio;
        _scale.setScalar(dotSize);
      }
      _mat4.compose(_pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, _color.setHex(p.colorHex));
      this.sparkMetaAttr.setXYZW(i, lifeRatio, p.kind, p.seed, p.heat);
    }
    if (anyDirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
      this.sparkMetaAttr.needsUpdate = true;
    }

    // Update Contact Arc Flares (camera-facing blinding metal-on-metal starburst)
    for (let i = 0; i < MAX_ARC_FLARES; i++) {
      const af = this.arcFlares[i];
      if (!af.active) continue;
      af.life -= dt;
      if (af.life <= 0) {
        af.active = false;
        af.mesh.visible = false;
        continue;
      }
      const progress = 1 - af.life / af.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2.6);
      const sc = af.startScale + (af.endScale - af.startScale) * eased;
      af.mesh.quaternion.copy(this.camera.quaternion);
      af.mesh.rotateZ(af.rollAngle);
      af.mesh.scale.setScalar(sc);
      (af.mesh.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - progress, 1.5);
    }

    // Update expanding shockwave rings
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.life -= dt;
      if (sw.life <= 0) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const progress = 1 - sw.life / sw.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2.2);
      const sc = sw.startScale + (sw.endScale - sw.startScale) * eased;
      sw.mesh.scale.setScalar(sc);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.72;
    }

    // Update anime curved rim slash arcs
    for (let i = 0; i < MAX_SLASH_ARCS; i++) {
      const sa = this.slashArcs[i];
      if (!sa.active) continue;
      sa.life -= dt;
      if (sa.life <= 0) {
        sa.active = false;
        sa.mesh.visible = false;
        continue;
      }
      const progress = 1 - sa.life / sa.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2.4);
      const sc = sa.startScale + (sa.endScale - sa.startScale) * eased;
      sa.mesh.rotation.set(sa.tiltX, sa.baseSpin + sa.spinDelta * eased, sa.tiltZ, 'YXZ');
      sa.mesh.scale.setScalar(sc);
      (sa.mesh.material as THREE.MeshBasicMaterial).opacity =
        sa.baseOpacity * Math.pow(1 - progress, 1.45);
    }

    // Update anime contact cleave beams
    for (let i = 0; i < MAX_CLEAVE_BEAMS; i++) {
      const cb = this.cleaveBeams[i];
      if (!cb.active) continue;
      cb.life -= dt;
      if (cb.life <= 0) {
        cb.active = false;
        cb.mesh.visible = false;
        continue;
      }
      const progress = 1 - cb.life / cb.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2.2);
      const sy = cb.startScaleY + (cb.endScaleY - cb.startScaleY) * eased;
      cb.mesh.quaternion.copy(this.camera.quaternion);
      cb.mesh.rotateZ(cb.rollAngle);
      cb.mesh.scale.set(cb.width * (1 - progress * 0.45), sy, 1);
      (cb.mesh.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - progress, 1.4);
    }

    // Cool transient thermal floor scorch glow decals into the underlying permanent canvas scar
    for (let i = 0; i < this.thermalScorches.length; i++) {
      const slot = this.thermalScorches[i];
      if (!slot.active) continue;
      slot.life -= dt;
      if (slot.life <= 0) {
        slot.active = false;
        slot.mesh.visible = false;
        continue;
      }
      const ratio = slot.life / slot.maxLife;
      const mat = slot.mesh.material as THREE.MeshBasicMaterial;
      _color.setHex(slot.coolHex);
      _color2.setHex(slot.hotHex);
      _color.lerp(_color2, Math.pow(ratio, 1.35));
      mat.color.copy(_color);
      mat.opacity = slot.baseOpacity * Math.pow(ratio, 1.6);
    }

    // Flush throttled scrape marks on scuffCanvas
    if (this.scuffDirty && this.scuffTex) {
      this.scuffUploadAccum += dt;
      if (this.scuffUploadAccum >= 0.065) {
        this.scuffUploadAccum = 0;
        this.scuffTex.needsUpdate = true;
        this.scuffDirty = false;
      }
    }

    // Update ballistic 3D ejected part fragments (gravity + exact bounding-box dish grounding + flat settle)
    for (let i = this.ejectedParts.length - 1; i >= 0; i--) {
      const d = this.ejectedParts[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        disposeObject3D(d.mesh);
        this.ejectedParts.splice(i, 1);
        continue;
      }

      d.vy -= 11.5 * dt;
      d.vx *= Math.exp(-0.55 * dt);
      d.vz *= Math.exp(-0.55 * dt);

      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;

      const r = Math.hypot(d.mesh.position.x, d.mesh.position.z);
      if (r > ARENA_DISH_RADIUS - 0.34 && r > 0.01) {
        const nx = d.mesh.position.x / r;
        const nz = d.mesh.position.z / r;
        d.mesh.position.x = nx * (ARENA_DISH_RADIUS - 0.34);
        d.mesh.position.z = nz * (ARENA_DISH_RADIUS - 0.34);
        const vn = d.vx * nx + d.vz * nz;
        if (vn > 0) {
          d.vx -= 1.4 * vn * nx;
          d.vz -= 1.4 * vn * nz;
        }
      }

      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.y += d.ry * dt;
      d.mesh.rotation.z += d.rz * dt;

      const lifeRatio = d.life / d.maxLife;
      const scaleFactor = lifeRatio < 0.15 ? Math.max(0.02, lifeRatio / 0.15) : 1.0;
      d.mesh.scale.copy(d.baseScale).multiplyScalar(scaleFactor);

      // Compute exact world-space lowest vertex so parts land and rest ON TOP of the arena dish
      d.mesh.updateMatrixWorld(true);
      _partBox.setFromObject(d.mesh);
      const floorY = arenaFloorHeight(d.mesh.position.x, d.mesh.position.z) + 0.018;
      if (_partBox.min.y < floorY) {
        const impactSpeed = Math.abs(d.vy);
        if (d.wasAirborne && d.landingEmissionsLeft > 0 && impactSpeed > 0.35) {
          const isPrimary = d.landingEmissionsLeft === 2;
          this.emitDebrisLandingParticles(
            d.mesh.position.x,
            floorY,
            d.mesh.position.z,
            impactSpeed,
            d.partSize,
            d.colorHex,
            isPrimary
          );
          d.landingEmissionsLeft -= 1;
        }
        d.wasAirborne = false;

        d.mesh.position.y += floorY - _partBox.min.y;
        if (d.vy < -0.45) {
          d.vy = -d.vy * 0.34;
          d.vx *= 0.72;
          d.vz *= 0.72;
          d.rx *= 0.55;
          d.ry *= 0.75;
          d.rz *= 0.55;
          if (d.vy > 0.45) {
            d.wasAirborne = true;
          }
        } else {
          d.vy = 0;
          const groundDamp = Math.exp(-6.5 * dt);
          d.vx *= groundDamp;
          d.vz *= groundDamp;
          d.rx *= Math.exp(-9.0 * dt);
          d.rz *= Math.exp(-9.0 * dt);
          d.ry *= Math.exp(-5.0 * dt);
          // Gently flatten pitch/roll to settle flush on the floor
          d.mesh.rotation.x *= Math.exp(-7.0 * dt);
          d.mesh.rotation.z *= Math.exp(-7.0 * dt);
          d.mesh.updateMatrixWorld(true);
          _partBox.setFromObject(d.mesh);
          if (_partBox.min.y < floorY) {
            d.mesh.position.y += floorY - _partBox.min.y;
          }
        }
      } else if (_partBox.min.y > floorY + 0.045) {
        d.wasAirborne = true;
      }
    }

    // Update grounded floor-debris landing particles (varying sizes per part + realistic short linger)
    let anyDebrisDirty = false;
    for (let i = 0; i < MAX_DEBRIS_PARTICLES; i++) {
      const dp = this.debrisParticles[i];
      if (!dp.active) continue;
      anyDebrisDirty = true;
      dp.life -= dt;
      if (dp.life <= 0) {
        dp.active = false;
        _pos.set(0, -100, 0);
        _scale.setScalar(0);
        _mat4.compose(_pos, _quat, _scale);
        this.debrisParticleMesh.setMatrixAt(i, _mat4);
        continue;
      }

      dp.vy -= 12.0 * dt;
      dp.vx *= Math.exp(-0.9 * dt);
      dp.vz *= Math.exp(-0.9 * dt);
      dp.x += dp.vx * dt;
      dp.y += dp.vy * dt;
      dp.z += dp.vz * dt;

      const dRad = Math.hypot(dp.x, dp.z);
      if (dRad > ARENA_DISH_RADIUS - 0.16 && dRad > 0.01) {
        const nx = dp.x / dRad;
        const nz = dp.z / dRad;
        dp.x = nx * (ARENA_DISH_RADIUS - 0.16);
        dp.z = nz * (ARENA_DISH_RADIUS - 0.16);
        const vn = dp.vx * nx + dp.vz * nz;
        if (vn > 0) {
          dp.vx -= 1.35 * vn * nx;
          dp.vz -= 1.35 * vn * nz;
        }
      }

      const dFloorY = arenaFloorHeight(dp.x, dp.z) + 0.015 * dp.baseSize;
      if (dp.y <= dFloorY) {
        dp.y = dFloorY;
        if (dp.vy < -0.45) {
          dp.vy = -dp.vy * 0.28;
          dp.vx *= 0.65;
          dp.vz *= 0.65;
          dp.vrx *= 0.55;
          dp.vry *= 0.65;
          dp.vrz *= 0.55;
        } else {
          dp.vy = 0;
          const slideDamp = Math.exp(-7.5 * dt);
          dp.vx *= slideDamp;
          dp.vz *= slideDamp;
          dp.vrx *= Math.exp(-8.5 * dt);
          dp.vry *= Math.exp(-6.5 * dt);
          dp.vrz *= Math.exp(-8.5 * dt);
        }
      }

      dp.rx += dp.vrx * dt;
      dp.ry += dp.vry * dt;
      dp.rz += dp.vrz * dt;

      const lifeRatio = dp.life / dp.maxLife;
      const lingerScale = lifeRatio < 0.28 ? Math.max(0.02, lifeRatio / 0.28) : 1.0;
      _pos.set(dp.x, dp.y, dp.z);
      _euler.set(dp.rx, dp.ry, dp.rz);
      _quat.setFromEuler(_euler);
      _scale.setScalar(dp.baseSize * lingerScale);
      _mat4.compose(_pos, _quat, _scale);
      this.debrisParticleMesh.setMatrixAt(i, _mat4);
      this.debrisParticleMesh.setColorAt(i, _color.setHex(dp.colorHex));
    }
    if (anyDebrisDirty) {
      this.debrisParticleMesh.instanceMatrix.needsUpdate = true;
      if (this.debrisParticleMesh.instanceColor) {
        this.debrisParticleMesh.instanceColor.needsUpdate = true;
      }
    }

    // Decay dynamic impact point light & combine stadium lighting flash + Critical Phase environment lighting
    if (this.clashLightIntensity > 0.02) {
      this.clashLightIntensity *= Math.exp(-15 * dt);
      this.clashLight.intensity = this.clashLightIntensity;
    } else {
      this.clashLightIntensity = 0;
      this.clashLight.intensity = 0;
    }

    const crit = this.criticalBlend;
    const critPulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.envTime * 5.2);
    const profile = resolveModeVisualProfile(
      this.battleEnv.matchMode,
      this.battleEnv.survivalWave,
      this.baseArenaTrimHex
    );

    let flashRatio = 0;
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      flashRatio = (this.flashTimer / Math.max(0.01, this.flashMaxDuration)) * this.flashPeakIntensity;
    }

    // Reactive Rim Light (arena trim -> battle mode accent -> Critical Crimson -> Clash Flash)
    _color.setHex(this.baseRimHex);
    if (this.cameraMode === 'battle' && profile.modeTintWeight > 0) {
      _color2.setHex(profile.rimHex);
      _color.lerp(_color2, profile.modeTintWeight);
    }
    if (crit > 0.005) {
      _color2.setHex(CRITICAL_CRIMSON_HEX);
      _color.lerp(_color2, crit * 0.85);
    }
    if (flashRatio > 0.005) {
      _flashColor.setHex(this.flashColorHex);
      _color.lerp(_flashColor, Math.min(1, flashRatio));
    }
    this.rimLight.color.copy(_color);
    this.rimLight.intensity = 1.35 + crit * (0.65 + critPulse * 0.45) + flashRatio * 2.2;
    if (this.fillRimLight) {
      this.fillRimLight.intensity = 0.36 + crit * 0.12;
    }

    // Reactive Key Light & Hemisphere Light
    _color.setHex(0xfff2dc);
    if (crit > 0.005) {
      _color2.setHex(0xffd6cc);
      _color.lerp(_color2, crit * 0.55);
    }
    this.keyLight.color.copy(_color);
    this.keyLight.intensity = 2.65 + crit * 0.25 + flashRatio * 1.4;

    if (this.hemiLight) {
      _color.setHex(0x7dd3fc);
      if (this.cameraMode === 'battle' && profile.modeTintWeight > 0) {
        _color2.setHex(profile.rimHex);
        _color.lerp(_color2, profile.modeTintWeight * 0.4);
      }
      if (crit > 0.005) {
        _color2.setHex(0xfda4af);
        _color.lerp(_color2, crit * 0.65);
      }
      this.hemiLight.color.copy(_color);

      _color.setHex(0x101324);
      if (crit > 0.005) {
        _color2.setHex(CRITICAL_HEMI_GROUND_HEX);
        _color.lerp(_color2, crit * 0.85);
      }
      this.hemiLight.groundColor.copy(_color);
      this.hemiLight.intensity = 0.42 + crit * 0.14;
    }

    // Reactive Critical Overhead Spot + Atmospheric Fog
    if (this.criticalOverheadLight) {
      this.criticalOverheadLight.intensity = crit * (1.8 + critPulse * 1.35);
    }
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      const weatherDef = getWeatherDefinition(this.currentWeather);
      _color.setHex(this.baseSkyHex);
      if (this.currentWeather !== 'Clear') {
        _color2.setHex(weatherDef.fogHex);
        _color.lerp(_color2, 0.48);
      }
      if (crit > 0.005) {
        _color2.setHex(CRITICAL_FOG_HEX);
        _color.lerp(_color2, crit * 0.58);
      }
      this.scene.fog.color.copy(_color);
      this.scene.fog.density =
        (this.baseFogDensity + weatherDef.fogDensityBoost) * (1 + crit * 0.36);
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.copy(_color);
      }
    }

    // Reactive Stadium Trim Rails, Pylon Light Bars & Critical Perimeter Surge Ring
    if (this.neonTrimMat && this.lightBarMat) {
      _color.setHex(this.baseArenaTrimHex);
      if (this.cameraMode === 'battle' && profile.modeTintWeight > 0) {
        _color2.setHex(profile.accentHex);
        _color.lerp(_color2, profile.modeTintWeight);
      }
      if (crit > 0.005) {
        _color2.setHex(CRITICAL_CRIMSON_HEX);
        _color3.setHex(CRITICAL_AMBER_HEX);
        _color2.lerp(_color3, critPulse * 0.45);
        _color.lerp(_color2, crit * 0.9);
      }
      this.neonTrimMat.color.copy(_color);
      this.neonTrimMat.emissive.copy(_color);
      this.lightBarMat.color.copy(_color);
      this.lightBarMat.emissive.copy(_color);
    }
    if (this.innerRimBandMat) {
      this.innerRimBandMat.emissiveIntensity = 1.25 + crit * (0.4 + critPulse * 0.35) + flashRatio * 0.85;
    }

    if (this.gateBeaconMat) {
      const gateAlert = this.battleEnv.mutators.ringOutOnly ? Math.max(crit, 0.55) : crit;
      _color.setHex(0xf43f5e);
      if (gateAlert > 0.05) {
        _color2.setHex(0xfef08a);
        _color.lerp(_color2, gateAlert * critPulse * 0.55);
      }
      this.gateBeaconMat.color.copy(_color);
      this.gateBeaconMat.emissive.copy(_color);
    }

    if (this.criticalWarningRing && this.criticalWarningMat) {
      this.criticalWarningRing.visible = crit > 0.02;
      if (this.criticalWarningRing.visible) {
        this.criticalWarningMat.opacity = crit * (0.28 + critPulse * 0.35);
      }
    }

    this.renderer.toneMappingExposure = 1.08 + crit * 0.05 + flashRatio * 0.24;
  }

  private updateTopKinematics(
    k: TopKinematicsState,
    x: number,
    floorY: number,
    z: number,
    vx: number,
    vz: number,
    omega: number,
    dt: number,
    side: 'player' | 'opponent',
    accentHex: number
  ): void {
    if (dt <= 0) return;

    // 1. Launch Slam vertical drop & microscopic metal-on-metal bounce
    if (k.dropActive) {
      if (k.dropDelay > 0) {
        k.dropDelay = Math.max(0, k.dropDelay - dt);
      } else {
        k.dropVy -= 26.5 * dt;
        k.dropY += k.dropVy * dt;
        if (k.dropY <= 0) {
          k.dropY = 0;
          if (!k.didPrimaryLand) {
            k.didPrimaryLand = true;
            const impactPower = Math.max(0.55, Math.min(1.25, 0.72 + k.lastPowerRatio * 0.42));
            this.emitDebrisLandingParticles(
              x,
              floorY + 0.015,
              z,
              1.65 * impactPower,
              0.72,
              0x94a3b8,
              true
            );
            this.spawnBurstParticles(x, floorY + 0.03, z, 12, 0xffd166, 3.6 * impactPower, {
              gravity: 13.2,
              drag: 0.93,
              maxLife: 0.22,
              sizeMult: 0.72,
              kind: 'metal',
              heat: 1.38,
              bounces: 2,
            });
            this.spawnShockwave(x, floorY, z, accentHex, 2.05, 0.2);
            this.recordLaunchScuff(x, z, vx, vz);

            // Micro landing tilt wobble along launch motion
            const spd = Math.hypot(vx, vz) || 1;
            k.recoilVelZ -= (vx / spd) * 1.35 * impactPower;
            k.recoilVelX += (vz / spd) * 1.35 * impactPower;

            if (side === 'player') {
              this.triggerCameraDip(0.95 * impactPower);
              this.triggerWallTremor(0.48 * impactPower, vx, vz, false);
              this.onLaunchSlamSfx?.(impactPower);
            } else {
              this.triggerCameraDip(0.5 * impactPower);
              this.triggerWallTremor(0.32 * impactPower, vx, vz, false);
            }
          }

          if (k.bouncesLeft > 0 && Math.abs(k.dropVy) > 0.48) {
            k.dropVy = Math.abs(k.dropVy) * 0.24;
            k.bouncesLeft -= 1;
            if (k.bouncesLeft === 0) {
              this.spawnBurstParticles(x, floorY + 0.02, z, 4, 0xffe4a0, 2.1, {
                gravity: 12.0,
                drag: 0.92,
                maxLife: 0.14,
                sizeMult: 0.52,
                kind: 'metal',
                heat: 1.25,
                bounces: 1,
              });
            }
          } else {
            k.dropVy = 0;
            k.dropY = 0;
            k.dropActive = false;
          }
        }
      }
    }

    // 2. Impact Recoil / Gyroscopic Wobble Damped Spring
    const stepDt = Math.min(dt, 0.035);
    const springK = 225;
    const dampingC = 15.8;
    const gyroCoupling = Math.min(1.2, omega / 110) * 28;
    const ax = -springK * k.recoilTiltX - dampingC * k.recoilVelX - gyroCoupling * k.recoilTiltZ;
    const az = -springK * k.recoilTiltZ - dampingC * k.recoilVelZ + gyroCoupling * k.recoilTiltX;
    k.recoilVelX += ax * stepDt;
    k.recoilVelZ += az * stepDt;
    k.recoilTiltX += k.recoilVelX * stepDt;
    k.recoilTiltZ += k.recoilVelZ * stepDt;

    const maxRecoil = 0.31;
    const mag = Math.hypot(k.recoilTiltX, k.recoilTiltZ);
    if (mag > maxRecoil) {
      const s = maxRecoil / mag;
      k.recoilTiltX *= s;
      k.recoilTiltZ *= s;
    }
    if (
      mag < 0.0008 &&
      Math.hypot(k.recoilVelX, k.recoilVelZ) < 0.005
    ) {
      k.recoilTiltX = 0;
      k.recoilTiltZ = 0;
      k.recoilVelX = 0;
      k.recoilVelZ = 0;
    }

    // 3. Heavy-tilt / recoil rim scrape marks against the bowl floor
    if (k.scrapeCooldown > 0) {
      k.scrapeCooldown = Math.max(0, k.scrapeCooldown - dt);
    }
    if (!k.dropActive && mag > 0.13 && k.scrapeCooldown <= 0) {
      k.scrapeCooldown = 0.1;
      this.recordScrapeMark(x, z, vx, vz, mag);
    }
  }

  private updateStructuralAndCameraKinematics(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0.001), 0.04);

    // Wall/stadium tremor spring
    const wallK = 2300;
    const wallC = 38;
    this.wallTremorVel.x += (-wallK * this.wallTremorPos.x - wallC * this.wallTremorVel.x) * dt;
    this.wallTremorVel.y += (-wallK * this.wallTremorPos.y - wallC * this.wallTremorVel.y) * dt;
    this.wallTremorVel.z += (-wallK * this.wallTremorPos.z - wallC * this.wallTremorVel.z) * dt;
    this.wallTremorPos.addScaledVector(this.wallTremorVel, dt);
    if (this.wallTremorPos.lengthSq() > 0.0004) {
      this.wallTremorPos.setLength(0.02);
    }
    if (this.wallRecoilGroup) {
      if (this.reducedMotion) {
        this.wallRecoilGroup.position.set(0, 0, 0);
        this.wallRecoilGroup.rotation.set(0, 0, 0);
      } else {
        this.wallRecoilGroup.position.copy(this.wallTremorPos);
        this.wallRecoilGroup.rotation.set(
          this.wallTremorPos.z * 0.08,
          0,
          -this.wallTremorPos.x * 0.08
        );
      }
    }

    // Camera vertical Launch Slam settle dip
    const dipK = 260;
    const dipC = 22;
    this.camDipVelY += (-dipK * this.camDipY - dipC * this.camDipVelY) * dt;
    this.camDipY += this.camDipVelY * dt;
    this.camDipY = Math.max(-0.16, Math.min(0.12, this.camDipY));

    // Directional camera recoil micro-shake
    const camK = 980;
    const camC = 32;
    this.camRecoilVel.x += (-camK * this.camRecoilPos.x - camC * this.camRecoilVel.x) * dt;
    this.camRecoilVel.y += (-camK * this.camRecoilPos.y - camC * this.camRecoilVel.y) * dt;
    this.camRecoilVel.z += (-camK * this.camRecoilPos.z - camC * this.camRecoilVel.z) * dt;
    this.camRecoilPos.addScaledVector(this.camRecoilVel, dt);
    if (this.camRecoilPos.lengthSq() > 0.032) {
      this.camRecoilPos.setLength(0.18);
    }
  }

  private applyRigVisualState(
    rig: TopVisualRig,
    shadow: THREE.Mesh,
    trail: THREE.Mesh,
    innerTrail: THREE.Mesh,
    x: number,
    y: number,
    z: number,
    spinAngle: number,
    wobbleTilt: number,
    wobblePhase: number,
    staminaRatio: number,
    hitFlashTimer: number,
    hasShield: boolean,
    hasFire: boolean,
    visible: boolean,
    recoilTiltX = 0,
    recoilTiltZ = 0
  ): void {
    rig.root.visible = visible;
    shadow.visible = visible;
    trail.visible = visible && staminaRatio > 0.15;
    innerTrail.visible = visible && staminaRatio > 0.25 && this.currentQuality !== 'Low';
    if (!visible) return;

    const totalTiltX = Math.cos(wobblePhase) * wobbleTilt + recoilTiltX;
    const totalTiltZ = Math.sin(wobblePhase) * wobbleTilt + recoilTiltZ;
    rig.root.position.set(x, y, z);
    rig.root.rotation.set(totalTiltX, 0, totalTiltZ);
    rig.spinGroup.rotation.y = spinAngle;
    const blurMat = rig.blurDisc.material as THREE.MeshBasicMaterial;
    if (rig.bladeGroup.visible && staminaRatio > 0.22) {
      rig.blurDisc.visible = true;
      blurMat.opacity = Math.min(0.28, (staminaRatio - 0.22) * 0.34);
      rig.blurDisc.rotation.y = spinAngle * 0.65;
    } else {
      rig.blurDisc.visible = false;
      blurMat.opacity = 0;
    }
    rig.shieldBubble.visible = hasShield;
    if (hasShield) {
      rig.shieldBubble.rotation.y = -spinAngle * 0.35;
      const sScale = 1 + Math.sin(wobblePhase * 4.5) * 0.04;
      rig.shieldBubble.scale.setScalar(sScale);
    }

    rig.fireAura.visible = hasFire;
    if (hasFire) {
      rig.fireAura.rotation.y = spinAngle * 1.35;
      const fPulse = 0.95 + Math.sin(wobblePhase * 6.5) * 0.08;
      rig.fireAura.scale.set(fPulse, 1 + Math.cos(wobblePhase * 8.2) * 0.18, fPulse);
      const outerOpacity = 0.55 + Math.sin(wobblePhase * 7.0) * 0.25;
      (rig.fireAura.material as THREE.MeshBasicMaterial).opacity = outerOpacity;
      const fireCore = rig.fireAura.children[0] as THREE.Mesh | undefined;
      if (fireCore?.material) {
        (fireCore.material as THREE.MeshBasicMaterial).opacity = Math.min(
          1,
          outerOpacity + 0.18
        );
      }
    }

    const flash = hitFlashTimer > 0;
    for (const m of rig.hitFlashMaterials) {
      if (flash) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 1.25;
      } else {
        m.emissive.setHex(rig.baseEmissiveHex);
        m.emissiveIntensity = 0.14;
      }
    }

    const dishFloorY = arenaFloorHeight(x, z);
    const heightAboveFloor = Math.max(0, y - dishFloorY);
    const onBowlFloor = y >= dishFloorY - 0.32 && Math.hypot(x, z) <= ARENA_WALL_RADIUS + 0.35;
    shadow.visible = visible && onBowlFloor;
    if (shadow.visible) {
      shadow.position.set(x, dishFloorY + 0.01, z);
      _dirVec.set(-2 * ARENA_DISH_CURVATURE * x, 1, -2 * ARENA_DISH_CURVATURE * z).normalize();
      shadow.quaternion.setFromUnitVectors(_upVec, _dirVec);
      shadow.scale.setScalar(rig.root.scale.x * (0.94 + heightAboveFloor * 0.36));
      (shadow.material as THREE.MeshBasicMaterial).opacity =
        0.86 * Math.max(0.24, 1 - heightAboveFloor * 1.4);
    }
    trail.position.set(x, y + 0.17, z);
    trail.rotation.set(
      Math.cos(wobblePhase) * wobbleTilt * 0.65,
      spinAngle * 0.72,
      Math.sin(wobblePhase) * wobbleTilt * 0.65
    );
    (trail.material as THREE.MeshBasicMaterial).opacity = 0.22 + staminaRatio * 0.45;

    if (innerTrail.visible) {
      innerTrail.position.set(x, y + 0.22, z);
      innerTrail.rotation.set(
        Math.cos(wobblePhase) * wobbleTilt * 0.55,
        -spinAngle * 1.15,
        Math.sin(wobblePhase) * wobbleTilt * 0.55
      );
      (innerTrail.material as THREE.MeshBasicMaterial).opacity = 0.16 + staminaRatio * 0.34;
    }
  }

  private advanceVisualSpinAngle(currentAngle: number, physOmega: number, dt: number): number {
    if (physOmega <= 0.1 || dt <= 0) return currentAngle;
    // Clamp visual angular speed strictly below 60Hz Nyquist for 3/4/5/6-blade tops so
    // blades never suffer stroboscopic "wagon-wheel" freezing while clearly reflecting RPM changes.
    const visualOmega =
      physOmega <= 22 ? physOmega : Math.min(36, 22 + (physOmega - 22) * 0.13);
    return (currentAngle + visualOmega * dt) % (Math.PI * 200);
  }

  private updateWeatherVisuals(dt: number): void {
    if (this.currentWeather === 'Clear' || this.weatherParticles.length === 0) return;
    const isDust = this.currentWeather === 'DustStorm';
    const isGale = this.currentWeather === 'GaleWind';
    const motionMult = this.reducedMotion ? 0.38 : 1.0;

    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      const wp = this.weatherParticles[i];
      const swirl = isDust ? Math.sin(this.envTime * 2.2 + wp.phase) * 0.9 : 0;
      const gWave = isGale ? Math.sin(this.envTime * 3.1 + wp.phase) * 1.1 : 0;

      wp.x += (wp.vx + swirl + gWave) * dt * motionMult;
      wp.y += wp.vy * dt * motionMult;
      wp.z += (wp.vz + swirl * 0.65) * dt * motionMult;

      if (wp.y < 0.08) {
        wp.y = 6.3 + Math.random() * 0.8;
        wp.x = (Math.random() - 0.5) * 14;
        wp.z = (Math.random() - 0.5) * 14;
      }
      if (wp.x > 7.4) wp.x = -7.4;
      else if (wp.x < -7.4) wp.x = 7.4;
      if (wp.z > 7.4) wp.z = -7.4;
      else if (wp.z < -7.4) wp.z = 7.4;

      _pos.set(wp.x, wp.y, wp.z);
      _dirVec.set(wp.vx + swirl + gWave, wp.vy, wp.vz + swirl * 0.65);
      if (_dirVec.lengthSq() > 0.001) {
        _dirVec.normalize();
        _quat.setFromUnitVectors(_upVec, _dirVec);
      } else {
        _quat.identity();
      }
      _scale.set(wp.thickness, wp.length, wp.thickness);
      _mat4.compose(_pos, _quat, _scale);
      this.weatherParticleMesh.setMatrixAt(i, _mat4);
    }
    this.weatherParticleMesh.instanceMatrix.needsUpdate = true;
  }

  private applyVictoryEmoteMotion(
    rig: TopVisualRig,
    shadow: THREE.Mesh,
    trail: THREE.Mesh,
    innerTrail: THREE.Mesh,
    emoteId: VictoryEmoteId,
    t: number,
    dt: number,
    baseX: number,
    baseZ: number,
    baseFloorY = 0
  ): void {
    const emoteDef = getVictoryEmoteDefinition(emoteId);
    const accentHex = parseInt(emoteDef.accentHex.replace('#', ''), 16) || 0xfacc15;
    let dx = 0;
    let dz = 0;
    let dy = 0;
    let extraTiltX = 0;
    let extraTiltZ = 0;

    switch (emoteId) {
      case 'cyclone_salute': {
        const orbitA = t * 6.4;
        dx = Math.cos(orbitA) * 0.36;
        dz = Math.sin(orbitA) * 0.36;
        dy = 0.1 + Math.abs(Math.sin(t * 4.5)) * 0.14;
        extraTiltX = Math.sin(orbitA) * 0.16;
        extraTiltZ = -Math.cos(orbitA) * 0.16;
        break;
      }
      case 'titan_hover': {
        dy = 0.28 + Math.sin(t * 3.4) * 0.1;
        extraTiltX = Math.sin(t * 2.1) * 0.12;
        extraTiltZ = Math.cos(t * 1.9) * 0.12;
        break;
      }
      case 'eclipse_spin': {
        dx = Math.sin(t * 4.2) * 0.34;
        dz = Math.sin(t * 8.4) * 0.16;
        dy = 0.1 + Math.abs(Math.cos(t * 4.2)) * 0.16;
        extraTiltZ = Math.cos(t * 4.2) * 0.18;
        break;
      }
      case 'solar_crown': {
        const bounce = Math.abs(Math.sin(t * 4.8));
        dy = 0.16 + bounce * 0.34;
        extraTiltX = Math.sin(t * 6.0) * 0.08;
        break;
      }
      case 'apex_flare':
      default: {
        dy = Math.abs(Math.sin(t * 5.2)) * 0.32;
        extraTiltX = Math.sin(t * 4.2) * 0.1;
        extraTiltZ = Math.cos(t * 4.2) * 0.1;
        break;
      }
    }

    const wx = baseX + dx;
    const wz = baseZ + dz;
    const surfaceY = Math.max(arenaFloorHeight(wx, wz), baseFloorY);
    const wy = surfaceY + dy;
    rig.root.position.set(wx, wy, wz);
    rig.root.rotation.set(extraTiltX, 0, extraTiltZ);
    shadow.position.set(wx, baseFloorY > 0 ? 0.095 : surfaceY + 0.015, wz);
    const shadowFade = Math.max(0.45, 1 - dy * 0.7);
    shadow.scale.setScalar(shadowFade);
    trail.position.set(wx, wy + 0.17, wz);
    if (innerTrail.visible) {
      innerTrail.position.set(wx, wy + 0.22, wz);
    }

    this.victoryEmoteFxCooldown -= dt;
    if (!this.reducedMotion && this.victoryEmoteFxCooldown <= 0) {
      this.victoryEmoteFxCooldown = emoteId === 'solar_crown' ? 0.42 : 0.68;
      this.spawnBurstParticles(wx, wy + 0.24, wz, 16, accentHex, 4.4, {
        gravity: emoteId === 'titan_hover' ? 2.5 : 7.2,
        maxLife: 0.42,
        sizeMult: 1.1,
      });
      if (emoteId === 'apex_flare' || emoteId === 'titan_hover' || emoteId === 'eclipse_spin') {
        this.spawnShockwave(wx, surfaceY + 0.05, wz, accentHex, 2.5, 0.32);
      }
    }
  }

  private updateScene(dt: number): void {
    const sim = this.simGetter();
    const dampK = 1 - Math.exp(-7 * dt);
    this.envTime += dt * (this.reducedMotion ? 0.35 : 1.0);
    this.updateHeatmap(dt, sim);
    this.updateWeatherVisuals(dt);

    const rawStepDt = this.lastRawDt > 0 ? this.lastRawDt : dt;
    this.updateStructuralAndCameraKinematics(rawStepDt);
    if (this.scuffMesh) {
      this.scuffMesh.visible = this.cameraMode === 'battle' || this.cameraMode === 'replay';
    }
    if (this.workshopPedestalGroup) {
      this.workshopPedestalGroup.visible = this.cameraMode === 'workshop';
      if (this.cameraMode === 'workshop') {
        if (this.workshopPedestalRing) {
          this.workshopPedestalRing.rotation.y += rawStepDt * 0.85;
        }
        if (this.workshopPedestalInnerGear) {
          this.workshopPedestalInnerGear.rotation.y -= rawStepDt * 0.55;
        }
        for (let k = 0; k < this.workshopSatellitePads.length; k++) {
          const pad = this.workshopSatellitePads[k];
          const wave = this.reducedMotion ? 0 : Math.sin(this.envTime * 1.9 + pad.phase);
          pad.group.position.y = pad.baseY + wave * 0.015;
          pad.rimMat.opacity = 0.68 + wave * 0.16;
        }
        if (this.workshopHoloCurtain) {
          const curtainMat = this.workshopHoloCurtain.material as THREE.MeshBasicMaterial;
          curtainMat.opacity = 0.032 + this.workshopExplodeBlend * 0.065;
        }
        if (this.workshopLayerReticleGroup) {
          let baseLocalY = 0.29;
          let explodeOffset = 0.58;
          let targetScale = 1.0;
          switch (this.workshopSelectedCategory) {
            case 'PerformanceDriver':
              baseLocalY = 0.08;
              explodeOffset = 0.04;
              targetScale = 0.58;
              break;
            case 'WeightDisc':
              baseLocalY = 0.18;
              explodeOffset = 0.22;
              targetScale = 0.88;
              break;
            case 'ArmorRing':
              baseLocalY = 0.236;
              explodeOffset = 0.38;
              targetScale = 1.02;
              break;
            case 'AttackBlade':
              baseLocalY = 0.29;
              explodeOffset = 0.58;
              targetScale = 1.14;
              break;
            case 'EnergyModule':
              baseLocalY = 0.332;
              explodeOffset = 0.76;
              targetScale = 0.72;
              break;
            case 'SpiritCore':
              baseLocalY = 0.365;
              explodeOffset = 0.96;
              targetScale = 0.6;
              break;
          }
          const rigScale = this.playerRig?.root.scale.y ?? 1;
          const targetY = 0.098 + (baseLocalY + explodeOffset * this.workshopExplodeBlend) * rigScale;
          this.workshopReticleCurrentY = this.reducedMotion
            ? targetY
            : THREE.MathUtils.damp(this.workshopReticleCurrentY, targetY, 12, rawStepDt);
          this.workshopLayerReticleGroup.position.y = this.workshopReticleCurrentY;
          this.workshopLayerReticleGroup.scale.setScalar(targetScale * rigScale);
          this.workshopLayerReticleGroup.rotation.y += rawStepDt * 0.72;
          if (this.workshopLayerReticleMat) {
            this.workshopLayerReticleMat.opacity = 0.58 + this.workshopExplodeBlend * 0.28;
          }
        }
      }
    }
    if (this.cameraMode !== 'workshop') {
      this.workshopExplodeBlend = 0;
      if (this.playerRig) {
        applyRigExplodeFactor(this.playerRig, 0);
      }
    }
    this.playerGhostRing.visible =
      this.cameraMode === 'battle' || this.cameraMode === 'replay';
    this.opponentGhostRing.visible =
      this.cameraMode === 'battle' || this.cameraMode === 'replay';

    // Detect Launch -> Combat Slam & Critical Phase transitions
    const currentPhase = sim?.phase ?? null;
    if (
      this.cameraMode === 'battle' &&
      this.lastObservedPhase === 'Launch' &&
      (currentPhase === 'Combat' || currentPhase === 'Critical')
    ) {
      this.triggerLaunchSlam(sim);
    }
    if (
      this.cameraMode === 'battle' &&
      currentPhase === 'Critical' &&
      this.lastObservedPhase !== 'Critical'
    ) {
      this.spawnShockwave(0, 0.12, 0, CRITICAL_CRIMSON_HEX, 5.2, 0.44);
      if (!this.reducedMotion) {
        const gateAngles = [Math.PI / 3, Math.PI, -Math.PI / 3];
        for (const ga of gateAngles) {
          const gx = Math.cos(ga) * (ARENA_DISH_RADIUS - 0.35);
          const gz = Math.sin(ga) * (ARENA_DISH_RADIUS - 0.35);
          this.spawnBurstParticles(gx, arenaFloorHeight(gx, gz) + 0.2, gz, 10, CRITICAL_CRIMSON_HEX, 3.6);
        }
      }
      this.flashColorHex = CRITICAL_CRIMSON_HEX;
      this.flashMaxDuration = 0.28;
      this.flashTimer = 0.28;
      this.flashPeakIntensity = this.reducedMotion ? 0.25 : 0.75;
    }
    this.lastObservedPhase = currentPhase;

    const targetCritical =
      this.cameraMode === 'battle' &&
      sim &&
      (sim.phase === 'Critical' || (sim.phase === 'Finish' && this.criticalBlend > 0.2))
        ? 1
        : this.cameraMode === 'replay' &&
            this.replayClip &&
            (this.replayClip.finishReason === 'BurstFinish' ||
              this.replayClip.finishReason === 'Knockout')
          ? 0.48
          : 0;
    this.criticalBlend = THREE.MathUtils.damp(this.criticalBlend, targetCritical, 4.2, dt);

    if (this.mistMesh) {
      this.mistMesh.rotation.y += dt * (0.22 + this.criticalBlend * 0.24);
      (this.mistMesh.material as THREE.MeshBasicMaterial).opacity =
        0.12 + 0.05 * Math.sin(this.envTime * 2.0) + this.criticalBlend * 0.06;
    }

    // Animate battle-mode moving traps & mutator rings cleanly (zero-GC)
    const trapAnimTime =
      this.cameraMode === 'battle' && sim
        ? sim.elapsedTime * (1 + this.criticalBlend * 0.45)
        : this.envTime * 0.45;
    for (let i = 0; i < this.modeMovingTraps.length; i++) {
      const trap = this.modeMovingTraps[i];
      let tx: number;
      let tz: number;
      if (trap.motionKind === 'orbit') {
        const angle = trap.phaseOffset + trapAnimTime * trap.speed;
        tx = Math.cos(angle) * trap.orbitRadius;
        tz = Math.sin(angle) * trap.orbitRadius;
      } else {
        const phase = trap.phaseOffset + trapAnimTime * trap.speed;
        tx = trap.baseX + Math.sin(phase) * trap.ampX;
        tz = trap.baseZ + Math.cos(phase) * trap.ampZ;
      }
      const ty = arenaFloorHeight(tx, tz) + 0.032;
      trap.group.position.set(tx, ty, tz);
      _dirVec.set(-2 * ARENA_DISH_CURVATURE * tx, 1, -2 * ARENA_DISH_CURVATURE * tz).normalize();
      trap.group.quaternion.setFromUnitVectors(_upVec, _dirVec);
      trap.spinner.rotation.y += dt * trap.spinSpeed * (1 + this.criticalBlend * 1.15);

      const pulse = 0.5 + 0.5 * Math.sin(this.envTime * 4.5 + i * 1.6);
      trap.ringMat.opacity = 0.52 + pulse * 0.24 + this.criticalBlend * 0.2;
      _color.setHex(trap.baseColorHex);
      if (this.criticalBlend > 0.02) {
        _color2.setHex(CRITICAL_CRIMSON_HEX);
        _color.lerp(_color2, this.criticalBlend * 0.72);
      }
      trap.ringMat.color.copy(_color);
      trap.coreMat.emissive.copy(_color);
      trap.coreMat.emissiveIntensity = 0.55 + this.criticalBlend * 0.75 + pulse * 0.2;
    }

    for (let i = 0; i < this.modeRingVisuals.length; i++) {
      const ring = this.modeRingVisuals[i];
      ring.mesh.rotation.y += dt * ring.spinSpeed * (1 + this.criticalBlend * 0.65);
      const pulse = 0.5 + 0.5 * Math.sin(this.envTime * 3.4 + ring.pulseOffset);
      ring.mat.opacity = ring.baseOpacity + pulse * 0.18 + this.criticalBlend * 0.16;
      _color.setHex(ring.baseColorHex);
      if (this.criticalBlend > 0.02) {
        _color2.setHex(CRITICAL_CRIMSON_HEX);
        _color.lerp(_color2, this.criticalBlend * 0.45);
      }
      ring.mat.color.copy(_color);
    }

    let particleDt = dt;

    if (this.cameraMode === 'replay' && this.replayClip && this.replayFrames.length >= 2) {
      this.aimGroup.visible = false;
      this.diagnosticsGroup.visible = false;

      const clip = this.replayClip;
      const frames = this.replayFrames;
      const duration = Math.max(0.25, frames[frames.length - 1].t - frames[0].t);
      const effectiveSpeed = this.reducedMotion ? Math.max(0.72, this.replaySpeed) : this.replaySpeed;

      if (this.replayClimaxHoldTimer > 0) {
        this.replayClimaxHoldTimer = Math.max(0, this.replayClimaxHoldTimer - dt);
        this.replayTimeOffset = duration;
        particleDt = dt * 0.85;
        if (this.replayClimaxHoldTimer <= 0) {
          this.replayPassCount += 1;
          if (!this.replayFirstPassNotified) {
            this.replayFirstPassNotified = true;
            this.onReplayFirstPassComplete?.();
          }
          // Loop seamlessly into the next replay pass
          this.replayTimeOffset = 0;
          this.replayLastClashRawIdx = -1;
          this.replayBurstTriggeredInPass = false;
          this.replayLastBrokenPlayer.clear();
          this.replayLastBrokenOpponent.clear();
          this.replayLastAngleIdx = -1;
          this.clearEjectedParts();
          this.clearFloorScuffs();
          this.resetCombatKinematics();
        }
      } else {
        this.replayTimeOffset += dt * effectiveSpeed;
        particleDt = dt * effectiveSpeed;
        if (this.replayTimeOffset >= duration) {
          this.replayTimeOffset = duration;
          this.replayClimaxHoldTimer = REPLAY_CLIMAX_HOLD_SEC;
        }
      }

      const sampled = sampleReplayFrame(frames, this.replayTimeOffset);
      const f = sampled.frame;

      // Sync moving pillars and hazard zones to the replay timestamp
      for (let i = 0; i < this.dynamicPillarMeshes.length; i++) {
        const entry = this.dynamicPillarMeshes[i];
        const st = evaluateDynamicPillarState(entry.pillar, f.t);
        entry.mesh.position.set(st.x, arenaFloorHeight(st.x, st.z), st.z);
        if (entry.pillar.motion) {
          entry.mesh.rotation.y += particleDt * 1.4;
        }
      }
      for (let i = 0; i < this.dynamicHazardMeshes.length; i++) {
        const entry = this.dynamicHazardMeshes[i];
        const pos = evaluateDynamicHazardPosition(entry.hz, f.t);
        const rimLift = ARENA_DISH_CURVATURE * entry.hz.radius * entry.hz.radius;
        entry.group.position.set(pos.x, arenaFloorHeight(pos.x, pos.z) + rimLift + 0.028, pos.z);
        _dirVec.set(-2 * ARENA_DISH_CURVATURE * pos.x, 1, -2 * ARENA_DISH_CURVATURE * pos.z).normalize();
        entry.group.quaternion.setFromUnitVectors(_upVec, _dirVec);
      }

      // Replay clash & climax VFX markers once per pass
      for (let i = this.replayLastClashRawIdx + 1; i <= sampled.rawIdx; i++) {
        const rf = frames[i];
        if (rf && rf.clashX !== undefined && rf.clashZ !== undefined) {
          const cy = arenaFloorHeight(rf.clashX, rf.clashZ) + 0.14;
          const dx = rf.ox - rf.px;
          const dz = rf.oz - rf.pz;
          const clashInt = rf.isCritical ? 1.3 : 0.9;
          this.triggerClashEffects(
            rf.clashX,
            cy,
            rf.clashZ,
            clashInt,
            Boolean(rf.isCritical),
            rf.isCritical ? 0xfacc15 : 0xff6b2b,
            { tangentX: -dz, tangentZ: dx, sparkMode: 'metal' }
          );
          this.triggerImpactRecoil('both', dx, dz, clashInt, Boolean(rf.isCritical));
          this.recordImpactScuff(rf.clashX, rf.clashZ, -dz, dx, clashInt, Boolean(rf.isCritical), false);
          if (this.replayPassCount === 0) {
            this.onReplayImpactSfx?.('clash', rf.isCritical ? 1.1 : 0.78);
          }
        }
      }
      this.replayLastClashRawIdx = Math.max(this.replayLastClashRawIdx, sampled.rawIdx);

      const pBroken = f.pBrokenParts ?? [];
      const oBroken = f.oBrokenParts ?? [];
      const newlyBrokenPlayer = pBroken.filter((k) => !this.replayLastBrokenPlayer.has(k));
      const newlyBrokenOpponent = oBroken.filter((k) => !this.replayLastBrokenOpponent.has(k));

      const inClimaxBurst = clip.finishReason === 'BurstFinish' && sampled.progress >= 0.99;
      if (sampled.progress >= 0.99 && !this.replayBurstTriggeredInPass) {
        this.replayBurstTriggeredInPass = true;
        if (clip.finishReason === 'BurstFinish' || clip.finishReason === 'Knockout') {
          const lx = clip.winnerSide === 'player' ? f.ox : f.px;
          const lz = clip.winnerSide === 'player' ? f.oz : f.pz;
          this.triggerClashEffects(
            lx,
            arenaFloorHeight(lx, lz) + 0.16,
            lz,
            1.55,
            true,
            0xff5a2f,
            { sparkMode: 'metal' }
          );
          this.triggerImpactRecoil(
            clip.winnerSide === 'player' ? 'player' : 'opponent',
            f.ox - f.px,
            f.oz - f.pz,
            1.5,
            true
          );
          this.recordImpactScuff(lx, lz, f.oVx || f.pVx || 1, f.oVz || f.pVz || 0, 1.55, true, true);
          this.triggerBurstShake(0.85, 0.42);
          if (clip.finishReason === 'BurstFinish') {
            const loserSide = clip.winnerSide === 'player' ? 'opponent' : 'player';
            const loserSet =
              loserSide === 'player' ? this.replayLastBrokenPlayer : this.replayLastBrokenOpponent;
            const allPartKeys: PartDurabilityKey[] = [
              'SpiritCore',
              'AttackBlade',
              'ArmorRing',
              'WeightDisc',
              'PerformanceDriver',
              'EnergyModule',
            ];
            const remainingParts = allPartKeys.filter((k) => !loserSet.has(k));
            if (remainingParts.length > 0) {
              this.spawnPartEjection(loserSide, remainingParts, 0, 0);
            }
            for (const k of allPartKeys) {
              loserSet.add(k);
            }
          }
          if (this.replayPassCount === 0) {
            this.onReplayImpactSfx?.('burst', 1.25);
          }
        }
      }

      if (newlyBrokenPlayer.length > 0) {
        for (const k of newlyBrokenPlayer) {
          this.replayLastBrokenPlayer.add(k);
        }
        if (!(inClimaxBurst && clip.winnerSide === 'opponent')) {
          this.spawnPartEjection('player', newlyBrokenPlayer, f.pVx, f.pVz);
        }
      }
      if (newlyBrokenOpponent.length > 0) {
        for (const k of newlyBrokenOpponent) {
          this.replayLastBrokenOpponent.add(k);
        }
        if (!(inClimaxBurst && clip.winnerSide === 'player')) {
          this.spawnPartEjection('opponent', newlyBrokenOpponent, f.oVx, f.oVz);
        }
      }

      const pRad = Math.hypot(f.px, f.pz);
      const pRingOut = pRad > ARENA_DISH_RADIUS + 0.12;
      const pY = arenaFloorHeight(f.px, f.pz) - (pRingOut ? Math.min(1.85, (pRad - ARENA_DISH_RADIUS) * 1.45) : 0);
      const pStam = Math.max(0, Math.min(1, f.pStaminaPct / 100));
      const pVisible = !(inClimaxBurst && clip.winnerSide === 'opponent');
      this.playerVisualSpinAngle = this.advanceVisualSpinAngle(
        this.playerVisualSpinAngle,
        Math.max(0, f.pRpm / 9.55),
        particleDt
      );
      this.updateTopKinematics(
        this.playerKinematics,
        f.px,
        pY,
        f.pz,
        f.pVx,
        f.pVz,
        Math.max(0, f.pRpm / 9.55),
        particleDt,
        'player',
        this.baseArenaTrimHex
      );
      const pShield = Boolean(f.pShield);
      const pFire = Boolean(f.pFire);
      if (pFire && Math.random() < 0.35) {
        this.spawnBurstParticles(f.px, pY + 0.15, f.pz, 2, 0xff5a2f, 1.3, { lifetimeSec: 0.25 });
      }
      if (pShield && Math.random() < 0.2) {
        this.spawnBurstParticles(f.px, pY + 0.2, f.pz, 2, 0x38bdf8, 1.1, { lifetimeSec: 0.3 });
      }
      if (this.playerRig) {
        syncRigBrokenParts(this.playerRig, pBroken);
        this.playerShadow.scale.setScalar(1);
        this.applyRigVisualState(
          this.playerRig,
          this.playerShadow,
          this.playerTrailRing,
          this.playerInnerTrailRing,
          f.px,
          pY,
          f.pz,
          this.playerVisualSpinAngle,
          (1 - pStam) * 0.24,
          f.t * 8.5,
          pStam,
          0,
          pShield,
          pFire,
          pVisible,
          this.playerKinematics.recoilTiltX,
          this.playerKinematics.recoilTiltZ
        );
        this.playerGhostRing.visible = pVisible && pStam > 0.35;
        if (this.playerGhostRing.visible) {
          this.playerGhostRing.position.set(f.px, pY + 0.25, f.pz);
          this.playerGhostRing.rotation.set(
            this.playerRig.root.rotation.x,
            -this.playerVisualSpinAngle * 1.45,
            this.playerRig.root.rotation.z
          );
          (this.playerGhostRing.material as THREE.MeshBasicMaterial).opacity =
            0.12 + pStam * 0.26;
        }
        this.updateRibbonTrack(
          this.playerRibbon,
          f.px,
          pY,
          f.pz,
          f.pVx,
          f.pVz,
          pVisible && pStam > 0.12 && !pRingOut,
          particleDt
        );
      }

      const oRad = Math.hypot(f.ox, f.oz);
      const oRingOut = oRad > ARENA_DISH_RADIUS + 0.12;
      const oY = arenaFloorHeight(f.ox, f.oz) - (oRingOut ? Math.min(1.85, (oRad - ARENA_DISH_RADIUS) * 1.45) : 0);
      const oStam = Math.max(0, Math.min(1, f.oStaminaPct / 100));
      const oVisible = !(inClimaxBurst && clip.winnerSide === 'player');
      this.opponentVisualSpinAngle = this.advanceVisualSpinAngle(
        this.opponentVisualSpinAngle,
        Math.max(0, f.oRpm / 9.55),
        particleDt
      );
      this.updateTopKinematics(
        this.opponentKinematics,
        f.ox,
        oY,
        f.oz,
        f.oVx,
        f.oVz,
        Math.max(0, f.oRpm / 9.55),
        particleDt,
        'opponent',
        0xf43f5e
      );
      const oShield = Boolean(f.oShield);
      const oFire = Boolean(f.oFire);
      if (oFire && Math.random() < 0.35) {
        this.spawnBurstParticles(f.ox, oY + 0.15, f.oz, 2, 0xff5a2f, 1.3, { lifetimeSec: 0.25 });
      }
      if (oShield && Math.random() < 0.2) {
        this.spawnBurstParticles(f.ox, oY + 0.2, f.oz, 2, 0x38bdf8, 1.1, { lifetimeSec: 0.3 });
      }
      if (this.opponentRig) {
        syncRigBrokenParts(this.opponentRig, oBroken);
        this.opponentShadow.scale.setScalar(1);
        this.applyRigVisualState(
          this.opponentRig,
          this.opponentShadow,
          this.opponentTrailRing,
          this.opponentInnerTrailRing,
          f.ox,
          oY,
          f.oz,
          this.opponentVisualSpinAngle,
          (1 - oStam) * 0.24,
          f.t * 8.5 + 1.4,
          oStam,
          0,
          oShield,
          oFire,
          oVisible,
          this.opponentKinematics.recoilTiltX,
          this.opponentKinematics.recoilTiltZ
        );
        this.opponentGhostRing.visible = oVisible && oStam > 0.35;
        if (this.opponentGhostRing.visible) {
          this.opponentGhostRing.position.set(f.ox, oY + 0.25, f.oz);
          this.opponentGhostRing.rotation.set(
            this.opponentRig.root.rotation.x,
            -this.opponentVisualSpinAngle * 1.45,
            this.opponentRig.root.rotation.z
          );
          (this.opponentGhostRing.material as THREE.MeshBasicMaterial).opacity =
            0.12 + oStam * 0.26;
        }
        this.updateRibbonTrack(
          this.opponentRibbon,
          f.ox,
          oY,
          f.oz,
          f.oVx,
          f.oVz,
          oVisible && oStam > 0.12 && !oRingOut,
          particleDt
        );
      }

      if (this.replayClimaxHoldTimer > 0) {
        this.victoryEmoteTime += dt;
        const winRig = clip.winnerSide === 'player' ? this.playerRig : this.opponentRig;
        const winShadow = clip.winnerSide === 'player' ? this.playerShadow : this.opponentShadow;
        const winTrail = clip.winnerSide === 'player' ? this.playerTrailRing : this.opponentTrailRing;
        const winInner =
          clip.winnerSide === 'player' ? this.playerInnerTrailRing : this.opponentInnerTrailRing;
        const winX = clip.winnerSide === 'player' ? f.px : f.ox;
        const winZ = clip.winnerSide === 'player' ? f.pz : f.oz;
        const winEmote =
          clip.winnerSide === 'player' ? this.playerVictoryEmote : this.opponentVictoryEmote;
        if (winRig && winRig.root.visible) {
          this.applyVictoryEmoteMotion(
            winRig,
            winShadow,
            winTrail,
            winInner,
            winEmote,
            this.victoryEmoteTime,
            dt,
            winX,
            winZ
          );
        }
      } else {
        this.victoryEmoteTime = 0;
      }

      // Pass 0 plays the entire WIDE replay + climax hold before opening Results modal; subsequent passes cycle LOW -> OVERHEAD -> WIDE behind the modal
      const angleIndex = (this.replayPassCount % 3) as 0 | 1 | 2;
      const angleCode = angleIndex === 0 ? 'CAM 01' : angleIndex === 1 ? 'CAM 02' : 'CAM 03';
      const angleLabel =
        angleIndex === 0 ? 'WIDE BROADCAST' : angleIndex === 1 ? 'LOW ACTION' : 'OVERHEAD VAR';
      const isCut = this.replayLastAngleIdx !== angleIndex;
      this.replayLastAngleIdx = angleIndex;

      const midX = (f.px + f.ox) * 0.5;
      const midZ = (f.pz + f.oz) * 0.5;
      let camYawAngle = this.replayBaseAngle;
      let camPitchAngle = 0.55;
      let camDist = 5.4;
      const holdElapsed =
        this.replayClimaxHoldTimer > 0
          ? REPLAY_CLIMAX_HOLD_SEC - this.replayClimaxHoldTimer
          : 0;

      if (angleIndex === 0) {
        _targetLookAt.set(midX * 0.72, 0.28, midZ * 0.72);
        camYawAngle = this.replayBaseAngle + 0.45 + sampled.progress * 0.5 + holdElapsed * 0.22;
        camPitchAngle = 0.55;
        camDist = 5.45 - sampled.progress * 0.65;
      } else if (angleIndex === 1) {
        _targetLookAt.set(midX * 0.88, 0.22, midZ * 0.88);
        camYawAngle = this.replayBaseAngle + 2.05 + sampled.progress * 0.48 + holdElapsed * 0.26;
        camPitchAngle = 0.25;
        camDist = 3.55;
      } else {
        _targetLookAt.set(this.replayClimaxX * 0.72, 0.22, this.replayClimaxZ * 0.72);
        camYawAngle = this.replayBaseAngle - 1.15 + sampled.progress * 0.58 + holdElapsed * 0.35;
        camPitchAngle = 1.02;
        camDist = 4.35 - sampled.progress * 0.72;
      }

      _targetCamPos.set(
        _targetLookAt.x + Math.sin(camYawAngle) * Math.cos(camPitchAngle) * camDist,
        _targetLookAt.y + Math.sin(camPitchAngle) * camDist,
        _targetLookAt.z + Math.cos(camYawAngle) * Math.cos(camPitchAngle) * camDist
      );

      if (isCut || !this.stableCamPosValid) {
        this.currentLookAt.copy(_targetLookAt);
        this.stableCamPos.copy(_targetCamPos);
        this.stableCamPosValid = true;
      } else {
        const trackK = 1 - Math.exp(-9 * dt);
        this.currentLookAt.lerp(_targetLookAt, trackK);
        this.stableCamPos.lerp(_targetCamPos, trackK);
      }

      if (this.burstShakeTimer > 0) {
        const rawStepDt = this.lastRawDt > 0 ? this.lastRawDt : dt;
        this.burstShakeTimer = Math.max(0, this.burstShakeTimer - rawStepDt);
        this.burstShakePhase += rawStepDt * 46;
      }

      this.camera.position.copy(this.stableCamPos);
      if (!this.reducedMotion) {
        this.camera.position.add(this.camRecoilPos);
        this.camera.position.y += this.camDipY;
      }
      this.camera.lookAt(this.currentLookAt);

      if (!this.reducedMotion && this.burstShakeTimer > 0.001) {
        const ratio = this.burstShakeTimer / Math.max(0.01, this.burstShakeDuration);
        const env = ratio * ratio * 0.17 * this.burstShakeStrength;
        const p = this.burstShakePhase;
        this.camera.position.x += (Math.sin(p) * 0.68 + Math.sin(p * 1.73 + 1.1) * 0.32) * env;
        this.camera.position.y += (Math.cos(p * 1.27 + 0.4) * 0.65 + Math.sin(p * 2.11) * 0.35) * env * 0.78;
        this.camera.position.z += Math.sin(p * 0.89 + 2.2) * env * 0.45;
        this.camera.rotation.z += Math.sin(p * 1.45 + 0.7) * ratio * ratio * 0.015 * this.burstShakeStrength;
      }

      const nowMs = performance.now();
      if (this.onReplayTelemetry && (isCut || nowMs - this.replayLastTelemetryEmitMs >= 65)) {
        this.replayLastTelemetryEmitMs = nowMs;
        this.onReplayTelemetry({
          angleIndex,
          angleCode,
          angleLabel,
          progress: sampled.progress,
          speed: effectiveSpeed,
          passCount: this.replayPassCount,
          inClimaxHold: this.replayClimaxHoldTimer > 0,
          finishReason: clip.finishReason,
          winnerSide: clip.winnerSide,
          playerShield: Boolean(f.pShield),
          playerFire: Boolean(f.pFire),
          playerActiveSlotIdx: f.pActiveSlotIdx,
          playerActiveSlots: f.pActiveSlots,
          playerStatuses: f.pStatuses,
          playerPartDurability: f.pPartDurability,
          playerBrokenParts: f.pBrokenParts,
          playerStatDebuffs: f.pStatDebuffs,
          opponentShield: Boolean(f.oShield),
          opponentFire: Boolean(f.oFire),
          opponentActiveSlotIdx: f.oActiveSlotIdx,
          opponentActiveSlots: f.oActiveSlots,
          opponentStatuses: f.oStatuses,
          opponentPartDurability: f.oPartDurability,
          opponentBrokenParts: f.oBrokenParts,
          opponentStatDebuffs: f.oStatDebuffs,
          playerRpm: f.pRpm,
          playerStaminaPct: f.pStaminaPct,
          playerDurabilityPct: f.pDurabilityPct,
          playerEnergyPct: f.pEnergyPct,
          playerResonance: f.pResonance,
          opponentRpm: f.oRpm,
          opponentStaminaPct: f.oStaminaPct,
          opponentDurabilityPct: f.oDurabilityPct,
        });
      }
    } else if (this.cameraMode === 'battle' && sim) {
      if (sim.arenaId !== this.currentArenaId) {
        this.setArena(sim.arenaId);
      }

      if (sim.weather !== this.currentWeather) {
        this.setWeather(sim.weather);
      }

      if (sim.phase !== 'Launch') {
        if (!sim.player.burstOut) {
          this.playerVisualSpinAngle = this.advanceVisualSpinAngle(
            this.playerVisualSpinAngle,
            sim.player.omega,
            dt
          );
        }
        if (!sim.opponent.burstOut) {
          this.opponentVisualSpinAngle = this.advanceVisualSpinAngle(
            this.opponentVisualSpinAngle,
            sim.opponent.omega,
            dt
          );
        }
      } else {
        this.playerVisualSpinAngle = 0;
        this.opponentVisualSpinAngle = 0;
        this.victoryEmoteTime = 0;
      }

      if (this.playerRig) {
        const p = sim.player;
        this.updateTopKinematics(
          this.playerKinematics,
          p.x,
          p.y,
          p.z,
          p.vx,
          p.vz,
          p.omega,
          dt,
          'player',
          this.baseArenaTrimHex
        );
        const { isShieldActive: pShield, isFireActive: pFire } = getPlayerActiveStatuses(p);
        if (pFire && Math.random() < 0.35) {
          this.spawnBurstParticles(p.x, p.y + 0.15, p.z, 2, 0xff5a2f, 1.3, { lifetimeSec: 0.25 });
        }
        if (pShield && Math.random() < 0.2) {
          this.spawnBurstParticles(p.x, p.y + 0.2, p.z, 2, 0x38bdf8, 1.1, { lifetimeSec: 0.3 });
        }
        syncRigBrokenParts(this.playerRig, p.brokenParts);
        this.playerShadow.scale.setScalar(1);
        const pRad = Math.hypot(p.x, p.z);
        const pDrop = p.ringedOut
          ? Math.min(2.1, Math.max(0.25, (pRad - ARENA_DISH_RADIUS) * 1.55))
          : 0;
        const pVisualY = p.y - pDrop + (p.ringedOut ? 0 : this.playerKinematics.dropY);
        this.applyRigVisualState(
          this.playerRig,
          this.playerShadow,
          this.playerTrailRing,
          this.playerInnerTrailRing,
          p.x,
          pVisualY,
          p.z,
          this.playerVisualSpinAngle,
          p.wobbleTilt,
          p.wobblePhase,
          p.staminaRatio,
          p.hitFlashTimer,
          pShield,
          pFire,
          !p.burstOut,
          this.playerKinematics.recoilTiltX,
          this.playerKinematics.recoilTiltZ
        );
        this.playerGhostRing.visible = !p.burstOut && sim.phase !== 'Launch' && p.staminaRatio > 0.35;
        if (this.playerGhostRing.visible) {
          this.playerGhostRing.position.set(p.x, pVisualY + 0.25, p.z);
          this.playerGhostRing.rotation.set(
            this.playerRig.root.rotation.x,
            -this.playerVisualSpinAngle * 1.45,
            this.playerRig.root.rotation.z
          );
          (this.playerGhostRing.material as THREE.MeshBasicMaterial).opacity =
            0.14 + p.staminaRatio * 0.28;
        }
        this.updateRibbonTrack(
          this.playerRibbon,
          p.x,
          pVisualY,
          p.z,
          p.vx,
          p.vz,
          sim.phase !== 'Launch' && !p.burstOut && !p.ringedOut && p.staminaRatio > 0.12,
          dt
        );
      }
      if (this.opponentRig) {
        const o = sim.opponent;
        this.updateTopKinematics(
          this.opponentKinematics,
          o.x,
          o.y,
          o.z,
          o.vx,
          o.vz,
          o.omega,
          dt,
          'opponent',
          0xf43f5e
        );
        const { isShieldActive: oShield, isFireActive: oFire } = getPlayerActiveStatuses(o);
        if (oFire && Math.random() < 0.35) {
          this.spawnBurstParticles(o.x, o.y + 0.15, o.z, 2, 0xff5a2f, 1.3, { lifetimeSec: 0.25 });
        }
        if (oShield && Math.random() < 0.2) {
          this.spawnBurstParticles(o.x, o.y + 0.2, o.z, 2, 0x38bdf8, 1.1, { lifetimeSec: 0.3 });
        }
        syncRigBrokenParts(this.opponentRig, o.brokenParts);
        this.opponentShadow.scale.setScalar(1);
        const oRad = Math.hypot(o.x, o.z);
        const oDrop = o.ringedOut
          ? Math.min(2.1, Math.max(0.25, (oRad - ARENA_DISH_RADIUS) * 1.55))
          : 0;
        const oVisualY = o.y - oDrop + (o.ringedOut ? 0 : this.opponentKinematics.dropY);
        this.applyRigVisualState(
          this.opponentRig,
          this.opponentShadow,
          this.opponentTrailRing,
          this.opponentInnerTrailRing,
          o.x,
          oVisualY,
          o.z,
          this.opponentVisualSpinAngle,
          o.wobbleTilt,
          o.wobblePhase,
          o.staminaRatio,
          o.hitFlashTimer,
          oShield,
          oFire,
          !o.burstOut,
          this.opponentKinematics.recoilTiltX,
          this.opponentKinematics.recoilTiltZ
        );
        this.opponentGhostRing.visible = !o.burstOut && sim.phase !== 'Launch' && o.staminaRatio > 0.35;
        if (this.opponentGhostRing.visible) {
          this.opponentGhostRing.position.set(o.x, oVisualY + 0.25, o.z);
          this.opponentGhostRing.rotation.set(
            this.opponentRig.root.rotation.x,
            -this.opponentVisualSpinAngle * 1.45,
            this.opponentRig.root.rotation.z
          );
          (this.opponentGhostRing.material as THREE.MeshBasicMaterial).opacity =
            0.14 + o.staminaRatio * 0.28;
        }
        this.updateRibbonTrack(
          this.opponentRibbon,
          o.x,
          oVisualY,
          o.z,
          o.vx,
          o.vz,
          sim.phase !== 'Launch' && !o.burstOut && !o.ringedOut && o.staminaRatio > 0.12,
          dt
        );
      }

      if ((sim.phase === 'Finish' || sim.phase === 'Results') && sim.winnerSide) {
        this.victoryEmoteTime += dt;
        const isPlayerWin = sim.winnerSide === 'player';
        const winRig = isPlayerWin ? this.playerRig : this.opponentRig;
        const winShadow = isPlayerWin ? this.playerShadow : this.opponentShadow;
        const winTrail = isPlayerWin ? this.playerTrailRing : this.opponentTrailRing;
        const winInner = isPlayerWin ? this.playerInnerTrailRing : this.opponentInnerTrailRing;
        const winEnt = isPlayerWin ? sim.player : sim.opponent;
        const winEmote = isPlayerWin ? this.playerVictoryEmote : this.opponentVictoryEmote;
        if (winRig && winRig.root.visible) {
          this.applyVictoryEmoteMotion(
            winRig,
            winShadow,
            winTrail,
            winInner,
            winEmote,
            this.victoryEmoteTime,
            dt,
            winEnt.x,
            winEnt.z
          );
        }
      }

      // Sync moving arena pillars and dynamic trap zones with physics elapsed time
      const animTime = sim.elapsedTime;
      for (let i = 0; i < this.dynamicPillarMeshes.length; i++) {
        const entry = this.dynamicPillarMeshes[i];
        const st = evaluateDynamicPillarState(entry.pillar, animTime);
        entry.mesh.position.set(st.x, arenaFloorHeight(st.x, st.z), st.z);
        if (entry.pillar.motion) {
          entry.mesh.rotation.y += dt * (1.4 + this.criticalBlend * 0.9);
        }
      }
      for (let i = 0; i < this.dynamicHazardMeshes.length; i++) {
        const entry = this.dynamicHazardMeshes[i];
        const pos = evaluateDynamicHazardPosition(entry.hz, animTime);
        const rimLift = ARENA_DISH_CURVATURE * entry.hz.radius * entry.hz.radius;
        entry.group.position.set(pos.x, arenaFloorHeight(pos.x, pos.z) + rimLift + 0.028, pos.z);
        _dirVec.set(-2 * ARENA_DISH_CURVATURE * pos.x, 1, -2 * ARENA_DISH_CURVATURE * pos.z).normalize();
        entry.group.quaternion.setFromUnitVectors(_upVec, _dirVec);
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 4.0 + i * 1.3);
        entry.discMat.opacity =
          (entry.hz.motion ? 0.2 : 0.1) + pulse * 0.16 + this.criticalBlend * 0.14;
      }

      // 3D Launch Aim Reticle + 0-90 deg Sector Cone + Accurate Non-Harmonic Spiral Preview
      if (sim.phase === 'Launch' && !this.spectatorMode) {
        this.aimGroup.visible = true;
        const tx = sim.launchSelection.targetX;
        const tz = sim.launchSelection.targetZ;
        const ty = arenaFloorHeight(tx, tz) + 0.08;
        this.aimRing.position.set(tx, ty, tz);
        _dirVec.set(-2 * ARENA_DISH_CURVATURE * tx, 1, -2 * ARENA_DISH_CURVATURE * tz).normalize();
        this.aimRing.quaternion.setFromUnitVectors(_upVec, _dirVec);

        // Update 0 deg (center) and 90 deg (side boundary) sector cone lines
        const sx = sim.player.x;
        const sz = sim.player.z;
        const inwardA = Math.atan2(-sz, -sx);
        const sideSign = sim.launchHandedness === 'right' ? 1 : -1;
        const limitA = inwardA + sideSign * (Math.PI / 2);
        const coneLen = 2.6;

        const zAttr = this.aimSectorZeroLine.geometry.attributes.position as THREE.BufferAttribute;
        const zx = sx + Math.cos(inwardA) * coneLen;
        const zz = sz + Math.sin(inwardA) * coneLen;
        zAttr.setXYZ(0, sx, arenaFloorHeight(sx, sz) + 0.14, sz);
        zAttr.setXYZ(1, zx, arenaFloorHeight(zx, zz) + 0.14, zz);
        zAttr.needsUpdate = true;

        const lAttr = this.aimSectorLimitLine.geometry.attributes.position as THREE.BufferAttribute;
        const lx = sx + Math.cos(limitA) * coneLen;
        const lz = sz + Math.sin(limitA) * coneLen;
        lAttr.setXYZ(0, sx, arenaFloorHeight(sx, sz) + 0.14, sz);
        lAttr.setXYZ(1, lx, arenaFloorHeight(lx, lz) + 0.14, lz);
        lAttr.needsUpdate = true;

        const arcSAttr = this.aimSectorArc.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < arcSAttr.count; i++) {
          const a = inwardA + sideSign * (i / (arcSAttr.count - 1)) * (Math.PI / 2);
          const ax = sx + Math.cos(a) * coneLen;
          const az = sz + Math.sin(a) * coneLen;
          arcSAttr.setXYZ(i, ax, arenaFloorHeight(ax, az) + 0.14, az);
        }
        arcSAttr.needsUpdate = true;

        const pAttr = this.aimLine.geometry.attributes.position as THREE.BufferAttribute;
        const arena = getArenaDefinition(sim.arenaId);
        const windBonus = sim.player.element === 'Wind' ? 1.08 : 1.0;
        const previewSpeed = (LAUNCH_SPEED_BASE + sim.launchSelection.powerRatio * LAUNCH_SPEED_RANGE) * windBonus;
        let px = sx;
        let pz = sz;
        let pvx = Math.cos(sim.launchSelection.angleRad) * previewSpeed;
        let pvz = Math.sin(sim.launchSelection.angleRad) * previewSpeed;
        const previewStep = 0.07;
        const weatherGrip = getWeatherDefinition(sim.weather).gripFrictionMult;
        const previewDamp = Math.exp(
          -(SPIRAL_BASE_DRAG + sim.player.physical.groundFriction * arena.surfaceFrictionMult * weatherGrip * 0.30) * previewStep
        );
        for (let i = 0; i < pAttr.count; i++) {
          pAttr.setXYZ(i, px, arenaFloorHeight(px, pz) + 0.14, pz);
          const acc = computeBowlRadialAccel(px, pz);
          pvx = (pvx + acc.ax * previewStep) * previewDamp;
          pvz = (pvz + acc.az * previewStep) * previewDamp;
          px += pvx * previewStep;
          pz += pvz * previewStep;
        }
        pAttr.needsUpdate = true;
      } else {
        this.aimGroup.visible = false;
      }

      // 3D Training Diagnostics Overlay (Live Velocity Arrows + Trajectory Arc)
      if (this.showDiagnostics && (sim.phase === 'Combat' || sim.phase === 'Critical')) {
        this.diagnosticsGroup.visible = true;
        const p = sim.player;
        const o = sim.opponent;
        const pSpd = Math.hypot(p.vx, p.vz);
        if (pSpd > 0.08) {
          _dirVec.set(p.vx, 0, p.vz).normalize();
          this.playerVelArrow.position.set(p.x, p.y + 0.35, p.z);
          this.playerVelArrow.setDirection(_dirVec);
          this.playerVelArrow.setLength(Math.min(2.2, 0.4 + pSpd * 0.35));
        }
        const oSpd = Math.hypot(o.vx, o.vz);
        if (oSpd > 0.08) {
          _dirVec.set(o.vx, 0, o.vz).normalize();
          this.oppVelArrow.position.set(o.x, o.y + 0.35, o.z);
          this.oppVelArrow.setDirection(_dirVec);
          this.oppVelArrow.setLength(Math.min(2.2, 0.4 + oSpd * 0.35));
        }
        const arcPos = this.predictedArcLine.geometry.attributes.position as THREE.BufferAttribute;
        const arena = getArenaDefinition(sim.arenaId);
        let ax = p.x;
        let az = p.z;
        let avx = p.vx;
        let avz = p.vz;
        const arcStep = 0.07;
        const arcWeatherGrip = getWeatherDefinition(sim.weather).gripFrictionMult;
        const arcDamp = Math.exp(
          -(SPIRAL_BASE_DRAG + p.physical.groundFriction * arena.surfaceFrictionMult * arcWeatherGrip * 0.30) * arcStep
        );
        for (let i = 0; i < arcPos.count; i++) {
          arcPos.setXYZ(i, ax, arenaFloorHeight(ax, az) + 0.14, az);
          const acc = computeBowlRadialAccel(ax, az);
          avx = (avx + acc.ax * arcStep) * arcDamp;
          avz = (avz + acc.az * arcStep) * arcDamp;
          ax += avx * arcStep;
          az += avz * arcStep;
        }
        arcPos.needsUpdate = true;
      } else {
        this.diagnosticsGroup.visible = false;
      }

      const rawStepDt = this.lastRawDt > 0 ? this.lastRawDt : dt;
      if (this.clashCamTimer > 0) {
        this.clashCamTimer = Math.max(0, this.clashCamTimer - rawStepDt);
      }

      const midX = (sim.player.x + sim.opponent.x) * 0.5;
      const midZ = (sim.player.z + sim.opponent.z) * 0.5;
      const sep = Math.hypot(sim.player.x - sim.opponent.x, sim.player.z - sim.opponent.z);
      let dist = (6.2 + sep * 0.62) * this.cameraZoom * (this.compactLandscape ? 1.07 : 1);
      let activePitch = this.cameraPitch;

      _targetLookAt.set(midX * 0.65, 0.3, midZ * 0.65);

      if (!this.reducedMotion && this.clashCamEnabled && this.clashCamTimer > 0.001) {
        const norm = this.clashCamTimer / Math.max(0.01, this.clashCamDuration);
        const bell = Math.sin(norm * Math.PI);
        const pull = bell * this.clashCamStrength;
        dist *= 1 - pull * 0.24;
        const pitchDipScale = this.cameraPreset === 'TopDown' ? 0.35 : 0.68;
        activePitch = THREE.MathUtils.lerp(
          this.cameraPitch,
          Math.min(this.cameraPitch, 0.26),
          pull * pitchDipScale
        );
        _targetLookAt.lerp(this.clashCamFocus, pull * 0.42);
      }

      this.currentLookAt.lerp(_targetLookAt, dampK);

      const effectiveYaw =
        this.cameraPreset === 'Orbit'
          ? this.cameraYaw + performance.now() * 0.00025
          : this.cameraYaw;

      if (sim.phase === 'Finish' && sim.finishReason === 'BurstFinish') {
        if (!this.burstShakeTriggeredForFinish) {
          this.triggerBurstShake(1.0, 0.42);
        }
      } else if (sim.phase === 'Launch' || sim.phase === 'Combat') {
        this.burstShakeTriggeredForFinish = false;
      }

      if (this.burstShakeTimer > 0) {
        this.burstShakeTimer = Math.max(0, this.burstShakeTimer - rawStepDt);
        this.burstShakePhase += rawStepDt * 46;
      }

      const camX =
        this.currentLookAt.x + Math.sin(effectiveYaw) * Math.cos(activePitch) * dist;
      const camY = this.currentLookAt.y + Math.sin(activePitch) * dist;
      const camZ =
        this.currentLookAt.z + Math.cos(effectiveYaw) * Math.cos(activePitch) * dist;
      _targetCamPos.set(camX, camY, camZ);
      if (!this.stableCamPosValid) {
        this.stableCamPos.copy(this.camera.position);
        this.stableCamPosValid = true;
      }
      this.stableCamPos.lerp(_targetCamPos, dampK);
      this.camera.position.copy(this.stableCamPos);
      if (!this.reducedMotion) {
        this.camera.position.add(this.camRecoilPos);
        this.camera.position.y += this.camDipY;
      }
      this.camera.lookAt(this.currentLookAt);

      if (!this.reducedMotion && sim.cameraTrauma > 0.01) {
        const shake = sim.cameraTrauma * sim.cameraTrauma * 0.34;
        this.camera.position.x += (Math.random() - 0.5) * shake;
        this.camera.position.y += (Math.random() - 0.5) * shake;
        this.camera.position.z += (Math.random() - 0.5) * shake * 0.7;
        this.camera.rotation.z += (Math.random() - 0.5) * sim.cameraTrauma * sim.cameraTrauma * 0.04;
      }

      if (!this.reducedMotion && this.burstShakeTimer > 0.001) {
        const ratio = this.burstShakeTimer / Math.max(0.01, this.burstShakeDuration);
        const env = ratio * ratio * 0.19 * this.burstShakeStrength;
        const p = this.burstShakePhase;
        this.camera.position.x += (Math.sin(p) * 0.68 + Math.sin(p * 1.73 + 1.1) * 0.32) * env;
        this.camera.position.y += (Math.cos(p * 1.27 + 0.4) * 0.65 + Math.sin(p * 2.11) * 0.35) * env * 0.78;
        this.camera.position.z += Math.sin(p * 0.89 + 2.2) * env * 0.45;
        this.camera.rotation.z += Math.sin(p * 1.45 + 0.7) * ratio * ratio * 0.018 * this.burstShakeStrength;
      }
    } else if (this.cameraMode === 'workshop') {
      this.aimGroup.visible = false;
      this.diagnosticsGroup.visible = false;
      this.resetRibbonTrack(this.playerRibbon);
      this.resetRibbonTrack(this.opponentRibbon);
      this.titleSpinAngle = (this.titleSpinAngle + dt * 11) % (Math.PI * 200);
      const explodeTarget = this.workshopExploded ? 1 : 0;
      this.workshopExplodeBlend = this.reducedMotion
        ? explodeTarget
        : THREE.MathUtils.damp(this.workshopExplodeBlend, explodeTarget, 8.5, rawStepDt);
      if (this.playerRig) {
        syncRigBrokenParts(this.playerRig, []);
        this.playerShadow.scale.setScalar(1);
        this.applyRigVisualState(
          this.playerRig,
          this.playerShadow,
          this.playerTrailRing,
          this.playerInnerTrailRing,
          0,
          0.098,
          0,
          this.titleSpinAngle,
          0.02,
          this.titleSpinAngle * 0.2,
          0.95,
          0,
          false,
          false,
          true
        );
        // Keep shadow resting atop the elevated cyber pedestal cap
        this.playerShadow.visible = true;
        this.playerShadow.position.set(0, 0.095, 0);
        this.playerShadow.quaternion.identity();
        this.playerShadow.scale.setScalar(this.playerRig.root.scale.x * 0.94);
        (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = 0.86;
        applyRigExplodeFactor(this.playerRig, this.workshopExplodeBlend);
        if (this.workshopExplodeBlend > 0.04) {
          this.playerRig.blurDisc.visible = false;
          this.playerTrailRing.visible = false;
          this.playerInnerTrailRing.visible = false;
        }
        if (this.workshopEmotePreviewTimer > 0 && this.workshopEmotePreviewId) {
          this.workshopEmotePreviewTimer = Math.max(0, this.workshopEmotePreviewTimer - dt);
          this.victoryEmoteTime += dt;
          this.applyVictoryEmoteMotion(
            this.playerRig,
            this.playerShadow,
            this.playerTrailRing,
            this.playerInnerTrailRing,
            this.workshopEmotePreviewId,
            this.victoryEmoteTime,
            dt,
            0,
            0,
            0.098
          );
          if (this.workshopEmotePreviewTimer <= 0) {
            this.workshopEmotePreviewId = null;
          }
        }
      }
      if (this.opponentRig) {
        this.opponentRig.root.visible = false;
        this.opponentShadow.visible = false;
        this.opponentTrailRing.visible = false;
        this.opponentInnerTrailRing.visible = false;
      }

      const dist =
        (this.compactLandscape ? 2.25 : 2.02) *
        (1 + this.workshopExplodeBlend * 0.42) *
        this.cameraZoom;
      _targetLookAt.set(0, 0.28 + this.workshopExplodeBlend * 0.45, 0);
      this.currentLookAt.lerp(_targetLookAt, dampK);
      _targetCamPos.set(
        Math.sin(this.cameraYaw + 0.35) * dist,
        0.58 + this.workshopExplodeBlend * 0.36 + Math.sin(this.cameraPitch) * dist * 0.65,
        Math.cos(this.cameraYaw + 0.35) * dist
      );
      this.camera.position.lerp(_targetCamPos, dampK);
      this.camera.lookAt(this.currentLookAt);
    } else {
      this.aimGroup.visible = false;
      this.diagnosticsGroup.visible = false;
      this.resetRibbonTrack(this.playerRibbon);
      this.resetRibbonTrack(this.opponentRibbon);
      this.titleSpinAngle += dt * 26;
      const orbitA = performance.now() * 0.00022 + this.cameraYaw;
      if (this.playerRig) {
        syncRigBrokenParts(this.playerRig, []);
        this.applyRigVisualState(
          this.playerRig,
          this.playerShadow,
          this.playerTrailRing,
          this.playerInnerTrailRing,
          0,
          arenaFloorHeight(0, 0),
          0,
          this.titleSpinAngle,
          0.025,
          this.titleSpinAngle * 0.1,
          1.0,
          0,
          false,
          false,
          true
        );
      }
      if (this.opponentRig) {
        syncRigBrokenParts(this.opponentRig, []);
        this.applyRigVisualState(
          this.opponentRig,
          this.opponentShadow,
          this.opponentTrailRing,
          this.opponentInnerTrailRing,
          -1.65,
          arenaFloorHeight(-1.65, -1.35),
          -1.35,
          -this.titleSpinAngle * 0.85,
          0.03,
          0,
          0.9,
          0,
          false,
          false,
          true
        );
      }

      _targetLookAt.set(0, 0.22, 0);
      this.currentLookAt.lerp(_targetLookAt, dampK);
      _targetCamPos.set(Math.sin(orbitA) * 4.75, 2.25, Math.cos(orbitA) * 4.75);
      this.camera.position.lerp(_targetCamPos, dampK);
      this.camera.lookAt(this.currentLookAt);
    }

    this.updateParticles(particleDt);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTimeMs) / 1000;
      this.lastTimeMs = now;
      const clampedDt = Math.min(Math.max(rawDt, 0.001), 0.05);

      // Live Training Diagnostics telemetry reporter (~3Hz)
      if (this.showDiagnostics && this.onTelemetry) {
        this.telemetryAccumTime += rawDt;
        this.telemetryFrames += 1;
        if (this.telemetryAccumTime >= 0.35) {
          const fps = Math.round(this.telemetryFrames / this.telemetryAccumTime);
          const frameTimeMs = Number(((this.telemetryAccumTime / Math.max(1, this.telemetryFrames)) * 1000).toFixed(1));
          this.onTelemetry({
            fps,
            frameTimeMs,
            simStepTimeMs: this.lastSimStepMs,
            droppedSteps: this.lastDroppedSteps,
            quality: this.currentQuality,
            qualityAutoAdjusted: this.qualityAutoAdjusted,
            particleBudget: this.getParticleBudget(),
            heatmapImpacts: this.heatmapImpacts,
            heatmapPeakZone: this.heatmapPeakZone,
            heatmapPeakIntensity: this.heatmapPeakIntensity,
          });
          this.telemetryAccumTime = 0;
          this.telemetryFrames = 0;
        }
      }

      // 3-tier bidirectional FPS Adaptive Quality check every 2.5s on non-software WebGL
      if (!this.isSoftwareGl) {
        this.fpsAccumTime += rawDt;
        this.fpsFrames += 1;
        if (this.fpsAccumTime >= 2.5) {
          const avgFps = this.fpsFrames / this.fpsAccumTime;
          if (avgFps < 28) {
            this.highFpsStreak = 0;
            if (this.currentQuality === 'High') {
              this.applyQuality('Medium', true);
            } else if (this.currentQuality === 'Medium') {
              this.applyQuality('Low', true);
            }
          } else if (avgFps >= 52 && this.currentQuality !== this.userQualityCap) {
            this.highFpsStreak += 1;
            if (this.highFpsStreak >= 2) {
              this.highFpsStreak = 0;
              if (this.currentQuality === 'Low') {
                this.applyQuality('Medium', true);
              } else if (this.currentQuality === 'Medium' && this.userQualityCap === 'High') {
                this.applyQuality('High', true);
              }
            }
          } else {
            this.highFpsStreak = 0;
          }
          this.fpsAccumTime = 0;
          this.fpsFrames = 0;
        }
      }

      const sim = this.simGetter();
      const inHitstop = Boolean(this.cameraMode !== 'replay' && sim && sim.hitstopTimer > 0);
      const timeScale = this.cameraMode !== 'replay' && sim && sim.slowMotionTimer > 0 ? 0.38 : 1.0;
      const tickDt = inHitstop ? clampedDt : clampedDt * timeScale;
      const sceneDt = inHitstop ? 0 : tickDt;
      this.lastRawDt = clampedDt;

      this.onFrameTick(tickDt);
      this.updateScene(sceneDt);
      if (!this.webglContextLost) {
        if (this.composer && this.currentQuality === 'High' && !this.isSoftwareGl) {
          this.composer.render();
        } else {
          this.renderer.render(this.scene, this.camera);
        }
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindPointer();
    this.resizeObserver.disconnect();
    if (this.initFailed || !this.renderer) return;
    this.clearEjectedParts();
    this.disposeComposer();
    this.heatmapTex.dispose();
    this.scuffTex?.dispose();
    this.scorchGlowTex?.dispose();
    this.contactShadowTex?.dispose();
    this.innerWallAoTex?.dispose();
    this.arenaEnvTarget?.dispose();
    this.arenaEnvTarget = null;
    this.clashFlareTex?.dispose();
    this.slashArcTex?.dispose();
    this.cleaveStreakTex?.dispose();
    this.shockwaveTex?.dispose();
    for (const tex of this.activeArenaTextures) {
      tex.dispose();
    }
    this.activeArenaTextures = [];
    if (this.stadiumSurfaceMaps) {
      this.stadiumSurfaceMaps.wallNormal.dispose();
      this.stadiumSurfaceMaps.wallRoughness.dispose();
      this.stadiumSurfaceMaps.wallAo.dispose();
      this.stadiumSurfaceMaps.deckNormal.dispose();
      this.stadiumSurfaceMaps.deckRoughness.dispose();
      this.stadiumSurfaceMaps = null;
    }
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    if (this.shockwaves.length > 0) {
      this.shockwaves[0].mesh.geometry.dispose();
      for (const sw of this.shockwaves) {
        (sw.mesh.material as THREE.Material).dispose();
      }
    }
    if (this.arcFlares.length > 0) {
      this.arcFlares[0].mesh.geometry.dispose();
      for (const af of this.arcFlares) {
        (af.mesh.material as THREE.Material).dispose();
      }
    }
    if (this.slashArcs.length > 0) {
      this.slashArcs[0].mesh.geometry.dispose();
      for (const sa of this.slashArcs) {
        (sa.mesh.material as THREE.Material).dispose();
      }
    }
    if (this.cleaveBeams.length > 0) {
      this.cleaveBeams[0].mesh.geometry.dispose();
      for (const cb of this.cleaveBeams) {
        (cb.mesh.material as THREE.Material).dispose();
      }
    }
    if (this.thermalScorches.length > 0) {
      this.thermalScorches[0].mesh.geometry.dispose();
      for (const ts of this.thermalScorches) {
        (ts.mesh.material as THREE.Material).dispose();
      }
    }
    this.debrisParticleMesh.geometry.dispose();
    (this.debrisParticleMesh.material as THREE.Material).dispose();
    this.weatherParticleMesh.geometry.dispose();
    (this.weatherParticleMesh.material as THREE.Material).dispose();
    if (this.playerRig) disposeObject3D(this.playerRig.root);
    if (this.opponentRig) disposeObject3D(this.opponentRig.root);
    if (this.workshopPedestalGroup) disposeObject3D(this.workshopPedestalGroup);
    this.workshopPedestalColorTex?.dispose();
    this.workshopPedestalEmissiveTex?.dispose();
    if (this.playerRibbon) {
      this.playerRibbon.geometry.dispose();
      this.playerRibbon.material.dispose();
    }
    if (this.opponentRibbon) {
      this.opponentRibbon.geometry.dispose();
      this.opponentRibbon.material.dispose();
    }
    if (this.stadiumGroup) disposeObject3D(this.stadiumGroup);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
