import * as THREE from 'three';
import { ELEMENTS, getComponentDefinition } from '../domain/catalog';
import {
  ComponentCategory,
  CosmeticCustomization,
  ElementType,
  EquippedComponents,
  GraphicsQuality,
  PartDurabilityKey,
} from '../domain/types';

function tagWorkshopCategory(obj: THREE.Object3D, category: ComponentCategory): void {
  obj.traverse((child) => {
    child.userData.workshopCategory = category;
  });
}

export interface ExplodeLayerEntry {
  obj: THREE.Object3D;
  baseY: number;
  offsetY: number;
}

export interface TopVisualRig {
  root: THREE.Group;
  spinGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  energyHalo: THREE.Mesh;
  bladeGroup: THREE.Group;
  armorMesh: THREE.Mesh;
  weightMesh: THREE.Mesh;
  driverGroup: THREE.Group;
  blurDisc: THREE.Mesh;
  shieldBubble: THREE.Mesh;
  fireAura: THREE.Mesh;
  hitFlashMaterials: THREE.MeshStandardMaterial[];
  explodeLayers: ExplodeLayerEntry[];
  baseEmissiveHex: number;
}

interface PbrTextureBundle {
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  clearcoatRoughnessMap?: THREE.CanvasTexture;
}

interface TopPbrMaps {
  brushed: PbrTextureBundle;
  forged: PbrTextureBundle;
  blade: PbrTextureBundle;
  driver: PbrTextureBundle;
}

let cachedTopMaps: TopPbrMaps | null = null;

function createCanvasTex(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildNormalCanvasFromHeight(
  heightField: Float32Array,
  size: number,
  strength: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const mask = size - 1;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) & mask;
    const yp = (y + 1) & mask;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) & mask;
      const xp = (x + 1) & mask;
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

function buildGrayscaleCanvas(
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

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getTopPbrMaps(maxAnisotropy = 4): TopPbrMaps | null {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));
  if (cachedTopMaps) {
    for (const bundle of Object.values(cachedTopMaps) as PbrTextureBundle[]) {
      if (bundle.normalMap.anisotropy !== aniso) {
        bundle.normalMap.anisotropy = aniso;
        bundle.roughnessMap.anisotropy = aniso;
        bundle.aoMap.anisotropy = aniso;
        if (bundle.clearcoatRoughnessMap) {
          bundle.clearcoatRoughnessMap.anisotropy = aniso;
        }
      }
    }
    return cachedTopMaps;
  }
  if (typeof document === 'undefined') return null;

  const rand = makePrng(40921);

  // 1. Machined Brushed Lathe Tungsten (WeightDisc & metallic collars)
  const bSize = 256;
  const bHeight = new Float32Array(bSize * bSize);
  const bRough = new Float32Array(bSize * bSize);
  const bAo = new Float32Array(bSize * bSize);
  for (let y = 0; y < bSize; y++) {
    const groove =
      Math.sin((y / bSize) * Math.PI * 24) * 0.28 +
      Math.sin((y / bSize) * Math.PI * 64) * 0.14;
    const rowJitter = (rand() - 0.5) * 0.22;
    const isMachinedSeam = y % 32 === 0 || y % 32 === 1;
    for (let x = 0; x < bSize; x++) {
      const idx = y * bSize + x;
      const microStreak = Math.sin((x / bSize) * Math.PI * 6 + y * 0.35) * 0.06 + (rand() - 0.5) * 0.08;
      const seamDip = isMachinedSeam ? -0.35 : 0;
      const h = Math.max(0, Math.min(1, 0.55 + groove + rowJitter + microStreak + seamDip));
      bHeight[idx] = h;
      bRough[idx] = Math.max(0, Math.min(1, isMachinedSeam ? 0.88 : 0.48 - groove * 0.32 + Math.abs(rowJitter) * 0.5));
      bAo[idx] = isMachinedSeam ? 0.52 : Math.max(0.75, Math.min(1, 0.88 + groove * 0.16));
    }
  }
  const brushed: PbrTextureBundle = {
    normalMap: createCanvasTex(buildNormalCanvasFromHeight(bHeight, bSize, 2.4), 2, 2, aniso),
    roughnessMap: createCanvasTex(buildGrayscaleCanvas(bRough, bSize, 0.36, 0.92), 2, 2, aniso),
    aoMap: createCanvasTex(buildGrayscaleCanvas(bAo, bSize, 0.45, 1.0), 2, 2, aniso),
  };
  brushed.aoMap.channel = 0;

  // 2. Forged Shot-Peened Gunmetal (ArmorRing, lug pockets, housings)
  const fSize = 256;
  const fHeight = new Float32Array(fSize * fSize);
  const fRough = new Float32Array(fSize * fSize);
  const fAo = new Float32Array(fSize * fSize);
  for (let i = 0; i < fHeight.length; i++) {
    fHeight[i] = 0.52 + (rand() - 0.5) * 0.26;
    fAo[i] = 0.92;
  }
  // Stamp tiny forged dimple pits cleanly across the tile
  for (let d = 0; d < 420; d++) {
    const cx = rand() * fSize;
    const cy = rand() * fSize;
    const rad = 1.6 + rand() * 3.4;
    const depth = 0.25 + rand() * 0.35;
    const minX = Math.floor(cx - rad);
    const maxX = Math.ceil(cx + rad);
    const minY = Math.floor(cy - rad);
    const maxY = Math.ceil(cy + rad);
    for (let yy = minY; yy <= maxY; yy++) {
      const wy = ((yy % fSize) + fSize) % fSize;
      for (let xx = minX; xx <= maxX; xx++) {
        const wx = ((xx % fSize) + fSize) % fSize;
        const dist = Math.hypot(xx - cx, yy - cy);
        if (dist < rad) {
          const falloff = 1 - dist / rad;
          const idx = wy * fSize + wx;
          fHeight[idx] = Math.max(0.05, fHeight[idx] - falloff * depth);
          fAo[idx] = Math.max(0.48, fAo[idx] - falloff * 0.32);
        }
      }
    }
  }
  for (let i = 0; i < fRough.length; i++) {
    fRough[i] = Math.max(0.1, Math.min(1, 0.85 - fHeight[i] * 0.45 + (rand() - 0.5) * 0.1));
  }
  const forged: PbrTextureBundle = {
    normalMap: createCanvasTex(buildNormalCanvasFromHeight(fHeight, fSize, 2.8), 3, 3, aniso),
    roughnessMap: createCanvasTex(buildGrayscaleCanvas(fRough, fSize, 0.55, 0.96), 3, 3, aniso),
    aoMap: createCanvasTex(buildGrayscaleCanvas(fAo, fSize, 0.45, 1.0), 3, 3, aniso),
  };
  forged.aoMap.channel = 0;

  // 3. Anodized Battle-Scarred Blade Alloy (AttackBlade + clearcoat wear)
  const blSize = 512;
  const blHeight = new Float32Array(blSize * blSize);
  const blRough = new Float32Array(blSize * blSize);
  const blClearcoatRough = new Float32Array(blSize * blSize);
  const blAo = new Float32Array(blSize * blSize);
  for (let y = 0; y < blSize; y++) {
    const brushWave = Math.sin((y / blSize) * Math.PI * 52) * 0.08 + (rand() - 0.5) * 0.1;
    for (let x = 0; x < blSize; x++) {
      const idx = y * blSize + x;
      blHeight[idx] = 0.62 + brushWave + (rand() - 0.5) * 0.05;
      blRough[idx] = 0.45 + Math.abs(brushWave) * 0.8;
      blClearcoatRough[idx] = 0.16 + Math.abs(brushWave) * 0.35;
      blAo[idx] = 0.94;
    }
  }
  // Micro-impact gouges and tangential combat scratches along anodized metal
  for (let s = 0; s < 95; s++) {
    const x0 = rand() * blSize;
    const y0 = rand() * blSize;
    const angle = (rand() - 0.5) * 1.15;
    const len = 18 + rand() * 58;
    const stepCount = Math.ceil(len);
    const scratchDepth = 0.22 + rand() * 0.28;
    for (let step = 0; step < stepCount; step++) {
      const taper = Math.sin((step / stepCount) * Math.PI);
      const px = (((x0 + Math.cos(angle) * step) % blSize) + blSize) % blSize;
      const py = (((y0 + Math.sin(angle) * step) % blSize) + blSize) % blSize;
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      const idx = iy * blSize + ix;
      blHeight[idx] = Math.max(0.08, blHeight[idx] - scratchDepth * taper);
      blRough[idx] = Math.min(1, blRough[idx] + 0.42 * taper);
      blClearcoatRough[idx] = Math.min(1, blClearcoatRough[idx] + 0.68 * taper);
      blAo[idx] = Math.max(0.55, blAo[idx] - 0.25 * taper);
      // Slight neighbor bleed for normal slope
      const nIdx = ((iy + 1) % blSize) * blSize + ix;
      blHeight[nIdx] = Math.max(0.12, blHeight[nIdx] - scratchDepth * taper * 0.45);
      blClearcoatRough[nIdx] = Math.min(1, blClearcoatRough[nIdx] + 0.35 * taper);
    }
  }
  const blade: PbrTextureBundle = {
    normalMap: createCanvasTex(buildNormalCanvasFromHeight(blHeight, blSize, 2.2), 1.5, 1.5, aniso),
    roughnessMap: createCanvasTex(buildGrayscaleCanvas(blRough, blSize, 0.38, 0.96), 1.5, 1.5, aniso),
    aoMap: createCanvasTex(buildGrayscaleCanvas(blAo, blSize, 0.5, 1.0), 1.5, 1.5, aniso),
    clearcoatRoughnessMap: createCanvasTex(buildGrayscaleCanvas(blClearcoatRough, blSize, 0.14, 0.9), 1.5, 1.5, aniso),
  };
  blade.aoMap.channel = 0;

  // 4. Diamond Knurled Grip (PerformanceDriver rubber/composite tip collar)
  const dSize = 256;
  const dHeight = new Float32Array(dSize * dSize);
  const dRough = new Float32Array(dSize * dSize);
  const dAo = new Float32Array(dSize * dSize);
  for (let y = 0; y < dSize; y++) {
    for (let x = 0; x < dSize; x++) {
      const idx = y * dSize + x;
      const u = (x / dSize) * Math.PI * 16;
      const v = (y / dSize) * Math.PI * 16;
      const knurl = Math.abs(Math.sin(u + v)) * Math.abs(Math.sin(u - v));
      const grain = (rand() - 0.5) * 0.08;
      dHeight[idx] = Math.max(0, Math.min(1, 0.25 + knurl * 0.65 + grain));
      dRough[idx] = Math.max(0.1, Math.min(1, 0.92 - knurl * 0.25 + Math.abs(grain)));
      dAo[idx] = Math.max(0.5, Math.min(1, 0.62 + knurl * 0.38));
    }
  }
  const driver: PbrTextureBundle = {
    normalMap: createCanvasTex(buildNormalCanvasFromHeight(dHeight, dSize, 3.0), 3, 2, aniso),
    roughnessMap: createCanvasTex(buildGrayscaleCanvas(dRough, dSize, 0.64, 0.98), 3, 2, aniso),
    aoMap: createCanvasTex(buildGrayscaleCanvas(dAo, dSize, 0.45, 1.0), 3, 2, aniso),
  };
  driver.aoMap.channel = 0;

  cachedTopMaps = { brushed, forged, blade, driver };
  return cachedTopMaps;
}

function safeComputeTangents(geo: THREE.BufferGeometry): void {
  if (
    geo.index !== null &&
    geo.attributes.position !== undefined &&
    geo.attributes.normal !== undefined &&
    geo.attributes.uv !== undefined
  ) {
    geo.computeTangents();
  }
}

function parseHexColor(hexStr: string | undefined, fallback: number): number {
  if (!hexStr) return fallback;
  const cleaned = hexStr.replace('#', '');
  const parsed = parseInt(cleaned, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createBladeShapeGeometry(
  shapeKind: string,
  bladeCount: number,
  outerRadius: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const innerR = outerRadius * 0.56;
  const steps = Math.max(3, bladeCount);

  if (shapeKind === 'wide') {
    const segs = 48;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const notch = Math.cos(a * steps) > 0.72 ? 0.88 : 1.0;
      const r = outerRadius * notch;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  } else if (shapeKind === 'curved' || shapeKind === 'vortex') {
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const aMid = a0 + (Math.PI * 2) / (steps * 2.1);
      const aTip = a0 + (Math.PI * 2) / (steps * 1.18);
      const p0x = Math.cos(a0) * innerR;
      const p0y = Math.sin(a0) * innerR;
      const p1x = Math.cos(aMid) * (outerRadius * 0.94);
      const p1y = Math.sin(aMid) * (outerRadius * 0.94);
      const p2x = Math.cos(aTip) * (outerRadius * (shapeKind === 'vortex' ? 1.08 : 1.02));
      const p2y = Math.sin(aTip) * (outerRadius * (shapeKind === 'vortex' ? 1.08 : 1.02));
      const p3x = Math.cos(aTip + 0.14) * innerR * 1.05;
      const p3y = Math.sin(aTip + 0.14) * innerR * 1.05;

      if (i === 0) shape.moveTo(p0x, p0y);
      else shape.lineTo(p0x, p0y);
      shape.quadraticCurveTo(p1x, p1y, p2x, p2y);
      shape.lineTo(p3x, p3y);
    }
    shape.closePath();
  } else if (shapeKind === 'heavy') {
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const span = (Math.PI * 2) / steps;
      const rA = innerR * 1.05;
      const rB = outerRadius * 1.04;
      const pts: [number, number][] = [
        [Math.cos(a0) * rA, Math.sin(a0) * rA],
        [Math.cos(a0 + span * 0.14) * rB, Math.sin(a0 + span * 0.14) * rB],
        [Math.cos(a0 + span * 0.62) * rB, Math.sin(a0 + span * 0.62) * rB],
        [Math.cos(a0 + span * 0.74) * rA, Math.sin(a0 + span * 0.74) * rA],
      ];
      pts.forEach(([x, y], idx) => {
        if (i === 0 && idx === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      });
    }
    shape.closePath();
  } else {
    const peakScale = shapeKind === 'sharp' ? 1.1 : 1.03;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const span = (Math.PI * 2) / steps;
      const p0x = Math.cos(a0) * innerR;
      const p0y = Math.sin(a0) * innerR;
      const p1x = Math.cos(a0 + span * 0.35) * (outerRadius * peakScale);
      const p1y = Math.sin(a0 + span * 0.35) * (outerRadius * peakScale);
      const p2x = Math.cos(a0 + span * 0.72) * (outerRadius * 0.85);
      const p2y = Math.sin(a0 + span * 0.72) * (outerRadius * 0.85);
      if (i === 0) shape.moveTo(p0x, p0y);
      else shape.lineTo(p0x, p0y);
      shape.lineTo(p1x, p1y);
      shape.lineTo(p2x, p2y);
    }
    shape.closePath();
  }

  const hole = new THREE.Path();
  hole.absarc(0, 0, outerRadius * 0.38, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.072,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildSpinningTopVisual(params: {
  equipped: EquippedComponents;
  element: ElementType;
  secondaryElement?: ElementType | null;
  evolutionStage: number;
  scaleMultiplier?: number;
  cosmetics?: CosmeticCustomization;
  quality?: GraphicsQuality;
  maxAnisotropy?: number;
}): TopVisualRig {
  const {
    equipped,
    element,
    secondaryElement,
    evolutionStage,
    scaleMultiplier = 1,
    cosmetics,
    quality = 'High',
    maxAnisotropy = 4,
  } = params;
  const elemDef = ELEMENTS[element];
  const secElemDef =
    secondaryElement && secondaryElement !== element ? ELEMENTS[secondaryElement] : null;
  const usePhysical = quality !== 'Low';
  const pbrMaps = usePhysical ? getTopPbrMaps(maxAnisotropy) : null;

  const coreDef = getComponentDefinition(equipped.SpiritCore);
  const bladeDef = getComponentDefinition(equipped.AttackBlade);
  const armorDef = getComponentDefinition(equipped.ArmorRing);
  const weightDef = getComponentDefinition(equipped.WeightDisc);
  const driverDef = getComponentDefinition(equipped.PerformanceDriver);
  const energyDef = getComponentDefinition(equipped.EnergyModule);

  const primaryOverrideHex = cosmetics
    ? parseHexColor(cosmetics.primaryColor, bladeDef.visual.primaryColor)
    : bladeDef.visual.primaryColor;
  const trimOverrideHex = cosmetics
    ? parseHexColor(cosmetics.trimColor, bladeDef.visual.accentColor)
    : bladeDef.visual.accentColor;

  const root = new THREE.Group();
  const spinGroup = new THREE.Group();
  root.add(spinGroup);

  const hitFlashMaterials: THREE.MeshStandardMaterial[] = [];
  const explodeLayers: ExplodeLayerEntry[] = [];

  // 1. PERFORMANCE DRIVER (Bottom-center pivot at y = 0 — chamfered stepped tip + knurled grip collar)
  const driverGroup = new THREE.Group();
  explodeLayers.push({ obj: driverGroup, baseY: 0, offsetY: 0.04 });
  const driverType = driverDef.visual.driverType ?? 'flat';
  const driverMat = new THREE.MeshStandardMaterial({
    color: driverDef.visual.primaryColor,
    metalness: driverType === 'rubber' ? 0.08 : Math.min(0.45, driverDef.visual.metalness),
    roughness: driverType === 'rubber' ? 0.94 : Math.max(0.64, driverDef.visual.roughness),
    normalMap: pbrMaps?.driver.normalMap ?? null,
    normalScale: new THREE.Vector2(driverType === 'rubber' ? 0.55 : 0.3, driverType === 'rubber' ? 0.55 : 0.3),
    roughnessMap: pbrMaps?.driver.roughnessMap ?? null,
    aoMap: pbrMaps?.driver.aoMap ?? null,
    aoMapIntensity: 0.65,
  });
  hitFlashMaterials.push(driverMat);

  let driverPoints: THREE.Vector2[];
  if (driverType === 'sharp') {
    driverPoints = [
      new THREE.Vector2(0.004, 0.0),
      new THREE.Vector2(0.022, 0.018),
      new THREE.Vector2(0.055, 0.042),
      new THREE.Vector2(0.065, 0.056),
      new THREE.Vector2(0.115, 0.082),
      new THREE.Vector2(0.145, 0.112),
      new THREE.Vector2(0.145, 0.135),
      new THREE.Vector2(0.0, 0.135),
    ];
  } else if (driverType === 'flat') {
    driverPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.082, 0.0),
      new THREE.Vector2(0.092, 0.014),
      new THREE.Vector2(0.095, 0.036),
      new THREE.Vector2(0.128, 0.068),
      new THREE.Vector2(0.148, 0.096),
      new THREE.Vector2(0.148, 0.135),
      new THREE.Vector2(0.0, 0.135),
    ];
  } else if (driverType === 'rubber') {
    driverPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.072, 0.0),
      new THREE.Vector2(0.084, 0.012),
      new THREE.Vector2(0.108, 0.048),
      new THREE.Vector2(0.116, 0.078),
      new THREE.Vector2(0.152, 0.105),
      new THREE.Vector2(0.152, 0.135),
      new THREE.Vector2(0.0, 0.135),
    ];
  } else {
    driverPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.044, 0.015),
      new THREE.Vector2(0.058, 0.032),
      new THREE.Vector2(0.064, 0.052),
      new THREE.Vector2(0.125, 0.092),
      new THREE.Vector2(0.145, 0.116),
      new THREE.Vector2(0.145, 0.135),
      new THREE.Vector2(0.0, 0.135),
    ];
  }
  const driverGeo = new THREE.LatheGeometry(driverPoints, 30);
  if (usePhysical) {
    safeComputeTangents(driverGeo);
  }
  const driverShaft = new THREE.Mesh(driverGeo, driverMat);
  driverShaft.castShadow = true;
  driverShaft.receiveShadow = true;
  driverGroup.add(driverShaft);

  const driverCollarMat = new THREE.MeshStandardMaterial({
    color: trimOverrideHex,
    metalness: 0.88,
    roughness: 0.34,
    normalMap: pbrMaps?.brushed.normalMap ?? null,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: pbrMaps?.brushed.roughnessMap ?? null,
    aoMap: pbrMaps?.brushed.aoMap ?? null,
    aoMapIntensity: 0.55,
  });
  const driverCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.142, 0.02, 10, 28),
    driverCollarMat
  );
  driverCollar.rotation.x = Math.PI / 2;
  driverCollar.position.y = 0.112;
  driverCollar.castShadow = true;
  driverCollar.receiveShadow = true;
  driverGroup.add(driverCollar);

  const lockTabGeo = new THREE.BoxGeometry(0.034, 0.036, 0.024);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tab = new THREE.Mesh(lockTabGeo, driverCollarMat);
    tab.position.set(Math.cos(a) * 0.144, 0.112, Math.sin(a) * 0.144);
    tab.rotation.y = -a + Math.PI / 2;
    tab.castShadow = true;
    tab.receiveShadow = true;
    driverGroup.add(tab);
  }
  tagWorkshopCategory(driverGroup, 'PerformanceDriver');
  spinGroup.add(driverGroup);

  // 2. WEIGHT DISC (Machined tungsten-alloy stepped flywheel with bevels & counterbored balance slugs)
  const weightMat = usePhysical
    ? new THREE.MeshPhysicalMaterial({
        color: weightDef.visual.primaryColor,
        metalness: 0.96,
        roughness: 0.24,
        roughnessMap: pbrMaps?.brushed.roughnessMap ?? null,
        normalMap: pbrMaps?.brushed.normalMap ?? null,
        normalScale: new THREE.Vector2(0.32, 0.32),
        aoMap: pbrMaps?.brushed.aoMap ?? null,
        aoMapIntensity: 0.65,
        clearcoat: 0.32,
        clearcoatRoughness: 0.2,
        anisotropy: quality === 'High' ? 0.72 : 0.4,
      })
    : new THREE.MeshStandardMaterial({
        color: weightDef.visual.primaryColor,
        metalness: 0.94,
        roughness: 0.16,
      });
  hitFlashMaterials.push(weightMat);

  const weightRadius = 0.285 + weightDef.radiusContribution * 6;
  const weightPoints = [
    new THREE.Vector2(0.11, 0.132),
    new THREE.Vector2(weightRadius * 0.76, 0.132),
    new THREE.Vector2(weightRadius * 0.92, 0.148),
    new THREE.Vector2(weightRadius, 0.165),
    new THREE.Vector2(weightRadius, 0.205),
    new THREE.Vector2(weightRadius * 0.92, 0.222),
    new THREE.Vector2(weightRadius * 0.72, 0.228),
    new THREE.Vector2(0.11, 0.228),
  ];
  const weightGeo = new THREE.LatheGeometry(weightPoints, 36);
  if (usePhysical) {
    safeComputeTangents(weightGeo);
  }
  const weightMesh = new THREE.Mesh(weightGeo, weightMat);
  weightMesh.castShadow = true;
  weightMesh.receiveShadow = true;

  const slugPocketMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.72,
    roughness: 0.78,
    normalMap: pbrMaps?.forged.normalMap ?? null,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: pbrMaps?.forged.roughnessMap ?? null,
    aoMap: pbrMaps?.forged.aoMap ?? null,
    aoMapIntensity: 0.7,
  });
  const slugPinMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.22,
    normalMap: pbrMaps?.brushed.normalMap ?? null,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughnessMap: pbrMaps?.brushed.roughnessMap ?? null,
  });
  const slugPocketGeo = new THREE.CylinderGeometry(0.03, 0.032, 0.022, 8);
  const slugPinGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.028, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rSlug = weightRadius * 0.78;
    const pocket = new THREE.Mesh(slugPocketGeo, slugPocketMat);
    pocket.position.set(Math.cos(a) * rSlug, 0.214, Math.sin(a) * rSlug);
    weightMesh.add(pocket);
    const pin = new THREE.Mesh(slugPinGeo, slugPinMat);
    pin.position.set(Math.cos(a) * rSlug, 0.218, Math.sin(a) * rSlug);
    weightMesh.add(pin);
  }
  tagWorkshopCategory(weightMesh, 'WeightDisc');
  spinGroup.add(weightMesh);
  explodeLayers.push({ obj: weightMesh, baseY: 0, offsetY: 0.22 });

  // 3. ARMOR RING (Beveled forged-gunmetal collar with shot-peened pitting, bumper ribs & hex rivets)
  const armorMat = new THREE.MeshStandardMaterial({
    color: cosmetics ? trimOverrideHex : armorDef.visual.primaryColor,
    metalness: Math.min(0.62, armorDef.visual.metalness),
    roughness: Math.max(0.68, armorDef.visual.roughness + 0.12),
    normalMap: pbrMaps?.forged.normalMap ?? null,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: pbrMaps?.forged.roughnessMap ?? null,
    aoMap: pbrMaps?.forged.aoMap ?? null,
    aoMapIntensity: 0.7,
  });
  hitFlashMaterials.push(armorMat);

  const armorRadius = 0.345 + armorDef.radiusContribution * 6;
  const armorPoints = [
    new THREE.Vector2(armorRadius * 0.52, -0.03),
    new THREE.Vector2(armorRadius * 0.88, -0.03),
    new THREE.Vector2(armorRadius * 0.98, -0.015),
    new THREE.Vector2(armorRadius, 0.016),
    new THREE.Vector2(armorRadius * 0.93, 0.032),
    new THREE.Vector2(armorRadius * 0.56, 0.032),
  ];
  const armorGeo = new THREE.LatheGeometry(armorPoints, 32);
  if (usePhysical) {
    safeComputeTangents(armorGeo);
  }
  const armorMesh = new THREE.Mesh(armorGeo, armorMat);
  armorMesh.position.y = 0.236;
  armorMesh.castShadow = true;
  armorMesh.receiveShadow = true;

  const armorRibGeo = new THREE.BoxGeometry(0.052, 0.048, 0.046);
  const armorRivetGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.02, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const rib = new THREE.Mesh(armorRibGeo, armorMat);
    rib.position.set(Math.cos(a) * (armorRadius - 0.01), 0.0, Math.sin(a) * (armorRadius - 0.01));
    rib.rotation.y = -a;
    armorMesh.add(rib);

    const rivet = new THREE.Mesh(armorRivetGeo, slugPinMat);
    rivet.position.set(Math.cos(a) * (armorRadius * 0.82), 0.028, Math.sin(a) * (armorRadius * 0.82));
    armorMesh.add(rivet);
  }
  tagWorkshopCategory(armorMesh, 'ArmorRing');
  spinGroup.add(armorMesh);
  explodeLayers.push({ obj: armorMesh, baseY: 0.236, offsetY: 0.38 });

  // 4. ATTACK BLADE (Anodized clearcoated alloy with battle-scar scratches, normal bevels & lock sockets)
  const bladeGroup = new THREE.Group();
  const bladeRadius = 0.42 + bladeDef.radiusContribution * 4.5;
  const bladeGeo = createBladeShapeGeometry(
    bladeDef.visual.bladeShape ?? 'sharp',
    bladeDef.visual.bladeCount ?? 4,
    bladeRadius
  );
  const bladeMat = usePhysical
    ? new THREE.MeshPhysicalMaterial({
        color: primaryOverrideHex,
        metalness: bladeDef.visual.metalness,
        roughness: Math.max(0.28, Math.min(0.46, bladeDef.visual.roughness + 0.08)),
        roughnessMap: pbrMaps?.blade.roughnessMap ?? null,
        normalMap: pbrMaps?.blade.normalMap ?? null,
        normalScale: new THREE.Vector2(0.28, 0.28),
        aoMap: pbrMaps?.blade.aoMap ?? null,
        aoMapIntensity: 0.6,
        clearcoat: 0.85,
        clearcoatRoughness: 0.36,
        clearcoatRoughnessMap: pbrMaps?.blade.clearcoatRoughnessMap ?? null,
        emissive: elemDef.emissiveHex,
        emissiveIntensity: evolutionStage > 0 ? 0.34 : 0.16,
      })
    : new THREE.MeshStandardMaterial({
        color: primaryOverrideHex,
        metalness: bladeDef.visual.metalness,
        roughness: bladeDef.visual.roughness,
        emissive: elemDef.emissiveHex,
        emissiveIntensity: evolutionStage > 0 ? 0.32 : 0.14,
      });
  hitFlashMaterials.push(bladeMat);

  const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
  bladeMesh.position.y = 0.242;
  bladeMesh.castShadow = true;
  bladeMesh.receiveShadow = true;
  bladeGroup.add(bladeMesh);

  const bladeTrimMat = new THREE.MeshStandardMaterial({
    color: trimOverrideHex,
    metalness: 0.9,
    roughness: 0.28,
    normalMap: pbrMaps?.brushed.normalMap ?? null,
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughnessMap: pbrMaps?.brushed.roughnessMap ?? null,
  });
  const bladeTrim = new THREE.Mesh(
    new THREE.TorusGeometry(bladeRadius * 0.64, 0.018, 10, 32),
    bladeTrimMat
  );
  bladeTrim.rotation.x = Math.PI / 2;
  bladeTrim.position.y = 0.326;
  bladeTrim.castShadow = true;
  bladeTrim.receiveShadow = true;
  bladeGroup.add(bladeTrim);

  // Machined chassis lock lugs & recessed mounting washers gripping AttackBlade to inner core
  const chassisLugGeo = new THREE.BoxGeometry(0.068, 0.028, 0.044);
  const washerGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.016, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lug = new THREE.Mesh(chassisLugGeo, slugPocketMat);
    lug.position.set(Math.cos(a) * (bladeRadius * 0.54), 0.324, Math.sin(a) * (bladeRadius * 0.54));
    lug.rotation.y = -a;
    bladeGroup.add(lug);

    const washer = new THREE.Mesh(washerGeo, slugPinMat);
    washer.position.set(Math.cos(a) * (bladeRadius * 0.54), 0.334, Math.sin(a) * (bladeRadius * 0.54));
    bladeGroup.add(washer);
  }

  // Pattern visual accents (Striped, Circuit, Apex — physical metallic inlays, zero flat unlit rings)
  const pattern = cosmetics?.pattern ?? 'solid';
  if (pattern === 'striped' || pattern === 'apex') {
    const stripeCount = pattern === 'apex' ? 6 : 4;
    const stripeMat = new THREE.MeshStandardMaterial({
      color: trimOverrideHex,
      emissive: trimOverrideHex,
      emissiveIntensity: pattern === 'apex' ? 0.45 : 0.22,
      metalness: 0.84,
      roughness: 0.2,
    });
    for (let i = 0; i < stripeCount; i++) {
      const a = (i / stripeCount) * Math.PI * 2;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(bladeRadius * 0.28, 0.024, 0.042),
        stripeMat
      );
      bar.position.set(Math.cos(a) * (bladeRadius * 0.68), 0.326, Math.sin(a) * (bladeRadius * 0.68));
      bar.rotation.y = -a;
      bladeGroup.add(bar);
    }
  } else if (pattern === 'circuit') {
    const circuitMat = new THREE.MeshStandardMaterial({
      color: trimOverrideHex,
      emissive: trimOverrideHex,
      emissiveIntensity: 0.82,
      metalness: 0.72,
      roughness: 0.18,
    });
    const circuitRing = new THREE.Mesh(
      new THREE.TorusGeometry(bladeRadius * 0.78, 0.013, 8, 28),
      circuitMat
    );
    circuitRing.rotation.x = Math.PI / 2;
    circuitRing.position.y = 0.326;
    bladeGroup.add(circuitRing);
  }

  const blurRingGeo = new THREE.RingGeometry(bladeRadius * 0.48, bladeRadius * 1.04, 32, 1, 0, Math.PI * 1.45);
  blurRingGeo.rotateX(-Math.PI / 2);
  const blurDisc = new THREE.Mesh(
    blurRingGeo,
    new THREE.MeshBasicMaterial({
      color: primaryOverrideHex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  blurDisc.position.y = 0.288;
  bladeGroup.add(blurDisc);

  tagWorkshopCategory(bladeGroup, 'AttackBlade');
  spinGroup.add(bladeGroup);
  explodeLayers.push({ obj: bladeGroup, baseY: 0, offsetY: 0.58 });

  // 5. ENERGY MODULE (Armored containment bezel + protective clamps around luminous core ring)
  const haloHex = secElemDef ? secElemDef.primaryHex : energyDef.visual.primaryColor;
  const energyHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.195, 0.02, 10, 28),
    new THREE.MeshPhysicalMaterial({
      color: haloHex,
      emissive: haloHex,
      emissiveIntensity: secElemDef ? 1.05 : 0.8,
      metalness: 0.25,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    })
  );
  energyHalo.rotation.x = Math.PI / 2;
  energyHalo.position.y = 0.332;

  const haloHousingMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.88,
    roughness: 0.34,
    normalMap: pbrMaps?.forged.normalMap ?? null,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughnessMap: pbrMaps?.forged.roughnessMap ?? null,
    aoMap: pbrMaps?.forged.aoMap ?? null,
    aoMapIntensity: 0.65,
  });
  const haloBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.214, 0.012, 8, 28),
    haloHousingMat
  );
  haloBezel.castShadow = true;
  haloBezel.receiveShadow = true;
  energyHalo.add(haloBezel);

  const clampGeo = new THREE.BoxGeometry(0.026, 0.044, 0.03);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const clamp = new THREE.Mesh(clampGeo, haloHousingMat);
    // Note: energyHalo is rotated PI/2 on X, so local XY lies in horizontal XZ plane
    clamp.position.set(Math.cos(a) * 0.195, Math.sin(a) * 0.195, 0);
    clamp.rotation.z = a + Math.PI / 2;
    energyHalo.add(clamp);
  }
  tagWorkshopCategory(energyHalo, 'EnergyModule');
  spinGroup.add(energyHalo);
  explodeLayers.push({ obj: energyHalo, baseY: 0.332, offsetY: 0.76 });

  // 6. SPIRIT CORE (Faceted core clamped inside chamfered steel retention collar + flanged hex bolts)
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: coreDef.visual.primaryColor,
    emissive: elemDef.emissiveHex,
    emissiveIntensity: evolutionStage > 0 ? 0.85 : 0.45,
    metalness: 0.25,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.135, 1), coreMat);
  coreMesh.scale.set(1.15, 0.65, 1.15);
  coreMesh.position.y = 0.352;
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;

  const coreCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.165, 0.042, 8),
    haloHousingMat
  );
  coreCollar.position.y = -0.024;
  coreCollar.castShadow = true;
  coreCollar.receiveShadow = true;
  coreMesh.add(coreCollar);
  tagWorkshopCategory(coreMesh, 'SpiritCore');
  spinGroup.add(coreMesh);
  explodeLayers.push({ obj: coreMesh, baseY: 0.352, offsetY: 0.96 });

  const boltFlangeGeo = new THREE.CylinderGeometry(0.026, 0.028, 0.016, 8);
  const boltHeadGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.032, 6);
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.16,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const flange = new THREE.Mesh(boltFlangeGeo, slugPocketMat);
    flange.position.set(Math.cos(a) * 0.195, 0.34, Math.sin(a) * 0.195);
    tagWorkshopCategory(flange, 'SpiritCore');
    spinGroup.add(flange);
    explodeLayers.push({ obj: flange, baseY: 0.34, offsetY: 0.96 });

    const bolt = new THREE.Mesh(boltHeadGeo, boltMat);
    bolt.position.set(Math.cos(a) * 0.195, 0.352, Math.sin(a) * 0.195);
    tagWorkshopCategory(bolt, 'SpiritCore');
    spinGroup.add(bolt);
    explodeLayers.push({ obj: bolt, baseY: 0.352, offsetY: 0.96 });
  }

  if (evolutionStage > 0) {
    const crownMat = new THREE.MeshStandardMaterial({
      color: elemDef.secondaryHex,
      emissive: elemDef.emissiveHex,
      emissiveIntensity: 0.9,
      metalness: 0.85,
      roughness: 0.14,
    });
    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.252, 0.013, 8, 28), crownMat);
    crownRing.rotation.x = Math.PI / 2;
    crownRing.position.y = 0.362;
    tagWorkshopCategory(crownRing, 'SpiritCore');
    spinGroup.add(crownRing);
    explodeLayers.push({ obj: crownRing, baseY: 0.362, offsetY: 0.98 });
  }

  const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(bladeRadius * 1.25, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  const shieldGrid = new THREE.Mesh(
    new THREE.SphereGeometry(bladeRadius * 1.28, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.55,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  shieldBubble.add(shieldGrid);
  shieldBubble.position.y = 0.22;
  shieldBubble.visible = false;
  root.add(shieldBubble);

  const fireAuraGeo = new THREE.TorusGeometry(bladeRadius * 1.12, 0.075, 12, 36);
  fireAuraGeo.rotateX(Math.PI / 2);
  const fireAura = new THREE.Mesh(
    fireAuraGeo,
    new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  const fireCoreGeo = new THREE.TorusGeometry(bladeRadius * 1.02, 0.045, 10, 32);
  fireCoreGeo.rotateX(Math.PI / 2);
  const fireCore = new THREE.Mesh(
    fireCoreGeo,
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  fireAura.add(fireCore);
  fireAura.position.y = 0.23;
  fireAura.visible = false;
  root.add(fireAura);

  root.scale.setScalar(scaleMultiplier);

  return {
    root,
    spinGroup,
    coreMesh,
    energyHalo,
    bladeGroup,
    armorMesh,
    weightMesh,
    driverGroup,
    blurDisc,
    shieldBubble,
    fireAura,
    hitFlashMaterials,
    explodeLayers,
    baseEmissiveHex: elemDef.emissiveHex,
  };
}

export function applyRigExplodeFactor(rig: TopVisualRig, factor: number): void {
  const t = Math.max(0, Math.min(1, factor));
  for (let i = 0; i < rig.explodeLayers.length; i++) {
    const layer = rig.explodeLayers[i];
    layer.obj.position.y = layer.baseY + layer.offsetY * t;
  }
}

export function syncRigBrokenParts(rig: TopVisualRig, brokenParts: PartDurabilityKey[]): void {
  rig.coreMesh.visible = !brokenParts.includes('SpiritCore');
  rig.bladeGroup.visible = !brokenParts.includes('AttackBlade');
  rig.armorMesh.visible = !brokenParts.includes('ArmorRing');
  rig.weightMesh.visible = !brokenParts.includes('WeightDisc');
  rig.driverGroup.visible = !brokenParts.includes('PerformanceDriver');
  rig.energyHalo.visible = !brokenParts.includes('EnergyModule');
}

function cloneWithOwnResources(source: THREE.Object3D): THREE.Object3D {
  const cloned = source.clone(true);
  cloned.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry = mesh.geometry.clone();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone());
      } else {
        mesh.material = mesh.material.clone();
      }
    }
  });
  return cloned;
}

export function createDetachedPartFragment(
  rig: TopVisualRig,
  partKey: PartDurabilityKey
): THREE.Object3D | null {
  let target: THREE.Object3D | null = null;
  switch (partKey) {
    case 'SpiritCore':
      target = rig.coreMesh;
      break;
    case 'AttackBlade':
      target = rig.bladeGroup;
      break;
    case 'ArmorRing':
      target = rig.armorMesh;
      break;
    case 'WeightDisc':
      target = rig.weightMesh;
      break;
    case 'PerformanceDriver':
      target = rig.driverGroup;
      break;
    case 'EnergyModule':
      target = rig.energyHalo;
      break;
  }
  if (!target) return null;
  const pivot = new THREE.Group();
  const fragment = cloneWithOwnResources(target);
  fragment.visible = true;
  pivot.add(fragment);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const center = new THREE.Vector3();
  box.getCenter(center);
  fragment.position.sub(center);
  pivot.scale.multiply(rig.root.scale);
  return pivot;
}

export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
}
