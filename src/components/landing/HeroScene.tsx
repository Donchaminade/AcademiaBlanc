import React, { useEffect, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Clock,
  Color,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';

/** Couleurs de la palette de l’application (index.css), reprises pour les particules et les formes. */
const PALETTE = ['#90a8ff', '#dce1ff', '#316bf3', '#ffffff', '#fc922b'];
const PALETTE_WEIGHTS = [0.34, 0.3, 0.2, 0.12, 0.04];

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function pickColor(random: () => number): Color {
  const r = random();
  let acc = 0;
  for (let i = 0; i < PALETTE.length; i += 1) {
    acc += PALETTE_WEIGHTS[i];
    if (r <= acc) return new Color(PALETTE[i]);
  }
  return new Color(PALETTE[0]);
}

/** Générateur déterministe : la scène est identique à chaque chargement et dans les captures. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FloatingShape {
  mesh: Mesh;
  baseY: number;
  phase: number;
  speed: number;
  spin: { x: number; y: number };
}

/**
 * Décor du hero : nuage de points et polyèdres filaires aux couleurs de la charte, qui dérivent lentement
 * et suivent la souris en douceur. Rendu dans un canvas plein fond, sous le texte (le dégradé de lisibilité
 * est appliqué par le parent). Statique quand l’utilisateur demande moins d’animations.
 */
export const HeroScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      // Pas de WebGL : le dégradé CSS du hero suffit.
      return undefined;
    }

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    const random = mulberry32(2025);

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new Scene();
    const camera = new PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    const world = new Group();
    scene.add(world);

    // Nuage de points.
    const count = narrow ? 420 : 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (random() - 0.5) * 34;
      positions[i * 3 + 1] = (random() - 0.5) * 20;
      positions[i * 3 + 2] = (random() - 0.5) * 12 - 2;
      const color = pickColor(random);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const pointsGeometry = new BufferGeometry();
    pointsGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const pointsMaterial = new PointsMaterial({
      size: narrow ? 0.09 : 0.075,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const points = new Points(pointsGeometry, pointsMaterial);
    world.add(points);

    // Polyèdres filaires flottants.
    const shapeGeometries = [new IcosahedronGeometry(1.1, 0), new OctahedronGeometry(1, 0), new IcosahedronGeometry(0.7, 1)];
    const shapeMaterials = ['#90a8ff', '#316bf3', '#dce1ff', '#fc922b'].map((hex) =>
      new MeshBasicMaterial({ color: new Color(hex), wireframe: true, transparent: true, opacity: 0.32, depthWrite: false }));
    const shapes: FloatingShape[] = [];
    const shapeCount = narrow ? 4 : 7;
    for (let i = 0; i < shapeCount; i += 1) {
      const geometry = shapeGeometries[i % shapeGeometries.length];
      const material = shapeMaterials[i === 3 ? 3 : i % 3];
      const mesh = new Mesh(geometry, material);
      const baseY = (random() - 0.5) * 10;
      mesh.position.set((random() - 0.5) * 24, baseY, (random() - 0.5) * 6 - 1);
      const scale = 0.6 + random() * 0.9;
      mesh.scale.setScalar(scale);
      mesh.rotation.set(random() * Math.PI, random() * Math.PI, 0);
      world.add(mesh);
      shapes.push({
        mesh,
        baseY,
        phase: random() * Math.PI * 2,
        speed: 0.25 + random() * 0.35,
        spin: { x: (random() - 0.5) * 0.3, y: (random() - 0.5) * 0.4 },
      });
    }

    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const clock = new Clock();
    let frame = 0;
    let running = false;
    let visible = true;
    let inViewport = true;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const renderOnce = () => renderer.render(scene, camera);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      target.x = MathUtils.lerp(target.x, pointer.x, 0.04);
      target.y = MathUtils.lerp(target.y, pointer.y, 0.04);

      world.rotation.y += delta * 0.03;
      world.rotation.x = target.y * 0.08;
      world.rotation.z = -target.x * 0.04;
      points.rotation.y = elapsed * 0.012;

      camera.position.x = MathUtils.lerp(camera.position.x, target.x * 1.4, 0.05);
      camera.position.y = MathUtils.lerp(camera.position.y, target.y * 0.9, 0.05);
      camera.lookAt(0, 0, 0);

      shapes.forEach((shape) => {
        shape.mesh.position.y = shape.baseY + Math.sin(elapsed * shape.speed + shape.phase) * 0.6;
        shape.mesh.rotation.x += delta * shape.spin.x;
        shape.mesh.rotation.y += delta * shape.spin.y;
      });

      renderer.render(scene, camera);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      clock.stop();
    };

    const start = () => {
      if (running || reducedMotion.matches || !visible || !inViewport) return;
      running = true;
      clock.start();
      animate();
    };

    const syncRunState = () => {
      if (reducedMotion.matches) {
        stop();
        renderOnce();
        return;
      }
      if (visible && inViewport) start();
      else stop();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    const onPointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    const onVisibility = () => {
      visible = document.visibilityState !== 'hidden';
      syncRunState();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
    };
    const onContextRestored = () => syncRunState();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!running) renderOnce();
    });
    resizeObserver.observe(host);

    const intersection = new IntersectionObserver((entries) => {
      inViewport = entries.some((entry) => entry.isIntersecting);
      syncRunState();
    }, { threshold: 0 });
    intersection.observe(host);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', syncRunState);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    resize();
    renderOnce();
    syncRunState();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', syncRunState);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      scene.clear();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      shapeGeometries.forEach((geometry) => geometry.dispose());
      shapeMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
};

export default HeroScene;
