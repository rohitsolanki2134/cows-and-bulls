import { calculateCowsBulls } from './gameLogic';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

function generateAllValid(digits: number, allowRepeat: boolean, allowZero: boolean): string[] {
  const results: string[] = [];
  const used = new Array(10).fill(false);

  function recurse(current: string) {
    if (current.length === digits) { results.push(current); return; }
    const isFirst = current.length === 0;
    for (let d = 0; d <= 9; d++) {
      if (isFirst && !allowZero && d === 0) continue;
      if (!allowRepeat && used[d]) continue;
      if (!allowRepeat) used[d] = true;
      recurse(current + d);
      if (!allowRepeat) used[d] = false;
    }
  }

  recurse('');
  return results;
}

export class AIPlayer {
  private allValid: string[];
  private remaining: string[];
  private tried: Set<string>;
  private _attempts = 0;

  constructor(
    public readonly digits: number,
    public readonly allowRepeat: boolean,
    public readonly allowZero: boolean,
    public readonly difficulty: AIDifficulty
  ) {
    this.allValid = generateAllValid(digits, allowRepeat, allowZero);
    this.remaining = [...this.allValid];
    this.tried = new Set();
  }

  /** Call after every guess to feed the result back into the solver. */
  processResult(guess: string, cows: number, bulls: number) {
    this.tried.add(guess);
    this._attempts++;
    if (this.difficulty !== 'easy') {
      this.remaining = this.remaining.filter(candidate => {
        const fb = calculateCowsBulls(candidate, guess);
        return fb.cows === cows && fb.bulls === bulls;
      });
    }
  }

  /** Returns the AI's next guess. */
  nextGuess(): string {
    switch (this.difficulty) {
      case 'easy': {
        // Totally random — ignores feedback, just avoids repeats
        const pool = this.allValid.filter(n => !this.tried.has(n));
        return pool[Math.floor(Math.random() * pool.length)];
      }

      case 'medium': {
        // Picks randomly from still-valid candidates (uses feedback)
        const pool = this.remaining.filter(n => !this.tried.has(n));
        if (pool.length === 0) {
          const fb = this.allValid.filter(n => !this.tried.has(n));
          return fb[Math.floor(Math.random() * fb.length)];
        }
        return pool[Math.floor(Math.random() * pool.length)];
      }

      case 'hard': {
        // Minimax: pick the guess that minimises the worst-case remaining pool
        const pool = this.remaining.filter(n => !this.tried.has(n));
        if (pool.length === 0) {
          const fb = this.allValid.filter(n => !this.tried.has(n));
          return fb[0];
        }
        if (pool.length <= 2) return pool[0];

        // Cap at 300 candidates for performance; still highly effective
        const candidates = pool.length <= 300 ? pool : pool.slice(0, 300);
        let best = candidates[0];
        let bestWorst = Infinity;

        for (const guess of candidates) {
          const buckets: Record<string, number> = {};
          for (const secret of pool) {
            const fb = calculateCowsBulls(secret, guess);
            const key = `${fb.cows},${fb.bulls}`;
            buckets[key] = (buckets[key] || 0) + 1;
          }
          const worst = Math.max(...Object.values(buckets));
          if (worst < bestWorst) { bestWorst = worst; best = guess; }
        }
        return best;
      }
    }
  }

  get remainingCount() { return this.remaining.length; }
  get attemptCount() { return this._attempts; }

  /** Realistic thinking delay per difficulty (ms). */
  thinkingDelay(): number {
    const [base, jitter]: [number, number] = {
      easy:   [2800, 1200],
      medium: [1500,  800],
      hard:   [ 600,  500],
    }[this.difficulty] as [number, number];
    return base + Math.random() * jitter;
  }

  label() {
    return { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' }[this.difficulty];
  }
}
