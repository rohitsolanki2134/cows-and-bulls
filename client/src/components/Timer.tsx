import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  running: boolean;
  onTick?: (seconds: number) => void;
  className?: string;
}

export default function Timer({ running, onTick, className = '' }: TimerProps) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          const next = s + 1;
          onTick?.(next);
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {m}:{s}
    </span>
  );
}
