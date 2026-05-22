import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode, SingleGameState, Guess } from '../types/game';
import GameModeCard from '../components/GameModeCard';
import GuessInput from '../components/GuessInput';
import GuessHistory from '../components/GuessHistory';
import Timer from '../components/Timer';
import api from '../utils/api';
import { formatTime, playBeep, validateGuess, calculateCowsBulls } from '../utils/gameLogic';
import { AIPlayer, type AIDifficulty } from '../utils/aiPlayer';

type Phase = 'setup' | 'playing' | 'won' | 'lost' | 'abandoned';
type PlayMode = 'normal' | 'vs_ai';

const DIFFICULTY_INFO: Record<AIDifficulty, { label: string; desc: string; color: string }> = {
  easy:   { label: '🟢 Easy',   desc: 'Guesses randomly — no learning',            color: 'border-brand-green/40 bg-brand-green/5 text-brand-green' },
  medium: { label: '🟡 Medium', desc: 'Uses your feedback to filter possibilities', color: 'border-brand-amber/40 bg-brand-amber/5 text-brand-amber' },
  hard:   { label: '🔴 Hard',   desc: 'Finds the optimal guess every time',         color: 'border-brand-red/40   bg-brand-red/5   text-brand-red'   },
};

export default function SinglePlayer() {
  const navigate = useNavigate();
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // ── Mode config ────────────────────────────────────────────────────────────
  const [mode, setMode]           = useState<GameMode>('noob');
  const [proDigits, setProDigits] = useState<4 | 5>(4);
  const [proRepeat, setProRepeat] = useState(false);
  const [proZero, setProZero]     = useState(false);

  // ── Play mode ──────────────────────────────────────────────────────────────
  const [playMode, setPlayMode]         = useState<PlayMode>('normal');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('medium');
  const [userSecretInput, setUserSecretInput] = useState('');
  const [userSecretError, setUserSecretError] = useState('');

  // ── Game state ─────────────────────────────────────────────────────────────
  const [phase, setPhase]               = useState<Phase>('setup');
  const [game, setGame]                 = useState<SingleGameState | null>(null);
  const [guesses, setGuesses]           = useState<Guess[]>([]);
  const [loading, setLoading]           = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [revealedSecret, setRevealedSecret] = useState('');

  // ── AI state ───────────────────────────────────────────────────────────────
  const aiRef          = useRef<AIPlayer | null>(null);
  const userSecretRef  = useRef('');
  const [aiGuesses, setAIGuesses]   = useState<Guess[]>([]);
  const [aiThinking, setAIThinking] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getModeConfig = () => {
    if (mode === 'noob')    return { digits: 4, allowRepeat: false, allowZero: false };
    if (mode === 'amateur') return { digits: 5, allowRepeat: false, allowZero: false };
    return { digits: proDigits, allowRepeat: proRepeat, allowZero: proZero };
  };

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = async () => {
    const cfg = getModeConfig();
    if (playMode === 'vs_ai') {
      const v = validateGuess(userSecretInput, cfg.digits, cfg.allowRepeat, cfg.allowZero);
      if (!v.valid) { setUserSecretError(v.error!); return; }
    }
    setLoading(true);
    try {
      const res = await api.post('/game/single/start', {
        mode,
        proDigits: mode === 'pro' ? proDigits : undefined,
        proRepeat:  mode === 'pro' ? proRepeat  : undefined,
        proZero:    mode === 'pro' ? proZero    : undefined,
      });
      setGame(res.data);
      setGuesses([]);
      setAIGuesses([]);
      setElapsedSeconds(0);
      setRevealedSecret('');
      if (playMode === 'vs_ai') {
        userSecretRef.current = userSecretInput;
        aiRef.current = new AIPlayer(cfg.digits, cfg.allowRepeat, cfg.allowZero, aiDifficulty);
      }
      setPhase('playing');
    } catch {
      alert('Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  // ── AI turn (runs after every user guess in vs_ai mode) ───────────────────
  const runAITurn = useCallback(async (gameId: string, digits: number) => {
    const ai = aiRef.current;
    if (!ai) return;

    setAIThinking(true);
    await new Promise(r => setTimeout(r, ai.thinkingDelay()));
    if (!isMounted.current) return;

    const aiGuess = ai.nextGuess();
    const { cows, bulls } = calculateCowsBulls(userSecretRef.current, aiGuess);
    ai.processResult(aiGuess, cows, bulls);

    const entry: Guess = { guess: aiGuess, cows, bulls, attemptNumber: ai.attemptCount };
    setAIGuesses(prev => [...prev, entry]);
    setAIThinking(false);

    if (cows === digits) {
      // AI cracked the user's secret — reveal the AI's secret too
      playBeep('error');
      try {
        const giveup = await api.post('/game/single/giveup', { gameId });
        if (isMounted.current) setRevealedSecret(giveup.data.secret);
      } catch { /* secret reveal is best-effort */ }
      if (isMounted.current) setPhase('lost');
    } else {
      playBeep('tick');
    }
  }, []);

  // ── User guess submission ──────────────────────────────────────────────────
  const handleGuess = useCallback(async (guess: string) => {
    if (!game) return;
    setLoading(true);
    try {
      const res = await api.post('/game/single/guess', { gameId: game.gameId, guess });
      const entry: Guess = {
        guess,
        cows:          res.data.cows,
        bulls:         res.data.bulls,
        attemptNumber: res.data.attemptNumber,
      };
      setGuesses(prev => [...prev, entry]);

      if (res.data.won) {
        setRevealedSecret(res.data.secret);
        setPhase('won');
        playBeep('win');
        setLoading(false);
        return;
      }

      playBeep(res.data.cows > 0 || res.data.bulls > 0 ? 'success' : 'tick');
      setLoading(false);

      if (playMode === 'vs_ai') {
        await runAITurn(game.gameId, game.digits);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Error submitting guess');
      setLoading(false);
      setAIThinking(false);
    }
  }, [game, playMode, runAITurn]);

  // ── Give up ────────────────────────────────────────────────────────────────
  const handleGiveUp = async () => {
    if (!game || !confirm('Give up and reveal the secret?')) return;
    try {
      const res = await api.post('/game/single/giveup', { gameId: game.gameId });
      setRevealedSecret(res.data.secret);
      setPhase('abandoned');
    } catch { alert('Error'); }
  };

  const reset = () => {
    setPhase('setup');
    setGame(null);
    setGuesses([]);
    setAIGuesses([]);
    setRevealedSecret('');
    setUserSecretInput('');
    setUserSecretError('');
    aiRef.current = null;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: SETUP
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'setup') {
    const cfg = getModeConfig();
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Single Player</h1>
          <p className="text-gray-500">Choose a mode and try to crack the secret number.</p>
        </div>

        <GameModeCard selected={mode} onSelect={setMode} />

        {/* Pro options */}
        {mode === 'pro' && (
          <div className="card p-5 space-y-4 animate-fade-in">
            <h3 className="font-semibold text-brand-red">Pro Mode Options</h3>
            <div className="flex gap-4 items-center flex-wrap">
              <div>
                <p className="text-sm text-gray-400 mb-2">Digits</p>
                <div className="flex gap-2">
                  {([4, 5] as const).map(n => (
                    <button key={n} onClick={() => setProDigits(n)}
                      className={`w-12 h-10 rounded-lg border font-mono font-bold transition-all ${proDigits === n ? 'bg-brand-red/10 border-brand-red text-brand-red' : 'bg-dark-surface border-dark-border text-gray-400 hover:border-gray-500'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {(['allowRepeat', 'allowZero'] as const).map(key => {
                const val = key === 'allowRepeat' ? proRepeat : proZero;
                const set = key === 'allowRepeat' ? setProRepeat : setProZero;
                const label = key === 'allowRepeat' ? 'Allow repeating digits' : 'Can start with 0';
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <div onClick={() => set(v => !v)} className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${val ? 'bg-brand-red' : 'bg-dark-border'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${val ? 'left-5' : 'left-1'}`} />
                    </div>
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Play mode toggle */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Play Mode</h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'normal', emoji: '🖥️', title: 'vs Computer', desc: 'You guess the computer\'s secret number' },
              { key: 'vs_ai',  emoji: '🤖', title: 'vs AI',       desc: 'Race against an AI — who cracks it first?' },
            ] as { key: PlayMode; emoji: string; title: string; desc: string }[]).map(({ key, emoji, title, desc }) => (
              <button key={key} onClick={() => setPlayMode(key)}
                className={`card p-4 text-left transition-all duration-200 ${playMode === key ? 'ring-2 ring-brand-purple ring-offset-2 ring-offset-dark-bg' : 'hover:border-dark-hover'}`}>
                <div className="text-2xl mb-1">{emoji}</div>
                <div className="font-semibold text-sm text-white">{title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* AI options */}
        {playMode === 'vs_ai' && (
          <div className="space-y-5 animate-fade-in">
            {/* Difficulty */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">AI Difficulty</h3>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(DIFFICULTY_INFO) as [AIDifficulty, typeof DIFFICULTY_INFO[AIDifficulty]][]).map(([key, info]) => (
                  <button key={key} onClick={() => setAIDifficulty(key)}
                    className={`card p-3 text-left transition-all duration-200 border ${aiDifficulty === key ? info.color + ' ring-1 ring-current' : 'hover:border-dark-hover'}`}>
                    <div className="font-semibold text-sm">{info.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-snug">{info.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* User's secret */}
            <div className="card p-5 space-y-3">
              <div>
                <h3 className="font-semibold text-sm text-white mb-0.5">Set Your Secret Number</h3>
                <p className="text-xs text-gray-500">The AI will try to guess this. Keep it hidden!</p>
              </div>
              <div className="flex gap-1.5 mb-2">
                {Array.from({ length: cfg.digits }).map((_, i) => (
                  <div key={i} className={`w-10 h-12 flex items-center justify-center rounded-lg border font-mono font-bold text-xl transition-all ${
                    userSecretInput[i] ? 'bg-brand-purple/10 border-brand-purple text-white' : 'bg-dark-surface border-dark-border text-gray-700'
                  }`}>{userSecretInput[i] ? '●' : '·'}</div>
                ))}
              </div>
              <input
                type="text" inputMode="numeric" maxLength={cfg.digits}
                value={userSecretInput}
                onChange={e => { setUserSecretInput(e.target.value.replace(/\D/g, '').slice(0, cfg.digits)); setUserSecretError(''); }}
                placeholder={`Enter your ${cfg.digits}-digit secret`}
                className="input-field font-mono text-center text-xl tracking-widest"
              />
              {userSecretError && <p className="text-brand-red text-sm">{userSecretError}</p>}
              <p className="text-xs text-gray-600">
                {cfg.allowRepeat ? 'Repeats OK' : 'Unique digits'} · {cfg.allowZero ? 'Zero start OK' : 'No leading zero'}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={startGame} disabled={loading || (playMode === 'vs_ai' && userSecretInput.length !== cfg.digits)} className="btn-primary px-10 py-3 text-base">
            {loading ? 'Starting...' : playMode === 'vs_ai' ? '⚔️ Start Race' : 'Start Game'}
          </button>
          <button onClick={() => navigate('/multiplayer')} className="btn-secondary py-3">Multiplayer Instead</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: GAME OVER
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === 'won' || phase === 'lost' || phase === 'abandoned') {
    const userWon    = phase === 'won';
    const aiWon      = phase === 'lost';
    const isVsAI     = playMode === 'vs_ai';

    const emoji   = userWon ? '🏆' : aiWon ? '🤖' : '😔';
    const heading = userWon
      ? isVsAI ? 'You beat the AI!' : 'You cracked it!'
      : aiWon  ? 'AI wins this round!'
      : 'Better luck next time';

    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 animate-fade-in">
        <div className={`card p-8 text-center space-y-5 ${userWon ? 'glow-purple' : ''}`}>
          <div className="text-6xl">{emoji}</div>
          <h2 className="text-3xl font-bold">{heading}</h2>

          {/* Secrets revealed */}
          <div className={`flex ${isVsAI ? 'justify-center gap-12' : 'justify-center'} flex-wrap gap-6`}>
            {isVsAI && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">Your secret</p>
                <div className="flex gap-1.5 justify-center">
                  {userSecretRef.current.split('').map((d, i) => (
                    <span key={i} className="digit-box text-xl w-12 h-12 bg-brand-purple/10 border-brand-purple/40 text-brand-purple">{d}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">{isVsAI ? "AI's secret" : 'The secret'}</p>
              <div className="flex gap-1.5 justify-center">
                {revealedSecret.split('').map((d, i) => (
                  <span key={i} className={`digit-box text-xl w-12 h-12 ${
                    userWon ? 'bg-brand-green/10 border-brand-green/40 text-brand-green' : 'bg-brand-red/10 border-brand-red/30 text-brand-red'
                  }`}>{d}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-6 text-sm text-gray-400 flex-wrap">
            <span>Your attempts: <strong className="text-white">{guesses.length}</strong></span>
            {isVsAI && <span>AI attempts: <strong className="text-white">{aiGuesses.length}</strong></span>}
            {userWon && <span>Time: <strong className="text-white">{formatTime(elapsedSeconds)}</strong></span>}
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button onClick={reset} className="btn-primary">Play Again</button>
            <button onClick={() => navigate('/leaderboard')} className="btn-secondary">Leaderboard</button>
          </div>
        </div>

        {/* History panels */}
        <div className={`grid gap-4 ${isVsAI ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="card p-4">
            <GuessHistory guesses={guesses} digits={game!.digits} label="Your Guesses" />
          </div>
          {isVsAI && (
            <div className="card p-4">
              <GuessHistory guesses={aiGuesses} digits={game!.digits} label={`AI's Guesses (${DIFFICULTY_INFO[aiDifficulty].label})`} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: PLAYING
  // ═══════════════════════════════════════════════════════════════════════════
  const isVsAI   = playMode === 'vs_ai';
  const diffInfo = DIFFICULTY_INFO[aiDifficulty];
  const ai       = aiRef.current;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="btn-ghost text-sm">← Back</button>
          <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
            mode === 'noob' ? 'bg-brand-green/10 text-brand-green' :
            mode === 'amateur' ? 'bg-brand-amber/10 text-brand-amber' :
            'bg-brand-red/10 text-brand-red'
          }`}>{mode}</span>
          {isVsAI && <span className={`text-xs font-semibold px-2 py-1 rounded-md ${diffInfo.color}`}>{diffInfo.label}</span>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">You: <strong className="text-white">{guesses.length}</strong></span>
          {isVsAI && <span className="text-gray-400">AI: <strong className="text-white">{aiGuesses.length}</strong></span>}
          <span className="text-gray-400">
            <Timer running={phase === 'playing' && !aiThinking} onTick={setElapsedSeconds} className="text-white font-semibold" />
          </span>
        </div>
      </div>

      {/* AI thinking banner */}
      {aiThinking && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-amber/5 border border-brand-amber/20 rounded-xl animate-fade-in">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 bg-brand-amber rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="text-sm text-brand-amber font-medium">AI ({diffInfo.label}) is thinking…</span>
          {ai && ai.difficulty !== 'easy' && (
            <span className="ml-auto text-xs text-gray-600">{ai.remainingCount} possibilities left</span>
          )}
        </div>
      )}

      {/* Guess input */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          {isVsAI ? "Your guess — crack the AI's secret" : 'Your Guess'}
        </h2>
        <GuessInput
          digits={game!.digits}
          allowRepeat={game!.allowRepeat}
          allowZero={game!.allowZero}
          onSubmit={handleGuess}
          loading={loading}
          disabled={aiThinking}
          previousGuesses={guesses.map(g => g.guess)}
        />
        <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
          <span>
            {game!.allowRepeat ? 'Repeats OK' : 'Unique digits'} · {game!.allowZero ? 'Zero start OK' : 'No leading zero'}
          </span>
          <button onClick={handleGiveUp} disabled={aiThinking} className="text-gray-600 hover:text-brand-red transition-colors disabled:opacity-40">
            Give up
          </button>
        </div>
      </div>

      {/* Last guess quick feedback */}
      {guesses.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-dark-card border border-dark-border rounded-xl animate-slide-up">
          <span className="text-sm text-gray-400">Last:</span>
          <span className="font-mono font-bold text-white tracking-widest">{guesses[guesses.length - 1].guess}</span>
          <span className="badge-cows">{guesses[guesses.length - 1].cows}C</span>
          <span className="badge-bulls">{guesses[guesses.length - 1].bulls}B</span>
          {isVsAI && aiGuesses.length > 0 && (
            <>
              <span className="ml-auto text-xs text-gray-500">AI's last:</span>
              <span className="font-mono font-bold text-brand-amber tracking-widest text-sm">{aiGuesses[aiGuesses.length - 1].guess}</span>
              <span className="badge-cows">{aiGuesses[aiGuesses.length - 1].cows}C</span>
              <span className="badge-bulls">{aiGuesses[aiGuesses.length - 1].bulls}B</span>
            </>
          )}
        </div>
      )}

      {/* History — split for vs AI */}
      <div className={`grid gap-4 ${isVsAI ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="card p-4">
          <GuessHistory guesses={guesses} digits={game!.digits} label="Your Guesses" highlightLast />
        </div>
        {isVsAI && (
          <div className="card p-4">
            <GuessHistory guesses={aiGuesses} digits={game!.digits} label={`AI's Guesses`} highlightLast />
          </div>
        )}
      </div>
    </div>
  );
}
