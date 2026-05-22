import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode, SingleGameState, Guess } from '../types/game';
import GameModeCard from '../components/GameModeCard';
import GuessInput from '../components/GuessInput';
import GuessHistory from '../components/GuessHistory';
import Timer from '../components/Timer';
import api from '../utils/api';
import { formatTime, playBeep } from '../utils/gameLogic';

type Phase = 'setup' | 'playing' | 'won' | 'abandoned';

export default function SinglePlayer() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<GameMode>('noob');
  const [proDigits, setProDigits] = useState<4 | 5>(4);
  const [proRepeat, setProRepeat] = useState(false);
  const [proZero, setProZero] = useState(false);
  const [game, setGame] = useState<SingleGameState | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(false);
  const [secret, setSecret] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startGame = async () => {
    setLoading(true);
    try {
      const res = await api.post('/game/single/start', {
        mode,
        proDigits: mode === 'pro' ? proDigits : undefined,
        proRepeat: mode === 'pro' ? proRepeat : undefined,
        proZero: mode === 'pro' ? proZero : undefined,
      });
      setGame(res.data);
      setGuesses([]);
      setSecret('');
      setElapsedSeconds(0);
      setPhase('playing');
    } catch {
      alert('Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const handleGuess = useCallback(async (guess: string) => {
    if (!game) return;
    setLoading(true);
    try {
      const res = await api.post('/game/single/guess', { gameId: game.gameId, guess });
      const newGuess: Guess = {
        guess,
        cows: res.data.cows,
        bulls: res.data.bulls,
        attemptNumber: res.data.attemptNumber,
      };
      setGuesses(prev => [...prev, newGuess]);

      if (res.data.won) {
        setSecret(res.data.secret);
        setPhase('won');
        playBeep('win');
      } else {
        playBeep(res.data.cows > 0 || res.data.bulls > 0 ? 'success' : 'tick');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Error submitting guess');
    } finally {
      setLoading(false);
    }
  }, [game]);

  const handleGiveUp = async () => {
    if (!game || !confirm('Give up and reveal the secret?')) return;
    try {
      const res = await api.post('/game/single/giveup', { gameId: game.gameId });
      setSecret(res.data.secret);
      setPhase('abandoned');
    } catch {
      alert('Error');
    }
  };

  const reset = () => {
    setPhase('setup');
    setGame(null);
    setGuesses([]);
    setSecret('');
  };

  // Setup screen
  if (phase === 'setup') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Single Player</h1>
          <p className="text-gray-500">Choose a mode and try to crack the secret number.</p>
        </div>

        <GameModeCard selected={mode} onSelect={setMode} />

        {/* Pro mode options */}
        {mode === 'pro' && (
          <div className="card p-5 space-y-4 animate-fade-in">
            <h3 className="font-semibold text-brand-red">Pro Mode Options</h3>
            <div className="flex gap-4 items-center flex-wrap">
              <div>
                <p className="text-sm text-gray-400 mb-2">Digits</p>
                <div className="flex gap-2">
                  {([4, 5] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setProDigits(n)}
                      className={`w-12 h-10 rounded-lg border font-mono font-bold transition-all ${
                        proDigits === n
                          ? 'bg-brand-red/10 border-brand-red text-brand-red'
                          : 'bg-dark-surface border-dark-border text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setProRepeat(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${proRepeat ? 'bg-brand-red' : 'bg-dark-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${proRepeat ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-300">Allow repeating digits</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setProZero(v => !v)}
                  className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${proZero ? 'bg-brand-red' : 'bg-dark-border'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${proZero ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-300">Can start with 0</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={startGame} disabled={loading} className="btn-primary px-10 py-3 text-base">
            {loading ? 'Starting...' : 'Start Game'}
          </button>
          <button onClick={() => navigate('/multiplayer')} className="btn-secondary py-3">
            Multiplayer Instead
          </button>
        </div>
      </div>
    );
  }

  // Game over screens
  if (phase === 'won' || phase === 'abandoned') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 animate-fade-in">
        <div className={`card p-8 text-center space-y-4 ${phase === 'won' ? 'glow-purple' : ''}`}>
          <div className="text-6xl">{phase === 'won' ? '🎉' : '😔'}</div>
          <h2 className="text-3xl font-bold">
            {phase === 'won' ? 'You Cracked It!' : 'Better Luck Next Time'}
          </h2>
          <div className="flex justify-center gap-3">
            {secret.split('').map((d, i) => (
              <span key={i} className={`digit-box text-2xl w-14 h-14 ${
                phase === 'won' ? 'bg-brand-green/10 border-brand-green/40 text-brand-green' : 'bg-brand-red/10 border-brand-red/30 text-brand-red'
              }`}>{d}</span>
            ))}
          </div>
          {phase === 'won' && (
            <div className="flex justify-center gap-6 text-sm text-gray-400">
              <span>Attempts: <strong className="text-white">{guesses.length}</strong></span>
              <span>Time: <strong className="text-white">{formatTime(elapsedSeconds)}</strong></span>
            </div>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={reset} className="btn-primary">Play Again</button>
            <button onClick={() => navigate('/leaderboard')} className="btn-secondary">Leaderboard</button>
          </div>
        </div>

        <div className="card p-4">
          <GuessHistory guesses={guesses} digits={game!.digits} label="Your Guesses" />
        </div>
      </div>
    );
  }

  // Playing screen
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="btn-ghost text-sm">← Back</button>
          <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
            mode === 'noob' ? 'bg-brand-green/10 text-brand-green' :
            mode === 'amateur' ? 'bg-brand-amber/10 text-brand-amber' :
            'bg-brand-red/10 text-brand-red'
          }`}>{mode}</span>
          <span className="text-gray-500 text-sm">{game!.digits} digits</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Attempts: <strong className="text-white">{guesses.length}</strong>
          </span>
          <span className="text-gray-400">
            Time: <Timer
              running={phase === 'playing'}
              onTick={setElapsedSeconds}
              className="text-white font-semibold"
            />
          </span>
        </div>
      </div>

      {/* Guess input */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Your Guess</h2>
        <GuessInput
          digits={game!.digits}
          allowRepeat={game!.allowRepeat}
          allowZero={game!.allowZero}
          onSubmit={handleGuess}
          loading={loading}
          previousGuesses={guesses.map(g => g.guess)}
        />
        <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
          <span>
            {game!.allowRepeat ? 'Digits can repeat' : 'Unique digits only'} ·
            {game!.allowZero ? ' Zero start OK' : ' No leading zero'}
          </span>
          <button onClick={handleGiveUp} className="text-gray-600 hover:text-brand-red transition-colors">
            Give up
          </button>
        </div>
      </div>

      {/* Hint bar on last guess */}
      {guesses.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-dark-card border border-dark-border rounded-xl animate-slide-up">
          <span className="text-sm text-gray-400">Last guess:</span>
          <span className="font-mono font-bold text-white tracking-widest">{guesses[guesses.length - 1].guess}</span>
          <span className="badge-cows">{guesses[guesses.length - 1].cows} Cow{guesses[guesses.length - 1].cows !== 1 ? 's' : ''}</span>
          <span className="badge-bulls">{guesses[guesses.length - 1].bulls} Bull{guesses[guesses.length - 1].bulls !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* History */}
      <div className="card p-4">
        <GuessHistory guesses={guesses} digits={game!.digits} label="Guess History" highlightLast />
      </div>
    </div>
  );
}
