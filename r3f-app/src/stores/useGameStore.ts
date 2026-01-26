import { create } from 'zustand';

export type Phase = 'ready' | 'playing' | 'paused' | 'win' | 'lose';

export type ItemType = number;

export interface ItemState {
  id: number;
  type: ItemType;
  pos: [number, number, number];
  picked: boolean;
  spawned: boolean;
  spawnOrder: number;
}

type ToolKey = 'remove' | 'match' | 'hint' | 'undo' | 'freeze' | 'shuffle';

interface GameState {
  phase: Phase;
  seed: number;
  mode: 'easy' | 'normal' | 'hard';
  timeLeftMs: number;
  score: number;
  bestScore: number;
  bagCapacity: number;
  bag: ItemState[];
  items: ItemState[];
  totalItems: number;
  tools: Record<ToolKey, number>;
  hintId: number | null;
  hintUntil: number;
  freezeUntil: number;
  mergePulse: number;
  mergeCombo: number;
  lastMergeAt: number;
  lastMergeAdd: number;
  spawnStartAt: number;
  spawnCursor: number;
  initFromUrl: (href: string) => void;
  start: () => void;
  tick: (dtMs: number) => void;
  togglePause: () => void;
  pick: (id: number) => void;
  undo: () => void;
  shuffle: () => void;
  setMode: (mode: 'easy' | 'normal' | 'hard') => void;
  reset: () => void;
  useToolRemove: () => void;
  useToolMatch: () => void;
  useToolHint: () => void;
  useToolFreeze: () => void;
  useToolShuffle: () => void;
  shareUrl: () => string;
}

const STORAGE_BEST = 'goosegameultimate.best';

function readInt(v: string | null, fallback: number) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeed() {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  } catch {
    return Math.floor(Math.random() * 2 ** 32) >>> 0;
  }
}

const MODES = {
  easy: { seconds: 180, itemsPerType: 10, cap: 7, layers: 5 },
  normal: { seconds: 240, itemsPerType: 14, cap: 7, layers: 6 },
  hard: { seconds: 240, itemsPerType: 18, cap: 6, layers: 7 },
} as const;

const TYPES = 8;
const COMBO_WINDOW = 1800;
const HINT_DURATION = 2400;
const FREEZE_DURATION = 6000;
const SPAWN_INTERVAL = 35;
const SPAWN_BURST = 30;
const TOOL_DEFAULTS: Record<ToolKey, number> = {
  remove: 2,
  match: 2,
  hint: 3,
  undo: 2,
  freeze: 2,
  shuffle: 1,
};

const BASE_Y = 0.12;
const LAYER_GAP = 0.24;
const SPREAD_BASE = 5.1;
const SPREAD_DECAY = 0.2;
const MIN_DIST_BASE = 0.82;

function findSpot(layerPoints: Array<[number, number]>, layer: number, rng: () => number) {
  const spread = SPREAD_BASE - layer * SPREAD_DECAY;
  const radius = Math.max(2.6, spread * 0.56);
  const minDist = MIN_DIST_BASE + layer * 0.035;
  const attempts = 48;
  let x = 0;
  let z = 0;
  for (let i = 0; i < attempts; i++) {
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    x = Math.cos(angle) * r;
    z = Math.sin(angle) * r;
    const bias = 0.92 - layer * 0.015;
    x *= bias;
    z *= bias;
    let ok = true;
    for (const [px, pz] of layerPoints) {
      const dx = x - px;
      const dz = z - pz;
      if (dx * dx + dz * dz < minDist * minDist) {
        ok = false;
        break;
      }
    }
    if (ok) break;
  }
  layerPoints.push([x, z]);
  const y = BASE_Y + layer * LAYER_GAP + (rng() - 0.5) * 0.05;
  return [x, y, z] as [number, number, number];
}

function generateItems(seed: number, mode: keyof typeof MODES): ItemState[] {
  const rng = mulberry32(seed);
  const { itemsPerType, layers } = MODES[mode];
  const items: ItemState[] = [];
  let id = 1;
  // Arrange items in a layered pile; higher layers are on top.
  const layerPoints: Array<Array<[number, number]>> = Array.from({ length: layers }, () => []);
  for (let l = 0; l < layers; l++) {
    const count = Math.floor((TYPES * itemsPerType) / layers);
    for (let i = 0; i < count; i++) {
      const type = Math.floor(rng() * TYPES);
      const pos = findSpot(layerPoints[l], l, rng);
      items.push({ id: id++, type, pos, picked: false, spawned: false, spawnOrder: 0 });
    }
  }
  // Ensure multiples of 3 for each type for solvability by balancing counts.
  const counts = new Array(TYPES).fill(0);
  items.forEach((it) => (counts[it.type] += 1));
  for (let t = 0; t < TYPES; t++) {
    const rem = counts[t] % 3;
    if (rem !== 0) {
      // Reassign a few random items to this type.
      const need = 3 - rem;
      for (let k = 0; k < need; k++) {
        const idx = Math.floor(rng() * items.length);
        counts[items[idx].type] -= 1;
        items[idx].type = t;
        counts[t] += 1;
      }
    }
  }
  const order = [...items].sort((a, b) => a.pos[1] - b.pos[1] + (rng() - 0.5) * 0.02);
  order.forEach((it, idx) => {
    it.spawnOrder = idx;
  });
  return items;
}

function scatterItems(items: ItemState[], layers: number, rng: () => number) {
  const next = items.map((it) => ({ ...it }));
  const layerPoints: Array<Array<[number, number]>> = Array.from({ length: layers }, () => []);
  const unpicked = next.filter((it) => !it.picked);
  let idx = 0;
  const perLayer = Math.ceil(unpicked.length / layers);
  for (let l = 0; l < layers; l++) {
    for (let i = 0; i < perLayer && idx < unpicked.length; i++) {
      const pos = findSpot(layerPoints[l], l, rng);
      unpicked[idx].pos = pos;
      idx += 1;
    }
  }
  return next;
}

function setUrlConfig(seed: number, mode: keyof typeof MODES) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('seed', String(seed >>> 0));
  window.history.replaceState({}, '', url);
}

function insertBagGrouped(bag: ItemState[], item: ItemState): ItemState[] {
  const firstSame = bag.findIndex((x) => x.type === item.type);
  const insertAt = firstSame === -1 ? bag.length : firstSame + 1;
  return [...bag.slice(0, insertAt), item, ...bag.slice(insertAt)];
}

function resolveTriples(bag: ItemState[]): { bag: ItemState[]; cleared: number } {
  const byType = new Map<number, number[]>();
  bag.forEach((it, idx) => {
    const arr = byType.get(it.type) ?? [];
    arr.push(idx);
    byType.set(it.type, arr);
  });
  const removeIdx = new Set<number>();
  for (const indices of byType.values()) {
    if (indices.length >= 3) {
      indices.slice(0, 3).forEach((i) => removeIdx.add(i));
    }
  }
  if (!removeIdx.size) return { bag, cleared: 0 };
  const next = bag.filter((_, idx) => !removeIdx.has(idx));
  return { bag: next, cleared: removeIdx.size };
}

function findTopmost(items: ItemState[], type?: number) {
  const candidates = items.filter((it) => it.spawned && !it.picked && (type == null || it.type === type));
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) => (cur.pos[1] > best.pos[1] ? cur : best));
}

function consumeTool(tools: Record<ToolKey, number>, key: ToolKey) {
  if (tools[key] <= 0) return null;
  return { ...tools, [key]: tools[key] - 1 };
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'ready',
  seed: 0,
  mode: 'easy',
  timeLeftMs: MODES.easy.seconds * 1000,
  score: 0,
  bestScore: readInt(localStorage.getItem(STORAGE_BEST), 0),
  bagCapacity: MODES.easy.cap,
  bag: [],
  items: [],
  totalItems: 0,
  tools: { ...TOOL_DEFAULTS },
  hintId: null,
  hintUntil: 0,
  freezeUntil: 0,
  mergePulse: 0,
  mergeCombo: 0,
  lastMergeAt: 0,
  lastMergeAdd: 0,
  spawnStartAt: 0,
  spawnCursor: 0,

  initFromUrl: (href) => {
    const url = new URL(href);
    const mode = (url.searchParams.get('mode') as any) || 'easy';
    const safeMode: any = MODES[mode as keyof typeof MODES] ? mode : 'easy';
    const seed = readInt(url.searchParams.get('seed'), 0) >>> 0;
    const actualSeed = seed || makeSeed();
    url.searchParams.set('mode', safeMode);
    url.searchParams.set('seed', String(actualSeed));
    window.history.replaceState({}, '', url);

    const items = generateItems(actualSeed, safeMode);
    set({
      seed: actualSeed,
      mode: safeMode,
      items,
      totalItems: items.length,
      bagCapacity: MODES[safeMode as keyof typeof MODES].cap,
      timeLeftMs: MODES[safeMode as keyof typeof MODES].seconds * 1000,
      score: 0,
      bag: [],
      tools: { ...TOOL_DEFAULTS },
      hintId: null,
      hintUntil: 0,
      freezeUntil: 0,
      mergePulse: 0,
      mergeCombo: 0,
      lastMergeAt: 0,
      lastMergeAdd: 0,
      spawnStartAt: 0,
      spawnCursor: 0,
      phase: 'ready',
    });
  },

  start: () => {
    const { seed, mode } = get();
    const items = generateItems(seed, mode);
    set({
      phase: 'playing',
      score: 0,
      bag: [],
      tools: { ...TOOL_DEFAULTS },
      hintId: null,
      hintUntil: 0,
      freezeUntil: 0,
      mergePulse: 0,
      mergeCombo: 0,
      lastMergeAt: 0,
      lastMergeAdd: 0,
      spawnStartAt: Date.now(),
      spawnCursor: 0,
      items,
      totalItems: items.length,
      timeLeftMs: MODES[mode].seconds * 1000,
    });
  },

  tick: (dtMs) => {
    const { phase, timeLeftMs, freezeUntil, hintUntil, spawnStartAt, spawnCursor, items } = get();
    if (phase !== 'playing') return;
    const now = Date.now();
    if (hintUntil && now > hintUntil) set({ hintId: null, hintUntil: 0 });
    if (freezeUntil && now < freezeUntil) return;
    const next = timeLeftMs - dtMs;
    if (next <= 0) {
      set({ phase: 'lose', timeLeftMs: 0 });
      return;
    }
    const updates: Partial<GameState> = { timeLeftMs: next };
    if (spawnStartAt > 0 && spawnCursor < items.length) {
      const elapsed = now - spawnStartAt;
      const target = Math.min(items.length, SPAWN_BURST + Math.floor(elapsed / SPAWN_INTERVAL));
      if (target > spawnCursor) {
        const nextItems = items.map((it) =>
          !it.spawned && it.spawnOrder < target ? { ...it, spawned: true } : it
        );
        updates.items = nextItems;
        updates.spawnCursor = target;
      }
    }
    set(updates);
  },

  togglePause: () => {
    const { phase } = get();
    if (phase === 'playing') set({ phase: 'paused' });
    else if (phase === 'paused') set({ phase: 'playing' });
  },

  pick: (id) => {
    const { phase, items, bag, bagCapacity, score, bestScore, mergeCombo, lastMergeAt, hintId, mergePulse } = get();
    if (phase !== 'playing') return;
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    const it = items[idx];
    if (it.picked) return;

    const nextBag = insertBagGrouped(bag, { ...it, picked: true });
    if (nextBag.length > bagCapacity) {
      set({ phase: 'lose' });
      return;
    }

    const { bag: resolved, cleared } = resolveTriples(nextBag);
    let nextScore = score;
    let nextCombo = mergeCombo;
    let lastMergeAdd = 0;
    if (cleared > 0) {
      const now = Date.now();
      const combo = now - lastMergeAt <= COMBO_WINDOW ? mergeCombo + 1 : 1;
      nextCombo = combo;
      const base = cleared * 10;
      const mult = 1 + Math.min(0.6, (combo - 1) * 0.15);
      lastMergeAdd = Math.round(base * mult);
      nextScore += lastMergeAdd;
    }
    const nextItems = items.map((x) => (x.id === id ? { ...x, picked: true } : x));
    const left = nextItems.filter((x) => !x.picked).length;
    let nextPhase: Phase = phase;
    if (left === 0) nextPhase = 'win';

    const nextBest = Math.max(bestScore, nextScore);
    if (nextBest !== bestScore) localStorage.setItem(STORAGE_BEST, String(nextBest));

    set({
      bag: resolved,
      score: nextScore,
      items: nextItems,
      phase: nextPhase,
      bestScore: nextBest,
      hintId: hintId === id ? null : hintId,
      hintUntil: hintId === id ? 0 : get().hintUntil,
      mergePulse: cleared > 0 ? mergePulse + 1 : mergePulse,
      mergeCombo: nextCombo,
      lastMergeAt: cleared > 0 ? Date.now() : lastMergeAt,
      lastMergeAdd,
    });
  },

  undo: () => {
    const { phase, bag, items, tools } = get();
    if (phase !== 'playing') return;
    if (!bag.length) return;
    const nextTools = consumeTool(tools, 'undo');
    if (!nextTools) return;
    const last = bag[bag.length - 1];
    const nextBag = bag.slice(0, -1);
    const nextItems = items.map((x) => (x.id === last.id ? { ...x, picked: false } : x));
    set({ bag: nextBag, items: nextItems, tools: nextTools });
  },

  shuffle: () => {
    const { phase, items, seed, mode } = get();
    if (phase !== 'playing') return;
    // Keep picked items, reshuffle positions for remaining items for a fresh look.
    const rng = mulberry32(seed ^ 0x9e3779b9);
    const { layers } = MODES[mode];
    const next = scatterItems(items, layers, rng);
    set({ items: next });
  },

  shareUrl: () => {
    const { seed, mode } = get();
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed >>> 0));
    url.searchParams.set('mode', mode);
    return url.toString();
  },

  setMode: (mode) => {
    const safeMode: keyof typeof MODES = MODES[mode] ? mode : 'easy';
    const { seed } = get();
    const items = generateItems(seed, safeMode);
    setUrlConfig(seed, safeMode);
    set({
      mode: safeMode,
      items,
      totalItems: items.length,
      bagCapacity: MODES[safeMode].cap,
      timeLeftMs: MODES[safeMode].seconds * 1000,
      score: 0,
      bag: [],
      tools: { ...TOOL_DEFAULTS },
      hintId: null,
      hintUntil: 0,
      freezeUntil: 0,
      mergePulse: 0,
      mergeCombo: 0,
      lastMergeAt: 0,
      lastMergeAdd: 0,
      spawnStartAt: 0,
      spawnCursor: 0,
      phase: 'ready',
    });
  },

  reset: () => {
    const { mode } = get();
    const seed = makeSeed();
    const items = generateItems(seed, mode);
    setUrlConfig(seed, mode);
    set({
      seed,
      items,
      totalItems: items.length,
      bagCapacity: MODES[mode].cap,
      timeLeftMs: MODES[mode].seconds * 1000,
      score: 0,
      bag: [],
      tools: { ...TOOL_DEFAULTS },
      hintId: null,
      hintUntil: 0,
      freezeUntil: 0,
      mergePulse: 0,
      mergeCombo: 0,
      lastMergeAt: 0,
      lastMergeAdd: 0,
      spawnStartAt: 0,
      spawnCursor: 0,
      phase: 'ready',
    });
  },

  useToolRemove: () => {
    const { phase, bag, tools } = get();
    if (phase !== 'playing') return;
    if (!bag.length) return;
    const nextTools = consumeTool(tools, 'remove');
    if (!nextTools) return;
    const nextBag = bag.slice(0, -1);
    set({ bag: nextBag, tools: nextTools });
  },

  useToolMatch: () => {
    const { phase, bag, tools, items } = get();
    if (phase !== 'playing') return;
    const counts = new Map<number, number>();
    bag.forEach((b) => counts.set(b.type, (counts.get(b.type) || 0) + 1));
    const target = [...counts.entries()].find(([, count]) => count >= 2);
    if (!target) return;
    const nextTools = consumeTool(tools, 'match');
    if (!nextTools) return;
    const candidate = findTopmost(items, target[0]);
    if (!candidate) return;
    const now = Date.now();
    set({ tools: nextTools, hintId: candidate.id, hintUntil: now + 900 });
    get().pick(candidate.id);
  },

  useToolHint: () => {
    const { phase, tools, items } = get();
    if (phase !== 'playing') return;
    const nextTools = consumeTool(tools, 'hint');
    if (!nextTools) return;
    const candidate = findTopmost(items);
    if (!candidate) return;
    const now = Date.now();
    set({
      tools: nextTools,
      hintId: candidate.id,
      hintUntil: now + HINT_DURATION,
    });
  },

  useToolFreeze: () => {
    const { phase, tools, freezeUntil } = get();
    if (phase !== 'playing') return;
    const nextTools = consumeTool(tools, 'freeze');
    if (!nextTools) return;
    const now = Date.now();
    const nextUntil = Math.max(freezeUntil, now) + FREEZE_DURATION;
    set({ tools: nextTools, freezeUntil: nextUntil });
  },

  useToolShuffle: () => {
    const { phase, tools } = get();
    if (phase !== 'playing') return;
    const nextTools = consumeTool(tools, 'shuffle');
    if (!nextTools) return;
    set({ tools: nextTools });
    get().shuffle();
  },
}));
