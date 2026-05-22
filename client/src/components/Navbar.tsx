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
    <nav className="sticky top-0 z-50 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🐄</span>
          <span className="font-bold text-lg hidden sm:block">
            <span className="text-gradient">Cows</span>
            <span className="text-gray-400 mx-1">&amp;</span>
            <span className="text-gradient">Bulls</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/" className="btn-ghost text-sm">Home</Link>
          <Link to="/leaderboard" className="btn-ghost text-sm">Leaderboard</Link>

          {user ? (
            <div className="flex items-center gap-2 ml-2">
              <Link to="/play" className="btn-primary text-sm py-1.5 px-3">Play</Link>
              <div className="flex items-center gap-2 pl-2 border-l border-dark-border">
                <span className="text-sm text-gray-400 hidden sm:block">
                  <span className="text-white font-medium">{user.username}</span>
                </span>
                <button onClick={handleLogout} className="btn-ghost text-sm text-gray-500">
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-sm py-1.5 px-4 ml-2">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
