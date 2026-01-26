import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { useGameStore } from '../stores/useGameStore';
import PileItem from './PileItem';
import MergeBurst from './MergeBurst';
import MergeRing from './MergeRing';

useGLTF.preload('/assets/scene/scene.gltf');

export default function Scene() {
  const { items, phase, tick } = useGameStore();
  const plateGltf = useGLTF('/assets/scene/scene.gltf');

  const plateModel = useMemo(() => {
    if (!plateGltf?.scene) return null;
    const plateRoot =
      plateGltf.scene.getObjectByName('BreakFastPlate') ??
      plateGltf.scene.getObjectByName('BreakFastPlate_Foodback_Materials_10_20_0');
    if (!plateRoot) return null;
    const clone = plateRoot.clone(true);
    clone.traverse((child: any) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    clone.position.sub(center);
    const maxDim = Math.max(size.x, size.z) || 1;
    const target = 19;
    const scale = target / maxDim;
    clone.scale.setScalar(scale);
    const scaledBox = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaledBox.min.y;
    return clone;
  }, [plateGltf]);

  useFrame((_, delta) => {
    if (phase === 'playing') tick(delta * 1000);
  });

  const floor = useMemo(() => new THREE.PlaneGeometry(60, 60), []);
  const platter = useMemo(() => new THREE.CylinderGeometry(9.5, 10.2, 0.6, 72), []);
  const rim = useMemo(() => new THREE.TorusGeometry(9.7, 0.22, 20, 60), []);
  const shadow = useMemo(() => new THREE.CircleGeometry(9.3, 64), []);
  const backdrop = useMemo(() => new THREE.PlaneGeometry(50, 26), []);
  const floorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ebe6e2', roughness: 0.92, metalness: 0.02 }),
    []
  );
  const platterMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f8f3ee', roughness: 0.7, metalness: 0.05 }),
    []
  );
  const rimMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffe3ec', roughness: 0.55, metalness: 0.15 }),
    []
  );
  const backdropMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#d2cbc6', roughness: 1, metalness: 0 }),
    []
  );

  return (
    <group>
      <color attach="background" args={['#cfc7c2']} />
      <fog attach="fog" args={['#d7d0cb', 20, 55]} />
      <mesh geometry={floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={floorMat} />
      <mesh geometry={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#d8cfc2" roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={backdrop} position={[0, 10, -18]} material={backdropMat} />
      {plateModel ? (
        <primitive object={plateModel} position={[0, 0.08, 0]} />
      ) : (
        <>
          <mesh geometry={platter} position={[0, 0.16, 0]} castShadow receiveShadow material={platterMat} />
          <mesh geometry={rim} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.36, 0]} castShadow material={rimMat} />
        </>
      )}
      <group>
        {items.filter((it) => it.spawned).map((it) => (
          <PileItem key={it.id} item={it} />
        ))}
      </group>
      <MergeBurst />
      <MergeRing />
      <ContactShadows position={[0, 0.05, 0]} opacity={0.45} scale={20} blur={2.4} far={12} />
    </group>
  );
}
