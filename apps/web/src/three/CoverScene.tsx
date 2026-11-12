import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_FOV, CAMERA_Z, ENV_H as H, ENV_W as W, SEAL_LOCAL_Y, envelopeLayout } from './layout';

/**
 * Real-time 3D cover: a paper envelope with a wax seal floating in a petal drift.
 * Everything is procedural geometry (no model files, no network fonts) so it stays
 * small and works under a strict CSP. Colors come from the live theme variables.
 *
 * Opening sequence (driven by `opening`): seal splits → flap swings open → card
 * rises out → camera dollies in while petals burst outward.
 */

const { damp, clamp, smoothstep } = THREE.MathUtils;
const stage = (p: number, from: number, to: number) => smoothstep(clamp((p - from) / (to - from), 0, 1), 0, 1);

function themeColor(name: string, fallback: string): THREE.Color {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  try {
    return new THREE.Color(/^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

interface Palette {
  paper: THREE.Color;
  paperShade: THREE.Color;
  paperDeep: THREE.Color;
  seal: THREE.Color;
  card: THREE.Color;
  accent: THREE.Color;
  petals: THREE.Color[];
}

function usePalette(): Palette {
  return useMemo(() => {
    const primary = themeColor('--c-primary', '#c7848f');
    const bg = themeColor('--c-bg', '#f3f5ef');
    const accent = themeColor('--c-accent', '#7a9883');
    const white = new THREE.Color('#ffffff');
    const paper = white.clone().lerp(primary, 0.1).lerp(bg, 0.25);
    return {
      paper,
      paperShade: paper.clone().lerp(primary, 0.12).multiplyScalar(0.97),
      paperDeep: paper.clone().lerp(primary, 0.22).multiplyScalar(0.93),
      seal: primary.clone().multiplyScalar(0.72),
      card: white.clone().lerp(bg, 0.2),
      accent,
      petals: [
        primary.clone().lerp(white, 0.35),
        primary.clone().lerp(white, 0.6),
        primary.clone(),
        white.clone().lerp(primary, 0.15),
        new THREE.Color('#c9b6d6'),
      ],
    };
  }, []);
}

/* ---------------- Geometry helpers ---------------- */

function triangle(a: [number, number], b: [number, number], c: [number, number], round = 0.08) {
  const s = new THREE.Shape();
  s.moveTo(...a);
  s.lineTo(...b);
  // slightly rounded tip for the flap point
  s.quadraticCurveTo(c[0], c[1] - round, c[0] + (a[0] < b[0] ? -0.0001 : 0.0001), c[1]);
  s.lineTo(...a);
  return new THREE.ShapeGeometry(s, 12);
}

function heartShape(size: number) {
  const s = new THREE.Shape();
  const k = size;
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(-1.1 * k, -0.1 * k, -0.9 * k, 0.9 * k, 0, 0.35 * k);
  s.bezierCurveTo(0.9 * k, 0.9 * k, 1.1 * k, -0.1 * k, 0, -0.9 * k);
  return s;
}

function petalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-0.07, 0.04, -0.07, 0.16, 0, 0.2);
  s.bezierCurveTo(0.07, 0.16, 0.07, 0.04, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  // cup the petal so it catches light as it tumbles
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, x * x * 6 + Math.sin(y * 12) * 0.006);
  }
  g.computeVertexNormals();
  g.translate(0, -0.1, 0);
  return g;
}

/** Paint the card face with the page's own fonts (already loaded for the HTML cover). */
function useCardTexture(pal: Palette, title: string, subtitle: string) {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 700;
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const cv = tex.image as HTMLCanvasElement;
      const ctx = cv.getContext('2d')!;
      const { width: w, height: h } = cv;
      ctx.fillStyle = `#${pal.card.getHexString()}`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = `#${pal.seal.getHexString()}`;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      ctx.strokeRect(36, 36, w - 72, h - 72);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 50, w - 100, h - 100);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#3d3345';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 128;
      do {
        ctx.font = `italic 300 ${size}px "Cormorant Garamond Variable", "Cormorant Garamond", Georgia, serif`;
        size -= 6;
      } while (ctx.measureText(title).width > w - 160 && size > 40);
      ctx.fillText(title, w / 2, h * 0.46);
      ctx.font = `400 34px "Jost Variable", "Jost", system-ui, sans-serif`;
      ctx.fillStyle = `#${pal.accent.getHexString()}`;
      ctx.fillText(subtitle.split('').join(String.fromCharCode(8202)), w / 2, h * 0.7);
      tex.needsUpdate = true;
    };
    draw();
    void document.fonts?.ready.then(draw);
    return () => {
      alive = false;
    };
  }, [tex, pal, title, subtitle]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/* ---------------- Envelope ---------------- */

function Envelope({
  opening,
  progress,
  pal,
  tilt,
  cardTex,
}: {
  opening: boolean;
  progress: RefObject<number>;
  pal: Palette;
  tilt: RefObject<{ x: number; y: number }>;
  cardTex: THREE.Texture;
}) {
  const root = useRef<THREE.Group>(null);
  const flap = useRef<THREE.Group>(null);
  const card = useRef<THREE.Group>(null);
  const sealL = useRef<THREE.Group>(null);
  const sealR = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const p = useRef(0);
  const { size } = useThree();
  const { scale, homeY } = envelopeLayout(size.width, size.height);

  const geo = useMemo(() => {
    const left = triangle([-W / 2, -H / 2], [-W / 2, H / 2], [0.02, -0.05], 0);
    const right = triangle([W / 2, -H / 2], [W / 2, H / 2], [-0.02, -0.05], 0);
    const bottom = triangle([-W / 2, -H / 2], [W / 2, -H / 2], [0, 0.18], 0);
    // flap is authored hanging down from the hinge at y=0 (the group sits on the top edge)
    const flapS = new THREE.Shape();
    flapS.moveTo(-W / 2, 0);
    flapS.lineTo(W / 2, 0);
    flapS.quadraticCurveTo(0.12, -H * 0.62, 0, -H * 0.66);
    flapS.quadraticCurveTo(-0.12, -H * 0.62, -W / 2, 0);
    const flapG = new THREE.ShapeGeometry(flapS, 16);
    const sealHalf = (start: number) => new THREE.CylinderGeometry(0.3, 0.3, 0.07, 40, 1, false, start, Math.PI);
    const heart = new THREE.ExtrudeGeometry(heartShape(0.12), { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 3 });
    const rim = new THREE.TorusGeometry(0.24, 0.012, 8, 48);
    return { left, right, bottom, flapG, sealL: sealHalf(Math.PI), sealR: sealHalf(0), heart, rim };
  }, []);

  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (opening && t0.current === null) t0.current = t;
    const since = t0.current === null ? 0 : t - t0.current; // seconds since open

    // Follow the finger while swiping; once opened, finish at a steady pace from wherever it is.
    if (opening) p.current = Math.min(1, p.current + dt / 1.1);
    else p.current = damp(p.current, progress.current ?? 0, 14, dt);
    const k = p.current;
    const dolly = opening && (k > 0.92 || since > 1);

    // idle float + tilt (tilt ref is fed from gyro / pointer)
    const tx = tilt.current?.x ?? 0;
    const ty = tilt.current?.y ?? 0;
    g.rotation.y = damp(g.rotation.y, tx * 0.35 + Math.sin(t * 0.5) * 0.05 * (1 - k), 4, dt);
    g.rotation.x = damp(g.rotation.x, -0.12 + ty * 0.25 + Math.sin(t * 0.7) * 0.03, 4, dt);
    const baseY = homeY + Math.sin(t * 0.9) * 0.04 * (1 - k);
    g.position.y = damp(g.position.y, baseY - (dolly ? 0.5 : 0), 3, dt);

    // seal splits apart
    if (sealL.current && sealR.current) {
      const s = clamp(k / 0.16, 0, 1);
      sealL.current.position.x = -s * 0.9;
      sealR.current.position.x = s * 0.9;
      sealL.current.position.y = sealR.current.position.y = -s * s * 1.2;
      sealL.current.rotation.z = s * 1.4;
      sealR.current.rotation.z = -s * 1.4;
      sealL.current.visible = sealR.current.visible = s < 1;
    }
    // flap swings open on its hinge
    if (flap.current) flap.current.rotation.x = -Math.PI * 0.96 * stage(k, 0.04, 0.46);
    // card rises and comes toward the camera
    if (card.current) {
      const up = stage(k, 0.4, 1);
      card.current.position.y = up * 1.55;
      card.current.position.z = up * 0.9;
      card.current.rotation.x = up * 0.12;
    }
    // camera dolly
    const cam = state.camera;
    cam.position.z = damp(cam.position.z, dolly ? 3.6 : CAMERA_Z, 1.6, dt);
    // follow the rising card so it ends centred in frame
    const cardY = g.position.y + (card.current?.position.y ?? 0) * scale;
    cam.position.y = damp(cam.position.y, dolly ? cardY : 0, 1.6, dt);
    cam.lookAt(0, cam.position.y, 0);
  });

  const paperMat = (color: THREE.Color, side: THREE.Side = THREE.FrontSide) => (
    <meshStandardMaterial color={color} roughness={0.92} metalness={0} side={side} />
  );

  return (
    <group ref={root} scale={scale} position={[0, homeY, 0]}>
      {/* back panel (inside of the envelope) */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[W, H]} />
        {paperMat(pal.paperDeep, THREE.DoubleSide)}
      </mesh>

      {/* the card tucked inside */}
      <group ref={card} position={[0, 0, -0.01]}>
        <mesh>
          <planeGeometry args={[W * 0.9, H * 0.92]} />
          <meshStandardMaterial map={cardTex} roughness={0.85} />
        </mesh>
      </group>

      {/* front pocket folds */}
      <mesh geometry={geo.left} position={[0, 0, 0.01]}>{paperMat(pal.paperShade)}</mesh>
      <mesh geometry={geo.right} position={[0, 0, 0.011]}>{paperMat(pal.paperShade)}</mesh>
      <mesh geometry={geo.bottom} position={[0, 0, 0.02]}>{paperMat(pal.paper)}</mesh>

      {/* top flap, hinged on the top edge */}
      <group ref={flap} position={[0, H / 2, 0.03]}>
        <mesh geometry={geo.flapG}>{paperMat(pal.paper, THREE.DoubleSide)}</mesh>
      </group>

      {/* wax seal (two halves so it can crack open) */}
      <group position={[0, SEAL_LOCAL_Y, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <group ref={sealL}>
          <mesh geometry={geo.sealL}>
            <meshStandardMaterial color={pal.seal} roughness={0.35} metalness={0.1} />
          </mesh>
        </group>
        <group ref={sealR}>
          <mesh geometry={geo.sealR}>
            <meshStandardMaterial color={pal.seal} roughness={0.35} metalness={0.1} />
          </mesh>
          <mesh geometry={geo.rim} position={[0, 0.036, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={pal.seal.clone().multiplyScalar(0.8)} roughness={0.4} />
          </mesh>
          <mesh geometry={geo.heart} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={pal.seal.clone().multiplyScalar(0.85)} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ---------------- Petals ---------------- */

function Petals({ opening, pal, count }: { opening: boolean; pal: Palette; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(petalGeometry, []);
  const { viewport } = useThree();
  const burst = useRef(0);
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 6,
        y: Math.random() * 8 - 4,
        z: (Math.random() - 0.5) * 3 - 0.5,
        speed: 0.25 + Math.random() * 0.35,
        sway: Math.random() * Math.PI * 2,
        spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.6),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        scale: 0.7 + Math.random() * 0.9,
      })),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    data.forEach((_, i) => m.setColorAt(i, pal.petals[i % pal.petals.length]!));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data, pal]);

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    burst.current = damp(burst.current, opening ? 1 : 0, 2, dt);
    const half = viewport.height / 2 + 1;
    const t = state.clock.elapsedTime;
    data.forEach((p, i) => {
      p.y -= p.speed * dt * (1 + burst.current * 2);
      p.x += Math.sin(t * 0.8 + p.sway) * dt * 0.25 + Math.sign(p.x || 1) * burst.current * dt * 1.5;
      p.z += burst.current * dt * 1.2;
      if (p.y < -half || p.z > 4) {
        p.y = half;
        p.x = (Math.random() - 0.5) * viewport.width * 1.4;
        p.z = (Math.random() - 0.5) * 3 - 0.5;
      }
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt * 0.5;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.copy(p.rot);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.7} transparent opacity={0.92} />
    </instancedMesh>
  );
}

/* ---------------- Scene ---------------- */

export default function CoverScene({
  opening,
  progress,
  title,
  subtitle,
}: {
  opening: boolean;
  progress: RefObject<number>;
  title: string;
  subtitle: string;
}) {
  const pal = usePalette();
  const cardTex = useCardTexture(pal, title, subtitle);
  const tilt = useRef({ x: 0, y: 0 });
  const [count] = useState(() => (window.innerWidth < 500 ? 34 : 60));

  // Gyro on phones, pointer on desktop. (iOS permission is requested on the open tap.)
  useEffect(() => {
    let base: { b: number; g: number } | null = null;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      base ??= { b: e.beta, g: e.gamma };
      tilt.current = { x: clamp((e.gamma - base.g) / 20), y: clamp((e.beta - base.b) / 20) };
    };
    const onPointer = (e: PointerEvent) => {
      tilt.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          // Neutral keeps the theme's paper/rose colors true instead of ACES' grey shift.
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <ambientLight intensity={1.4} />
        <hemisphereLight args={['#fff8f4', '#e9efe9', 1.1]} />
        <directionalLight position={[2.5, 4, 5]} intensity={2.2} color="#fff4ec" />
        <directionalLight position={[-3, -1, 2]} intensity={0.5} color="#f2f6ff" />
        <Envelope opening={opening} progress={progress} pal={pal} tilt={tilt} cardTex={cardTex} />
        <Petals opening={opening} pal={pal} count={count} />
      </Canvas>
    </div>
  );
}
