
import { Play, RotateCcw } from "lucide-react";
import { ITEM_TYPES, MODES, MODE_ORDER, useGameStore } from "../stores/useGameStore";

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const UI = () => {

    const gamePhase = useGameStore((state) => state.gamePhase);
    const mode = useGameStore((state) => state.mode);
    const setMode = useGameStore((state) => state.setMode);
    const visualStyle = useGameStore((state) => state.visualStyle);
    const setVisualStyle = useGameStore((state) => state.setVisualStyle);
    const scene = useGameStore((state) => state.scene);
    const setScene = useGameStore((state) => state.setScene);
    const gameStore = useGameStore();
    const tools = useGameStore((state) => state.tools);
    const notification = useGameStore((state) => state.notification);
    const handleStart = () => gameStore.start();
    const handleStartOver = () => {
        gameStore.end();
        setTimeout(() => {
            gameStore.start();
        }, 50);
    };

    const handleResume = () => gameStore.resume();
    const allowModeChange = gamePhase === 'ready' || gamePhase === 'win' || gamePhase === 'gameover';

    return (
        <>
            {(gamePhase !== 'playing') && (
                <div className='ui-container'>
                    <div className="menu">
                        <div className="menu-header">
                            <div className="title">抓大鹅 · Deluxe</div>
                            <div className="subtitle">
                                点击物品收集到托盘，凑齐三个相同即可消除。
                            </div>
                        </div>
                        <div className="mode-select">
                            <div className="mode-heading">难度选择</div>
                            <div className="mode-options" role="radiogroup" aria-label="难度选择">
                                {MODE_ORDER.map((key) => {
                                    const cfg = MODES[key];
                                    const total = cfg.itemsPerType * ITEM_TYPES;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            className={`mode-card mode-${key} ${mode === key ? 'is-active' : ''}`}
                                            onClick={() => allowModeChange && setMode(key)}
                                            aria-pressed={mode === key}
                                            disabled={!allowModeChange}
                                        >
                                            <span className="mode-name">{cfg.label}</span>
                                            <span className="mode-meta">{formatTime(cfg.seconds)} · {total} 物品</span>
                                            <span className="mode-desc">{cfg.description}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {!allowModeChange && (
                                <div className="mode-hint">暂停中无法切换难度，请重开后选择</div>
                            )}
                        </div>
                        <div className="style-select">
                            <div className="mode-heading">视觉风格</div>
                            <div className="style-options" role="radiogroup" aria-label="视觉风格">
                                {([
                                    { key: 'realistic', label: '写实' },
                                    { key: 'toon', label: '卡通' },
                                ] as const).map((style) => (
                                    <button
                                        key={style.key}
                                        type="button"
                                        className={`style-chip ${visualStyle === style.key ? 'is-active' : ''}`}
                                        onClick={() => allowModeChange && setVisualStyle(style.key)}
                                        aria-pressed={visualStyle === style.key}
                                        disabled={!allowModeChange}
                                    >
                                        {style.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="theme-select">
                            <div className="mode-heading">场景主题</div>
                            <div className="theme-options" role="radiogroup" aria-label="场景主题">
                                {([
                                    { key: 'japanese', label: '日式料理店', sub: '暖木色调' },
                                    { key: 'cyber', label: '赛博超市', sub: '霓虹与金属' },
                                    { key: 'arcade', label: '复古街机厅', sub: '像素霓虹' },
                                    { key: 'magic', label: '魔法书屋', sub: '书与药剂' },
                                    { key: 'space', label: '太空货仓', sub: '冷光工业' },
                                ] as const).map((theme) => (
                                    <button
                                        key={theme.key}
                                        type="button"
                                        className={`theme-chip ${scene === theme.key ? 'is-active' : ''}`}
                                        onClick={() => allowModeChange && setScene(theme.key)}
                                        aria-pressed={scene === theme.key}
                                        disabled={!allowModeChange}
                                    >
                                        <span className="theme-title">{theme.label}</span>
                                        <span className="theme-sub">{theme.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        {gamePhase === 'ready' && (
                            <div className="menu-actions">
                                <button className="primary" onClick={handleStart}><Play size={20}/>开始</button>
                            </div>
                        )}
                        {(gamePhase === 'paused') && (
                            <div className="menu-actions">
                                <button className="primary" onClick={handleResume}><Play size={20}/>继续</button>
                                <button className="ghost" onClick={handleStartOver}><RotateCcw size={20}/>重来</button>
                            </div>
                        )}
                        {(gamePhase === 'win' || gamePhase === 'gameover') && (
                            <div className="menu-actions">
                                {gamePhase === 'win' ?
                                    <div className="win-title">大鹅已被逮捕！</div> :
                                    <div className="loss-title">游戏结束！可惜可惜</div>}
                                <button className="primary" onClick={handleStartOver}><RotateCcw size={20}/>再来</button>
                            </div>
                        )}
                    </div>
                </div>

            )}

            {gamePhase === 'catch' && (
                <div className="goose-banner">
                    大鹅出现了！点击抓捕
                </div>
            )}

            {(gamePhase === 'playing' || gamePhase === 'paused') && (
                <div className="tool-bar">
                    <button className="tool-button" onClick={gameStore.removeTool} disabled={tools.remove <= 0}>
                        <span className="tool-icon">OUT</span>
                        <span className="tool-label">移出</span>
                        <span className="tool-count">{tools.remove}</span>
                    </button>
                    <button className="tool-button" onClick={gameStore.magTool} disabled={tools.mag <= 0}>
                        <span className="tool-icon">MAG</span>
                        <span className="tool-label">凑齐</span>
                        <span className="tool-count">{tools.mag}</span>
                    </button>
                    <button className="tool-button" onClick={gameStore.hintTool} disabled={tools.hint <= 0}>
                        <span className="tool-icon">TIP</span>
                        <span className="tool-label">提示</span>
                        <span className="tool-count">{tools.hint}</span>
                    </button>
                    <button className="tool-button" onClick={gameStore.undoTool} disabled={tools.undo <= 0}>
                        <span className="tool-icon">UNDO</span>
                        <span className="tool-label">撤回</span>
                        <span className="tool-count">{tools.undo}</span>
                    </button>
                    <button className="tool-button" onClick={gameStore.iceTool} disabled={tools.ice <= 0}>
                        <span className="tool-icon">ICE</span>
                        <span className="tool-label">停时</span>
                        <span className="tool-count">{tools.ice}</span>
                    </button>
                    <button className="tool-button" onClick={gameStore.mixTool} disabled={tools.mix <= 0}>
                        <span className="tool-icon">MIX</span>
                        <span className="tool-label">打乱</span>
                        <span className="tool-count">{tools.mix}</span>
                    </button>
                </div>
            )}

            {notification && (
                <div className="toast">{notification}</div>
            )}

        </>

    )
}

export default UI;
