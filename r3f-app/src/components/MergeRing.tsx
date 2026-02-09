import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../stores/useGameStore';

const DURATION = 0.6;

export default function MergeRing() {
  const { mergePulse } = useGameStore();
  const meshRef = useRef<THREE.Mesh>(null!);
  const startRef = useRef(0);
  const activeRef = useRef(false);

  const geom = useMemo(() => new THREE.RingGeometry(1.2, 1.6, 48), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffe2f0',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  useEffect(() => {
    if (!mergePulse) return;
    startRef.current = performance.now();
    activeRef.current = true;
  }, [mergePulse]);

  useFrame(() => {
    if (!activeRef.current) return;
    const t = (performance.now() - startRef.current) / 1000;
    const p = Math.min(1, t / DURATION);
    const scale = 0.4 + p * 3.2;
    meshRef.current.scale.setScalar(scale);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.8;
    if (p >= 1) {
      activeRef.current = false;
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      meshRef.current.scale.setScalar(0.01);
    }
  });

  return <mesh ref={meshRef} geometry={geom} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} />;
}
