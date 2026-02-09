import { create } from 'zustand';
import * as THREE from 'three';
import type React from 'react';

interface BagItem {
    id: number;
    type: number;
    meshRef: React.RefObject<THREE.Object3D | null>;

}

type SceneKey = 'japanese' | 'cyber' | 'arcade' | 'magic' | 'space';
export type VisualStyle = 'realistic' | 'toon';

export const MODE_ORDER = ['easy', 'normal', 'hard'] as const;
export type ModeKey = (typeof MODE_ORDER)[number];

type ToolConfig = {
    remove: number;
    hint: number;
    undo: number;
    ice: number;
    mix: number;
    mag: number;
};

type ModeConfig = {
    label: string;
    description: string;
    seconds: number;
    itemsPerType: number;
    bagCapacity: number;
    tools: ToolConfig;
};

export const ITEM_TYPES = 7;
const DEFAULT_MODE: ModeKey = 'normal';

export const MODES: Record<ModeKey, ModeConfig> = {
    easy: {
        label: '轻松',
        description: '更宽裕的时间与道具，适合新手',
        seconds: 600,
        itemsPerType: 40,
        bagCapacity: 6,
        tools: {
            remove: 3,
            hint: 3,
            undo: 3,
            ice: 2,
            mix: 2,
            mag: 2,
        },
    },
    normal: {
        label: '标准',
        description: '节奏适中，挑战与策略平衡',
        seconds: 600,
        itemsPerType: 60,
        bagCapacity: 6,
        tools: {
            remove: 2,
            hint: 2,
            undo: 2,
            ice: 2,
            mix: 2,
            mag: 2,
        },
    },
    hard: {
        label: '高手',
        description: '物品更多、时间更紧，需要精准操作',
        seconds: 600,
        itemsPerType: 90,
        bagCapacity: 6,
        tools: {
            remove: 1,
            hint: 1,
            undo: 1,
            ice: 1,
            mix: 1,
            mag: 1,
        },
    },
};

const buildModeState = (mode: ModeKey) => {
    const config = MODES[mode] ?? MODES[DEFAULT_MODE];
    const totalItems = config.itemsPerType * ITEM_TYPES;
    return {
        mode,
        time: config.seconds,
        totalItems,
        itemsLeft: totalItems,
        bagCapacity: config.bagCapacity,
        tools: { ...config.tools },
    };
};

interface GameState {
    gamePhase: 'ready' | 'playing' | 'paused' | 'gameover' | 'win' | 'catch';
    mode: ModeKey;
    visualStyle: VisualStyle;
    time: number;
    totalItems: number;
    itemsLeft: number;
    bagCapacity: number;
    bagItemsCount: number;
    bagItems: BagItem[];
    pickedIds: number[];
    removedIds: number[];
    bagTargets: Record<number, THREE.Vector3>;
    hintId: number | null;
    shuffleSeed: number;
    freezeUntil: number | null;
    gooseCaptured: boolean;
    tools: ToolConfig;
    notification: string | null;
    itemRefs: Record<number, React.RefObject<THREE.Object3D | null>>;
    worldItemRefs: Record<number, React.RefObject<THREE.Object3D | null>>;
    itemsMeta: { id: number; type: number }[];
    slotPositions: THREE.Vector3[];
    scene: SceneKey;
    sceneList: SceneKey[];
    start: () => void;
    end: () => void;
    win: () => void;
    lose: () => void;
    paused: () => void;
    resume: () => void;
    setMode: (mode: ModeKey) => void;
    setVisualStyle: (style: VisualStyle) => void;
    setScene: (scene: SceneKey) => void;
    notify: (message: string) => void;
    registerItemsMeta: (items: { id: number; type: number }[]) => void;
    registerItemRef: (id: number, ref: React.RefObject<THREE.Object3D | null>) => void;
    registerWorldItemRef: (id: number, ref: React.RefObject<THREE.Object3D | null>) => void;
    // getNextPosition: () => THREE.Vector3 | null;
    pickItem: (item: BagItem) => THREE.Vector3 | null;
    checkAndRemoveItems: () => boolean;
    catchGoose: () => void;
    undoTool: () => void;
    removeTool: () => void;
    hintTool: () => void;
    iceTool: () => void;
    mixTool: () => void;
    magTool: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    gamePhase: 'ready',
    ...buildModeState(DEFAULT_MODE),
    bagItemsCount: 0,
    bagItems: [],
    pickedIds: [],
    removedIds: [],
    bagTargets: {},
    hintId: null,
    shuffleSeed: 0,
    freezeUntil: null,
    gooseCaptured: false,
    notification: null,
    itemRefs: {},
    worldItemRefs: {},
    itemsMeta: [],
    visualStyle: 'realistic',
    scene: 'japanese',
    sceneList: ['japanese', 'cyber', 'arcade', 'magic', 'space'],
    slotPositions: [
        new THREE.Vector3(-2.25, 0.2, 3),
        new THREE.Vector3(-1.35, 0.2, 3),
        new THREE.Vector3(-0.45, 0.2, 3),
        new THREE.Vector3(0.45, 0.2, 3),
        new THREE.Vector3(1.35, 0.2, 3),
        new THREE.Vector3(2.25, 0.2, 3),
    ],

    setScene: (scene) => {
        const { gamePhase, sceneList } = get();
        if (gamePhase === 'playing' || gamePhase === 'paused' || gamePhase === 'catch') {
            get().notify('请在新一局开始前切换场景');
            return;
        }
        const safeScene = sceneList.includes(scene) ? scene : sceneList[0];
        set({ scene: safeScene });
    },
    setVisualStyle: (style) => {
        const { gamePhase } = get();
        if (gamePhase === 'playing' || gamePhase === 'paused' || gamePhase === 'catch') {
            get().notify('请在新一局开始前切换风格');
            return;
        }
        set({ visualStyle: style });
    },
    setMode: (mode) => {
        const safeMode = MODES[mode] ? mode : DEFAULT_MODE;
        const { gamePhase } = get();
        if (gamePhase === 'playing' || gamePhase === 'paused' || gamePhase === 'catch') {
            get().notify('请在新一局开始前切换难度');
            return;
        }
        set({
            ...buildModeState(safeMode),
            bagItemsCount: 0,
            bagItems: [],
            pickedIds: [],
            removedIds: [],
            bagTargets: {},
            hintId: null,
            freezeUntil: null,
            gooseCaptured: false,
            itemRefs: {},
            worldItemRefs: {},
            itemsMeta: [],
        });
    },
    notify: (message) => {
        set({ notification: message });
        setTimeout(() => {
            if (get().notification === message) {
                set({ notification: null });
            }
        }, 1500);
    },
    registerItemsMeta: (items) => set({ itemsMeta: items }),
    registerItemRef: (id, ref) =>
        set((state) => ({
            itemRefs: { ...state.itemRefs, [id]: ref },
        })),
    registerWorldItemRef: (id, ref) =>
        set((state) => ({
            worldItemRefs: { ...state.worldItemRefs, [id]: ref },
        })),
    start: () => {
        const { scene, mode } = get();
        const nextScene = scene;
        const baseState = buildModeState(mode);
        set({
            gamePhase: 'playing',
            ...baseState,
            bagItemsCount: 0,
            bagItems: [],
            pickedIds: [],
            removedIds: [],
            bagTargets: {},
            hintId: null,
            shuffleSeed: Math.floor(Math.random() * 10000),
            freezeUntil: null,
            gooseCaptured: false,
            scene: nextScene,
            itemRefs: {},
            worldItemRefs: {},
            itemsMeta: [],
        });
    },
    paused: () => set({ gamePhase: 'paused' }),
    resume: () => set({ gamePhase: 'playing' }),
    end: () =>
        set((state) => ({
            gamePhase: 'ready',
            ...buildModeState(state.mode),
            bagItemsCount: 0,
            bagItems: [],
            pickedIds: [],
            removedIds: [],
            bagTargets: {},
            hintId: null,
            freezeUntil: null,
            gooseCaptured: false,
            itemRefs: {},
            worldItemRefs: {},
            itemsMeta: [],
        })),
    win: () => set({ gamePhase: 'win' }),
    lose: () => set({ gamePhase: 'gameover' }),
    //向 bag 中添加 item 优先插入到已有type的后面
    // 
    //检查是否有三个同样type的item，如果有则移除它们并更新 bagItemsCount
    // 如果没有移除且容量已满则返回false，否则返回true
    checkAndRemoveItems: () => {
        const { bagItems } = get();
        const typeCount: { [key: number]: number[] } = {};
        bagItems.forEach((item, index) => {
            if (!typeCount[item.type]) {
                typeCount[item.type] = [];
            }
            typeCount[item.type].push(index);
        });

        let indicesToRemove: number[] = [];
        Object.values(typeCount).forEach((indices) => {
            if (indices.length >= 3) {
                indicesToRemove = indicesToRemove.concat(indices.slice(0, 3));
            }
        });

        let full = false;

        if (indicesToRemove.length > 0) {
            // 有需要移除的item，更新状态
            const idsToRemove = indicesToRemove.map((i) => bagItems[i].id);
            indicesToRemove.forEach(
                (i) => bagItems[i].meshRef.current && (bagItems[i].meshRef.current!.visible = false),
            );

            set((state) => {
                const newBagItems = state.bagItems.filter((_, index) => !indicesToRemove.includes(index));
                const newPickedIds = state.pickedIds.filter((id) => !idsToRemove.includes(id));
                const newRemovedIds = [...state.removedIds, ...idsToRemove];
                const newBagTargets = { ...state.bagTargets };
                idsToRemove.forEach((id) => {
                    delete newBagTargets[id];
                });
                const nextItemsLeft = Math.max(0, state.itemsLeft - idsToRemove.length);
                const nextPhase =
                    nextItemsLeft === 0 && newBagItems.length === 0 ? 'catch' : state.gamePhase;
                return {
                    bagItems: newBagItems,
                    bagItemsCount: newBagItems.length,
                    pickedIds: newPickedIds,
                    removedIds: newRemovedIds,
                    bagTargets: newBagTargets,
                    itemsLeft: nextItemsLeft,
                    gamePhase: nextPhase,
                };
            });
        } else if (bagItems.length >= get().bagCapacity) {
            full = true;
        }

        return !full;
    },

    //添加item并获取其位置
    pickItem: (item: BagItem) => {
        const { slotPositions, bagCapacity } = get();
        const { bagItems } = get();

        if (bagItems.length >= bagCapacity) return null;
        if (get().pickedIds.includes(item.id) || get().removedIds.includes(item.id)) return null;

        const existingTypeIndex = bagItems.findIndex(i => i.type === item.type);
        let newIndex = existingTypeIndex !== -1 ? existingTypeIndex + 1 : bagItems.length;
        const newPosition = slotPositions[newIndex] ?? slotPositions[slotPositions.length - 1];

        const newBagItems = [
            ...bagItems.slice(0, newIndex),
            item,
            ...bagItems.slice(newIndex),
        ];

        set({
            bagItems: newBagItems,
            bagItemsCount: newBagItems.length,
            pickedIds: [...get().pickedIds, item.id],
            bagTargets: {
                ...get().bagTargets,
                [item.id]: newPosition.clone(),
            },
        });

        const bagAvailable = get().checkAndRemoveItems();
        if (!bagAvailable) {
            get().lose();
        }
        return newPosition;

    },
    catchGoose: () => {
        if (get().gamePhase !== 'catch') return;
        set({ gooseCaptured: true, gamePhase: 'win' });
    },
    undoTool: () => {
        const { bagItems, tools, totalItems } = get();
        if (tools.undo <= 0) {
            get().notify('撤回道具不足');
            return;
        }
        if (!bagItems.length) {
            get().notify('栏里没有可撤回的物品');
            return;
        }
        const last = bagItems[bagItems.length - 1];
        set((state) => {
            const newBagItems = state.bagItems.slice(0, -1);
            const newPickedIds = state.pickedIds.filter((id) => id !== last.id);
            const newBagTargets = { ...state.bagTargets };
            delete newBagTargets[last.id];
            return {
                bagItems: newBagItems,
                bagItemsCount: newBagItems.length,
                pickedIds: newPickedIds,
                bagTargets: newBagTargets,
                itemsLeft: Math.min(totalItems, state.itemsLeft + 1),
                tools: { ...state.tools, undo: Math.max(0, state.tools.undo - 1) },
            };
        });
        get().notify(`已撤回一个${last.type}`);
    },
    removeTool: () => {
        const { bagItems, tools } = get();
        if (tools.remove <= 0) {
            get().notify('移出道具不足');
            return;
        }
        if (!bagItems.length) {
            get().notify('栏里没有可移出的物品');
            return;
        }
        const last = bagItems[bagItems.length - 1];
        set((state) => {
            const newBagItems = state.bagItems.slice(0, -1);
            const newBagTargets = { ...state.bagTargets };
            delete newBagTargets[last.id];
            const nextItemsLeft = Math.max(0, state.itemsLeft - 1);
            const nextPhase =
                nextItemsLeft === 0 && newBagItems.length === 0 ? 'catch' : state.gamePhase;
            return {
                bagItems: newBagItems,
                bagItemsCount: newBagItems.length,
                removedIds: [...state.removedIds, last.id],
                bagTargets: newBagTargets,
                itemsLeft: nextItemsLeft,
                gamePhase: nextPhase,
                tools: { ...state.tools, remove: Math.max(0, state.tools.remove - 1) },
            };
        });
        if (last.meshRef.current) last.meshRef.current.visible = false;
        get().notify('已移出一个物品');
    },
    hintTool: () => {
        const { tools, itemsMeta, pickedIds, removedIds } = get();
        if (tools.hint <= 0) {
            get().notify('提示道具不足');
            return;
        }
        const available = itemsMeta.filter(
            (item) => !pickedIds.includes(item.id) && !removedIds.includes(item.id),
        );
        if (!available.length) {
            get().notify('暂无可提示的物品');
            return;
        }
        const bagTypes = get().bagItems.map((item) => item.type);
        const preferred = available.filter((item) => bagTypes.includes(item.type));
        const pool = preferred.length ? preferred : available;
        const target = pool[Math.floor(Math.random() * pool.length)];
        set((state) => ({
            hintId: target.id,
            tools: { ...state.tools, hint: Math.max(0, state.tools.hint - 1) },
        }));
        setTimeout(() => {
            if (get().hintId === target.id) {
                set({ hintId: null });
            }
        }, 1500);
    },
    iceTool: () => {
        const { tools } = get();
        if (tools.ice <= 0) {
            get().notify('停时道具不足');
            return;
        }
        set((state) => ({
            freezeUntil: Date.now() + 5000,
            tools: { ...state.tools, ice: Math.max(0, state.tools.ice - 1) },
        }));
        get().notify('时间冻结 5 秒');
    },
    mixTool: () => {
        const { tools } = get();
        if (tools.mix <= 0) {
            get().notify('打乱道具不足');
            return;
        }
        set((state) => ({
            shuffleSeed: state.shuffleSeed + 1,
            tools: { ...state.tools, mix: Math.max(0, state.tools.mix - 1) },
        }));
        get().notify('已打乱');
    },
    magTool: () => {
        const { tools, bagItems, itemsMeta, pickedIds, removedIds, itemRefs } = get();
        if (tools.mag <= 0) {
            get().notify('凑齐道具不足');
            return;
        }
        if (!bagItems.length) {
            get().notify('暂无可凑齐的物品');
            return;
        }
        const typeCount: Record<number, number> = {};
        bagItems.forEach((item) => {
            typeCount[item.type] = (typeCount[item.type] ?? 0) + 1;
        });
        const targetType = Object.keys(typeCount)
            .map((key) => Number(key))
            .find((type) => typeCount[type] >= 2) ?? bagItems[0].type;
        const candidate = itemsMeta.find(
            (item) =>
                item.type === targetType &&
                !pickedIds.includes(item.id) &&
                !removedIds.includes(item.id),
        );
        if (!candidate) {
            get().notify('暂无可凑齐的物品');
            return;
        }
        set((state) => ({
            tools: { ...state.tools, mag: Math.max(0, state.tools.mag - 1) },
        }));
        get().pickItem({
            id: candidate.id,
            type: candidate.type,
            meshRef: itemRefs[candidate.id] ?? { current: null },
        });
    },
})
);
