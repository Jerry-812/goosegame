import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../stores/useGameStore';
import { cloneWithStyle } from '../utils/visualStyle';
import type { VisualStyle } from '../stores/useGameStore';

import jpFloorUrl from '../assets/curated/japanese/env/floor.glb?url';
import jpWallUrl from '../assets/curated/japanese/env/wall.glb?url';
import jpWallWindowUrl from '../assets/curated/japanese/env/wall_window.glb?url';
import jpCounterUrl from '../assets/curated/japanese/env/counter.glb?url';
import jpCounterCornerUrl from '../assets/curated/japanese/env/counter_corner.glb?url';
import jpTableUrl from '../assets/curated/japanese/env/table.glb?url';
import jpStoolUrl from '../assets/curated/japanese/env/stool.glb?url';

import protoFloorUrl from '../assets/curated/arcade/env/floor.glb?url';
import protoWallLargeUrl from '../assets/curated/arcade/env/wall_back.glb?url';
import protoWallLargeBUrl from '../assets/curated/arcade/env/wall_side.glb?url';

import sciFloorUrl from '../assets/curated/cyber/env/floor.glb?url';
import sciWallAccentUrl from '../assets/curated/cyber/env/wall.glb?url';
import sciWallAccentCornerUrl from '../assets/curated/cyber/env/wall_corner.glb?url';
import sciWallBandUrl from '../assets/curated/space/env/wall.glb?url';
import spaceFloorUrl from '../assets/curated/space/env/floor.glb?url';

import propShelfTallUrl from '../assets/curated/cyber/env/shelf_tall.glb?url';
import propShelfShortUrl from '../assets/curated/cyber/env/shelf_short.glb?url';
import propDeskMediumUrl from '../assets/curated/cyber/env/desk.glb?url';
import propDeskLargeUrl from '../assets/curated/arcade/env/desk_large.glb?url';
import propDeskSmallUrl from '../assets/curated/arcade/env/desk_small.glb?url';
import spaceDeskSmallUrl from '../assets/curated/space/env/desk_small.glb?url';
import propChairUrl from '../assets/curated/arcade/env/chair.glb?url';
import propCrateUrl from '../assets/curated/cyber/env/crate.glb?url';
import propCrateLargeUrl from '../assets/curated/space/env/crate_large.glb?url';
import propCrateTarpUrl from '../assets/curated/space/env/crate_tarp.glb?url';
import propBarrelUrl from '../assets/curated/cyber/env/barrel.glb?url';
import propBarrelClosedUrl from '../assets/curated/space/env/barrel.glb?url';
import propChestUrl from '../assets/curated/space/env/chest.glb?url';

import magicBookcaseUrl from '../assets/curated/magic/env/bookcase.glb?url';
import magicShelfUrl from '../assets/curated/magic/env/shelf.glb?url';
import magicShelfArchUrl from '../assets/curated/magic/env/shelf_arch.glb?url';
import magicTableUrl from '../assets/curated/magic/env/table.glb?url';
import magicChairUrl from '../assets/curated/magic/env/chair.glb?url';
import magicCandleUrl from '../assets/curated/magic/env/candle.glb?url';

useGLTF.preload(jpFloorUrl);
useGLTF.preload(jpWallUrl);
useGLTF.preload(jpWallWindowUrl);
useGLTF.preload(jpCounterUrl);
useGLTF.preload(jpCounterCornerUrl);
useGLTF.preload(jpTableUrl);
useGLTF.preload(jpStoolUrl);

useGLTF.preload(protoFloorUrl);
useGLTF.preload(protoWallLargeUrl);
useGLTF.preload(protoWallLargeBUrl);

useGLTF.preload(sciFloorUrl);
useGLTF.preload(sciWallAccentUrl);
useGLTF.preload(sciWallAccentCornerUrl);
useGLTF.preload(sciWallBandUrl);
useGLTF.preload(spaceFloorUrl);

useGLTF.preload(propShelfTallUrl);
useGLTF.preload(propShelfShortUrl);
useGLTF.preload(propDeskMediumUrl);
useGLTF.preload(propDeskLargeUrl);
useGLTF.preload(propDeskSmallUrl);
useGLTF.preload(spaceDeskSmallUrl);
useGLTF.preload(propChairUrl);
useGLTF.preload(propCrateUrl);
useGLTF.preload(propCrateLargeUrl);
useGLTF.preload(propCrateTarpUrl);
useGLTF.preload(propBarrelUrl);
useGLTF.preload(propBarrelClosedUrl);
useGLTF.preload(propChestUrl);

useGLTF.preload(magicBookcaseUrl);
useGLTF.preload(magicShelfUrl);
useGLTF.preload(magicShelfArchUrl);
useGLTF.preload(magicTableUrl);
useGLTF.preload(magicChairUrl);
useGLTF.preload(magicCandleUrl);

type LayoutItem = {
  model: THREE.Object3D;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
};

const cloneScene = (scene: THREE.Object3D, style: VisualStyle) => {
  const cloned = cloneWithStyle(scene, style);
  cloned.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.frustumCulled = false;
      child.castShadow = false;
      child.receiveShadow = true;
      child.raycast = () => null;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (mat) {
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        }
      });
    }
  });
  return cloned;
};

const LayoutGroup = ({
  sceneKey,
  layout,
  style,
}: {
  sceneKey: string;
  layout: LayoutItem[];
  style: VisualStyle;
}) => {
  const styledLayout = useMemo(
    () =>
      layout.map((item) => ({
        ...item,
        styledModel: cloneScene(item.model, style),
      })),
    [layout, style],
  );

  return (
    <group name={`${sceneKey}-environment`}>
      {styledLayout.map((item, index) => (
        <primitive
          key={`${sceneKey}-${index}`}
          object={item.styledModel}
          position={item.position}
          rotation={item.rotation ?? [0, 0, 0]}
          scale={item.scale ?? 1}
        />
      ))}
    </group>
  );
};

const JapaneseEnvironment = ({ style }: { style: VisualStyle }) => {
  const floor = useGLTF(jpFloorUrl);
  const wall = useGLTF(jpWallUrl);
  const wallWindow = useGLTF(jpWallWindowUrl);
  const counter = useGLTF(jpCounterUrl);
  const counterCorner = useGLTF(jpCounterCornerUrl);
  const table = useGLTF(jpTableUrl);
  const stool = useGLTF(jpStoolUrl);

  const layout = useMemo(
    () =>
      [
        { model: floor.scene, position: [0, -0.7, 0], scale: 7 },
        { model: wall.scene, position: [0, 0.5, -3.6], scale: 2.6 },
        { model: wallWindow.scene, position: [2.6, 0.5, -3.6], scale: 2.4 },
        { model: counter.scene, position: [-1.6, -0.2, -1.4], rotation: [0, Math.PI / 2, 0], scale: 1.4 },
        { model: counterCorner.scene, position: [1.2, -0.2, -1.4], rotation: [0, Math.PI, 0], scale: 1.4 },
        { model: table.scene, position: [0, -0.15, -0.2], scale: 1.4 },
        { model: stool.scene, position: [-1.2, -0.2, 0.4], scale: 1.2 },
        { model: stool.scene, position: [1.2, -0.2, 0.4], scale: 1.2 },
      ] as LayoutItem[],
    [floor, wall, wallWindow, counter, counterCorner, table, stool],
  );

  return <LayoutGroup sceneKey="japanese" layout={layout} style={style} />;
};

const CyberEnvironment = ({ style }: { style: VisualStyle }) => {
  const floor = useGLTF(spaceFloorUrl);
  const wall = useGLTF(sciWallAccentUrl);
  const wallCorner = useGLTF(sciWallAccentCornerUrl);
  const shelfTall = useGLTF(propShelfTallUrl);
  const shelfShort = useGLTF(propShelfShortUrl);
  const desk = useGLTF(propDeskMediumUrl);
  const crate = useGLTF(propCrateUrl);
  const barrel = useGLTF(propBarrelUrl);

  const layout = useMemo(
    () =>
      [
        { model: floor.scene, position: [0, -0.8, 0], scale: 6.4 },
        { model: wall.scene, position: [0, 0.4, -3.5], rotation: [0, Math.PI, 0], scale: 2.2 },
        { model: wallCorner.scene, position: [-2.8, 0.4, -3.5], rotation: [0, Math.PI / 2, 0], scale: 2.2 },
        { model: wallCorner.scene, position: [2.8, 0.4, -3.5], rotation: [0, -Math.PI / 2, 0], scale: 2.2 },
        { model: shelfTall.scene, position: [-2.2, -0.2, -2.1], rotation: [0, Math.PI / 2, 0], scale: 1.4 },
        { model: shelfShort.scene, position: [2.2, -0.2, -2.1], rotation: [0, -Math.PI / 2, 0], scale: 1.4 },
        { model: desk.scene, position: [0, -0.3, -1.8], rotation: [0, Math.PI, 0], scale: 1.3 },
        { model: crate.scene, position: [-0.8, -0.3, -0.6], scale: 1.1 },
        { model: barrel.scene, position: [1.0, -0.3, -0.4], scale: 1.1 },
      ] as LayoutItem[],
    [floor, wall, wallCorner, shelfTall, shelfShort, desk, crate, barrel],
  );

  return <LayoutGroup sceneKey="cyber" layout={layout} style={style} />;
};

const ArcadeEnvironment = ({ style }: { style: VisualStyle }) => {
  const floor = useGLTF(protoFloorUrl);
  const wallA = useGLTF(protoWallLargeUrl);
  const wallB = useGLTF(protoWallLargeBUrl);
  const deskLarge = useGLTF(propDeskLargeUrl);
  const deskSmall = useGLTF(spaceDeskSmallUrl);
  const chair = useGLTF(propChairUrl);

  const layout = useMemo(
    () =>
      [
        { model: floor.scene, position: [0, -0.8, 0], scale: 6.8 },
        { model: wallA.scene, position: [0, 0.1, -3.6], rotation: [0, Math.PI, 0], scale: 2.2 },
        { model: wallB.scene, position: [-2.8, 0.1, -2.2], rotation: [0, Math.PI / 2, 0], scale: 2.2 },
        { model: wallB.scene, position: [2.8, 0.1, -2.2], rotation: [0, -Math.PI / 2, 0], scale: 2.2 },
        { model: deskLarge.scene, position: [-1.6, -0.25, -1.2], rotation: [0, Math.PI / 2, 0], scale: 1.2 },
        { model: deskLarge.scene, position: [1.6, -0.25, -1.2], rotation: [0, -Math.PI / 2, 0], scale: 1.2 },
        { model: deskSmall.scene, position: [0, -0.3, -2.0], rotation: [0, Math.PI, 0], scale: 1.1 },
        { model: chair.scene, position: [0, -0.25, 0.2], rotation: [0, Math.PI, 0], scale: 1.2 },
      ] as LayoutItem[],
    [floor, wallA, wallB, deskLarge, deskSmall, chair],
  );

  return <LayoutGroup sceneKey="arcade" layout={layout} style={style} />;
};

const MagicEnvironment = ({ style }: { style: VisualStyle }) => {
  const floor = useGLTF(protoFloorUrl);
  const wall = useGLTF(protoWallLargeUrl);
  const bookcase = useGLTF(magicBookcaseUrl);
  const shelf = useGLTF(magicShelfUrl);
  const shelfArch = useGLTF(magicShelfArchUrl);
  const table = useGLTF(magicTableUrl);
  const chair = useGLTF(magicChairUrl);
  const candle = useGLTF(magicCandleUrl);

  const layout = useMemo(
    () =>
      [
        { model: floor.scene, position: [0, -0.8, 0], scale: 6.6 },
        { model: wall.scene, position: [0, 0.1, -3.5], rotation: [0, Math.PI, 0], scale: 2.2 },
        { model: bookcase.scene, position: [-2.2, -0.2, -2.6], rotation: [0, Math.PI / 2, 0], scale: 1.5 },
        { model: shelf.scene, position: [2.2, -0.2, -2.4], rotation: [0, -Math.PI / 2, 0], scale: 1.5 },
        { model: shelfArch.scene, position: [0, -0.2, -2.8], rotation: [0, Math.PI, 0], scale: 1.4 },
        { model: table.scene, position: [0, -0.3, -0.4], scale: 1.3 },
        { model: chair.scene, position: [0, -0.25, 0.6], rotation: [0, Math.PI, 0], scale: 1.2 },
        { model: candle.scene, position: [-0.6, 0.2, -0.2], scale: 1.0 },
      ] as LayoutItem[],
    [floor, wall, bookcase, shelf, shelfArch, table, chair, candle],
  );

  return <LayoutGroup sceneKey="magic" layout={layout} style={style} />;
};

const SpaceEnvironment = ({ style }: { style: VisualStyle }) => {
  const floor = useGLTF(sciFloorUrl);
  const wall = useGLTF(sciWallBandUrl);
  const crateLarge = useGLTF(propCrateLargeUrl);
  const crateTarp = useGLTF(propCrateTarpUrl);
  const barrel = useGLTF(propBarrelClosedUrl);
  const chest = useGLTF(propChestUrl);
  const deskSmall = useGLTF(propDeskSmallUrl);

  const layout = useMemo(
    () =>
      [
        { model: floor.scene, position: [0, -0.8, 0], scale: 6.6 },
        { model: wall.scene, position: [0, 0.4, -3.6], rotation: [0, Math.PI, 0], scale: 2.2 },
        { model: crateLarge.scene, position: [-1.4, -0.3, -0.8], scale: 1.3 },
        { model: crateTarp.scene, position: [1.4, -0.3, -0.8], scale: 1.3 },
        { model: barrel.scene, position: [0, -0.3, -0.2], scale: 1.2 },
        { model: chest.scene, position: [-0.6, -0.3, 0.8], rotation: [0, Math.PI / 2, 0], scale: 1.1 },
        { model: deskSmall.scene, position: [1.2, -0.3, 0.6], rotation: [0, Math.PI / 2, 0], scale: 1.2 },
      ] as LayoutItem[],
    [floor, wall, crateLarge, crateTarp, barrel, chest, deskSmall],
  );

  return <LayoutGroup sceneKey="space" layout={layout} style={style} />;
};

const SCENE_COMPONENTS = {
  japanese: JapaneseEnvironment,
  cyber: CyberEnvironment,
  arcade: ArcadeEnvironment,
  magic: MagicEnvironment,
  space: SpaceEnvironment,
} as const;

const SceneEnvironment = () => {
  const scene = useGameStore((state) => state.scene);
  const visualStyle = useGameStore((state) => state.visualStyle);
  const SceneComponent = SCENE_COMPONENTS[scene] ?? SCENE_COMPONENTS.japanese;

  return <SceneComponent style={visualStyle} />;
};

export default SceneEnvironment;
