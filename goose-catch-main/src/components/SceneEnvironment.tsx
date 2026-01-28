import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../stores/useGameStore';

import floorTilesUrl from '../assets/scenes/sushi-kit/Floor_Tiles.gltf?url';
import floorWoodUrl from '../assets/scenes/sushi-kit/Floor_Wood.gltf?url';
import wallNormalUrl from '../assets/scenes/sushi-kit/Wall_Normal.gltf?url';
import wallShelvesUrl from '../assets/scenes/sushi-kit/Wall_Shelves.gltf?url';
import wallShojiUrl from '../assets/scenes/sushi-kit/Wall_Shoji.gltf?url';
import tableUrl from '../assets/scenes/sushi-kit/Environment_Table.gltf?url';
import stoolUrl from '../assets/scenes/sushi-kit/Environment_Stool.gltf?url';
import potUrl from '../assets/scenes/sushi-kit/Environment_Pot_2_Filled.gltf?url';
import canFridgeUrl from '../assets/scenes/sushi-kit/Environment_CanFridge.gltf?url';
import counterStraightUrl from '../assets/scenes/sushi-kit/Environment_Counter_Straight.gltf?url';
import counterCornerUrl from '../assets/scenes/sushi-kit/Environment_Counter_Corner.gltf?url';
import signUrl from '../assets/scenes/sushi-kit/Decoration_Sign.gltf?url';
import plantUrl from '../assets/scenes/sushi-kit/Decoration_Plant1.gltf?url';
import lightUrl from '../assets/scenes/sushi-kit/Decoration_Light.gltf?url';
import bambooUrl from '../assets/scenes/sushi-kit/Decoration_Bamboo.gltf?url';

const MARKET_SCENE_URL = '/scenes/market/market-scene.gltf';

useGLTF.preload(floorTilesUrl);
useGLTF.preload(floorWoodUrl);
useGLTF.preload(wallNormalUrl);
useGLTF.preload(wallShelvesUrl);
useGLTF.preload(wallShojiUrl);
useGLTF.preload(tableUrl);
useGLTF.preload(stoolUrl);
useGLTF.preload(potUrl);
useGLTF.preload(canFridgeUrl);
useGLTF.preload(counterStraightUrl);
useGLTF.preload(counterCornerUrl);
useGLTF.preload(signUrl);
useGLTF.preload(plantUrl);
useGLTF.preload(lightUrl);
useGLTF.preload(bambooUrl);
useGLTF.preload(MARKET_SCENE_URL);

const cloneScene = (scene: THREE.Object3D) => scene.clone(true);

const SceneEnvironment = () => {
  const scene = useGameStore((state) => state.scene);

  const models = {
    floorTiles: useGLTF(floorTilesUrl),
    floorWood: useGLTF(floorWoodUrl),
    wallNormal: useGLTF(wallNormalUrl),
    wallShelves: useGLTF(wallShelvesUrl),
    wallShoji: useGLTF(wallShojiUrl),
    table: useGLTF(tableUrl),
    stool: useGLTF(stoolUrl),
    pot: useGLTF(potUrl),
    canFridge: useGLTF(canFridgeUrl),
    counterStraight: useGLTF(counterStraightUrl),
    counterCorner: useGLTF(counterCornerUrl),
    sign: useGLTF(signUrl),
    plant: useGLTF(plantUrl),
    light: useGLTF(lightUrl),
    bamboo: useGLTF(bambooUrl),
    marketScene: useGLTF(MARKET_SCENE_URL),
  };

  type LayoutItem = {
    model: THREE.Object3D;
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
  };

  const layouts = useMemo(() => {
    return {
      market: [
        { model: models.marketScene.scene, position: [0, -1.4, -1.5], rotation: [0, Math.PI, 0], scale: 2.2 },
      ],
      convenience: [
        { model: models.floorTiles.scene, position: [0, -0.7, 0], scale: 10 },
        { model: models.wallShelves.scene, position: [0, 0.4, -4.4], rotation: [0, Math.PI, 0], scale: 2.2 },
        { model: models.counterStraight.scene, position: [-1.8, -0.2, -1.6], rotation: [0, Math.PI / 2, 0], scale: 1.6 },
        { model: models.counterCorner.scene, position: [1.8, -0.2, -1.6], rotation: [0, Math.PI, 0], scale: 1.6 },
        { model: models.canFridge.scene, position: [3.4, -0.1, -2.8], rotation: [0, -Math.PI / 2, 0], scale: 1.2 },
        { model: models.sign.scene, position: [-3.2, 0.7, -3.6], scale: 1.2 },
        { model: models.light.scene, position: [0, 2.4, -2.5], scale: 1.4 },
      ],
      hotpot: [
        { model: models.floorWood.scene, position: [0, -0.7, 0], scale: 10 },
        { model: models.wallShoji.scene, position: [0, 0.6, -4.4], rotation: [0, Math.PI, 0], scale: 2.3 },
        { model: models.wallNormal.scene, position: [0, 0.6, -5.8], rotation: [0, Math.PI, 0], scale: 2.3 },
        { model: models.table.scene, position: [0, -0.2, -1.8], scale: 1.7 },
        { model: models.stool.scene, position: [-1.4, -0.2, -1.3], scale: 1.3 },
        { model: models.stool.scene, position: [1.4, -0.2, -1.3], scale: 1.3 },
        { model: models.pot.scene, position: [0, 0.5, -1.8], scale: 1.2 },
        { model: models.light.scene, position: [0, 2.6, -2.8], scale: 1.6 },
        { model: models.plant.scene, position: [-3.4, 0, -3.4], scale: 1.5 },
      ],
    } satisfies Record<string, LayoutItem[]>;
  }, [models]);

  const layout = layouts[scene];

  return (
    <group name="scene-environment">
      {layout.map((item, index) => (
        <primitive
          key={`${scene}-${index}`}
          object={cloneScene(item.model)}
          position={item.position}
          rotation={item.rotation ?? [0, 0, 0]}
          scale={item.scale ?? 1}
        />
      ))}
    </group>
  );
};

export default SceneEnvironment;
