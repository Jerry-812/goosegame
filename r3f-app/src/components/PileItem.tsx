import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useGameStore, ItemState } from '../stores/useGameStore';
import { gsap } from 'gsap';
import { useFrame, useThree } from '@react-three/fiber';

const GEOMS = [
  () => new THREE.BoxGeometry(0.85, 0.85, 0.85),
  () => new THREE.SphereGeometry(0.55, 24, 24),
  () => new THREE.CylinderGeometry(0.45, 0.45, 0.9, 24),
  () => new THREE.TorusGeometry(0.55, 0.22, 16, 28),
  () => new THREE.ConeGeometry(0.55, 0.9, 24),
  () => new THREE.DodecahedronGeometry(0.6),
];

const MODEL_URLS = [
  '/assets/food/ice-cream.glb',
  '/assets/food/cheese.glb',
  '/assets/food/coockie-man.glb',
  '/assets/food/hotdog.glb',
  '/assets/food/sandwich.glb',
  '/assets/food/sandwich-toast.glb',
  '/assets/food/pancake-big.glb',
  '/assets/food/toast.glb',
];

MODEL_URLS.forEach((url) => useGLTF.preload(url));

const MODEL_META = new Map<string, { offset: THREE.Vector3; scale: number }>();
const MODEL_TARGET_SIZE = 1.6;
const GEOM_SCALE = 1.35;
const RING_INNER = 0.95;
const RING_OUTER = 1.25;
const BOB_AMP = 0.0;
const BOB_SPEED = 1.6;
const TILT_AMP = 0.0;
const TILT_SPEED = 1.1;

function pickGeom(type: number) {
  const idx = type % GEOMS.length;
  return GEOMS[idx]();
}

function setGroupOpacity(root: THREE.Object3D, factor: number) {
  root.traverse((child: any) => {
    if (!child.isMesh) return;
    const apply = (mat: THREE.Material) => {
      const base = mat.userData.baseOpacity ?? (typeof (mat as any).opacity === 'number' ? (mat as any).opacity : 1);
      mat.userData.baseOpacity = base;
      if (typeof (mat as any).opacity === 'number') {
        (mat as any).transparent = factor < 1 || base < 1;
        (mat as any).opacity = base * factor;
        (mat as any).needsUpdate = true;
      }
    };
    if (Array.isArray(child.material)) child.material.forEach(apply);
    else if (child.material) apply(child.material);
  });
}

function getModelMeta(url: string, scene: THREE.Object3D, targetSize = MODEL_TARGET_SIZE) {
  const cached = MODEL_META.get(url);
  if (cached) return cached;
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
  const meta = { offset, scale: targetSize / maxDim };
  MODEL_META.set(url, meta);
  return meta;
}

function buildModel(scene: THREE.Object3D, meta: { offset: THREE.Vector3; scale: number }) {
  const clone = scene.clone(true);
  clone.position.copy(meta.offset);
  clone.scale.setScalar(meta.scale);
  clone.traverse((child: any) => {
    if (!child.isMesh) return;
    if (child.material) {
      if (Array.isArray(child.material)) child.material = child.material.map((mat: THREE.Material) => mat.clone());
      else child.material = child.material.clone();
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return clone;
}

function findItemIdFromObject(obj: THREE.Object3D | null | undefined) {
  let cur: THREE.Object3D | null | undefined = obj;
  while (cur) {
    if (typeof (cur as any).userData?.itemId === 'number') return (cur as any).userData.itemId as number;
    cur = cur.parent;
  }
  return null;
}

export default function PileItem({ item }: { item: ItemState }) {
  const ref = useRef<THREE.Group>(null!);
  const { phase, pick, hintId } = useGameStore();
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [ready, setReady] = useState(false);
  const animatingRef = useRef(false);
  const spawnTweenRef = useRef<gsap.core.Timeline | null>(null);

  const geom = useMemo(() => pickGeom(item.type), [item.type]);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15, transparent: false, opacity: 1 }),
    []
  );
  const modelUrl = MODEL_URLS[item.type % MODEL_URLS.length];
  const gltf = useGLTF(modelUrl);
  const model = useMemo(() => {
    if (!gltf?.scene) return null;
    const meta = getModelMeta(modelUrl, gltf.scene);
    return buildModel(gltf.scene, meta);
  }, [gltf, modelUrl]);
  const ringGeom = useMemo(() => new THREE.RingGeometry(RING_INNER, RING_OUTER, 32), []);
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffd1e7',
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );
  const baseRotation = useMemo<[number, number, number]>(
    () => [
      ((item.type % 5) - 2) * 0.05 + ((item.id % 7) - 3) * 0.02,
      ((item.id % 12) - 6) * 0.18,
      ((item.type % 7) - 3) * 0.06,
    ],
    [item.id, item.type]
  );

  useEffect(() => {
    if (!ref.current) return;
    (ref.current as any).userData.itemId = item.id;
  }, [item.id]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (!ready) return;
    const t = clock.elapsedTime;
    if (!animatingRef.current) {
      const bob = Math.sin(t * BOB_SPEED + item.id * 0.7) * BOB_AMP;
      ref.current.position.set(item.pos[0], item.pos[1] + bob, item.pos[2]);
      const tilt = Math.sin(t * TILT_SPEED + item.id * 0.4) * TILT_AMP;
      ref.current.rotation.x = baseRotation[0] + tilt;
      ref.current.rotation.y = baseRotation[1];
      ref.current.rotation.z = baseRotation[2] + Math.cos(t * TILT_SPEED + item.id * 0.2) * TILT_AMP * 0.5;
    }
    if (hovered || animatingRef.current) return;
    if (hintId === item.id) {
      const s = 1 + Math.sin(t * 6) * 0.06;
      ref.current.scale.setScalar(s);
    } else if (ref.current.scale.x !== 1) {
      ref.current.scale.setScalar(1);
    }
  });

  useEffect(() => {
    if (!ref.current) return;
    setReady(false);
    const delay = 0;
    const startX = item.pos[0] + (Math.random() - 0.5) * 0.35;
    const startZ = item.pos[2] + (Math.random() - 0.5) * 0.35;
    const startY = item.pos[1] + 1.35 + Math.random() * 0.55;
    ref.current.position.set(startX, startY, startZ);
    ref.current.scale.setScalar(0.05);
    if (model) setGroupOpacity(ref.current, 0);
    else {
      mat.opacity = 0;
      mat.transparent = true;
    }
    const id = window.setTimeout(() => {
      const fade = { v: 0 };
      spawnTweenRef.current = gsap
        .timeline({
          onComplete: () => {
            setReady(true);
            spawnTweenRef.current = null;
          },
        })
        .to(
          ref.current!.position,
          {
            x: item.pos[0],
            y: item.pos[1] + 0.14,
            z: item.pos[2],
            duration: 0.4,
            ease: 'power3.out',
          },
          0
        )
        .to(
          ref.current!.position,
          {
            y: item.pos[1],
            duration: 0.2,
            ease: 'bounce.out',
          },
          0.4
        )
        .to(ref.current!.scale, { x: 1, y: 1, z: 1, duration: 0.36, ease: 'back.out(1.9)' }, 0.05)
        .to(
          fade,
          {
            v: 1,
            duration: 0.32,
            ease: 'power2.out',
            onUpdate: () => {
              if (model) setGroupOpacity(ref.current!, fade.v);
              else {
                mat.opacity = fade.v;
                mat.transparent = fade.v < 1;
              }
            },
          },
          0.05
        );
    }, delay);
    return () => {
      window.clearTimeout(id);
      spawnTweenRef.current?.kill();
      spawnTweenRef.current = null;
    };
  }, []);

  const screenToWorld = (clientX: number, clientY: number, planeY = 0.6) => {
    const rect = gl.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(origin).normalize();
    if (Math.abs(dir.y) < 1e-4) return null;
    const t = (planeY - origin.y) / dir.y;
    if (!Number.isFinite(t) || t < 0) return null;
    return origin.clone().add(dir.multiplyScalar(t));
  };

  const isTopHit = (e: any) => {
    const hits = e.intersections || [];
    for (const hit of hits) {
      const id = findItemIdFromObject(hit.object);
      if (id != null) return id === item.id;
    }
    return true;
  };

  const onPointerOver = (e: any) => {
    if (phase !== 'playing') return;
    if (!ready) return;
    if (!isTopHit(e)) {
      ref.current.scale.setScalar(1.0);
      if (model) setGroupOpacity(ref.current, 0.45);
      else {
        mat.opacity = 0.45;
        mat.transparent = true;
      }
      return;
    }
    setHovered(true);
    ref.current.scale.setScalar(1.08);
  };

  const onPointerOut = () => {
    setHovered(false);
    ref.current.scale.setScalar(1.0);
    if (model) setGroupOpacity(ref.current, 1);
    else {
      mat.opacity = 1;
      mat.transparent = false;
    }
  };

  const onPointerUp = (e: any) => {
    e.stopPropagation();
    if (phase !== 'playing') return;
    if (!ready) return;
    if (animatingRef.current) return;

    // R3F provides intersections sorted nearest-first; only the nearest object is "topmost".
    if (!isTopHit(e)) return;
    animatingRef.current = true;
    setHovered(false);
    const tray = document.querySelector('.tray') as HTMLElement | null;
    const fallback = new THREE.Vector3(0, 1.1, 6.5);
    let target = fallback;
    if (tray) {
      const rect = tray.getBoundingClientRect();
      const world = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.6);
      if (world) target = world;
    }

    const start = ref.current.position.clone();
    const control = start.clone().lerp(target, 0.5);
    control.y += 1.6 + Math.random() * 0.4;
    const travel = { t: 0 };
    gsap.to(travel, {
      t: 1,
      duration: 0.42,
      ease: 'power3.inOut',
      onUpdate: () => {
        const t = travel.t;
        const inv = 1 - t;
        const x = inv * inv * start.x + 2 * inv * t * control.x + t * t * target.x;
        const y = inv * inv * start.y + 2 * inv * t * control.y + t * t * target.y;
        const z = inv * inv * start.z + 2 * inv * t * control.z + t * t * target.z;
        ref.current.position.set(x, y, z);
      },
    });
    gsap.to(ref.current.rotation, {
      y: ref.current.rotation.y + (Math.random() * 0.6 - 0.3),
      duration: 0.42,
      ease: 'power2.inOut',
    });
    gsap
      .timeline()
      .to(ref.current.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 0.08, ease: 'power2.out' })
      .to(ref.current.scale, {
        x: 0.08,
        y: 0.08,
        z: 0.08,
        duration: 0.28,
        ease: 'back.in(1.8)',
        onComplete: () => {
          pick(item.id);
          animatingRef.current = false;
        },
      });
  };

  if (item.picked) return null;

  return (
    <group ref={ref} position={item.pos} rotation={baseRotation} onPointerOver={onPointerOver} onPointerOut={onPointerOut} onPointerUp={onPointerUp}>
      {model ? <primitive object={model} /> : <mesh geometry={geom} material={mat} castShadow scale={GEOM_SCALE} />}
      {hintId === item.id ? (
        <mesh geometry={ringGeom} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} />
      ) : null}
    </group>
  );
}
