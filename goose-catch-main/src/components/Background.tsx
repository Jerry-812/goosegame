import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../stores/useGameStore';

const Background = () => {
  const visualStyle = useGameStore((state) => state.visualStyle);
  const texture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const isToon = visualStyle === 'toon';
      const radial = ctx.createRadialGradient(
        size * 0.5,
        size * 0.35,
        size * 0.18,
        size * 0.5,
        size * 0.5,
        size * 0.8
      );
      if (isToon) {
        radial.addColorStop(0, '#fff3d8');
        radial.addColorStop(0.6, '#ffe4b8');
        radial.addColorStop(1, '#f4c98d');
      } else {
        radial.addColorStop(0, '#fff7f0');
        radial.addColorStop(0.6, '#f7efe9');
        radial.addColorStop(1, '#e8e0d7');
      }

      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);

      const vignette = ctx.createRadialGradient(
        size * 0.5,
        size * 0.5,
        size * 0.4,
        size * 0.5,
        size * 0.5,
        size * 0.9
      );
      vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
      vignette.addColorStop(1, isToon ? 'rgba(180, 120, 60, 0.35)' : 'rgba(210, 200, 190, 0.6)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, size, size);

      if (isToon) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#ffffff';
        const step = 46;
        for (let y = 0; y < size; y += step) {
          for (let x = 0; x < size; x += step) {
            ctx.beginPath();
            ctx.arc(x + (y % (step * 2) === 0 ? 6 : 20), y + 12, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [visualStyle]);

  return (
    <mesh
      position={[0, -1, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[30, 30, 1]}
      renderOrder={-100}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export default Background;
