// import { Perf } from 'r3f-perf'
import { Canvas, } from '@react-three/fiber'
// import { OrbitControls } from '@react-three/drei'
import Experience from './Experience'
import { Loader, useProgress } from '@react-three/drei'
import { MODES, useGameStore } from './stores/useGameStore'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { Pause, Play } from 'lucide-react'
import UI from './components/UI'
import CountDown from './components/CountDown'

declare global {
  interface Window {
    render_game_to_text?: () => string
    advanceTime?: (ms: number) => Promise<void>
  }
}

function App() {

  const pauseGame = useGameStore((state) => state.paused);
  const resumeGame = useGameStore((state) => state.resume);
  const lose = useGameStore((state) => state.lose);
  const gamePhase = useGameStore((state) => state.gamePhase);
  const itemsLeft = useGameStore((state) => state.itemsLeft);
  const bagItemsCount = useGameStore((state) => state.bagItemsCount);
  const bagCapacity = useGameStore((state) => state.bagCapacity);
  const mode = useGameStore((state) => state.mode);
  const scene = useGameStore((state) => state.scene);
  const visualStyle = useGameStore((state) => state.visualStyle);
  const { progress } = useProgress();

  const showPauseButton = gamePhase === 'playing' || gamePhase === 'paused';
  const showCountDown = gamePhase === 'playing' || gamePhase === 'paused' || gamePhase === 'catch';
  const showIndicator = gamePhase !== 'ready' && gamePhase !== 'win' && gamePhase !== 'gameover';

  useEffect(() => {
    window.advanceTime = async (ms) => {
      const frameMs = 1000 / 60;
      const frames = Math.max(1, Math.round(ms / frameMs));
      for (let i = 0; i < frames; i += 1) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
    };

    window.render_game_to_text = () => {
      const state = useGameStore.getState();
      const typeLookup = new Map(state.itemsMeta.map((item) => [item.id, item.type]));
      const visibleWorldItems: Array<{ id: number; type: number; x: number; y: number; z: number }> = [];
      const worldRefs = Object.keys(state.worldItemRefs).length ? state.worldItemRefs : state.itemRefs;

      for (const [idKey, ref] of Object.entries(worldRefs)) {
        const id = Number(idKey);
        const object = ref.current;
        if (!Number.isFinite(id) || !object) continue;
        if (state.pickedIds.includes(id) || state.removedIds.includes(id)) continue;
        if (!object.visible) continue;
        const point = new THREE.Vector3();
        object.getWorldPosition(point);
        visibleWorldItems.push({
          id,
          type: typeLookup.get(id) ?? -1,
          x: Number(point.x.toFixed(2)),
          y: Number(point.y.toFixed(2)),
          z: Number(point.z.toFixed(2)),
        });
        if (visibleWorldItems.length >= 48) break;
      }

      const timerText =
        document.querySelector('.countdown-timer')?.textContent?.trim() ?? null;

      const payload = {
        coordinateSystem:
          'three-world: origin at board center, +x right, +y up, +z towards tray/front',
        phase: state.gamePhase,
        mode: state.mode,
        scene: state.scene,
        visualStyle: state.visualStyle,
        timerText,
        itemsLeft: state.itemsLeft,
        totalItems: state.totalItems,
        bagCount: state.bagItemsCount,
        bagCapacity: state.bagCapacity,
        bagTypes: state.bagItems.map((item) => item.type),
        hintId: state.hintId,
        freezeMsRemaining: state.freezeUntil ? Math.max(0, state.freezeUntil - Date.now()) : 0,
        goose: {
          visible: state.gamePhase === 'catch' || state.gooseCaptured,
          captured: state.gooseCaptured,
        },
        tools: state.tools,
        availableCount: state.itemsMeta.length - state.pickedIds.length - state.removedIds.length,
        visibleWorldItems,
      };

      return JSON.stringify(payload);
    };

    return () => {
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, []);


  return (
    <div className='app'>

      <div className='wrapper'>
        <div className='camera'></div>

        {showIndicator && (
          <div className='indicator'>
            <div className="indicator-row">
              <div className="stat">
                <span className="stat-label">剩余</span>
                <span className="stat-value">{itemsLeft}</span>
              </div>
              <div className="stat">
                <span className="stat-label">托盘</span>
                <span className="stat-value">{bagItemsCount}/{bagCapacity}</span>
              </div>
            </div>
            <div className={`mode-pill mode-${mode}`}>
              <span className="mode-dot" />
              <span>{MODES[mode].label}</span>
            </div>
            <div className="mode-pill">
              <span className="mode-dot" />
              <span>{scene}</span>
              <span>·</span>
              <span>{visualStyle === 'toon' ? '卡通' : '写实'}</span>
            </div>
          </div>
        )}
        {showPauseButton && (
          <button
            className='pause-button'
            type="button"
            onClick={() => {
              if (gamePhase === 'playing') {
                pauseGame();
                return;
              }
              if (gamePhase === 'paused') {
                resumeGame();
              }
            }}
            aria-label={gamePhase === 'paused' ? "继续" : "暂停"}
          >
            {gamePhase === 'paused' ? <Play /> : <Pause />}
          </button>
        )}
        {showCountDown && (
          <div className='count-down'><CountDown onComplete={lose} /></div>
        )}
        <Canvas
          id='r3f-canvas'
          camera={{ position: [0, 14.6, 3.6], fov: 42, near: 0.1, far: 80 }}
          onCreated={({ camera }) => {
            camera.lookAt(0, 0.2, -0.2);
          }}
        >

          <Suspense fallback={null} >
            {/* <Perf position="top-left" /> */}
            {/* <Grid args={[10, 10]} sectionSize={1} infiniteGrid={false} /> */}
            {/* <PerspectiveCamera makeDefault position={[0, 8, 0]} /> */}
            {/* <OrbitControls /> */}
            <Experience />
          </Suspense>
        </Canvas>
        <Loader
          containerStyles={{ backgroundColor: 'black', borderRadius: '40px' }}
          innerStyles={{ color: 'white' }}
          dataStyles={{ color: 'white' }}
          barStyles={{ backgroundColor: 'orange' }}
          dataInterpolation={(p) => `加载中 ${p.toFixed(2)} %`}
          initialState={(active) => active}
        />

        {/* Game interface */}
        {
          progress === 100 && <UI />
        }

      </div>
    </div>
  )
}

export default App
