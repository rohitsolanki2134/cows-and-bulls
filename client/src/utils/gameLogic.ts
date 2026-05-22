import type { GameMode } from '../types/game';

export function calculateCowsBulls(secret: string, guess: string) {
  let cows = 0, bulls = 0;
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) cows++;
    else if (secret.includes(guess[i])) bulls++;
  }
  return { cows, bulls };
}

export function validateGuess(
  guess: string,
  digits: number,
  allowRepeat: boolean,
  allowZero: boolean
): { valid: boolean; error?: string } {
  if (!guess || !/^\d+$/.test(guess)) return { valid: false, error: 'Only digits allowed' };
  if (guess.length !== digits) return { valid: false, error: `Must be exactly ${digits} digits` };
  if (!allowZero && guess[0] === '0') return { valid: false, error: 'Cannot start with 0' };
  if (!allowRepeat && new Set(guess).size !== digits) return { valid: false, error: 'All digits must be unique' };
  return { valid: true };
}

export function getModeLabel(mode: GameMode) {
  return { noob: 'Noob', amateur: 'Amateur', pro: 'Pro' }[mode];
}

export function getModeColor(mode: GameMode) {
  return { noob: 'text-brand-green', amateur: 'text-brand-amber', pro: 'text-brand-red' }[mode];
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function playBeep(type: 'success' | 'error' | 'tick' | 'win') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const configs = {
      tick: { freq: 440, duration: 0.08, type: 'sine' as OscillatorType },
      success: { freq: 880, duration: 0.15, type: 'sine' as OscillatorType },
      error: { freq: 220, duration: 0.2, type: 'sawtooth' as OscillatorType },
      win: { freq: 1046, duration: 0.5, type: 'sine' as OscillatorType },
    };
    const c = configs[type];
    osc.type = c.type;
    osc.frequency.setValueAtTime(c.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + c.duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + c.duration);
  } catch {
    // Audio not supported — silent fail
  }
}
