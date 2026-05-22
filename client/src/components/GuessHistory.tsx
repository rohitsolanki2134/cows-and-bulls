import type { Guess } from '../types/game';

interface GuessHistoryProps {
  guesses: Guess[];
  digits: number;
  label?: string;
  highlightLast?: boolean;
}

export default function GuessHistory({ guesses, digits, label, highlightLast }: GuessHistoryProps) {
  if (guesses.length === 0) {
    return (
      <div className="text-center py-10 text-gray-600">
        <div className="text-4xl mb-2">🤔</div>
        <p className="text-sm">No guesses yet. Make your first move!</p>
      </div>
    );
  }

  // Newest guess at the top
  const displayed = [...guesses].reverse();

  return (
    <div>
      {label && <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{label}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left pb-3 pl-2 w-10">#</th>
              <th className="text-left pb-3">Guess</th>
              <th className="text-center pb-3">Cows</th>
              <th className="text-center pb-3">Bulls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {displayed.map((g, idx) => {
              const isNewest = highlightLast && idx === 0;
              const isWin = g.cows === digits;
              return (
                <tr
                  key={g.id ?? g.attemptNumber}
                  className={`transition-colors duration-150 ${
                    isWin ? 'bg-brand-green/5' : isNewest ? 'bg-dark-hover' : 'hover:bg-dark-hover/50'
                  } ${idx === 0 ? 'animate-slide-up' : ''}`}
                >
                  <td className="py-2.5 pl-2 text-gray-500 font-mono text-xs">{g.attemptNumber}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1">
                      {g.guess.split('').map((d, i) => (
                        <span
                          key={i}
                          className={`w-8 h-8 flex items-center justify-center rounded-md font-mono font-bold text-sm border ${
                            isWin
                              ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                              : 'bg-dark-surface border-dark-border text-white'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      g.cows > 0
                        ? 'bg-brand-green/15 text-brand-green'
                        : 'text-gray-600'
                    }`}>
                      {g.cows}
                    </span>
                  </td>
                  <td className="py-2.5 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                      g.bulls > 0
                        ? 'bg-brand-amber/15 text-brand-amber'
                        : 'text-gray-600'
                    }`}>
                      {g.bulls}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
