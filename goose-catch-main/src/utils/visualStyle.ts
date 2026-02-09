import * as THREE from 'three';
import type { VisualStyle } from '../stores/useGameStore';

type StyleOptions = {
  environment?: boolean;
};

const toonGradient = (() => {
  const data = new Uint8Array([
    24, 24, 24,
    86, 86, 86,
    168, 168, 168,
    255, 255, 255,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
})();

const cloneMaterial = (material: THREE.Material) => material.clone();

const toToonMaterial = (material: THREE.Material) => {
  const source = material as THREE.MeshStandardMaterial;
  const color = source.color ? source.color.clone() : new THREE.Color(0xffffff);
  const toon = new THREE.MeshToonMaterial({
    color,
    map: source.map ?? null,
    emissive: source.emissive ? source.emissive.clone() : new THREE.Color(0x000000),
    emissiveMap: source.emissiveMap ?? null,
  });
  toon.gradientMap = toonGradient;
  toon.side = source.side;
  toon.transparent = source.transparent;
  toon.opacity = source.opacity;
  toon.depthWrite = source.depthWrite;
  toon.depthTest = source.depthTest;
  return toon;
};

const mapMaterial = (material: THREE.Material, style: VisualStyle) =>
  style === 'toon' ? toToonMaterial(material) : cloneMaterial(material);

export const applyVisualStyle = <T extends THREE.Object3D>(
  root: T,
  style: VisualStyle,
  options: StyleOptions = {},
) => {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const sourceMaterial = child.material;
    if (Array.isArray(sourceMaterial)) {
      child.material = sourceMaterial.map((mat) => mapMaterial(mat, style));
    } else if (sourceMaterial) {
      child.material = mapMaterial(sourceMaterial, style);
    }

    if (options.environment) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = false;
        mat.depthTest = false;
      });
      child.renderOrder = -10;
      child.castShadow = false;
      child.receiveShadow = false;
      child.raycast = () => null;
    }
  });
  return root;
};

export const cloneWithStyle = <T extends THREE.Object3D>(
  root: T,
  style: VisualStyle,
  options: StyleOptions = {},
) => applyVisualStyle(root.clone(true), style, options);

type NormalizeOptions = {
  targetSize?: number;
  ground?: boolean;
};

export const normalizeObject = <T extends THREE.Object3D>(
  root: T,
  options: NormalizeOptions = {},
) => {
  const { targetSize, ground } = options;
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (targetSize && maxDim > 0) {
    const scale = targetSize / maxDim;
    root.scale.setScalar(scale);
  }
  if (ground) {
    const groundedBox = new THREE.Box3().setFromObject(root);
    if (Number.isFinite(groundedBox.min.y)) {
      root.position.y -= groundedBox.min.y;
    }
  }
  return root;
};
