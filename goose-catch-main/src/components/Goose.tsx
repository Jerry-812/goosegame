import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../stores/useGameStore';
import { cloneWithStyle } from '../utils/visualStyle';
import gooseUrl from '../assets/goose.glb?url';

useGLTF.preload(gooseUrl);

const Goose = () => {
  const gamePhase = useGameStore((state) => state.gamePhase);
  const catchGoose = useGameStore((state) => state.catchGoose);
  const gooseCaptured = useGameStore((state) => state.gooseCaptured);
  const visualStyle = useGameStore((state) => state.visualStyle);
  const model = useGLTF(gooseUrl);

  const gooseScene = useMemo(() => {
    const cloned = cloneWithStyle(model.scene, visualStyle);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [model, visualStyle]);

  if (!(gamePhase === 'catch' || gooseCaptured)) {
    return null;
  }

  return (
    <group
      position={[0, 0.1, 1.2]}
      scale={1.4}
      onPointerDown={(e) => {
        e.stopPropagation();
        catchGoose();
      }}
    >
      <primitive object={gooseScene} />
    </group>
  );
};

export default Goose;
