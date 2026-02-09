import React, { useEffect, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, SSAO, Vignette } from '@react-three/postprocessing';
import { useGameStore } from './stores/useGameStore';
import Scene from './components/Scene';
import HUD from './components/HUD';

export default function App() {
  const { initFromUrl } = useGameStore();

  useEffect(() => {
    initFromUrl(window.location.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key.toLowerCase() === 'p') {
        useGameStore.getState().togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <HUD />
      <div className="stage">
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 9.2, 8.6], fov: 40 }}
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, 0.9, 0);
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <ambientLight intensity={0.6} color="#fff2ea" />
          <directionalLight
            position={[8, 12, 6]}
            intensity={1.25}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0004}
          />
          <directionalLight position={[-6, 6, -4]} intensity={0.55} color="#ffd6e7" />
          <pointLight position={[0, 6, 0]} intensity={0.35} color="#ffe0b6" />
          <Suspense fallback={null}>
            <Environment preset="sunset" />
            <Scene />
          </Suspense>
          <EffectComposer multisampling={0}>
            <SSAO samples={12} radius={0.35} intensity={18} />
            <Bloom intensity={0.35} luminanceThreshold={0.6} luminanceSmoothing={0.1} />
            <Vignette eskil={false} offset={0.1} darkness={0.6} />
          </EffectComposer>
        </Canvas>
      </div>
    </div>
  );
}
