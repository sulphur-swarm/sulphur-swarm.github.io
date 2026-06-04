/**
 * ngiNeuralVis.ts — Three.js WebGL neural network visualization for the NGI hero area.
 * Renders a stunning 3D neural network with custom GLSL shaders, bloom post-processing,
 * noise-driven organic motion, and traveling signal particles.
 */

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  Points,
  LineSegments,
  Float32BufferAttribute,
  Color,
  ShaderMaterial,
  AdditiveBlending,
  Vector2,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MOBILE_BREAKPOINT = 640;
const NODE_COUNT_DESKTOP = 28;
const NODE_COUNT_MOBILE = 14;
const AMBIENT_COUNT_DESKTOP = 180;
const AMBIENT_COUNT_MOBILE = 50;
const BG_COLOR = new Color(0x08090c);

/* ------------------------------------------------------------------ */
/*  Simple 3D pseudo-noise (sine-hash)                                 */
/* ------------------------------------------------------------------ */

function noise3d(x: number, y: number, z: number): number {
  const dot1 = x * 127.1 + y * 311.7 + z * 74.7;
  const dot2 = x * 269.5 + y * 183.3 + z * 246.1;
  const dot3 = x * 419.2 + y * 371.9 + z * 128.9;
  const s1 = Math.sin(dot1) * 43758.5453;
  const s2 = Math.sin(dot2) * 43758.5453;
  const s3 = Math.sin(dot3) * 43758.5453;
  return (s1 - Math.floor(s1) + s2 - Math.floor(s2) + s3 - Math.floor(s3)) / 3 * 2 - 1;
}

/* ------------------------------------------------------------------ */
/*  GLSL Shaders                                                       */
/* ------------------------------------------------------------------ */

const nodeVertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aTier;
  attribute float aSize;
  uniform float uTime;
  varying float vPulse;
  varying float vTier;

  void main() {
    vTier = aTier;
    vPulse = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float sizeScale = 300.0 / -mvPosition.z;
    gl_PointSize = aSize * (0.8 + 0.2 * vPulse) * sizeScale;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const nodeFragmentShader = /* glsl */ `
  varying float vPulse;
  varying float vTier;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    // Colors: violet #6c63ff -> cyan #00d4ff based on tier
    vec3 violet = vec3(0.424, 0.388, 1.0);
    vec3 cyan = vec3(0.0, 0.831, 1.0);
    vec3 baseColor = mix(violet, cyan, vTier * 0.5);

    // Core with soft edge
    float core = smoothstep(0.5, 0.1, dist);
    // Glow halo
    float glow = exp(-dist * 4.0) * 0.6;

    float alpha = (core + glow) * (0.7 + 0.3 * vPulse);
    gl_FragColor = vec4(baseColor * (1.0 + glow * 0.5), alpha);
  }
`;

const edgeVertexShader = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(0.424, 0.388, 1.0, vAlpha * 0.12);
  }
`;

const signalVertexShader = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  varying float vGlow;

  void main() {
    float t = fract(uTime * aSpeed + aPhase);
    vec3 pos = mix(aStart, aEnd, t);

    // Pulse brightness near middle of travel
    vGlow = sin(t * 3.14159) * 0.5 + 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float sizeScale = 200.0 / -mvPosition.z;
    gl_PointSize = max(3.0, 5.0 * sizeScale);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const signalFragmentShader = /* glsl */ `
  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * 6.0);
    vec3 color = vec3(0.0, 0.831, 1.0); // cyan #00d4ff
    float alpha = core * (0.6 + 0.4 * vGlow);
    gl_FragColor = vec4(color * (1.0 + core * 0.5), alpha);
  }
`;

const ambientVertexShader = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;

  void main() {
    vec3 pos = position;
    pos.y += sin(uTime * 0.05 + aPhase) * 2.0;
    pos.x += cos(uTime * 0.03 + aPhase * 1.3) * 1.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = max(1.0, 80.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ambientFragmentShader = /* glsl */ `
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.0, dist) * 0.2;
    gl_FragColor = vec4(0.6, 0.55, 1.0, alpha);
  }
`;

/* ------------------------------------------------------------------ */
/*  Network topology builder                                           */
/* ------------------------------------------------------------------ */

interface NodeData {
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
  tier: number;
  size: number;
}

interface EdgeData {
  from: number;
  to: number;
}

function buildNetwork(nodeCount: number) {
  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];

  // Calculate per-tier count
  const isFull = nodeCount >= 20;
  const tier0Count = isFull ? 9 : 5;
  const tier1Count = isFull ? 11 : 5;
  const tier2Count = nodeCount - tier0Count - tier1Count;

  // Tier 0: input layer — arc at negative Z
  for (let i = 0; i < tier0Count; i++) {
    const angle = ((i / (tier0Count - 1)) - 0.5) * Math.PI * 0.8;
    nodes.push({
      baseX: Math.cos(angle) * 80,
      baseY: Math.sin(angle) * 40 + (Math.random() - 0.5) * 20,
      baseZ: -50 + (Math.random() - 0.5) * 20,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.4,
      tier: 0,
      size: 8,
    });
  }

  // Tier 1: processing layer — clustered at center
  for (let i = 0; i < tier1Count; i++) {
    const angle = ((i / (tier1Count - 1)) - 0.5) * Math.PI * 0.7;
    nodes.push({
      baseX: Math.cos(angle) * 60 + (Math.random() - 0.5) * 20,
      baseY: Math.sin(angle) * 35 + (Math.random() - 0.5) * 15,
      baseZ: (Math.random() - 0.5) * 30,
      phase: Math.random() * Math.PI * 2,
      speed: 0.2 + Math.random() * 0.3,
      tier: 1,
      size: 10,
    });
  }

  // Tier 2: output layer — arc at positive Z
  for (let i = 0; i < tier2Count; i++) {
    const angle = ((i / Math.max(tier2Count - 1, 1)) - 0.5) * Math.PI * 0.75;
    nodes.push({
      baseX: Math.cos(angle) * 75 + (Math.random() - 0.5) * 15,
      baseY: Math.sin(angle) * 30 + (Math.random() - 0.5) * 15,
      baseZ: 50 + (Math.random() - 0.5) * 20,
      phase: Math.random() * Math.PI * 2,
      speed: 0.25 + Math.random() * 0.35,
      tier: 2,
      size: 7,
    });
  }

  // Within-tier connections (adjacent)
  let offset = 0;
  for (const count of [tier0Count, tier1Count, tier2Count]) {
    for (let i = 0; i < count - 1; i++) {
      edges.push({ from: offset + i, to: offset + i + 1 });
    }
    offset += count;
  }

  // Between-tier: tier0 → tier1
  for (let i = 0; i < tier0Count; i++) {
    // Connect to nearest tier1 node(s)
    const target = tier0Count + Math.min(i, tier1Count - 1);
    edges.push({ from: i, to: target });
    if (i + 1 < tier1Count) {
      edges.push({ from: i, to: tier0Count + Math.min(i + 1, tier1Count - 1) });
    }
  }

  // Between-tier: tier1 → tier2
  const t2Start = tier0Count + tier1Count;
  for (let i = 0; i < tier1Count; i++) {
    const target = t2Start + Math.min(Math.floor(i * tier2Count / tier1Count), tier2Count - 1);
    edges.push({ from: tier0Count + i, to: target });
  }

  // Skip connections: tier0 → tier2
  edges.push({ from: 0, to: t2Start });
  if (tier2Count > 1) {
    edges.push({ from: Math.floor(tier0Count / 2), to: t2Start + Math.floor(tier2Count / 2) });
  }
  edges.push({ from: tier0Count - 1, to: t2Start + tier2Count - 1 });

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Main init                                                          */
/* ------------------------------------------------------------------ */

export function init(canvas: HTMLCanvasElement): () => void {
  // Bail out gracefully if WebGL isn't available
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch {
    return () => {};
  }

  const parent = canvas.parentElement;
  if (!parent) return () => { renderer.dispose(); };

  const parentWidth = () => parent.clientWidth;
  const parentHeight = () => parent.clientHeight;

  let isMobile = parentWidth() < MOBILE_BREAKPOINT;
  const dpr = Math.min(window.devicePixelRatio, 2);

  renderer.setPixelRatio(dpr);
  renderer.setSize(parentWidth(), parentHeight());

  // Scene
  const scene = new Scene();
  scene.background = BG_COLOR;

  // Camera
  const camera = new PerspectiveCamera(60, parentWidth() / parentHeight(), 0.1, 1000);
  camera.position.z = 300;

  /* ---- Build network ---- */
  const nodeCount = isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
  const { nodes, edges } = buildNetwork(nodeCount);

  // Current positions (CPU-side, updated each frame for edge sync)
  const currentPositions = new Float32Array(nodes.length * 3);

  /* ---- Node Points ---- */
  const nodePositions = new Float32Array(nodes.length * 3);
  const nodePhases = new Float32Array(nodes.length);
  const nodeSpeeds = new Float32Array(nodes.length);
  const nodeTiers = new Float32Array(nodes.length);
  const nodeSizes = new Float32Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    nodePositions[i * 3] = n.baseX;
    nodePositions[i * 3 + 1] = n.baseY;
    nodePositions[i * 3 + 2] = n.baseZ;
    nodePhases[i] = n.phase;
    nodeSpeeds[i] = n.speed;
    nodeTiers[i] = n.tier;
    nodeSizes[i] = n.size;
  }

  const nodesGeometry = new BufferGeometry();
  nodesGeometry.setAttribute('position', new Float32BufferAttribute(nodePositions, 3));
  nodesGeometry.setAttribute('aPhase', new Float32BufferAttribute(nodePhases, 1));
  nodesGeometry.setAttribute('aSpeed', new Float32BufferAttribute(nodeSpeeds, 1));
  nodesGeometry.setAttribute('aTier', new Float32BufferAttribute(nodeTiers, 1));
  nodesGeometry.setAttribute('aSize', new Float32BufferAttribute(nodeSizes, 1));

  const nodesMaterial = new ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const nodesPoints = new Points(nodesGeometry, nodesMaterial);
  scene.add(nodesPoints);

  /* ---- Edge Lines ---- */
  const edgePositions = new Float32Array(edges.length * 6);
  const edgeAlphas = new Float32Array(edges.length * 2);
  for (let i = 0; i < edges.length; i++) {
    edgeAlphas[i * 2] = 1;
    edgeAlphas[i * 2 + 1] = 1;
  }

  const edgesGeometry = new BufferGeometry();
  edgesGeometry.setAttribute('position', new Float32BufferAttribute(edgePositions, 3));
  edgesGeometry.setAttribute('aAlpha', new Float32BufferAttribute(edgeAlphas, 1));

  const edgesMaterial = new ShaderMaterial({
    vertexShader: edgeVertexShader,
    fragmentShader: edgeFragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const edgeLines = new LineSegments(edgesGeometry, edgesMaterial);
  scene.add(edgeLines);

  /* ---- Signal particles ---- */
  const signalCount = isMobile ? Math.floor(edges.length / 2) : edges.length;
  const signalStarts = new Float32Array(signalCount * 3);
  const signalEnds = new Float32Array(signalCount * 3);
  const signalPhases = new Float32Array(signalCount);
  const signalSpeeds = new Float32Array(signalCount);
  // Dummy positions — actual position computed in vertex shader
  const signalPositions = new Float32Array(signalCount * 3);

  for (let i = 0; i < signalCount; i++) {
    signalPhases[i] = Math.random();
    signalSpeeds[i] = 0.08 + Math.random() * 0.12;
  }

  const signalsGeometry = new BufferGeometry();
  signalsGeometry.setAttribute('position', new Float32BufferAttribute(signalPositions, 3));
  signalsGeometry.setAttribute('aStart', new Float32BufferAttribute(signalStarts, 3));
  signalsGeometry.setAttribute('aEnd', new Float32BufferAttribute(signalEnds, 3));
  signalsGeometry.setAttribute('aPhase', new Float32BufferAttribute(signalPhases, 1));
  signalsGeometry.setAttribute('aSpeed', new Float32BufferAttribute(signalSpeeds, 1));

  const signalMaterial = new ShaderMaterial({
    vertexShader: signalVertexShader,
    fragmentShader: signalFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const signalPoints = new Points(signalsGeometry, signalMaterial);
  scene.add(signalPoints);

  /* ---- Ambient particles ---- */
  const ambientCount = isMobile ? AMBIENT_COUNT_MOBILE : AMBIENT_COUNT_DESKTOP;
  const ambientPositions = new Float32Array(ambientCount * 3);
  const ambientPhases = new Float32Array(ambientCount);

  for (let i = 0; i < ambientCount; i++) {
    ambientPositions[i * 3] = (Math.random() - 0.5) * 800;
    ambientPositions[i * 3 + 1] = (Math.random() - 0.5) * 600;
    ambientPositions[i * 3 + 2] = (Math.random() - 0.5) * 400 - 100;
    ambientPhases[i] = Math.random() * Math.PI * 2;
  }

  const ambientGeometry = new BufferGeometry();
  ambientGeometry.setAttribute('position', new Float32BufferAttribute(ambientPositions, 3));
  ambientGeometry.setAttribute('aPhase', new Float32BufferAttribute(ambientPhases, 1));

  const ambientMaterial = new ShaderMaterial({
    vertexShader: ambientVertexShader,
    fragmentShader: ambientFragmentShader,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const ambientPoints = new Points(ambientGeometry, ambientMaterial);
  scene.add(ambientPoints);

  /* ---- Post-processing (bloom) ---- */
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomStrength = isMobile ? 0.8 : 1.3;
  const bloomPass = new UnrealBloomPass(
    new Vector2(parentWidth(), parentHeight()),
    bloomStrength,
    0.5,
    0.2,
  );
  composer.addPass(bloomPass);

  /* ---- Update helpers ---- */

  function updateNodePositions(time: number) {
    const pos = nodesGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const i3 = i * 3;
      const drift = 8;
      const nx = noise3d(n.baseX * 0.01, time * 0.3 + n.phase, 0) * drift;
      const ny = noise3d(0, n.baseY * 0.01, time * 0.25 + n.phase) * drift;
      const nz = noise3d(time * 0.2 + n.phase, 0, n.baseZ * 0.01) * drift * 0.5;

      pos[i3] = n.baseX + nx;
      pos[i3 + 1] = n.baseY + ny;
      pos[i3 + 2] = n.baseZ + nz;

      currentPositions[i3] = pos[i3];
      currentPositions[i3 + 1] = pos[i3 + 1];
      currentPositions[i3 + 2] = pos[i3 + 2];
    }
    nodesGeometry.attributes.position.needsUpdate = true;
  }

  function updateEdgeGeometry() {
    const pos = edgesGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const f3 = e.from * 3;
      const t3 = e.to * 3;
      const i6 = i * 6;
      pos[i6] = currentPositions[f3];
      pos[i6 + 1] = currentPositions[f3 + 1];
      pos[i6 + 2] = currentPositions[f3 + 2];
      pos[i6 + 3] = currentPositions[t3];
      pos[i6 + 4] = currentPositions[t3 + 1];
      pos[i6 + 5] = currentPositions[t3 + 2];
    }
    edgesGeometry.attributes.position.needsUpdate = true;
  }

  function updateSignalGeometry() {
    const starts = signalsGeometry.attributes.aStart.array as Float32Array;
    const ends = signalsGeometry.attributes.aEnd.array as Float32Array;
    for (let i = 0; i < signalCount; i++) {
      const e = edges[i % edges.length];
      const f3 = e.from * 3;
      const t3 = e.to * 3;
      const i3 = i * 3;
      starts[i3] = currentPositions[f3];
      starts[i3 + 1] = currentPositions[f3 + 1];
      starts[i3 + 2] = currentPositions[f3 + 2];
      ends[i3] = currentPositions[t3];
      ends[i3 + 1] = currentPositions[t3 + 1];
      ends[i3 + 2] = currentPositions[t3 + 2];
    }
    signalsGeometry.attributes.aStart.needsUpdate = true;
    signalsGeometry.attributes.aEnd.needsUpdate = true;
  }

  /* ---- Reduced motion check ---- */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (prefersReducedMotion.matches) {
    // Render a single static frame
    updateNodePositions(0);
    updateEdgeGeometry();
    updateSignalGeometry();
    composer.render();
  }

  /* ---- Animation loop ---- */
  let animFrameId = 0;

  function animate(timestamp: number) {
    animFrameId = requestAnimationFrame(animate);
    const time = timestamp * 0.001;

    // Update uniforms
    nodesMaterial.uniforms.uTime.value = time;
    signalMaterial.uniforms.uTime.value = time;
    ambientMaterial.uniforms.uTime.value = time;

    // Update positions
    updateNodePositions(time);
    updateEdgeGeometry();
    updateSignalGeometry();

    // Subtle scene rotation for 3D parallax
    scene.rotation.y = Math.sin(time * 0.05) * 0.08;
    scene.rotation.x = Math.cos(time * 0.07) * 0.04;

    // Render with bloom
    composer.render();
  }

  if (!prefersReducedMotion.matches) {
    animFrameId = requestAnimationFrame(animate);
  }

  /* ---- Resize observer ---- */
  const resizeObserver = new ResizeObserver(() => {
    const w = parentWidth();
    const h = parentHeight();
    if (w === 0 || h === 0) return;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);

    const newMobile = w < MOBILE_BREAKPOINT;
    if (newMobile !== isMobile) {
      isMobile = newMobile;
      // Adjust bloom on breakpoint change
      bloomPass.strength = isMobile ? 0.8 : 1.3;
    }
  });
  resizeObserver.observe(parent);

  /* ---- Cleanup ---- */
  return function cleanup() {
    cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();

    nodesGeometry.dispose();
    nodesMaterial.dispose();
    edgesGeometry.dispose();
    edgesMaterial.dispose();
    signalsGeometry.dispose();
    signalMaterial.dispose();
    ambientGeometry.dispose();
    ambientMaterial.dispose();

    composer.dispose();
    renderer.dispose();
  };
}
