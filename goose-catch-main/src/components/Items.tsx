import { useGameStore } from '../stores/useGameStore';
import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import * as THREE from 'three';
import Item from './Item';

import jpBowlUrl from '../assets/curated/japanese/items/bowl.glb?url';
import jpBowlSmallUrl from '../assets/curated/japanese/items/bowl_small.glb?url';
import jpPlateUrl from '../assets/curated/japanese/items/plate.glb?url';
import jpPlateSmallUrl from '../assets/curated/japanese/items/plate_small.glb?url';
import jpPotAUrl from '../assets/curated/japanese/items/pot_a.glb?url';
import jpPotBUrl from '../assets/curated/japanese/items/pot_b.glb?url';
import jpDinnerUrl from '../assets/curated/japanese/items/dinner.glb?url';

import cyberSodaUrl from '../assets/curated/cyber/items/soda.glb?url';
import cyberChipsUrl from '../assets/curated/cyber/items/chips.glb?url';
import cyberChocolateUrl from '../assets/curated/cyber/items/chocolate.glb?url';
import cyberDoughnutUrl from '../assets/curated/cyber/items/doughnut.glb?url';
import cyberCandyUrl from '../assets/curated/cyber/items/candy.glb?url';
import cyberKetchupUrl from '../assets/curated/cyber/items/ketchup.glb?url';
import cyberOnionUrl from '../assets/curated/cyber/items/onion.glb?url';

import arcadeCoinAUrl from '../assets/curated/arcade/items/coin_a.glb?url';
import arcadeCoinBUrl from '../assets/curated/arcade/items/coin_b.glb?url';
import arcadeCoinCUrl from '../assets/curated/arcade/items/coin_c.glb?url';
import arcadeCanAUrl from '../assets/curated/arcade/items/can_a.glb?url';
import arcadeCanBUrl from '../assets/curated/arcade/items/can_b.glb?url';
import arcadeBoxAUrl from '../assets/curated/arcade/items/box_a.glb?url';
import arcadeBoxBUrl from '../assets/curated/arcade/items/box_b.glb?url';

import magicBookStack1Url from '../assets/curated/magic/items/book_stack_1.glb?url';
import magicBookStack2Url from '../assets/curated/magic/items/book_stack_2.glb?url';
import magicPotion1Url from '../assets/curated/magic/items/potion_1.glb?url';
import magicPotion2Url from '../assets/curated/magic/items/potion_2.glb?url';
import magicCandleUrl from '../assets/curated/magic/items/candle.glb?url';
import magicCauldronUrl from '../assets/curated/magic/items/cauldron.glb?url';
import magicBookStandUrl from '../assets/curated/magic/items/book_stand.glb?url';

import spaceCrateUrl from '../assets/curated/space/items/crate.glb?url';
import spaceCrateLargeUrl from '../assets/curated/space/items/crate_large.glb?url';
import spaceCrateTarpUrl from '../assets/curated/space/items/crate_tarp.glb?url';
import spaceBarrelUrl from '../assets/curated/space/items/barrel.glb?url';
import spaceBarrelClosedUrl from '../assets/curated/space/items/barrel_closed.glb?url';
import spaceChestUrl from '../assets/curated/space/items/chest.glb?url';
import spaceKeyCardUrl from '../assets/curated/space/items/keycard.glb?url';

const ITEM_URLS = {
  japanese: [
    jpBowlUrl,
    jpBowlSmallUrl,
    jpPlateUrl,
    jpPlateSmallUrl,
    jpPotAUrl,
    jpPotBUrl,
    jpDinnerUrl,
  ],
  cyber: [
    cyberSodaUrl,
    cyberChipsUrl,
    cyberChocolateUrl,
    cyberDoughnutUrl,
    cyberCandyUrl,
    cyberKetchupUrl,
    cyberOnionUrl,
  ],
  arcade: [
    arcadeCoinAUrl,
    arcadeCoinBUrl,
    arcadeCoinCUrl,
    arcadeCanAUrl,
    arcadeCanBUrl,
    arcadeBoxAUrl,
    arcadeBoxBUrl,
  ],
  magic: [
    magicBookStack1Url,
    magicBookStack2Url,
    magicPotion1Url,
    magicPotion2Url,
    magicCandleUrl,
    magicCauldronUrl,
    magicBookStandUrl,
  ],
  space: [
    spaceCrateUrl,
    spaceCrateLargeUrl,
    spaceCrateTarpUrl,
    spaceBarrelUrl,
    spaceBarrelClosedUrl,
    spaceChestUrl,
    spaceKeyCardUrl,
  ],
} as const;

type SceneKey = keyof typeof ITEM_URLS;
type GltfAsset = GLTF;

type StackProfile = {
  centerX: number;
  centerZ: number;
  baseY: number;
  radius: number;
  jitter: number;
  heightSpacing: number;
  layerCapacity: number;
  xClamp: number;
  zClamp: [number, number];
};

const WORLD_TARGET_SIZE = 0.9;
const BAG_TARGET_SIZE = 0.55;

const STACK_PROFILE_BY_SCENE: Record<SceneKey, StackProfile> = {
  japanese: {
    centerX: 0,
    centerZ: -0.28,
    baseY: 1.06,
    radius: 1.95,
    jitter: 0.05,
    heightSpacing: 0.18,
    layerCapacity: 44,
    xClamp: 2.26,
    zClamp: [-2.22, 1.34],
  },
  cyber: {
    centerX: 0,
    centerZ: -0.32,
    baseY: 1.04,
    radius: 1.9,
    jitter: 0.05,
    heightSpacing: 0.18,
    layerCapacity: 44,
    xClamp: 2.24,
    zClamp: [-2.24, 1.32],
  },
  arcade: {
    centerX: 0,
    centerZ: -0.25,
    baseY: 1.06,
    radius: 2.0,
    jitter: 0.055,
    heightSpacing: 0.18,
    layerCapacity: 46,
    xClamp: 2.28,
    zClamp: [-2.2, 1.38],
  },
  magic: {
    centerX: 0,
    centerZ: -0.3,
    baseY: 1.03,
    radius: 1.92,
    jitter: 0.05,
    heightSpacing: 0.18,
    layerCapacity: 44,
    xClamp: 2.24,
    zClamp: [-2.24, 1.32],
  },
  space: {
    centerX: 0,
    centerZ: -0.28,
    baseY: 1.03,
    radius: 1.95,
    jitter: 0.05,
    heightSpacing: 0.18,
    layerCapacity: 44,
    xClamp: 2.24,
    zClamp: [-2.24, 1.34],
  },
};

const getScaleForTarget = (model: GLTF | undefined, target: number) => {
  if (!model?.scene) return 1;
  const box = new THREE.Box3().setFromObject(model.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  return target / maxDim;
};

const Items = () => {
  const phase = useGameStore((state) => state.gamePhase);
  const totalItems = useGameStore((state) => state.totalItems);
  const shuffleSeed = useGameStore((state) => state.shuffleSeed);
  const registerItemsMeta = useGameStore((state) => state.registerItemsMeta);
  const scene = useGameStore((state) => state.scene);

  const sceneKey = (scene in ITEM_URLS ? scene : 'japanese') as SceneKey;
  const itemUrls = ITEM_URLS[sceneKey];
  const models = useGLTF(itemUrls) as GltfAsset[];
  const itemTypes = itemUrls.length;

  useEffect(() => {
    Object.values(ITEM_URLS).forEach((urls) => {
      urls.forEach((url) => useGLTF.preload(url));
    });
  }, []);

  useEffect(() => {
    itemUrls.forEach((url) => useGLTF.preload(url));
  }, [itemUrls]);

  const modelScales = useMemo(
    () =>
      models.map((model) => ({
        world: getScaleForTarget(model, WORLD_TARGET_SIZE),
        bag: getScaleForTarget(model, BAG_TARGET_SIZE),
      })),
    [models],
  );

  const seededRandom = useMemo(() => {
    let seed = shuffleSeed || 1;
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, [shuffleSeed]);

  const items = useMemo(() => {
    const profile = STACK_PROFILE_BY_SCENE[sceneKey] ?? STACK_PROFILE_BY_SCENE.japanese;
    const density = Math.min(1, Math.max(0, (totalItems - 280) / 350));
    const layerCapacity = Math.max(38, Math.round(profile.layerCapacity + density * 8));
    const radius = profile.radius + density * 0.16;
    const jitter = profile.jitter + density * 0.02;
    const heightSpacing = profile.heightSpacing + density * 0.01;
    const centerX = profile.centerX;
    const centerZ = profile.centerZ;
    const baseY = profile.baseY;
    const [zMin, zMax] = profile.zClamp;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    const rnd = seededRandom;
    const typePool = Array.from({ length: totalItems }, (_, i) => i % itemTypes);

    for (let i = typePool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [typePool[i], typePool[j]] = [typePool[j], typePool[i]];
    }

    return Array.from({ length: totalItems }, (_, i) => {
      const stackLayer = Math.floor(i / layerCapacity);
      const withinLayer = i % layerCapacity;
      const t = (withinLayer + 0.5) / layerCapacity;
      const angle = withinLayer * GOLDEN_ANGLE + stackLayer * 0.42 + rnd() * 0.25;
      const ringRadius = Math.sqrt(t) * (radius + stackLayer * 0.035);
      const x = clamp(centerX + Math.cos(angle) * ringRadius + (rnd() - 0.5) * jitter, -profile.xClamp, profile.xClamp);
      const z = clamp(centerZ + Math.sin(angle) * ringRadius + (rnd() - 0.5) * jitter, zMin, zMax);
      const y = baseY + stackLayer * heightSpacing + (rnd() - 0.5) * jitter;
      return {
        id: i,
        pos: [x, y, z],
        delay: (i / Math.max(totalItems, 1)) * 1400,
        type: typePool[i],
      };
    });
  }, [sceneKey, totalItems, seededRandom, itemTypes]);

  useEffect(() => {
    registerItemsMeta(items.map((item) => ({ id: item.id, type: item.type })));
  }, [items, registerItemsMeta]);

  return (
    <>
      {phase === 'playing' || phase === 'paused' ? (
        <group>
          {items.map(({ id, pos, delay, type }, i) => (
            <Item
              id={id}
              key={i}
              type={type}
              position={pos as [number, number, number]}
              delay={delay}
              object={models[type]}
              scale={modelScales[type]?.world ?? 1}
              bagScale={modelScales[type]?.bag}
            />
          ))}
        </group>
      ) : null}
    </>
  );
};

export default Items;
