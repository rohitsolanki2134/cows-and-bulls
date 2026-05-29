import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🐄</span>
          <span className="font-bold text-lg">
            <span className="text-gradient">Cows</span>
            <span className="text-slate-400 mx-1">&amp;</span>
            <span className="text-gradient">Bulls</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/" className="btn-ghost text-sm min-h-[44px] flex items-center">Home</Link>
          <Link to="/leaderboard" className="btn-ghost text-sm min-h-[44px] flex items-center">Leaderboard</Link>

          {user ? (
            <div className="flex items-center gap-2 ml-2">
              <Link to="/play" className="btn-primary text-sm py-1.5 px-3 min-h-[44px] flex items-center">Play</Link>
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <span className="text-sm text-slate-600">
                  <span className="text-slate-800 font-medium">{user.username}</span>
                </span>
                <button onClick={handleLogout} className="btn-ghost text-sm text-slate-500 min-h-[44px]">
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-sm py-1.5 px-4 ml-2 min-h-[44px] flex items-center">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
