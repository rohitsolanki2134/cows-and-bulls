export type GameMode = 'noob' | 'amateur' | 'pro';

export interface GameConfig {
  mode: GameMode;
  digits: number;
  allowRepeat: boolean;
  allowZero: boolean;
  proDigits?: 4 | 5;
}

export interface Guess {
  id?: number;
  guess: string;
  cows: number;
  bulls: number;
  attemptNumber: number;
  created_at?: number;
}

export interface SingleGameState {
  gameId: string;
  gamePlayerId: number;
  mode: GameMode;
  digits: number;
  allowRepeat: boolean;
  allowZero: boolean;
  startedAt: number;
}

export interface LeaderboardEntry {
  username: string;
  mode: GameMode;
  digits: number;
  allow_repeat: number;
  allow_zero: number;
  attempts: number;
  time_taken: number;
  completed_at: number;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  fullName?: string;
}

export type MultiplayerPhase =
  | 'lobby'
  | 'room_created'
  | 'room_joined'
  | 'set_secret'
  | 'waiting_opponent'
  | 'playing'
  | 'game_over';

export interface MultiplayerPlayer {
  userId: number;
  username: string;
  ready?: boolean;
}

export interface MultiplayerState {
  phase: MultiplayerPhase;
  roomCode: string;
  gameId: string;
  mode: GameMode;
  config: { digits: number; allowRepeat: boolean; allowZero: boolean };
  players: MultiplayerPlayer[];
  currentTurn: number | null;
  myGuesses: Guess[];
  oppGuesses: Guess[];
  winner: MultiplayerPlayer | null;
  loser: MultiplayerPlayer | null;
  winnerAttempts: number;
  revealedSecret: string;
}
