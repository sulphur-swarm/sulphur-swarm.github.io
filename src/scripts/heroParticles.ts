import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  Points,
  PointsMaterial,
  LineSegments,
  LineBasicMaterial,
  Float32BufferAttribute,
  Color,
} from 'three';

// Constants
const PARTICLE_COUNT_DESKTOP = 400;
const PARTICLE_COUNT_MOBILE = 80;
const CONNECTION_DISTANCE = 120;
const CONNECTION_DISTANCE_SQ = CONNECTION_DISTANCE * CONNECTION_DISTANCE;
const COLOR_VIOLET = new Color(0x6c63ff);
const COLOR_CYAN = new Color(0x00d4ff);
const BACKGROUND_COLOR = new Color(0x08090c);

export function init(canvas: HTMLCanvasElement): () => void {
  const isMobile = window.innerWidth < 768;
  const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;

  // Renderer
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Scene
  const scene = new Scene();
  scene.background = BACKGROUND_COLOR;

  // Camera
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 200;

  // Particle geometry
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const driftPhases = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    // Random position in [-250, 250]
    positions[i3]     = (Math.random() - 0.5) * 500;
    positions[i3 + 1] = (Math.random() - 0.5) * 500;
    positions[i3 + 2] = (Math.random() - 0.5) * 500;

    // Random color: violet or cyan ~50/50
    const c = Math.random() < 0.5 ? COLOR_VIOLET : COLOR_CYAN;
    colors[i3]     = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    // Small random velocity in [-0.15, 0.15]
    velocities[i3]     = (Math.random() - 0.5) * 0.3;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;

    // Drift phase for organic wave motion
    driftPhases[i] = Math.random() * Math.PI * 2;
  }

  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  const particleMaterial = new PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
  });

  const points = new Points(particleGeometry, particleMaterial);
  scene.add(points);

  // Connection lines geometry
  const lineGeometry = new BufferGeometry();
  const linePositions = new Float32Array(particleCount * particleCount * 6); // max possible
  const lineColors = new Float32Array(particleCount * particleCount * 6);
  lineGeometry.setAttribute('position', new Float32BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new Float32BufferAttribute(lineColors, 3));

  const lineMaterial = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.25,
  });

  const lineSegments = new LineSegments(lineGeometry, lineMaterial);
  if (!isMobile) {
    scene.add(lineSegments);
  }

  // Animation loop
  let animFrameId: number;

  function animate(timestamp: number) {
    animFrameId = requestAnimationFrame(animate);

    const pos = particleGeometry.attributes.position.array as Float32Array;

    // Update particle positions
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      pos[i3]     += velocities[i3];
      pos[i3 + 1] += velocities[i3 + 1] + Math.sin(timestamp * 0.001 + driftPhases[i]) * 0.03;
      pos[i3 + 2] += velocities[i3 + 2];

      // Boundary wrap at 300
      if (pos[i3]     >  300) pos[i3]     = -300;
      if (pos[i3]     < -300) pos[i3]     =  300;
      if (pos[i3 + 1] >  300) pos[i3 + 1] = -300;
      if (pos[i3 + 1] < -300) pos[i3 + 1] =  300;
      if (pos[i3 + 2] >  300) pos[i3 + 2] = -300;
      if (pos[i3 + 2] < -300) pos[i3 + 2] =  300;
    }

    particleGeometry.attributes.position.needsUpdate = true;

    // Update connection lines (desktop only)
    if (!isMobile) {
      const lPos = lineGeometry.attributes.position.array as Float32Array;
      const lCol = lineGeometry.attributes.color.array as Float32Array;
      let lineIndex = 0;

      for (let i = 0; i < particleCount - 1; i++) {
        const i3 = i * 3;
        const ax = pos[i3], ay = pos[i3 + 1], az = pos[i3 + 2];

        for (let j = i + 1; j < particleCount; j++) {
          const j3 = j * 3;
          const dx = ax - pos[j3];
          const dy = ay - pos[j3 + 1];
          const dz = az - pos[j3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq > CONNECTION_DISTANCE_SQ) continue;

          const alpha = 1 - Math.sqrt(distSq) / CONNECTION_DISTANCE;
          const li = lineIndex * 6;

          // Start vertex
          lPos[li]     = ax;
          lPos[li + 1] = ay;
          lPos[li + 2] = az;
          // End vertex
          lPos[li + 3] = pos[j3];
          lPos[li + 4] = pos[j3 + 1];
          lPos[li + 5] = pos[j3 + 2];

          // Colors: mix violet/cyan with alpha fade
          lCol[li]     = COLOR_VIOLET.r * alpha;
          lCol[li + 1] = COLOR_VIOLET.g * alpha;
          lCol[li + 2] = COLOR_VIOLET.b * alpha;
          lCol[li + 3] = COLOR_CYAN.r * alpha;
          lCol[li + 4] = COLOR_CYAN.g * alpha;
          lCol[li + 5] = COLOR_CYAN.b * alpha;

          lineIndex++;
        }
      }

      lineGeometry.setDrawRange(0, lineIndex * 2);
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  animFrameId = requestAnimationFrame(animate);

  // Resize handler (debounced ~16ms)
  let resizeTimer: ReturnType<typeof setTimeout>;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 16);
  }

  window.addEventListener('resize', handleResize);

  // Cleanup function
  return function cleanup() {
    cancelAnimationFrame(animFrameId);
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', handleResize);
    particleGeometry.dispose();
    particleMaterial.dispose();
    lineGeometry.dispose();
    lineMaterial.dispose();
    renderer.dispose();
  };
}
