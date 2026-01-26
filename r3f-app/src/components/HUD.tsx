import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../stores/useGameStore';

function formatMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const TYPE_COLORS = ['#ff8fab', '#ffc6a8', '#ffeaa7', '#b8f2e6', '#a0c4ff', '#cdb4db', '#ffd6e0', '#f4d06f'];

const TYPE_ICONS = [
  '/ui/ice-cream.svg',
  '/ui/cheese.svg',
  '/ui/cookie-man.svg',
  '/ui/hotdog.svg',
  '/ui/sandwich.svg',
  '/ui/sandwich-toast.svg',
  '/ui/pancake.svg',
  '/ui/toast.svg',
];

const TYPE_LABELS = [
  '冰淇淋',
  '奶酪',
  '姜饼人',
  '热狗',
  '三明治',
  '吐司三明治',
  '松饼',
  '吐司',
];

export default function HUD() {
  const confettiRef = useRef<HTMLCanvasElement | null>(null);
  const {
    phase,
    score,
    bestScore,
    timeLeftMs,
    bag,
    bagCapacity,
    tools,
    mergePulse,
    mergeCombo,
    lastMergeAdd,
    freezeUntil,
    reset,
    shareUrl,
    togglePause,
    mode,
    setMode,
    start,
    undo,
    useToolRemove,
    useToolMatch,
    useToolHint,
    useToolFreeze,
    useToolShuffle,
    items,
  } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [mergeFx, setMergeFx] = useState(false);
  const [trayPulse, setTrayPulse] = useState(false);
  const remaining = useMemo(() => items.filter((x) => !x.picked).length, [items]);
  const freezeLeft = Math.max(0, freezeUntil - now);
  const bagDanger = bag.length >= Math.max(1, bagCapacity - 1);

  const burst = useCallback((count: number, duration: number) => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#ff8fab', '#ffc6a8', '#ffeaa7', '#a0c4ff', '#b8f2e6', '#ffffff'];
    const parts = Array.from({ length: count }, () => ({
      x: rect.width * (0.2 + Math.random() * 0.6),
      y: rect.height * 0.45,
      vx: (Math.random() * 2 - 1) * 3.2,
      vy: -2 - Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: (Math.random() * 2 - 1) * 0.2,
      w: 6 + Math.random() * 10,
      h: 6 + Math.random() * 12,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));

    const start = performance.now();
    const gravity = 0.08;
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, rect.width, rect.height);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - t / duration);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < duration) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, rect.width, rect.height);
    };
    requestAnimationFrame(tick);
  }, []);

  const beep = useCallback((freq: number, duration: number, gain: number) => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.05);
      osc.onended = () => ctx.close();
    } catch {
      // ignore
    }
  }, []);

  const click = useCallback(() => {
    beep(420, 0.04, 0.04);
  }, [beep]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === 'playing' && bag.length) {
      beep(520, 0.05, 0.05);
      setTrayPulse(true);
      const id = window.setTimeout(() => setTrayPulse(false), 180);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [bag.length, phase, beep]);

  useEffect(() => {
    if (!mergePulse) return;
    setMergeFx(true);
    const id = window.setTimeout(() => setMergeFx(false), 360);
    burst(60, 520);
    beep(720, 0.08, 0.08);
    if (navigator.vibrate) navigator.vibrate(12);
    return () => window.clearTimeout(id);
  }, [mergePulse, burst, beep]);

  useEffect(() => {
    if (phase === 'win') {
      burst(180, 1400);
      beep(920, 0.12, 0.1);
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    }
  }, [phase, burst, beep]);

  const doCopy = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="hud">
      <canvas className="confetti" ref={confettiRef} />
      <div className={`freeze-overlay ${freezeLeft > 0 ? 'active' : ''}`} />
      <div className="hud-top">
        <div className={`pill ${freezeLeft > 0 ? 'freeze' : ''}`}>
          <span className="pill-label">时间</span>
          <strong>{formatMs(timeLeftMs)}</strong>
          {freezeLeft > 0 ? <small>冻结 {Math.ceil(freezeLeft / 1000)}s</small> : null}
        </div>
        <div className="pill">
          <span className="pill-label">得分</span>
          <strong>{score}</strong>
        </div>
        <div className="pill">
          <span className="pill-label">最佳</span>
          <strong>{bestScore}</strong>
        </div>
        <div className="pill">
          <span className="pill-label">剩余</span>
          <strong>{remaining}</strong>
        </div>
        <div className="actions">
          <button className="btn" onPointerDown={click} onClick={togglePause}>
            {phase === 'paused' ? '继续' : '暂停'}
          </button>
          <button className="btn" onPointerDown={click} onClick={undo} disabled={phase !== 'playing' || bag.length === 0 || tools.undo <= 0}>
            撤回 ({tools.undo})
          </button>
          <button className="btn ghost" onPointerDown={click} onClick={doCopy}>
            {copied ? '已复制' : '分享'}
          </button>
        </div>
      </div>

      <div className="hud-bottom">
        <div className={`tray ${mergeFx ? 'merge' : ''} ${bagDanger ? 'danger' : ''} ${trayPulse ? 'pulse' : ''}`}>
          <div className="merge-fx" />
          {Array.from({ length: bagCapacity }).map((_, i) => {
            const it = bag[i];
            const color = it ? TYPE_COLORS[it.type % TYPE_COLORS.length] : undefined;
            return (
              <div key={i} className={`slot ${it ? 'filled' : ''}`}>
                {it ? (
                  <img
                    className="slot-img"
                    src={TYPE_ICONS[it.type % TYPE_ICONS.length]}
                    alt={TYPE_LABELS[it.type % TYPE_LABELS.length]}
                    title={TYPE_LABELS[it.type % TYPE_LABELS.length]}
                  />
                ) : (
                  <span className="token" style={color ? { background: color } : undefined} />
                )}
              </div>
            );
          })}
          {mergeFx && lastMergeAdd > 0 ? (
            <div className="merge-score">+{lastMergeAdd}{mergeCombo > 1 ? ` 连消×${mergeCombo}` : ''}</div>
          ) : null}
        </div>
        <div className="tools">
          <button className="tool-btn" onPointerDown={click} onClick={useToolRemove} disabled={phase !== 'playing' || tools.remove <= 0}>
            移出 <span>{tools.remove}</span>
          </button>
          <button className="tool-btn" onPointerDown={click} onClick={useToolMatch} disabled={phase !== 'playing' || tools.match <= 0}>
            凑齐 <span>{tools.match}</span>
          </button>
          <button className="tool-btn" onPointerDown={click} onClick={useToolHint} disabled={phase !== 'playing' || tools.hint <= 0}>
            提示 <span>{tools.hint}</span>
          </button>
          <button className="tool-btn" onPointerDown={click} onClick={useToolFreeze} disabled={phase !== 'playing' || tools.freeze <= 0}>
            停时 <span>{tools.freeze}</span>
          </button>
          <button className="tool-btn" onPointerDown={click} onClick={useToolShuffle} disabled={phase !== 'playing' || tools.shuffle <= 0}>
            打乱 <span>{tools.shuffle}</span>
          </button>
        </div>
        <div className="modes">
          {(['easy', 'normal', 'hard'] as const).map((m) => (
            <button key={m} className={`btn ${mode === m ? 'primary' : ''}`} onPointerDown={click} onClick={() => setMode(m)}>
              {m === 'easy' ? '轻松' : m === 'normal' ? '标准' : '高手'}
            </button>
          ))}
          <button className="btn ghost" onPointerDown={click} onClick={reset}>
            换一局
          </button>
        </div>
      </div>

      {phase === 'ready' && (
        <div className="overlay">
          <div className="panel">
            <div className="panel-title">抓大鹅 · 3D 版</div>
            <p className="panel-sub">点击最上层物品放入槽位，凑齐三个自动消除。清空即可胜利。</p>
            <div className="panel-actions">
              <button className="btn ghost" onPointerDown={click} onClick={reset}>
                随机局号
              </button>
              <button className="btn primary" onPointerDown={click} onClick={start}>
                开始游戏
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <div className="overlay">
          <div className="panel">
            <div className="panel-title">暂停中</div>
            <p className="panel-sub">休息一下，继续冲！</p>
            <div className="panel-actions">
              <button className="btn ghost" onPointerDown={click} onClick={reset}>
                换一局
              </button>
              <button className="btn primary" onPointerDown={click} onClick={togglePause}>
                继续
              </button>
            </div>
          </div>
        </div>
      )}

      {(phase === 'win' || phase === 'lose') && (
        <div className="overlay">
          <div className="panel">
            <div className="panel-title">{phase === 'win' ? '通关成功！' : '游戏结束'}</div>
            <p className="panel-sub">得分 {score} · 剩余 {remaining}</p>
            <div className="panel-actions">
              <button className="btn ghost" onPointerDown={click} onClick={doCopy}>
                复制分享链接
              </button>
              <button className="btn primary" onPointerDown={click} onClick={reset}>
                再来一局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
