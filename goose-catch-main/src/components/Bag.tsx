import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../stores/useGameStore';

const slotPositions = [
  new THREE.Vector3(-2.25, 0.2, 3),
  new THREE.Vector3(-1.35, 0.2, 3),
  new THREE.Vector3(-0.45, 0.2, 3),
  new THREE.Vector3(0.45, 0.2, 3),
  new THREE.Vector3(1.35, 0.2, 3),
  new THREE.Vector3(2.25, 0.2, 3),
];

const Bag = () => {
  const visualStyle = useGameStore((state) => state.visualStyle);
  const isToon = visualStyle === 'toon';

  const frameGeometry = useMemo(() => new THREE.BoxGeometry(0.86, 0.12, 0.86), []);
  const frameEdges = useMemo(() => new THREE.EdgesGeometry(frameGeometry), [frameGeometry]);
  const plateGeometry = useMemo(() => new THREE.PlaneGeometry(0.78, 0.78), []);

  const baseColor = isToon ? '#cfe9ff' : '#c5e2f6';
  const baseEmissive = isToon ? '#9bc2e6' : '#8fb6da';
  const plateColor = isToon ? '#fff2e4' : '#f6f0ea';
  const rimColor = isToon ? '#f6c9a2' : '#d9c6b2';
  const lineColor = isToon ? '#ffb46a' : '#c2aa95';

  return (
    <group receiveShadow>
      <mesh position={[0, 0, 3]} renderOrder={3}>
        <boxGeometry args={[6, 0.1, 1]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseEmissive}
          emissiveIntensity={0.25}
          metalness={0.05}
          roughness={0.6}
        />
      </mesh>

      {slotPositions.map((pos, index) => (
        <group key={index} position={pos}>
          <mesh
            geometry={plateGeometry}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.035, 0]}
            renderOrder={6}
          >
            <meshStandardMaterial
              color={plateColor}
              transparent
              opacity={0.35}
              roughness={0.4}
              metalness={0.1}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          <mesh
            geometry={frameGeometry}
            position={[0, 0.02, 0]}
            renderOrder={7}
          >
            <meshStandardMaterial
              color={rimColor}
              transparent
              opacity={0.25}
              metalness={0.15}
              roughness={0.3}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          <lineSegments geometry={frameEdges} position={[0, 0.02, 0]} renderOrder={26}>
            <lineBasicMaterial
              color={lineColor}
              transparent
              opacity={0.85}
              depthTest={false}
              depthWrite={false}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  );
};

export default Bag;
