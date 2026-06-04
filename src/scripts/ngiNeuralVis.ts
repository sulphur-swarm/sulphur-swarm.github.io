/**
 * ngiNeuralVis.ts — Animated neural network canvas visualization for the NGI hero area.
 * Renders 15 nodes (matching FENA's 15-node architecture) in 3 hierarchical tiers
 * connected by pulsing edges with traveling signal dots.
 */

interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  phase: number;
  speed: number;
  tier: number;
}

interface Edge {
  from: number;
  to: number;
  signalPos: number;
  signalSpeed: number;
  signalDir: number;
}

const NODE_COLOR = '#6c63ff';
const SIGNAL_COLOR = '#00d4ff';
const EDGE_COLOR = 'rgba(108, 99, 255, 0.15)';
const MOBILE_BREAKPOINT = 640;

export function init(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let animFrameId = 0;
  let width = 0;
  let height = 0;
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let isMobile = false;

  function setupLayout() {
    const parent = canvas.parentElement;
    width = parent ? parent.clientWidth : canvas.clientWidth;
    height = parent ? parent.clientHeight : canvas.clientHeight;
    canvas.width = width * Math.min(window.devicePixelRatio, 2);
    canvas.height = height * Math.min(window.devicePixelRatio, 2);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx!.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));

    isMobile = width < MOBILE_BREAKPOINT;

    // Create nodes in 3 tiers (5 per tier) arranged in a brain-like shape
    const centerX = width / 2;
    const centerY = height / 2;
    const spreadX = isMobile ? width * 0.35 : width * 0.3;
    const spreadY = isMobile ? height * 0.3 : height * 0.32;

    nodes = [];

    // Tier 0 (top) — sensory/input layer
    for (let i = 0; i < 5; i++) {
      const angle = ((i - 2) / 4) * Math.PI * 0.6 - Math.PI / 2;
      nodes.push({
        x: 0,
        y: 0,
        baseX: centerX + Math.cos(angle) * spreadX * 0.9,
        baseY: centerY - spreadY * 0.7 + Math.sin(angle) * spreadY * 0.3,
        radius: isMobile ? 3 : 4.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.4,
        tier: 0,
      });
    }

    // Tier 1 (middle) — processing layer
    for (let i = 0; i < 5; i++) {
      const angle = ((i - 2) / 4) * Math.PI * 0.5;
      nodes.push({
        x: 0,
        y: 0,
        baseX: centerX + Math.cos(angle) * spreadX * 0.7,
        baseY: centerY + Math.sin(angle) * spreadY * 0.2,
        radius: isMobile ? 4 : 5.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.3,
        tier: 1,
      });
    }

    // Tier 2 (bottom) — output/integration layer
    for (let i = 0; i < 5; i++) {
      const angle = ((i - 2) / 4) * Math.PI * 0.55 + Math.PI / 2;
      nodes.push({
        x: 0,
        y: 0,
        baseX: centerX + Math.cos(angle) * spreadX * 0.85,
        baseY: centerY + spreadY * 0.6 + Math.sin(angle) * spreadY * 0.25,
        radius: isMobile ? 3 : 4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.35,
        tier: 2,
      });
    }

    // Create edges: connect nodes within and between tiers
    edges = [];

    // Within-tier connections (adjacent nodes)
    for (let tier = 0; tier < 3; tier++) {
      const start = tier * 5;
      for (let i = 0; i < 4; i++) {
        edges.push({
          from: start + i,
          to: start + i + 1,
          signalPos: Math.random(),
          signalSpeed: 0.002 + Math.random() * 0.003,
          signalDir: Math.random() > 0.5 ? 1 : -1,
        });
      }
    }

    // Between-tier connections (tier 0 → tier 1)
    for (let i = 0; i < 5; i++) {
      edges.push({
        from: i,
        to: 5 + i,
        signalPos: Math.random(),
        signalSpeed: 0.001 + Math.random() * 0.003,
        signalDir: 1,
      });
      if (i < 4) {
        edges.push({
          from: i,
          to: 5 + i + 1,
          signalPos: Math.random(),
          signalSpeed: 0.0015 + Math.random() * 0.0025,
          signalDir: 1,
        });
      }
    }

    // Between-tier connections (tier 1 → tier 2)
    for (let i = 0; i < 5; i++) {
      edges.push({
        from: 5 + i,
        to: 10 + i,
        signalPos: Math.random(),
        signalSpeed: 0.001 + Math.random() * 0.003,
        signalDir: 1,
      });
      if (i > 0) {
        edges.push({
          from: 5 + i,
          to: 10 + i - 1,
          signalPos: Math.random(),
          signalSpeed: 0.0015 + Math.random() * 0.0025,
          signalDir: -1,
        });
      }
    }

    // A few cross-tier skip connections (tier 0 → tier 2)
    edges.push(
      { from: 0, to: 10, signalPos: Math.random(), signalSpeed: 0.001, signalDir: 1 },
      { from: 2, to: 12, signalPos: Math.random(), signalSpeed: 0.0012, signalDir: 1 },
      { from: 4, to: 14, signalPos: Math.random(), signalSpeed: 0.0008, signalDir: -1 },
    );
  }

  function drawNode(node: Node, time: number) {
    if (!ctx) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * node.speed + node.phase);

    // Glow halo
    const gradient = ctx.createRadialGradient(
      node.x, node.y, 0,
      node.x, node.y, node.radius * (3 + pulse * 2),
    );
    gradient.addColorStop(0, `rgba(108, 99, 255, ${0.15 + pulse * 0.1})`);
    gradient.addColorStop(1, 'rgba(108, 99, 255, 0)');
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * (3 + pulse * 2), 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Core circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * (0.8 + pulse * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = NODE_COLOR;
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawEdge(edge: Edge) {
    if (!ctx) return;
    const fromNode = nodes[edge.from];
    const toNode = nodes[edge.to];

    // Edge line
    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Traveling signal dot
    const sx = fromNode.x + (toNode.x - fromNode.x) * edge.signalPos;
    const sy = fromNode.y + (toNode.y - fromNode.y) * edge.signalPos;

    const signalGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, isMobile ? 4 : 6);
    signalGradient.addColorStop(0, SIGNAL_COLOR);
    signalGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.beginPath();
    ctx.arc(sx, sy, isMobile ? 4 : 6, 0, Math.PI * 2);
    ctx.fillStyle = signalGradient;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function animate(timestamp: number) {
    if (!ctx) return;
    const time = timestamp * 0.001;

    ctx.clearRect(0, 0, width, height);

    // Update node positions (sinusoidal drift)
    for (const node of nodes) {
      node.x = node.baseX + Math.sin(time * 0.5 + node.phase) * (isMobile ? 4 : 8);
      node.y = node.baseY + Math.cos(time * 0.4 + node.phase * 1.3) * (isMobile ? 3 : 6);
    }

    // Update and draw edges
    for (const edge of edges) {
      edge.signalPos += edge.signalSpeed * edge.signalDir * 16; // ~16ms per frame
      if (edge.signalPos > 1) edge.signalPos = 0;
      if (edge.signalPos < 0) edge.signalPos = 1;
      drawEdge(edge);
    }

    // Draw nodes on top
    for (const node of nodes) {
      drawNode(node, time);
    }

    animFrameId = requestAnimationFrame(animate);
  }

  // Setup and start
  setupLayout();
  animFrameId = requestAnimationFrame(animate);

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    // Reset scale before re-setup
    ctx?.setTransform(1, 0, 0, 1, 0, 0);
    setupLayout();
  });
  resizeObserver.observe(canvas.parentElement || canvas);

  // Reduced motion: stop animation, show static frame
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) {
    cancelAnimationFrame(animFrameId);
    // Draw one static frame
    for (const node of nodes) {
      node.x = node.baseX;
      node.y = node.baseY;
    }
    for (const edge of edges) drawEdge(edge);
    for (const node of nodes) drawNode(node, 0);
  }

  // Cleanup
  return function cleanup() {
    cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();
  };
}
