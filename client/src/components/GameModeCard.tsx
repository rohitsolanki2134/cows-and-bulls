import type { GameMode } from '../types/game';

interface ModeConfig {
  mode: GameMode;
  title: string;
  emoji: string;
  description: string;
  rules: string[];
  color: string;
  borderColor: string;
  bgColor: string;
}

const MODES: ModeConfig[] = [
  {
    mode: 'noob',
    title: 'Noob',
    emoji: '🌱',
    description: '4-digit number, unique digits, no leading zero.',
    rules: ['4 digits', 'All digits unique', 'Cannot start with 0'],
    color: 'text-brand-green',
    borderColor: 'border-brand-green/20 hover:border-brand-green/50',
    bgColor: 'hover:bg-brand-green/5',
  },
  {
    mode: 'amateur',
    title: 'Amateur',
    emoji: '⚡',
    description: '5-digit number, unique digits, no leading zero.',
    rules: ['5 digits', 'All digits unique', 'Cannot start with 0'],
    color: 'text-brand-amber',
    borderColor: 'border-brand-amber/20 hover:border-brand-amber/50',
    bgColor: 'hover:bg-brand-amber/5',
  },
  {
    mode: 'pro',
    title: 'Pro',
    emoji: '🔥',
    description: '4 or 5 digits, repeating allowed, configurable.',
    rules: ['4 or 5 digits (your choice)', 'Digits can repeat', 'Can start with 0 (optional)'],
    color: 'text-brand-red',
    borderColor: 'border-brand-red/20 hover:border-brand-red/50',
    bgColor: 'hover:bg-brand-red/5',
  },
];

interface GameModeCardProps {
  selected: GameMode | null;
  onSelect: (mode: GameMode) => void;
}

export default function GameModeCard({ selected, onSelect }: GameModeCardProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {MODES.map(({ mode, title, emoji, description, rules, color, borderColor, bgColor }) => (
        <button
          key={mode}
          onClick={() => onSelect(mode)}
          className={`card ${borderColor} ${bgColor} p-5 text-left transition-all duration-200 cursor-pointer ${
            selected === mode ? `ring-2 ring-offset-2 ring-offset-dark-bg ${
              mode === 'noob' ? 'ring-brand-green' :
              mode === 'amateur' ? 'ring-brand-amber' :
              'ring-brand-red'
            }` : ''
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{emoji}</span>
            <span className={`font-bold text-lg ${color}`}>{title}</span>
          </div>
          <p className="text-gray-400 text-sm mb-3">{description}</p>
          <ul className="space-y-1">
            {rules.map(rule => (
              <li key={rule} className="text-xs text-gray-500 flex items-center gap-1.5">
                <span className={`w-1 h-1 rounded-full bg-current ${color}`} />
                {rule}
              </li>
            ))}
          </ul>
        </button>
      ))}
    </div>
  );
}
