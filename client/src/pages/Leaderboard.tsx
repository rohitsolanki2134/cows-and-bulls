import { useState, useEffect } from 'react';
import type { GameMode, LeaderboardEntry } from '../types/game';
import api from '../utils/api';
import { formatTime } from '../utils/gameLogic';

const MODES: { key: 'all' | GameMode; label: string; emoji: string }[] = [
  { key: 'all', label: 'All Modes', emoji: '🏅' },
  { key: 'noob', label: 'Noob', emoji: '🌱' },
  { key: 'amateur', label: 'Amateur', emoji: '⚡' },
  { key: 'pro', label: 'Pro', emoji: '🔥' },
];

interface Stats {
  totalGames: number;
  totalPlayers: number;
  gamesWon: number;
  avgAttempts: number;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mode, setMode] = useState<'all' | GameMode>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/leaderboard/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/leaderboard', { params: { mode: mode === 'all' ? undefined : mode, limit: 50 } })
      .then(r => setEntries(r.data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [mode]);

  const medal = (rank: number) =>
    rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">Leaderboard</h1>
        <p className="text-gray-500">Top players ranked by fewest attempts, then fastest time.</p>
      </div>

      {/* Global stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Games Played', value: stats.totalGames, emoji: '🎮' },
            { label: 'Players', value: stats.totalPlayers, emoji: '👥' },
            { label: 'Games Won', value: stats.gamesWon, emoji: '🏆' },
            { label: 'Avg Attempts', value: stats.avgAttempts, emoji: '📊' },
          ].map(({ label, value, emoji }) => (
            <div key={label} className="card p-4 text-center">
              <div className="text-2xl mb-1">{emoji}</div>
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mode filter */}
      <div className="flex gap-2 flex-wrap">
        {MODES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
              mode === key
                ? 'bg-brand-red/10 border-brand-red text-brand-red'
                : 'bg-dark-card border-dark-border text-gray-400 hover:border-gray-500'
            }`}
          >
            <span>{emoji}</span> {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <span className="w-6 h-6 border-2 border-gray-600 border-t-brand-red rounded-full animate-spin mr-3" />
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <div className="text-4xl mb-2">🏜️</div>
            <p>No entries yet. Be the first!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-surface">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 w-12">Rank</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-center">Attempts</th>
                  <th className="px-4 py-3 text-center">Time</th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">Digits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {entries.map((e, i) => (
                  <tr key={i} className={`hover:bg-dark-hover/50 transition-colors ${i < 3 ? 'bg-brand-amber/2' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                        {medal(i)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{e.username}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${
                        e.mode === 'noob' ? 'bg-brand-green/10 text-brand-green' :
                        e.mode === 'amateur' ? 'bg-brand-amber/10 text-brand-amber' :
                        'bg-brand-red/10 text-brand-red'
                      }`}>
                        {e.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-white">{e.attempts}</td>
                    <td className="px-4 py-3 text-center text-gray-400 font-mono">
                      {e.time_taken ? formatTime(e.time_taken) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                      {e.digits}
                      {e.allow_repeat ? ' +R' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
