import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Tab = 'login' | 'register' | 'guest';

export default function Login() {
  const { user, login, register, guestLogin } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]           = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail]       = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (user) return <Navigate to="/" replace />;

  const resetFields = (t: Tab) => {
    setTab(t);
    setError('');
    setUsername('');
    setPassword('');
    setEmail('');
    setFullName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login')    await login(username, password);
      else if (tab === 'register') await register(username, password, email, fullName);
      else                    await guestLogin(username);
      navigate('/play');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'login',    label: 'Log In',   emoji: '🔑' },
    { key: 'register', label: 'Register', emoji: '✨' },
    { key: 'guest',    label: 'Guest',    emoji: '👻' },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
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
              onClick={() => resetFields(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === t.key
                  ? 'bg-dark-card shadow font-semibold'
                  : 'hover:bg-dark-hover'
              }`}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">

          {/* Full Name — register only */}
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-field"
                placeholder="Your full name"
                autoFocus
                required
              />
            </div>
          )}

          {/* Email — register only */}
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                Used to recover your account. Cannot be changed later.
              </p>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {tab === 'guest' ? 'Nickname' : 'Username'}
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input-field"
              placeholder={tab === 'guest' ? 'Choose a nickname' : tab === 'login' ? 'Username or email' : 'Choose a username'}
              autoFocus={tab !== 'register'}
              required
            />
            {tab === 'login' && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                You can log in with your username or email address.
              </p>
            )}
          </div>

          {/* Password */}
          {tab !== 'guest' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder={tab === 'register' ? 'Create a password (min 4 chars)' : 'Enter your password'}
                required
              />
            </div>
          )}

          {error && (
            <div className="text-brand-red text-sm bg-brand-red/10 border border-brand-red/20 rounded-lg px-3 py-2">
              {error}
              {/* If email already exists, nudge user to log in */}
              {error.includes('already exists') && (
                <button
                  type="button"
                  onClick={() => resetFields('login')}
                  className="block mt-1 underline font-semibold"
                >
                  Go to Log In →
                </button>
              )}
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
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
              Guest scores are saved but won't appear on the leaderboard. Register to compete!
            </p>
          )}

          {tab === 'register' && (
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => resetFields('login')} className="underline font-semibold">
                Log in
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
