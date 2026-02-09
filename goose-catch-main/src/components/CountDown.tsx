import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/useGameStore';

interface CountDownProps {
  onComplete?: () => void;
}

const CountDown = ({ onComplete }: CountDownProps) => {
  const { time, gamePhase, freezeUntil } = useGameStore();
  const [timeLeft, setTimeLeft] = useState<number>(time);
  const prevPhaseRef = useRef<string>(gamePhase);
  const completedRef = useRef(false);


  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const startedFromReady =
      gamePhase === 'playing' &&
      (prevPhase === 'ready' || prevPhase === 'win' || prevPhase === 'gameover');
    const resetPhase = gamePhase === 'ready' || gamePhase === 'win' || gamePhase === 'gameover';

    if (startedFromReady || resetPhase) {
      setTimeLeft(time);
      completedRef.current = false;
    }
    prevPhaseRef.current = gamePhase;
  }, [gamePhase, time]);


  useEffect(() => {
    if (gamePhase !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (freezeUntil && Date.now() < freezeUntil) {
          return prev;
        }
        if (prev <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, freezeUntil, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="countdown-timer">
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
};

export default CountDown;
