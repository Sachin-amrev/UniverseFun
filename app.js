import * as THREE from 'three';
import {
  FilesetResolver,
  HandLandmarker
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';

// ============================================================================
// DOM Elements
// ============================================================================
const sceneContainer = document.getElementById('scene-container');
const videoEl = document.getElementById('webcam');
const canvasEl = document.getElementById('landmark-canvas');
const canvasCtx = canvasEl.getContext('2d');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const gestureBadge = document.getElementById('gesture-badge');
const fpsValue = document.getElementById('fps-value');
const starCountBadge = document.getElementById('star-count-badge');

const instPinch = document.getElementById('inst-pinch');
const instRotate = document.getElementById('inst-rotate');
const instExpand = document.getElementById('inst-expand');

const pinchReadout = document.getElementById('pinch-readout');
const pinchBar = document.getElementById('pinch-bar');
const pinchThresholdMarker = document.getElementById('pinch-threshold-marker');

const rollVal = document.getElementById('roll-val');
const pitchVal = document.getElementById('pitch-val');
const yawVal = document.getElementById('yaw-val');
const posVal = document.getElementById('pos-val');

const shapeSelect = document.getElementById('shape-select');
const realmPills = document.querySelectorAll('.realm-pill');
const lerpSlider = document.getElementById('lerp-slider');
const lerpDisplay = document.getElementById('lerp-display');
const rotLerpSlider = document.getElementById('rot-lerp-slider');
const rotLerpDisplay = document.getElementById('rot-lerp-display');
const pinchSlider = document.getElementById('pinch-slider');
const pinchDisplay = document.getElementById('pinch-display');
const starScaleSlider = document.getElementById('star-scale-slider');
const starScaleDisplay = document.getElementById('star-scale-display');

const warpBtn = document.getElementById('warp-btn');
const resetBtn = document.getElementById('reset-btn');
const cameraBtn = document.getElementById('camera-btn');
const hudToggleBtn = document.getElementById('hud-toggle-btn');
const restoreHudBtn = document.getElementById('restore-hud-btn');
const hudLeft = document.getElementById('hud-left');

const retryCameraBtn = document.getElementById('retry-camera-btn');
const cameraOverlayMsg = document.getElementById('camera-overlay-msg');
const cameraMsgText = document.getElementById('camera-msg-text');
const cameraSpinner = document.getElementById('camera-spinner');
const camLiveDot = document.getElementById('cam-live-dot');
const handednessLabel = document.getElementById('handedness-label');

if (starCountBadge) {
  starCountBadge.textContent = '8,000 TARAS';
}

// ============================================================================
// Configuration & Cosmic State
// ============================================================================
const config = {
  posLerp: parseFloat(lerpSlider.value),
  rotLerp: parseFloat(rotLerpSlider.value),
  pinchThreshold: parseFloat(pinchSlider.value),
  starBrilliance: parseFloat(starScaleSlider.value),
  worldBoundsX: 4.6,
  worldBoundsY: 2.7,
  worldBoundsZ: 3.0
};

const state = {
  handLandmarker: null,
  cameraActive: false,
  lastVideoTime: -1,
  handDetected: false,
  isPinching: false,
  pinchDistance: 1.0,
  handSpread: 0.35,
  targetScale: 1.0,
  targetPosition: new THREE.Vector3(0, 0, 0),
  targetQuaternion: new THREE.Quaternion(),
  targetEuler: new THREE.Euler(0, 0, 0, 'YXZ'),
  universeQuaternion: new THREE.Quaternion(),
  handCursorPos: new THREE.Vector3(0, 0, 0),
  wristAnglesDeg: { roll: 0, pitch: 0, yaw: 0 },
  supernovaPulse: 0,
  currentRealm: 'solar',
  frameCount: 0,
  lastFpsUpdate: performance.now()
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];

// ============================================================================
// Crisp Star ("Tara") Sprite & Label Textures (No Blurry Over-Bloom!)
// ============================================================================
function createCrispStarTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;

  // Tight, razor-sharp star core with delicate halo
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.12, 'rgba(255, 252, 240, 0.95)');
  grad.addColorStop(0.28, 'rgba(160, 215, 255, 0.35)');
  grad.addColorStop(0.6, 'rgba(80, 140, 255, 0.05)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Crisp 4-point star sparkle
  ctx.save();
  ctx.translate(half, half);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(0, 0, half * 0.78, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.1, half * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function createSoftHaloTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 245, 200, 0.75)');
  grad.addColorStop(0.35, 'rgba(251, 191, 36, 0.25)');
  grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.05)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function createTextLabelSprite(name, subtitle, colorHex) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');

  ctx.font = '700 22px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 8;
  ctx.fillText(`✦ ${name}`, 12, 28);

  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#bae6fd';
  ctx.shadowBlur = 0;
  ctx.fillText(subtitle, 16, 48);

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.88,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.25, 0.31, 1);
  return sprite;
}

const starTexture = createCrispStarTexture();
const softHaloTexture = createSoftHaloTexture();

// ============================================================================
// Three.js Crisp Scene Setup
// ============================================================================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040d, 0.018);

const camera = new THREE.PerspectiveCamera(
  52,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 0.55, 6.6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
sceneContainer.appendChild(renderer.domElement);

// Clean, high-contrast lighting so planets show real 3D day/night terminators
const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.9);
scene.add(ambientLight);

const sunPointLight = new THREE.PointLight(0xfffaed, 6.5, 40, 1.1);
scene.add(sunPointLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
rimLight.position.set(8, 10, 6);
scene.add(rimLight);

const backLight = new THREE.DirectionalLight(0xc084fc, 1.2);
backLight.position.set(-8, -6, -5);
scene.add(backLight);

// ============================================================================
// Layer 1: 6,500 Crisp Deep-Space Spiral Galaxy & Milky Way Stars
// Rotates smoothly with your wrist so the whole universe turns in your hand
// ============================================================================
const universeGroup = new THREE.Group();
scene.add(universeGroup);

const starColorsPalette = [
  new THREE.Color(0xffffff), // Pure White
  new THREE.Color(0xfff1c1), // Warm Solar Gold
  new THREE.Color(0x93c5fd), // Celestial Blue
  new THREE.Color(0x38bdf8), // Bright Cyan Tara
  new THREE.Color(0xd8b4fe), // Astral Violet
  new THREE.Color(0xfda4af)  // Crimson Giant
];

const DEEP_STAR_COUNT = 6500;
const deepStarGeo = new THREE.BufferGeometry();
const deepPositions = new Float32Array(DEEP_STAR_COUNT * 3);
const deepColors = new Float32Array(DEEP_STAR_COUNT * 3);

for (let i = 0; i < DEEP_STAR_COUNT; i++) {
  const i3 = i * 3;
  if (i < DEEP_STAR_COUNT * 0.7) {
    const arms = 4;
    const radius = 4.5 + Math.pow(Math.random(), 1.4) * 32;
    const branchAngle = ((i % arms) / arms) * Math.PI * 2;
    const spinAngle = radius * 0.38;
    const spread = (Math.random() - 0.5) * 2.4;

    deepPositions[i3] = Math.cos(branchAngle + spinAngle) * radius + spread;
    deepPositions[i3 + 1] = (Math.random() - 0.5) * (1.2 + radius * 0.14);
    deepPositions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + spread - 5;
  } else {
    const r = 9 + Math.random() * 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    deepPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
    deepPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    deepPositions[i3 + 2] = r * Math.cos(phi) - 5;
  }

  const c = starColorsPalette[i % starColorsPalette.length];
  const brightness = 0.55 + Math.random() * 0.45;
  deepColors[i3] = c.r * brightness;
  deepColors[i3 + 1] = c.g * brightness;
  deepColors[i3 + 2] = c.b * brightness;
}

deepStarGeo.setAttribute('position', new THREE.BufferAttribute(deepPositions, 3));
deepStarGeo.setAttribute('color', new THREE.BufferAttribute(deepColors, 3));

const deepStarMat = new THREE.PointsMaterial({
  size: 0.22,
  map: starTexture,
  vertexColors: true,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const deepGalaxyPoints = new THREE.Points(deepStarGeo, deepStarMat);
universeGroup.add(deepGalaxyPoints);

// ============================================================================
// Layer 2: 1,500 Near-Field Interactive "Taras" + Famous Named Stars Near You!
// "Every Tara is near — I can control the universe"
// ============================================================================
const NEAR_STAR_COUNT = 1500;
const nearStarGeo = new THREE.BufferGeometry();
const nearPositions = new Float32Array(NEAR_STAR_COUNT * 3);
const nearHomePositions = new Float32Array(NEAR_STAR_COUNT * 3);
const nearColors = new Float32Array(NEAR_STAR_COUNT * 3);

for (let i = 0; i < NEAR_STAR_COUNT; i++) {
  const i3 = i * 3;
  // Surrounding the user closely in 3D space
  const x = (Math.random() - 0.5) * 13.5;
  const y = (Math.random() - 0.5) * 8.5;
  const z = (Math.random() - 0.5) * 8.0 - 0.2;

  nearPositions[i3] = x;
  nearPositions[i3 + 1] = y;
  nearPositions[i3 + 2] = z;

  nearHomePositions[i3] = x;
  nearHomePositions[i3 + 1] = y;
  nearHomePositions[i3 + 2] = z;

  const col = starColorsPalette[(i * 3) % starColorsPalette.length];
  nearColors[i3] = col.r;
  nearColors[i3 + 1] = col.g;
  nearColors[i3 + 2] = col.b;
}

nearStarGeo.setAttribute('position', new THREE.BufferAttribute(nearPositions, 3));
nearStarGeo.setAttribute('color', new THREE.BufferAttribute(nearColors, 3));

const nearStarMat = new THREE.PointsMaterial({
  size: 0.36,
  map: starTexture,
  vertexColors: true,
  transparent: true,
  opacity: 0.98,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const nearStarPoints = new THREE.Points(nearStarGeo, nearStarMat);
scene.add(nearStarPoints);

// Famous Named Bright "Taras" floating near you in 3D space that react to your hand!
const namedTarasGroup = new THREE.Group();
scene.add(namedTarasGroup);

const NAMED_TARAS_SPEC = [
  { name: 'DHRUVA TARA', sub: 'Pole Star • α UMi', pos: [0.0, 2.35, -1.5], color: 0xfef08a, hex: '#fef08a' },
  { name: 'SIRIUS (VYADHA)', sub: 'Brightest Star • -1.46M', pos: [-3.2, -1.2, 0.6], color: 0x7dd3fc, hex: '#38bdf8' },
  { name: 'ROHINI (ALDEBARAN)', sub: 'Red Giant • α Tau', pos: [3.1, 1.35, 0.4], color: 0xfda4af, hex: '#fb7185' },
  { name: 'VEGA (ABHIJIT)', sub: 'Lyra Alpha • 25 ly', pos: [-2.7, 1.55, -0.8], color: 0xbae6fd, hex: '#7dd3fc' },
  { name: 'ANTARES (JYESHTHA)', sub: 'Supergiant • α Sco', pos: [2.9, -1.45, -0.5], color: 0xfbbf24, hex: '#fbbf24' },
  { name: 'SPICA (CHITRA)', sub: 'Blue Binary • α Vir', pos: [-1.8, -2.0, 1.1], color: 0xc084fc, hex: '#c084fc' }
];

const namedTaraNodes = [];

NAMED_TARAS_SPEC.forEach((spec) => {
  const holder = new THREE.Group();
  holder.position.set(...spec.pos);

  const starSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture,
      color: spec.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  starSprite.scale.set(0.68, 0.68, 1);
  holder.add(starSprite);

  const label = createTextLabelSprite(spec.name, spec.sub, spec.hex);
  label.position.set(0.45, 0.24, 0);
  holder.add(label);

  namedTarasGroup.add(holder);
  namedTaraNodes.push({
    holder,
    home: new THREE.Vector3(...spec.pos),
    starSprite
  });
});

// Dynamic 3D Constellation Filaments connecting your hand to nearby Taras
const MAX_CONSTELLATION_LINES = 60;
const constellationVertices = new Float32Array(MAX_CONSTELLATION_LINES * 6);
const constellationGeo = new THREE.BufferGeometry();
constellationGeo.setAttribute('position', new THREE.BufferAttribute(constellationVertices, 3));
const constellationMat = new THREE.LineBasicMaterial({
  color: 0x7dd3fc,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending
});
const constellationLines = new THREE.LineSegments(constellationGeo, constellationMat);
scene.add(constellationLines);

// ============================================================================
// Controllable Central Celestial System (4 Crisp, High-Detail Realms)
// ============================================================================
const objectGroup = new THREE.Group();
scene.add(objectGroup);

const animatedSubParts = {
  orbiters: [],
  rings: [],
  coreGlowSprites: []
};

function clearObjectGroup() {
  animatedSubParts.orbiters = [];
  animatedSubParts.rings = [];
  animatedSubParts.coreGlowSprites = [];

  while (objectGroup.children.length > 0) {
    const child = objectGroup.children[0];
    objectGroup.remove(child);
  }
}

function buildRealm(realmType) {
  clearObjectGroup();
  state.currentRealm = realmType;

  if (realmType === 'solar') {
    // 1. Complete 8-Planet Solar System with Crisp Sun, Moon, Saturn Rings & Asteroid Belt
    const sunGeo = new THREE.SphereGeometry(0.56, 48, 48);
    const sunMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.6,
      roughness: 0.2
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    objectGroup.add(sunMesh);

    // Subtle, non-blinding solar corona
    const sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: softHaloTexture,
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sunHalo.scale.set(2.2, 2.2, 1);
    objectGroup.add(sunHalo);
    animatedSubParts.coreGlowSprites.push(sunHalo);

    const planets = [
      { name: 'Mercury', r: 0.82, size: 0.055, speed: 2.4, color: 0x94a3b8, emissive: 0x334155, tilt: 0.05 },
      { name: 'Venus', r: 1.06, size: 0.085, speed: 1.85, color: 0xfde68a, emissive: 0xb45309, tilt: -0.06 },
      { name: 'Earth', r: 1.36, size: 0.105, speed: 1.4, color: 0x38bdf8, emissive: 0x0369a1, tilt: 0.08, hasMoon: true },
      { name: 'Mars', r: 1.64, size: 0.075, speed: 1.08, color: 0xf97316, emissive: 0x9a3412, tilt: -0.09 },
      { name: 'Jupiter', r: 2.08, size: 0.19, speed: 0.72, color: 0xfdba74, emissive: 0x9a3412, tilt: 0.11 },
      { name: 'Saturn', r: 2.54, size: 0.16, speed: 0.52, color: 0xfef08a, emissive: 0xa16207, tilt: -0.14, hasRing: true },
      { name: 'Uranus', r: 2.94, size: 0.115, speed: 0.36, color: 0x67e8f9, emissive: 0x0e7490, tilt: 0.16 },
      { name: 'Neptune', r: 3.30, size: 0.11, speed: 0.26, color: 0x60a5fa, emissive: 0x1d4ed8, tilt: -0.12 }
    ];

    planets.forEach((cfg, idx) => {
      const orbitPivot = new THREE.Group();
      orbitPivot.rotation.x = cfg.tilt;
      orbitPivot.rotation.z = idx * 0.35;
      objectGroup.add(orbitPivot);

      // Crisp orbital path circle
      const trackGeo = new THREE.RingGeometry(cfg.r - 0.006, cfg.r + 0.006, 112);
      const trackMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending
      });
      const trackMesh = new THREE.Mesh(trackGeo, trackMat);
      trackMesh.rotation.x = Math.PI / 2;
      orbitPivot.add(trackMesh);

      const planetHolder = new THREE.Group();
      const pGeo = new THREE.SphereGeometry(cfg.size, 32, 32);
      const pMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.emissive,
        emissiveIntensity: 0.48,
        roughness: 0.32,
        metalness: 0.15
      });
      const planet = new THREE.Mesh(pGeo, pMat);
      planet.position.x = cfg.r;
      planetHolder.add(planet);

      if (cfg.hasRing) {
        const innerRing = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size * 1.35, cfg.size * 1.9, 64),
          new THREE.MeshBasicMaterial({
            color: 0xfde68a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
          })
        );
        const outerRing = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size * 2.02, cfg.size * 2.45, 64),
          new THREE.MeshBasicMaterial({
            color: 0xfef3c7,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.55
          })
        );
        innerRing.rotation.x = Math.PI / 2.3;
        outerRing.rotation.x = Math.PI / 2.3;
        planet.add(innerRing, outerRing);
      }

      if (cfg.hasMoon) {
        const moonPivot = new THREE.Group();
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(0.032, 16, 16),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x64748b, emissiveIntensity: 0.4 })
        );
        moon.position.x = cfg.size * 2.1;
        moonPivot.add(moon);
        planet.add(moonPivot);
        animatedSubParts.orbiters.push({ holder: moonPivot, speed: 4.2, phase: 0 });
      }

      orbitPivot.add(planetHolder);
      animatedSubParts.orbiters.push({ holder: planetHolder, speed: cfg.speed, phase: idx * 1.4 });
    });

    // Crisp Asteroid Belt between Mars & Jupiter
    const astCount = 420;
    const astGeo = new THREE.BufferGeometry();
    const astPos = new Float32Array(astCount * 3);
    for (let i = 0; i < astCount; i++) {
      const r = 1.85 + (Math.random() - 0.5) * 0.16;
      const a = (i / astCount) * Math.PI * 2 + Math.random() * 0.1;
      astPos[i * 3] = Math.cos(a) * r;
      astPos[i * 3 + 1] = (Math.random() - 0.5) * 0.06;
      astPos[i * 3 + 2] = Math.sin(a) * r;
    }
    astGeo.setAttribute('position', new THREE.BufferAttribute(astPos, 3));
    const astPoints = new THREE.Points(
      astGeo,
      new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.032, transparent: true, opacity: 0.7 })
    );
    objectGroup.add(astPoints);
    animatedSubParts.rings.push({ mesh: astPoints, speedY: 0.25, speedX: 0 });

    sunPointLight.color.setHex(0xfbbf24);
  } else if (realmType === 'galaxy') {
    // 2. Crisp 3,500-Star Andromeda Spiral Galaxy + Black Hole Event Horizon
    const bhCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    objectGroup.add(bhCore);

    // Crisp Photon Ring around Black Hole
    const photonRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.025, 24, 96),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    objectGroup.add(photonRing);

    const accretionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 1.15, 96),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      })
    );
    accretionRing.rotation.x = Math.PI / 2.2;
    objectGroup.add(accretionRing);

    // 3,500 Crisp Spiral Arm Stars
    const armStarCount = 3500;
    const armGeo = new THREE.BufferGeometry();
    const armPos = new Float32Array(armStarCount * 3);
    const armCol = new Float32Array(armStarCount * 3);

    for (let i = 0; i < armStarCount; i++) {
      const i3 = i * 3;
      const r = 0.65 + Math.pow(Math.random(), 1.5) * 2.65;
      const branch = ((i % 4) / 4) * Math.PI * 2;
      const curve = r * 2.4;
      const jitter = (Math.random() - 0.5) * 0.26;

      armPos[i3] = Math.cos(branch + curve) * r + jitter;
      armPos[i3 + 1] = (Math.random() - 0.5) * 0.14 * (3.4 - r);
      armPos[i3 + 2] = Math.sin(branch + curve) * r + jitter;

      const c = r < 1.25
        ? new THREE.Color(0xfef08a)
        : i % 3 === 0
          ? new THREE.Color(0x38bdf8)
          : new THREE.Color(0xc084fc);
      armCol[i3] = c.r;
      armCol[i3 + 1] = c.g;
      armCol[i3 + 2] = c.b;
    }
    armGeo.setAttribute('position', new THREE.BufferAttribute(armPos, 3));
    armGeo.setAttribute('color', new THREE.BufferAttribute(armCol, 3));

    const armPoints = new THREE.Points(
      armGeo,
      new THREE.PointsMaterial({
        size: 0.17,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    objectGroup.add(armPoints);
    animatedSubParts.rings.push({ mesh: armPoints, speedY: -0.7, speedX: 0 });

    sunPointLight.color.setHex(0xc084fc);
  } else if (realmType === 'supernova') {
    // 3. Pulsar Star + Sacred Constellation Tara Web
    const pulsarCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.52, 2),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.8,
        roughness: 0.15
      })
    );
    objectGroup.add(pulsarCore);

    const webGeo = new THREE.IcosahedronGeometry(1.85, 1);
    const webWire = new THREE.Mesh(
      webGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending
      })
    );
    objectGroup.add(webWire);
    animatedSubParts.rings.push({ mesh: webWire, speedY: 0.45, speedX: 0.22 });

    const webPoints = new THREE.Points(
      webGeo,
      new THREE.PointsMaterial({
        size: 0.42,
        map: starTexture,
        color: 0xfef08a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    webWire.add(webPoints);

    sunPointLight.color.setHex(0x38bdf8);
  } else if (realmType === 'dyson') {
    // 4. Celestial Dyson Sphere & Multi-Ring Gyrocore
    const starMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0xecfdf5,
        emissive: 0x34d399,
        emissiveIntensity: 1.6
      })
    );
    objectGroup.add(starMesh);

    const ringSpecs = [
      { r: 1.05, tube: 0.038, col: 0xfbbf24, sx: 1.1, sy: 0.4 },
      { r: 1.44, tube: 0.042, col: 0x38bdf8, sx: -0.6, sy: 1.0 },
      { r: 1.84, tube: 0.046, col: 0xc084fc, sx: 0.3, sy: -0.8 }
    ];

    ringSpecs.forEach((spec, idx) => {
      const rMesh = new THREE.Mesh(
        new THREE.TorusGeometry(spec.r, spec.tube, 24, 96),
        new THREE.MeshStandardMaterial({
          color: spec.col,
          emissive: spec.col,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        })
      );
      rMesh.rotation.set(idx * 0.8, idx * 0.5, 0);
      objectGroup.add(rMesh);
      animatedSubParts.rings.push({ mesh: rMesh, speedX: spec.sx, speedY: spec.sy });
    });

    sunPointLight.color.setHex(0x34d399);
  }
}

buildRealm('solar');

// ============================================================================
// 3D Hand Astral Cursor & Energy Tether
// ============================================================================
const cursorGroup = new THREE.Group();
cursorGroup.visible = false;
scene.add(cursorGroup);

const cursorStarSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: starTexture,
    color: 0xfbbf24,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
cursorStarSprite.scale.set(0.75, 0.75, 1);

const cursorRingMesh = new THREE.Mesh(
  new THREE.RingGeometry(0.15, 0.19, 36),
  new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  })
);
cursorGroup.add(cursorStarSprite, cursorRingMesh);

const tetherPositions = new Float32Array(6);
const tetherGeo = new THREE.BufferGeometry();
tetherGeo.setAttribute('position', new THREE.BufferAttribute(tetherPositions, 3));
const tetherMat = new THREE.LineBasicMaterial({
  color: 0xfbbf24,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending
});
const tetherLine = new THREE.Line(tetherGeo, tetherMat);
scene.add(tetherLine);

// ============================================================================
// MediaPipe HandLandmarker Initialization & Webcam Setup
// ============================================================================
async function initHandLandmarker() {
  try {
    setStatus('loading', 'Loading MediaPipe HandLandmarker…');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
    );

    try {
      state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
    } catch (gpuError) {
      console.warn('GPU delegate unavailable, falling back to CPU:', gpuError);
      state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      });
    }

    setStatus('ready', 'Cosmos Ready — Connecting Camera…');
    await startWebcam();
  } catch (err) {
    console.error('Failed to initialize MediaPipe HandLandmarker:', err);
    setStatus('error', 'Vision Model Error');
    cameraSpinner.classList.add('hidden');
    cameraMsgText.textContent = `Could not load MediaPipe model: ${err.message}`;
  }
}

async function startWebcam() {
  try {
    cameraOverlayMsg.classList.remove('hidden');
    cameraSpinner.classList.remove('hidden');
    retryCameraBtn.classList.add('hidden');
    cameraMsgText.textContent = 'Opening Astral Hand Scanner…';

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    videoEl.srcObject = stream;
    await videoEl.play();

    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;

    state.cameraActive = true;
    cameraOverlayMsg.classList.add('hidden');
    camLiveDot.classList.remove('paused');
    cameraBtn.textContent = 'Pause Camera';
    setStatus('ready', 'Universe Link Active');
  } catch (err) {
    console.error('Webcam access error:', err);
    state.cameraActive = false;
    camLiveDot.classList.add('paused');
    setStatus('error', 'Camera Permission Needed');
    cameraSpinner.classList.add('hidden');
    cameraMsgText.textContent =
      'Allow webcam access to command the 3D universe with your hand gestures.';
    retryCameraBtn.classList.remove('hidden');
  }
}

function stopWebcam() {
  if (videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach((track) => track.stop());
    videoEl.srcObject = null;
  }
  state.cameraActive = false;
  state.handDetected = false;
  state.isPinching = false;
  camLiveDot.classList.add('paused');
  cameraBtn.textContent = 'Start Camera';
  cameraOverlayMsg.classList.remove('hidden');
  cameraSpinner.classList.add('hidden');
  retryCameraBtn.classList.remove('hidden');
  cameraMsgText.textContent = 'Astral Scanner paused.';
  setStatus('loading', 'Scanner Paused');
  clearOverlayCanvas();
}

// ============================================================================
// Hand Landmark Processing: Pinch Singularity & Wrist Universe Rotation
// ============================================================================
function processHandLandmarks(landmarks) {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const pinkyMcp = landmarks[17];
  const pinkyTip = landmarks[20];

  // 1. Pinch Gesture (Thumb tip #4 + Index tip #8 distance)
  const dx = thumbTip.x - indexTip.x;
  const dy = thumbTip.y - indexTip.y;
  const dz = (thumbTip.z - indexTip.z) * 0.6;
  const distance = Math.hypot(dx, dy, dz);
  state.pinchDistance = distance;

  // Hand span (Thumb tip to Pinky tip) controls cosmic zoom scale when open
  state.handSpread = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);

  const enterThreshold = config.pinchThreshold;
  const exitThreshold = config.pinchThreshold * 1.3;
  if (!state.isPinching && distance < enterThreshold) {
    state.isPinching = true;
  } else if (state.isPinching && distance > exitThreshold) {
    state.isPinching = false;
  }

  // Pinch Midpoint in normalized [0, 1] coordinates
  const midX = (thumbTip.x + indexTip.x) * 0.5;
  const midY = (thumbTip.y + indexTip.y) * 0.5;
  const midZ = (thumbTip.z + indexTip.z) * 0.5;

  // Map to 3D Universe coordinates
  const worldX = (0.5 - midX) * 2 * config.worldBoundsX;
  const worldY = (0.5 - midY) * 2 * config.worldBoundsY;
  const worldZ = THREE.MathUtils.clamp(-midZ * 7.0, -config.worldBoundsZ, config.worldBoundsZ);

  state.handCursorPos.set(worldX, worldY, worldZ);

  if (state.isPinching) {
    state.targetPosition.set(worldX, worldY, worldZ);
  }

  // 2. Wrist Rotation (Roll, Pitch, Yaw) -> Rotates Both Core & 6,500-Star Galaxy
  const palmVx = (0.5 - middleMcp.x) - (0.5 - wrist.x);
  const palmVy = (0.5 - middleMcp.y) - (0.5 - wrist.y);
  const palmVz = middleMcp.z - wrist.z;

  const knuckleVx = (0.5 - pinkyMcp.x) - (0.5 - indexMcp.x);
  const knuckleVy = (0.5 - pinkyMcp.y) - (0.5 - indexMcp.y);
  const knuckleVz = pinkyMcp.z - indexMcp.z;

  const palmTiltAngle = Math.atan2(palmVx, Math.max(0.001, palmVy));
  const knuckleRollAngle = Math.atan2(knuckleVy, knuckleVx);
  const roll = -palmTiltAngle * 1.45 + knuckleRollAngle * 0.35;

  const palmLen2D = Math.hypot(palmVx, palmVy) || 0.001;
  const pitch = Math.atan2(palmVz, palmLen2D) * 2.25;

  const knuckleLen2D = Math.hypot(knuckleVx, knuckleVy) || 0.001;
  const yaw = Math.atan2(knuckleVz, knuckleLen2D) * 2.0;

  state.targetEuler.set(pitch, yaw, roll, 'YXZ');
  state.targetQuaternion.setFromEuler(state.targetEuler);

  // Couple the surrounding galaxy & named Taras to your wrist rotation!
  const galaxyEuler = new THREE.Euler(pitch * 0.65, yaw * 0.75, roll * 0.6, 'YXZ');
  state.universeQuaternion.setFromEuler(galaxyEuler);

  state.wristAnglesDeg.roll = Math.round(THREE.MathUtils.radToDeg(roll));
  state.wristAnglesDeg.pitch = Math.round(THREE.MathUtils.radToDeg(pitch));
  state.wristAnglesDeg.yaw = Math.round(THREE.MathUtils.radToDeg(yaw));

  updateTelemetryUI();
  drawHandConstellationOverlay(landmarks, state.isPinching, distance);
}

// ============================================================================
// Near-Field "Tara" Star Physics & Constellation Filament Builder
// ============================================================================
function updateNearFieldTaras(now) {
  const posAttr = nearStarGeo.attributes.position;
  const arr = posAttr.array;

  const lineAttr = constellationGeo.attributes.position;
  const lineArr = lineAttr.array;
  let lineCount = 0;

  const hx = cursorGroup.position.x;
  const hy = cursorGroup.position.y;
  const hz = cursorGroup.position.z;

  const cx = objectGroup.position.x;
  const cy = objectGroup.position.y;
  const cz = objectGroup.position.z;

  const pulsePush = state.supernovaPulse;
  state.supernovaPulse *= 0.92;

  for (let i = 0; i < NEAR_STAR_COUNT; i++) {
    const i3 = i * 3;
    let x = arr[i3];
    let y = arr[i3 + 1];
    let z = arr[i3 + 2];

    const homeX = nearHomePositions[i3];
    const homeY = nearHomePositions[i3 + 1];
    const homeZ = nearHomePositions[i3 + 2];

    const driftX = homeX + Math.sin(now * 0.0005 + i) * 0.16;
    const driftY = homeY + Math.cos(now * 0.0004 + i * 0.7) * 0.16;
    const driftZ = homeZ;

    if (state.handDetected) {
      if (state.isPinching) {
        // Gravitational Singularity Vortex: nearby Taras swirl toward the pinched Core
        const dx = cx - x;
        const dy = cy - y;
        const dz = cz - z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < 25.0 && distSq > 0.25) {
          const dist = Math.sqrt(distSq);
          const pull = 0.048 / (0.4 + dist * 0.35);
          x += dx * pull - dy * 0.025;
          y += dy * pull + dx * 0.025;
          z += dz * pull;
        } else {
          x += (driftX - x) * 0.035;
          y += (driftY - y) * 0.035;
          z += (driftZ - z) * 0.035;
        }
      } else {
        // Open Hand Magnetism: stars near your fingers ripple & form constellation lines
        const dx = hx - x;
        const dy = hy - y;
        const dz = hz - z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 3.0) {
          x += dx * 0.02;
          y += dy * 0.02;
          z += dz * 0.02;

          if (lineCount < MAX_CONSTELLATION_LINES) {
            const l6 = lineCount * 6;
            lineArr[l6] = hx;
            lineArr[l6 + 1] = hy;
            lineArr[l6 + 2] = hz;
            lineArr[l6 + 3] = x;
            lineArr[l6 + 4] = y;
            lineArr[l6 + 5] = z;
            lineCount++;
          }
        } else {
          x += (driftX - x) * 0.04;
          y += (driftY - y) * 0.04;
          z += (driftZ - z) * 0.04;
        }
      }
    } else {
      x += (driftX - x) * 0.035;
      y += (driftY - y) * 0.035;
      z += (driftZ - z) * 0.035;
    }

    if (pulsePush > 0.01) {
      const rx = x - cx;
      const ry = y - cy;
      const rz = z - cz;
      const rLen = Math.hypot(rx, ry, rz) || 1;
      x += (rx / rLen) * pulsePush * 0.38;
      y += (ry / rLen) * pulsePush * 0.38;
      z += (rz / rLen) * pulsePush * 0.38;
    }

    arr[i3] = x;
    arr[i3 + 1] = y;
    arr[i3 + 2] = z;
  }

  posAttr.needsUpdate = true;

  for (let j = lineCount * 6; j < MAX_CONSTELLATION_LINES * 6; j++) {
    lineArr[j] = 0;
  }
  constellationGeo.setDrawRange(0, lineCount * 2);
  lineAttr.needsUpdate = true;

  // Animate Named Bright Taras & let them respond when your hand comes close!
  for (let i = 0; i < namedTaraNodes.length; i++) {
    const node = namedTaraNodes[i];
    const targetX = node.home.x + Math.sin(now * 0.0007 + i * 1.5) * 0.12;
    const targetY = node.home.y + Math.cos(now * 0.0006 + i * 1.2) * 0.12;
    const targetZ = node.home.z;

    if (state.handDetected) {
      const d = node.holder.position.distanceTo(cursorGroup.position);
      if (d < 2.2) {
        // Pull the named Tara gently toward your hand & make it shine brighter!
        node.holder.position.lerp(cursorGroup.position, 0.04);
        node.starSprite.scale.setScalar(0.95);
        continue;
      }
    }
    node.holder.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.05);
    const pulse = 0.66 + Math.sin(now * 0.004 + i) * 0.08;
    node.starSprite.scale.setScalar(pulse);
  }
}

// ============================================================================
// 2D Canvas Overlay: Constellation Hand Landmarks on Mirrored Webcam Preview
// ============================================================================
function clearOverlayCanvas() {
  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
}

function drawHandConstellationOverlay(landmarks, isPinching, pinchDist) {
  const w = canvasEl.width;
  const h = canvasEl.height;
  canvasCtx.clearRect(0, 0, w, h);

  canvasCtx.lineCap = 'round';
  canvasCtx.lineJoin = 'round';
  canvasCtx.lineWidth = 2.2;
  canvasCtx.strokeStyle = isPinching
    ? 'rgba(251, 191, 36, 0.9)'
    : 'rgba(125, 211, 252, 0.75)';

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const a = landmarks[startIdx];
    const b = landmarks[endIdx];
    canvasCtx.beginPath();
    canvasCtx.moveTo(a.x * w, a.y * h);
    canvasCtx.lineTo(b.x * w, b.y * h);
    canvasCtx.stroke();
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  canvasCtx.save();
  canvasCtx.setLineDash([4, 4]);
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = 'rgba(192, 132, 252, 0.9)';
  canvasCtx.beginPath();
  canvasCtx.moveTo(wrist.x * w, wrist.y * h);
  canvasCtx.lineTo(middleMcp.x * w, middleMcp.y * h);
  canvasCtx.stroke();
  canvasCtx.restore();

  const thumb = landmarks[4];
  const index = landmarks[8];
  const tx = thumb.x * w;
  const ty = thumb.y * h;
  const ix = index.x * w;
  const iy = index.y * h;
  const mx = (tx + ix) * 0.5;
  const my = (ty + iy) * 0.5;

  canvasCtx.beginPath();
  canvasCtx.moveTo(tx, ty);
  canvasCtx.lineTo(ix, iy);
  canvasCtx.lineWidth = isPinching ? 3.5 : 1.8;
  canvasCtx.strokeStyle = isPinching ? '#fbbf24' : '#38bdf8';
  canvasCtx.stroke();

  const orbRadius = isPinching ? 11 : Math.max(5, Math.min(18, pinchDist * 130));
  const grad = canvasCtx.createRadialGradient(mx, my, 1, mx, my, orbRadius * 1.6);
  if (isPinching) {
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(251, 191, 36, 0.85)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
  } else {
    grad.addColorStop(0, 'rgba(125, 211, 252, 0.8)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  }
  canvasCtx.beginPath();
  canvasCtx.arc(mx, my, orbRadius * 1.6, 0, Math.PI * 2);
  canvasCtx.fillStyle = grad;
  canvasCtx.fill();

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = lm.x * w;
    const y = lm.y * h;

    let radius = 3.2;
    let fill = '#7dd3fc';

    if (i === 4 || i === 8) {
      radius = 5.8;
      fill = '#fbbf24';
    } else if (i === 0) {
      radius = 5.5;
      fill = '#c084fc';
    } else if (i === 12 || i === 16 || i === 20) {
      radius = 4.2;
      fill = '#f8fafc';
    }

    canvasCtx.beginPath();
    canvasCtx.arc(x, y, radius, 0, Math.PI * 2);
    canvasCtx.fillStyle = fill;
    canvasCtx.fill();
  }
}

// ============================================================================
// UI Status & Telemetry Updates
// ============================================================================
function setStatus(mode, message) {
  statusDot.className = `status-dot ${mode}`;
  statusText.textContent = message;
}

function updateTelemetryUI() {
  const proximity = THREE.MathUtils.clamp((0.16 - state.pinchDistance) / 0.145, 0, 1);
  pinchBar.style.width = `${Math.round(proximity * 100)}%`;
  pinchReadout.textContent = `${state.pinchDistance.toFixed(3)} ${state.isPinching ? '✦ GRAVITY LOCK' : ''}`;

  rollVal.textContent = `${state.wristAnglesDeg.roll}°`;
  pitchVal.textContent = `${state.wristAnglesDeg.pitch}°`;
  yawVal.textContent = `${state.wristAnglesDeg.yaw}°`;
  posVal.textContent = `${objectGroup.position.x.toFixed(1)}, ${objectGroup.position.y.toFixed(1)}, ${objectGroup.position.z.toFixed(1)}`;

  handednessLabel.textContent = state.isPinching ? 'Singularity Active' : 'Hand Coupled';

  if (state.isPinching) {
    gestureBadge.textContent = '✦ Gravity Lock';
    gestureBadge.className = 'gesture-badge pinching';
    instPinch.classList.add('active-gesture');
    instExpand.classList.remove('active-rotate');
  } else {
    gestureBadge.textContent = 'Cosmos Coupled';
    gestureBadge.className = 'gesture-badge tracking';
    instPinch.classList.remove('active-gesture');
    instExpand.classList.add('active-rotate');
  }
  instRotate.classList.add('active-rotate');
}

function updateIdleUI() {
  gestureBadge.textContent = 'Awaiting Hand';
  gestureBadge.className = 'gesture-badge';
  handednessLabel.textContent = 'Scanning Space…';
  pinchBar.style.width = '0%';
  pinchReadout.textContent = '—';
  instPinch.classList.remove('active-gesture');
  instRotate.classList.remove('active-rotate');
  instExpand.classList.remove('active-rotate');
  posVal.textContent = `${objectGroup.position.x.toFixed(1)}, ${objectGroup.position.y.toFixed(1)}, ${objectGroup.position.z.toFixed(1)}`;
}

function updateThresholdMarker() {
  const markerPos = THREE.MathUtils.clamp((0.16 - config.pinchThreshold) / 0.145, 0.05, 0.95);
  pinchThresholdMarker.style.left = `${Math.round(markerPos * 100)}%`;
}
updateThresholdMarker();

// ============================================================================
// Main Render & Vision Loop
// ============================================================================
let lastFrameTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrameTime) * 0.001, 0.1);
  lastFrameTime = now;

  // FPS Counter
  state.frameCount++;
  if (now - state.lastFpsUpdate >= 500) {
    const fps = Math.round((state.frameCount * 1000) / (now - state.lastFpsUpdate));
    fpsValue.textContent = fps;
    state.frameCount = 0;
    state.lastFpsUpdate = now;
  }

  // 1. Detect Hand Landmarks from Video Stream
  if (
    state.handLandmarker &&
    state.cameraActive &&
    videoEl.readyState >= 2 &&
    videoEl.currentTime !== state.lastVideoTime
  ) {
    state.lastVideoTime = videoEl.currentTime;
    const results = state.handLandmarker.detectForVideo(videoEl, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      state.handDetected = true;
      processHandLandmarks(results.landmarks[0]);
    } else if (state.handDetected) {
      state.handDetected = false;
      state.isPinching = false;
      clearOverlayCanvas();
      updateIdleUI();
    }
  }

  // 2. Smoothly Interpolate (Lerp) Central Celestial System Position
  objectGroup.position.lerp(state.targetPosition, config.posLerp);
  sunPointLight.position.copy(objectGroup.position);

  // 3. Smoothly Rotate Both Central System AND Surrounding Universe from Wrist Rotation
  if (state.handDetected) {
    objectGroup.quaternion.slerp(state.targetQuaternion, config.rotLerp);
    universeGroup.quaternion.slerp(state.universeQuaternion, config.rotLerp * 0.65);
    namedTarasGroup.quaternion.slerp(state.universeQuaternion, config.rotLerp * 0.45);

    cursorGroup.visible = true;
    cursorGroup.position.lerp(state.handCursorPos, 0.38);
    cursorGroup.lookAt(camera.position);

    const activeColor = state.isPinching ? 0xfbbf24 : 0x38bdf8;
    cursorStarSprite.material.color.setHex(activeColor);
    cursorRingMesh.material.color.setHex(activeColor);
    cursorRingMesh.scale.setScalar(state.isPinching ? 0.78 : 1.15 + Math.sin(now * 0.008) * 0.08);

    const tPos = tetherGeo.attributes.position;
    tPos.setXYZ(0, cursorGroup.position.x, cursorGroup.position.y, cursorGroup.position.z);
    tPos.setXYZ(1, objectGroup.position.x, objectGroup.position.y, objectGroup.position.z);
    tPos.needsUpdate = true;
    tetherMat.opacity = state.isPinching ? 0.72 : 0.18;
    tetherMat.color.setHex(activeColor);

    const targetScale = state.isPinching ? 1.12 : 1.0;
    objectGroup.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
  } else {
    cursorGroup.visible = false;
    tetherMat.opacity = 0;

    objectGroup.rotation.y += dt * 0.25;
    objectGroup.rotation.x = Math.sin(now * 0.0005) * 0.15;
    state.targetQuaternion.copy(objectGroup.quaternion);

    universeGroup.rotation.y += dt * 0.04;
    state.universeQuaternion.copy(universeGroup.quaternion);
    objectGroup.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
  }

  // 4. Animate Internal Orbiting Planets & Rings
  for (const orb of animatedSubParts.orbiters) {
    orb.holder.rotation.y = now * 0.001 * orb.speed + orb.phase;
  }
  for (const r of animatedSubParts.rings) {
    if (r.speedX) r.mesh.rotation.x += dt * r.speedX;
    if (r.speedY) r.mesh.rotation.y += dt * r.speedY;
    if (r.speedZ) r.mesh.rotation.z += dt * r.speedZ;
  }
  for (let i = 0; i < animatedSubParts.coreGlowSprites.length; i++) {
    const sp = animatedSubParts.coreGlowSprites[i];
    const pulse = 2.15 + Math.sin(now * 0.004 + i) * 0.12;
    sp.scale.set(pulse, pulse, 1);
  }

  // 5. Update Interactive Near-Field Taras, Named Stars & Constellation Filaments
  updateNearFieldTaras(now);

  renderer.render(scene, camera);
}

// ============================================================================
// UI Controls & Event Listeners
// ============================================================================
function selectRealm(realm) {
  shapeSelect.value = realm;
  realmPills.forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.realm === realm);
  });
  buildRealm(realm);
}

realmPills.forEach((pill) => {
  pill.addEventListener('click', () => {
    selectRealm(pill.dataset.realm);
  });
});

shapeSelect.addEventListener('change', (e) => {
  selectRealm(e.target.value);
});

lerpSlider.addEventListener('input', (e) => {
  config.posLerp = parseFloat(e.target.value);
  lerpDisplay.textContent = config.posLerp.toFixed(2);
});

rotLerpSlider.addEventListener('input', (e) => {
  config.rotLerp = parseFloat(e.target.value);
  rotLerpDisplay.textContent = config.rotLerp.toFixed(2);
});

pinchSlider.addEventListener('input', (e) => {
  config.pinchThreshold = parseFloat(e.target.value);
  pinchDisplay.textContent = config.pinchThreshold.toFixed(3);
  updateThresholdMarker();
});

starScaleSlider.addEventListener('input', (e) => {
  config.starBrilliance = parseFloat(e.target.value);
  starScaleDisplay.textContent = `${config.starBrilliance.toFixed(1)}x`;
  nearStarMat.size = 0.28 * config.starBrilliance;
  deepStarMat.size = 0.17 * config.starBrilliance;
});

warpBtn.addEventListener('click', () => {
  state.supernovaPulse = 1.6;
});

resetBtn.addEventListener('click', () => {
  state.targetPosition.set(0, 0, 0);
  state.targetEuler.set(0, 0, 0, 'YXZ');
  state.targetQuaternion.identity();
  state.universeQuaternion.identity();
});

cameraBtn.addEventListener('click', () => {
  if (state.cameraActive) {
    stopWebcam();
  } else {
    startWebcam();
  }
});

retryCameraBtn.addEventListener('click', () => {
  startWebcam();
});

function toggleHudPanels() {
  const isCollapsed = hudLeft.classList.toggle('collapsed');
  restoreHudBtn.classList.toggle('hidden', !isCollapsed);
}

hudToggleBtn.addEventListener('click', toggleHudPanels);
restoreHudBtn.addEventListener('click', toggleHudPanels);

window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    toggleHudPanels();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot the Crisp Universe
initHandLandmarker();
requestAnimationFrame(animate);
