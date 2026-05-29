import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const howToPlay = [
    { label: 'Cow 🐄', desc: 'Correct digit in the correct position', color: 'text-brand-green' },
    { label: 'Bull 🐂', desc: 'Correct digit but in the wrong position', color: 'text-brand-amber' },
  ];

  const example = [
    { digit: '1', cow: false, bull: true },
    { digit: '2', cow: true, bull: false },
    { digit: '3', cow: false, bull: false },
    { digit: '4', cow: false, bull: true },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-20">
      {/* Hero */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600 mb-4">
          <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-pulse" />
          Number Guessing · Single &amp; Multiplayer
        </div>
        <h1 className="text-4xl sm:text-7xl font-extrabold leading-tight">
          <span className="text-gradient">Cows</span>
          <span className="text-slate-400 mx-3">&amp;</span>
          <span className="text-gradient">Bulls</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          Crack the secret number using logic and deduction. Get hints after every guess — how many cows and bulls?
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <>
              <button onClick={() => navigate('/play')} className="btn-primary text-base px-8 py-3">
                Play Solo
              </button>
              <button onClick={() => navigate('/multiplayer')} className="btn-secondary text-base px-8 py-3">
                Challenge a Friend
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-primary text-base px-8 py-3">Get Started</Link>
              <Link to="/leaderboard" className="btn-secondary text-base px-8 py-3">View Leaderboard</Link>
            </>
          )}
        </div>
      </div>

      {/* How to play */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-center">How to Play</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {howToPlay.map(({ label, desc, color }) => (
            <div key={label} className="card p-5 flex items-start gap-4">
              <span className={`text-2xl font-bold ${color} w-24 shrink-0`}>{label}</span>
              <p className="text-slate-600 mt-1">{desc}</p>
            </div>
          ))}
        </div>

        {/* Example */}
        <div className="card p-6 space-y-4">
          <p className="text-slate-500 text-sm uppercase tracking-wide font-semibold">Example</p>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Secret</p>
              <div className="flex gap-1">
                {['4','2','7','1'].map((d, i) => (
                  <span key={i} className="digit-box bg-brand-purple/10 border-brand-purple/30 text-brand-purple">{d}</span>
                ))}
              </div>
            </div>
            <span className="text-2xl text-slate-400">→</span>
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Guess</p>
              <div className="flex gap-1">
                {example.map(({ digit, cow, bull }, i) => (
                  <span key={i} className={`digit-box ${
                    cow ? 'bg-brand-green/10 border-brand-green/40 text-brand-green' :
                    bull ? 'bg-brand-amber/10 border-brand-amber/40 text-brand-amber' :
                    ''
                  }`}>{digit}</span>
                ))}
              </div>
            </div>
            <span className="text-2xl text-slate-400">→</span>
            <div className="flex gap-2">
              <span className="badge-cows">1 Cow</span>
              <span className="badge-bulls">2 Bulls</span>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            <span className="text-brand-green font-semibold">2</span> is a Cow (right digit, right spot) ·
            <span className="text-brand-amber font-semibold ml-1">1</span> and
            <span className="text-brand-amber font-semibold ml-1">4</span> are Bulls (right digit, wrong spot)
          </p>
        </div>
      </div>

      {/* Modes */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">Game Modes</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { emoji: '🌱', title: 'Noob', detail: '4 digits · unique', color: 'text-brand-green', bg: 'bg-brand-green/5', border: 'border-brand-green/20' },
            { emoji: '⚡', title: 'Amateur', detail: '5 digits · unique', color: 'text-brand-amber', bg: 'bg-brand-amber/5', border: 'border-brand-amber/20' },
            { emoji: '🔥', title: 'Pro', detail: '4–5 digits · repeats allowed', color: 'text-brand-red', bg: 'bg-brand-red/5', border: 'border-brand-red/20' },
          ].map(({ emoji, title, detail, color, bg, border }) => (
            <div key={title} className={`card ${border} ${bg} p-5 text-center`}>
              <div className="text-4xl mb-2">{emoji}</div>
              <div className={`font-bold text-lg ${color}`}>{title}</div>
              <div className="text-slate-500 text-sm mt-1">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
