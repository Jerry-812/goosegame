import { useMemo } from 'react';
import * as THREE from 'three';

const Background = () => {
  const texture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const radial = ctx.createRadialGradient(
        size * 0.5,
        size * 0.35,
        size * 0.2,
        size * 0.5,
        size * 0.5,
        size * 0.75
      );
      radial.addColorStop(0, '#fff7f0');
      radial.addColorStop(0.6, '#f7efe9');
      radial.addColorStop(1, '#e8e0d7');

      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, size, size);

      const vignette = ctx.createRadialGradient(
        size * 0.5,
        size * 0.5,
        size * 0.4,
        size * 0.5,
        size * 0.5,
        size * 0.85
      );
      vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
      vignette.addColorStop(1, 'rgba(210, 200, 190, 0.6)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, size, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

export default Background;
