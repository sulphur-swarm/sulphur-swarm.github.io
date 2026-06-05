/**
 * ngiNeuralVis.ts — Three.js WebGL abstract flowing topology surface for NGI hero.
 * Renders a morphing 3D wireframe landscape with simplex noise displacement,
 * purple-to-cyan gradient coloring, bloom post-processing, and atmospheric fog.
 */

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Vector2,
  FogExp2,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MOBILE_BREAKPOINT = 640;
const SEGMENTS_DESKTOP = 200;
const SEGMENTS_MOBILE = 80;

/* ------------------------------------------------------------------ */
/*  GLSL Simplex Noise (Ashima/webgl-noise, MIT license)               */
/* ------------------------------------------------------------------ */

const simplexNoise3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/* ------------------------------------------------------------------ */
/*  Vertex Shader                                                      */
/* ------------------------------------------------------------------ */

const vertexShader = /* glsl */ `
${simplexNoise3D}

uniform float uTime;
uniform float uAmplitude;
varying float vDisplacement;
varying float vScreenY;

void main() {
  vec3 pos = position;

  // Multi-octave simplex noise displacement on Y axis
  float displacement = 0.0;
  displacement += snoise(vec3(pos.x * 0.015, pos.z * 0.015, uTime * 0.15)) * uAmplitude;
  displacement += snoise(vec3(pos.x * 0.03, pos.z * 0.03, uTime * 0.2)) * uAmplitude * 0.5;
  displacement += snoise(vec3(pos.x * 0.06, pos.z * 0.06, uTime * 0.25)) * uAmplitude * 0.25;

  // Normalize displacement to 0-1 range for color mapping
  // Total max amplitude ≈ uAmplitude * 1.75, noise range is -1 to 1
  float maxDisp = uAmplitude * 1.75;
  vDisplacement = clamp((displacement + maxDisp) / (2.0 * maxDisp), 0.0, 1.0);

  pos.y += displacement;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  // Normalized screen Y: 0.0 = bottom, 1.0 = top
  vScreenY = gl_Position.y / gl_Position.w * 0.5 + 0.5;
}
`;

/* ------------------------------------------------------------------ */
/*  Fragment Shader                                                    */
/* ------------------------------------------------------------------ */

const fragmentShader = /* glsl */ `
varying float vDisplacement;
varying float vScreenY;

void main() {
  // Purple-to-cyan gradient based on displacement height
  vec3 deepPurple = vec3(0.424, 0.388, 1.0);   // #6c63ff
  vec3 brightCyan = vec3(0.0, 0.831, 1.0);      // #00d4ff
  vec3 color = mix(deepPurple, brightCyan, vDisplacement);

  // Brightness boost for peaks (feeds into bloom) — reduced for subtlety
  color *= 1.0 + vDisplacement * 0.15;

  // Bottom fade: smoothly blend to background in bottom ~25% of screen
  vec3 bgColor = vec3(0.031, 0.035, 0.047);
  float fadeFactor = smoothstep(0.0, 0.25, vScreenY);
  color = mix(bgColor, color, fadeFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  Main init                                                          */
/* ------------------------------------------------------------------ */

export function init(canvas: HTMLCanvasElement): () => void {
  // Bail out gracefully if WebGL isn't available
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return () => {};
  }

  const parent = canvas.parentElement;
  if (!parent) {
    renderer.dispose();
    return () => {};
  }

  const parentWidth = () => parent.clientWidth;
  const parentHeight = () => parent.clientHeight;

  let isMobile = parentWidth() < MOBILE_BREAKPOINT;

  // DPI-aware rendering, capped at 2x
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(parentWidth(), parentHeight());
  renderer.setClearColor(0x000000, 0);

  // Scene — transparent background lets page color show through
  const scene = new Scene();
  scene.background = null;
  scene.fog = new FogExp2(0x08090c, isMobile ? 0.005 : 0.003);

  // Camera — viewport-aware positioning for cinematic depth
  const camera = new PerspectiveCamera(
    isMobile ? 60 : 50,
    parentWidth() / parentHeight(),
    0.1,
    1000,
  );
  if (isMobile) {
    camera.position.set(0, 90, 130);
    camera.lookAt(0, 0, -30);
  } else {
    camera.position.set(0, 70, 120);
    camera.lookAt(0, 0, -40);
  }

  // Geometry
  const segments = isMobile ? SEGMENTS_MOBILE : SEGMENTS_DESKTOP;
  let geometry = new PlaneGeometry(300, 300, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  // Shader Material
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: 20.0 },
    },
    wireframe: true,
  });

  // Mesh
  let mesh = new Mesh(geometry, material);
  scene.add(mesh);

  // Post-processing (bloom) — reduced for subtle, refined glow
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new Vector2(parentWidth(), parentHeight()),
    isMobile ? 0.25 : 0.35,
    isMobile ? 0.25 : 0.3,
    isMobile ? 0.75 : 0.7,
  );
  composer.addPass(bloomPass);

  // Reduced motion check
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (prefersReducedMotion.matches) {
    // Render a single static frame
    composer.render();
  }

  // Animation loop
  let animFrameId = 0;

  function animate(timestamp: number) {
    animFrameId = requestAnimationFrame(animate);
    const time = timestamp * 0.001;

    material.uniforms.uTime.value = time;

    // Subtle camera drift — viewport-aware
    const driftX = isMobile ? 5 : 10;
    const driftY = isMobile ? 3 : 5;
    const baseY = isMobile ? 90 : 70;
    const lookTarget = isMobile ? -30 : -40;

    camera.position.x = Math.sin(time * 0.05) * driftX;
    camera.position.y = baseY + Math.sin(time * 0.03) * driftY;
    camera.lookAt(0, 0, lookTarget);

    composer.render();
  }

  if (!prefersReducedMotion.matches) {
    animFrameId = requestAnimationFrame(animate);
  }

  // Resize observer
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

      // Rebuild geometry with appropriate segment count
      const newSegments = isMobile ? SEGMENTS_MOBILE : SEGMENTS_DESKTOP;
      const newGeometry = new PlaneGeometry(300, 300, newSegments, newSegments);
      newGeometry.rotateX(-Math.PI / 2);
      mesh.geometry.dispose();
      mesh.geometry = newGeometry;
      geometry = newGeometry;

      // Update bloom — subtle refined glow
      bloomPass.strength = isMobile ? 0.25 : 0.35;
      bloomPass.radius = isMobile ? 0.25 : 0.3;
      bloomPass.threshold = isMobile ? 0.75 : 0.7;

      // Update camera for new viewport
      camera.fov = isMobile ? 60 : 50;
      if (isMobile) {
        camera.position.set(0, 90, 130);
        camera.lookAt(0, 0, -30);
      } else {
        camera.position.set(0, 70, 120);
        camera.lookAt(0, 0, -40);
      }
      camera.updateProjectionMatrix();

      // Update fog density
      scene.fog = new FogExp2(0x08090c, isMobile ? 0.005 : 0.003);
    }
  });
  resizeObserver.observe(parent);

  // Cleanup
  return function cleanup() {
    cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();
    geometry.dispose();
    material.dispose();
    composer.dispose();
    renderer.dispose();
  };
}
