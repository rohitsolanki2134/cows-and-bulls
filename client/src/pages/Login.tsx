import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Tab = 'login' | 'register' | 'guest';

export default function Login() {
  const { user, login, register, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') await login(username, password);
      else if (tab === 'register') await register(username, password);
      else await guestLogin(username);
      navigate('/play');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'login', label: 'Log In', emoji: '🔑' },
    { key: 'register', label: 'Register', emoji: '✨' },
    { key: 'guest', label: 'Guest', emoji: '👻' },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gradient mb-2">Welcome</h1>
          <p className="text-gray-500 text-sm">Sign in to track your scores and play multiplayer</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-dark-surface rounded-xl p-1 gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === t.key
                  ? 'bg-dark-card text-white shadow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input-field"
              placeholder={tab === 'guest' ? 'Choose a nickname' : 'Enter your username'}
              autoFocus
              required
            />
          </div>

          {tab !== 'guest' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
              />
            </div>
          )}

          {error && (
            <div className="text-brand-red text-sm bg-brand-red/10 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Please wait...
              </span>
            ) : (
              tabs.find(t => t.key === tab)?.label
            )}
          </button>

          {tab === 'guest' && (
            <p className="text-xs text-gray-600 text-center">
              Guest scores are saved but the account has no password. Register later to secure it.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
