import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode, MultiplayerState, Guess } from '../types/game';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import GameModeCard from '../components/GameModeCard';
import GuessInput from '../components/GuessInput';
import GuessHistory from '../components/GuessHistory';
import { validateGuess, playBeep } from '../utils/gameLogic';

const EMPTY_STATE: MultiplayerState = {
  phase: 'lobby',
  roomCode: '',
  gameId: '',
  mode: 'noob',
  config: { digits: 4, allowRepeat: false, allowZero: false },
  players: [],
  currentTurn: null,
  myGuesses: [],
  oppGuesses: [],
  winner: null,
  loser: null,
  winnerAttempts: 0,
  mySecret: '',
  loserSecret: '',
  winnerSecret: '',
};

export default function Multiplayer() {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const [state, setState] = useState<MultiplayerState>(EMPTY_STATE);
  const [mode, setMode] = useState<GameMode>('noob');
  const [joinCode, setJoinCode] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [secretError, setSecretError] = useState('');
  const [guessLoading, setGuessLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [copied, setCopied] = useState(false);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  // Session persistence: save room info on phase/roomCode changes
  useEffect(() => {
    if (state.roomCode && state.phase !== 'lobby') {
      sessionStorage.setItem('mp_room', JSON.stringify({
        roomCode: state.roomCode,
        gameId: state.gameId,
        mode: state.mode,
        config: state.config,
      }));
    } else if (state.phase === 'lobby') {
      sessionStorage.removeItem('mp_room');
    }
  }, [state.roomCode, state.phase]);

  // Auto-rejoin on socket connect/reconnect.
  // Fires immediately if the socket is already connected on mount (e.g. after a page refresh),
  // and again whenever the socket reconnects after a drop.
  useEffect(() => {
    if (!socket) return;
    const tryRejoin = () => {
      const saved = sessionStorage.getItem('mp_room');
      if (!saved) return;
      try {
        const { roomCode } = JSON.parse(saved);
        socket.emit('room:rejoin', { roomCode });
      } catch {
        sessionStorage.removeItem('mp_room');
      }
    };
    if (socket.connected) tryRejoin();   // already connected on mount → try now
    socket.on('connect', tryRejoin);     // reconnect after drop → try again
    return () => { socket.off('connect', tryRejoin); };
  }, [socket]); // intentionally omit state.phase — avoid stale closure

  useEffect(() => {
    if (!socket) return;

    socket.on('room:created', (data) => {
      setState(prev => ({
        ...prev,
        phase: 'room_created',
        roomCode: data.roomCode,
        gameId: data.gameId,
        mode: data.mode,
        config: data.config,
        players: [{ userId: user!.id, username: user!.username, ready: false }],
      }));
    });

    socket.on('room:joined', (data) => {
      setState(prev => ({
        ...prev,
        phase: 'set_secret',
        roomCode: data.roomCode,
        gameId: data.gameId,
        mode: data.mode,
        config: data.config,
        players: data.players,
      }));
    });

    socket.on('room:error', ({ message }) => notify(`Error: ${message}`));
    socket.on('game:error', ({ message }) => { notify(message); setGuessLoading(false); });

    socket.on('room:player_ready', ({ players }) => {
      setState(prev => ({ ...prev, players }));
    });

    socket.on('game:secret_set', () => {
      setState(prev => ({ ...prev, phase: 'waiting_opponent' }));
      notify('Secret set! Waiting for opponent...');
    });

    socket.on('game:started', ({ currentTurn, players }) => {
      setState(prev => ({ ...prev, phase: 'playing', currentTurn, players }));
      notify('Game started!');
      playBeep('success');
    });

    socket.on('game:guess_result', (data: { playerId: number; playerName: string; guess: string; cows: number; bulls: number; attemptNumber: number; nextTurn: number }) => {
      setGuessLoading(false);
      const g: Guess = { guess: data.guess, cows: data.cows, bulls: data.bulls, attemptNumber: data.attemptNumber };
      if (data.playerId === user!.id) {
        setState(prev => ({ ...prev, myGuesses: [...prev.myGuesses, g], currentTurn: data.nextTurn }));
        playBeep(data.cows > 0 || data.bulls > 0 ? 'success' : 'tick');
      } else {
        setState(prev => ({ ...prev, oppGuesses: [...prev.oppGuesses, g], currentTurn: data.nextTurn }));
        notify(`${data.playerName} guessed — ${data.cows}C ${data.bulls}B`);
      }
    });

    socket.on('game:over', (data) => {
      setGuessLoading(false);
      sessionStorage.removeItem('mp_room'); // room is gone after game ends
      const iAmWinner = data.winner.userId === user!.id;
      const winGuess = { guess: data.lastGuess.guess, cows: data.lastGuess.cows, bulls: data.lastGuess.bulls, attemptNumber: iAmWinner ? 0 : 0 };
      setState(prev => ({
        ...prev,
        phase: 'game_over',
        winner: data.winner,
        loser: data.loser,
        winnerAttempts: data.winnerAttempts,
        loserSecret:  data.loserSecret  || '',
        winnerSecret: data.winnerSecret || '',
        // Winner: append winning guess to MY panel
        myGuesses: iAmWinner
          ? [...prev.myGuesses, { ...winGuess, attemptNumber: prev.myGuesses.length + 1 }]
          : prev.myGuesses,
        // Loser: append opponent's winning guess to OPP panel
        oppGuesses: !iAmWinner
          ? [...prev.oppGuesses, { ...winGuess, attemptNumber: prev.oppGuesses.length + 1 }]
          : prev.oppGuesses,
      }));
      playBeep(iAmWinner ? 'win' : 'error');
    });

    socket.on('room:player_left', ({ username }) => {
      notify(`${username} left the room`);
      sessionStorage.removeItem('mp_room');
      setState(EMPTY_STATE);
    });

    // Reconnection handlers
    socket.on('room:rejoined', (data) => {
      setState(prev => ({
        ...prev,
        phase: data.phase,
        roomCode: data.roomCode,
        gameId: data.gameId,
        mode: data.mode,
        config: data.config,
        players: data.players,
        currentTurn: data.currentTurn,
        myGuesses: data.myGuesses,
        oppGuesses: data.oppGuesses,
        mySecret: data.mySecret || prev.mySecret,
      }));
      notify('Reconnected to room!');
    });

    socket.on('room:player_disconnected', ({ username }: { username: string }) => {
      notify(`${username} disconnected — waiting for them to reconnect (60s)...`);
    });

    socket.on('room:player_reconnected', ({ username }: { username: string }) => {
      notify(`${username} reconnected!`);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:error');
      socket.off('game:error');
      socket.off('room:player_ready');
      socket.off('game:secret_set');
      socket.off('game:started');
      socket.off('game:guess_result');
      socket.off('game:over');
      socket.off('room:player_left');
      socket.off('room:rejoined');
      socket.off('room:player_disconnected');
      socket.off('room:player_reconnected');
    };
  }, [socket, user]);

  const createRoom = () => {
    if (!socket) return;
    socket.emit('room:create', { mode });
  };

  const joinRoom = () => {
    if (!socket || !joinCode.trim()) return;
    socket.emit('room:join', { roomCode: joinCode.trim().toUpperCase() });
  };

  const setSecret = () => {
    if (!socket) return;
    const v = validateGuess(secretInput, state.config.digits, state.config.allowRepeat, state.config.allowZero);
    if (!v.valid) { setSecretError(v.error!); return; }
    setSecretError('');
    setState(prev => ({ ...prev, mySecret: secretInput })); // save before server confirms
    socket.emit('game:set_secret', { roomCode: state.roomCode, secret: secretInput });
  };

  const handleGuess = useCallback((guess: string) => {
    if (!socket) return;
    setGuessLoading(true);
    socket.emit('game:guess', { roomCode: state.roomCode, guess });
  }, [socket, state.roomCode]);

  const leaveRoom = () => {
    socket?.emit('room:leave');
    sessionStorage.removeItem('mp_room');
    setState(EMPTY_STATE);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(state.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMyTurn = state.currentTurn === user?.id;

  // Lobby
  if (state.phase === 'lobby') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Multiplayer</h1>
          <p className="text-slate-500">Challenge a friend in real-time 1v1.</p>
        </div>
        {notification && (
          <div className="bg-brand-red/10 border border-brand-red/20 text-brand-red px-4 py-2 rounded-xl text-sm animate-slide-up">
            {notification}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Create */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-lg text-slate-800">Create Room</h2>
            <p className="text-slate-500 text-sm">Pick a mode and share the code with a friend.</p>
            <div className="space-y-3">
              {(['noob', 'amateur', 'pro'] as GameMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border transition-all text-sm font-medium min-h-[44px] ${
                    mode === m
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {m === 'noob' ? '🌱 Noob — 4 digits' : m === 'amateur' ? '⚡ Amateur — 5 digits' : '🔥 Pro — configurable'}
                </button>
              ))}
            </div>
            <button onClick={createRoom} disabled={!socket} className="btn-primary w-full">
              Create Room
            </button>
          </div>

          {/* Join */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-lg text-slate-800">Join Room</h2>
            <p className="text-slate-500 text-sm">Enter the 6-character code from your friend.</p>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ROOM CODE"
              className="input-field font-mono text-center text-xl tracking-widest uppercase"
              maxLength={6}
            />
            <button onClick={joinRoom} disabled={!socket || joinCode.length < 6} className="btn-primary w-full">
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting for 2nd player
  if (state.phase === 'room_created') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        <div className="text-5xl">🔗</div>
        <h2 className="text-2xl font-bold">Room Created!</h2>
        <p className="text-slate-500">Share this code with your opponent:</p>
        <div className="card p-6">
          <div className="font-mono text-4xl font-bold tracking-[0.3em] text-slate-800 mb-4">{state.roomCode}</div>
          <button onClick={copyCode} className="btn-secondary text-sm">
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <span className="w-2 h-2 bg-brand-amber rounded-full animate-pulse" />
          Waiting for opponent to join...
        </div>
        <button onClick={leaveRoom} className="btn-ghost text-sm text-slate-600">Cancel</button>
      </div>
    );
  }

  // Set secret (both players in room)
  if (state.phase === 'set_secret' || state.phase === 'waiting_opponent') {
    const myPlayer = state.players.find(p => p.userId === user?.id);
    const allReady = state.players.length === 2 && state.players.every(p => p.ready);

    return (
      <div className="max-w-md mx-auto px-4 py-10 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Set Your Secret</h2>
          <p className="text-slate-500 text-sm mt-1">
            Choose a {state.config.digits}-digit number for your opponent to guess.
          </p>
        </div>

        {notification && (
          <div className="bg-brand-purple/10 border border-brand-purple/20 text-brand-purple px-4 py-2 rounded-xl text-sm">
            {notification}
          </div>
        )}

        {/* Show the player's own secret once they've set it */}
        {state.mySecret && (
          <div className="card p-4 border-l-4 border-brand-amber flex items-center gap-4 flex-wrap">
            <div className="text-sm font-semibold text-brand-amber whitespace-nowrap">🔒 Your secret</div>
            <div className="flex gap-1.5">
              {state.mySecret.split('').map((d, i) => (
                <span key={i} className="digit-box w-9 h-9 text-base bg-brand-amber/10 border-brand-amber/40 text-brand-amber">{d}</span>
              ))}
            </div>
            <span className="text-xs text-slate-500 ml-auto">Opponent will try to guess this</span>
          </div>
        )}

        {/* Players */}
        <div className="card p-4 flex gap-3">
          {state.players.map(p => (
            <div key={p.userId} className={`flex-1 text-center py-2 rounded-lg ${
              p.ready ? 'bg-brand-green/10 border border-brand-green/20' : 'bg-slate-50 border border-slate-200'
            }`}>
              <p className="font-semibold text-sm text-slate-800">{p.username}</p>
              <p className={`text-xs mt-0.5 ${p.ready ? 'text-brand-green' : 'text-slate-500'}`}>
                {p.ready ? 'Ready' : 'Setting secret...'}
              </p>
            </div>
          ))}
        </div>

        {state.phase === 'set_secret' && !myPlayer?.ready && (
          <div className="card p-5 space-y-3">
            <div className="flex gap-2">
              {Array.from({ length: state.config.digits }).map((_, i) => (
                <div key={i} className={`flex-1 h-12 flex items-center justify-center rounded-lg border font-mono font-bold text-xl transition-colors ${
                  secretInput[i] ? 'bg-brand-red/10 border-brand-red text-brand-red' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>{secretInput[i] || '·'}</div>
              ))}
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={secretInput}
              onChange={e => { setSecretInput(e.target.value.replace(/\D/g, '').slice(0, state.config.digits)); setSecretError(''); }}
              placeholder={`Enter ${state.config.digits}-digit secret`}
              className="input-field font-mono text-center text-xl tracking-widest"
              maxLength={state.config.digits}
            />
            {secretError && <p className="text-brand-red text-sm">{secretError}</p>}
            <p className="text-xs text-slate-500">
              {state.config.allowRepeat ? 'Repeats OK' : 'Unique digits'} ·
              {state.config.allowZero ? ' Can start with 0' : ' No leading zero'}
            </p>
            <button
              onClick={setSecret}
              disabled={secretInput.length !== state.config.digits}
              className="btn-primary w-full"
            >
              Set Secret
            </button>
          </div>
        )}

        {allReady && <p className="text-center text-brand-green text-sm animate-pulse">Both ready — starting...</p>}

        <button onClick={leaveRoom} className="btn-ghost w-full text-sm text-slate-600">Leave Room</button>
      </div>
    );
  }

  // Playing
  if (state.phase === 'playing') {
    const oppPlayer = state.players.find(p => p.userId !== user?.id);
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Your secret reminder — pinned at TOP so it's always visible */}
        {state.mySecret && (
          <div className="card p-4 border-l-4 border-brand-amber flex items-center gap-4 flex-wrap">
            <div className="text-sm font-semibold text-brand-amber whitespace-nowrap">🔒 Your secret</div>
            <div className="flex gap-1.5">
              {state.mySecret.split('').map((d, i) => (
                <span key={i} className="digit-box w-9 h-9 text-base bg-brand-amber/10 border-brand-amber/40 text-brand-amber">{d}</span>
              ))}
            </div>
            <span className="text-xs text-slate-500 ml-auto">{oppPlayer?.username ?? 'Opponent'} is trying to guess this</span>
          </div>
        )}

        {/* Status bar */}
        <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl border ${
          isMyTurn ? 'bg-brand-purple/10 border-brand-purple/30' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isMyTurn ? 'bg-brand-green animate-pulse' : 'bg-slate-400'}`} />
            <span className="font-semibold text-sm">
              {isMyTurn ? 'Your turn' : `${oppPlayer?.username ?? 'Opponent'}'s turn`}
            </span>
          </div>
          <div className="text-xs text-slate-500">Room: <span className="text-slate-700 font-mono">{state.roomCode}</span></div>
        </div>

        {notification && (
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm text-slate-700 animate-slide-up">
            {notification}
          </div>
        )}

        {/* Guess input */}
        {isMyTurn && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Guess {oppPlayer?.username}'s secret
            </h3>
            <GuessInput
              digits={state.config.digits}
              allowRepeat={state.config.allowRepeat}
              allowZero={state.config.allowZero}
              onSubmit={handleGuess}
              loading={guessLoading}
              previousGuesses={state.myGuesses.map(g => g.guess)}
            />
          </div>
        )}

        {!isMyTurn && (
          <div className="card p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <span className="w-2 h-2 bg-brand-amber rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-brand-amber rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-2 h-2 bg-brand-amber rounded-full animate-bounce [animation-delay:0.3s]" />
              <span className="ml-2 text-sm">{oppPlayer?.username} is thinking...</span>
            </div>
          </div>
        )}

        {/* Guess panels — stack on mobile, side by side on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4 my-guesses-panel">
            <GuessHistory
              guesses={state.myGuesses}
              digits={state.config.digits}
              label={`Your Guesses (${state.myGuesses.length})`}
              highlightLast
              tableClass="my-guesses-table"
            />
          </div>
          <div className="card p-4 opp-guesses-panel">
            <GuessHistory
              guesses={state.oppGuesses}
              digits={state.config.digits}
              label={`${oppPlayer?.username ?? 'Opponent'}'s Guesses (${state.oppGuesses.length})`}
              tableClass="opp-guesses-table"
            />
          </div>
        </div>

        <button onClick={leaveRoom} className="btn-ghost text-sm text-slate-600 w-full">Forfeit &amp; Leave</button>
      </div>
    );
  }

  // Game over
  if (state.phase === 'game_over') {
    const iWon = state.winner?.userId === user?.id;
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6 animate-fade-in">
        <div className={`card p-8 text-center space-y-4 ${iWon ? 'glow-purple' : ''}`}>
          <div className="text-6xl">{iWon ? '🏆' : '💀'}</div>
          <h2 className="text-2xl sm:text-3xl font-bold">{iWon ? 'You Won!' : 'You Lost!'}</h2>
          <p className="text-slate-500">
            {iWon
              ? `Cracked it in ${state.winnerAttempts} attempts!`
              : `${state.winner?.username} cracked it in ${state.winnerAttempts} attempts.`}
          </p>
          {/* Both secrets revealed */}
          <div className="flex justify-center gap-8 flex-wrap">
            {/* The secret the winner cracked (loser's number) */}
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-2">
                {iWon ? '✅ Secret you cracked' : `❌ Your secret (${state.winner?.username} cracked it)`}
              </p>
              <div className="flex gap-1.5 justify-center">
                {(state.loserSecret || '').split('').map((d, i) => (
                  <span key={i} className={`digit-box text-xl w-12 h-12 ${
                    iWon ? 'bg-brand-green/10 border-brand-green/40 text-brand-green'
                         : 'bg-brand-red/10 border-brand-red/30 text-brand-red'
                  }`}>{d}</span>
                ))}
              </div>
            </div>
            {/* The winner's secret (what the loser was trying to crack) */}
            {state.winnerSecret && (
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-2">
                  {iWon ? '🔒 Your secret (unguessed)' : `🔓 ${state.winner?.username}'s secret`}
                </p>
                <div className="flex gap-1.5 justify-center">
                  {(state.winnerSecret || '').split('').map((d, i) => (
                    <span key={i} className="digit-box text-xl w-12 h-12 bg-brand-purple/10 border-brand-purple/40 text-brand-purple">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => setState(EMPTY_STATE)} className="btn-primary">Play Again</button>
            <button onClick={() => navigate('/leaderboard')} className="btn-secondary">Leaderboard</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4 my-guesses-panel">
            <GuessHistory guesses={state.myGuesses} digits={state.config.digits} label="Your Guesses" tableClass="my-guesses-table" />
          </div>
          <div className="card p-4 opp-guesses-panel">
            <GuessHistory guesses={state.oppGuesses} digits={state.config.digits} label="Opponent's Guesses" tableClass="opp-guesses-table" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
