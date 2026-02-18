import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../stores/useGameStore';

const COUNT = 140;
const ORIGIN = new THREE.Vector3(0, 1.1, 0);
const OFFSCREEN = 9999;

export default function MergeBurst() {
  const { mergePulse } = useGameStore();
  const geom = useMemo(() => new THREE.BufferGeometry(), []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  const colors = useMemo(() => new Float32Array(COUNT * 3), []);
  const velocities = useRef<Float32Array>(new Float32Array(COUNT * 3));
  const life = useRef<Float32Array>(new Float32Array(COUNT));
  const sprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => {
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [geom, positions, colors]);

  useEffect(() => {
    if (!mergePulse) return;
    const palette = ['#ff8fab', '#ffc6a8', '#ffeaa7', '#a0c4ff', '#b8f2e6', '#ffffff'];
    for (let i = 0; i < COUNT; i++) {
      const idx = i * 3;
      positions[idx] = ORIGIN.x;
      positions[idx + 1] = ORIGIN.y;
      positions[idx + 2] = ORIGIN.z;
      const theta = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 1.8;
      const rise = 1.2 + Math.random() * 1.6;
      velocities.current[idx] = Math.cos(theta) * speed;
      velocities.current[idx + 1] = rise;
      velocities.current[idx + 2] = Math.sin(theta) * speed;
      life.current[i] = 0.9 + Math.random() * 0.6;
      const color = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
  }, [mergePulse, geom, positions, colors]);

  useFrame((_, dt) => {
    let dirty = false;
    let active = 0;
    for (let i = 0; i < COUNT; i++) {
      if (life.current[i] <= 0) {
        const idx = i * 3;
        if (positions[idx] !== OFFSCREEN) {
          positions[idx] = OFFSCREEN;
          positions[idx + 1] = OFFSCREEN;
          positions[idx + 2] = OFFSCREEN;
          dirty = true;
        }
        continue;
      }
      const idx = i * 3;
      positions[idx] += velocities.current[idx] * dt;
      positions[idx + 1] += velocities.current[idx + 1] * dt;
      positions[idx + 2] += velocities.current[idx + 2] * dt;
      velocities.current[idx + 1] -= 2.2 * dt;
      velocities.current[idx] *= 0.98;
      velocities.current[idx + 2] *= 0.98;
      life.current[i] -= dt;
      active += 1;
      if (life.current[i] <= 0) {
        positions[idx] = OFFSCREEN;
        positions[idx + 1] = OFFSCREEN;
        positions[idx + 2] = OFFSCREEN;
        dirty = true;
      }
    }
    if (active > 0 || dirty) {
      geom.attributes.position.needsUpdate = true;
    }
  });

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: sprite ?? undefined,
        alphaTest: 0.3,
      }),
    [sprite]
  );

  return <points geometry={geom} material={material} />;
}
