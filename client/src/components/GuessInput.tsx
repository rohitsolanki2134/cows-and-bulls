import { useState, useRef, useEffect } from 'react';
import { validateGuess } from '../utils/gameLogic';

interface GuessInputProps {
  digits: number;
  allowRepeat: boolean;
  allowZero: boolean;
  onSubmit: (guess: string) => void;
  loading?: boolean;
  disabled?: boolean;
  previousGuesses: string[];
}

export default function GuessInput({
  digits, allowRepeat, allowZero, onSubmit, loading, disabled, previousGuesses
}: GuessInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [disabled]);

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, digits);
    setValue(raw);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateGuess(value, digits, allowRepeat, allowZero);
    if (!v.valid) { triggerShake(v.error!); return; }
    if (previousGuesses.includes(value)) { triggerShake('Already tried this number'); return; }
    onSubmit(value);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit(e as unknown as React.FormEvent);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        {/* Visual digit boxes preview */}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: digits }).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-12 flex items-center justify-center rounded-lg border font-mono font-bold text-xl transition-all duration-100 ${
                value[i]
                  ? 'bg-brand-purple/10 border-brand-purple text-white'
                  : 'bg-dark-surface border-dark-border text-gray-700'
              }`}
            >
              {value[i] || '·'}
            </div>
          ))}
        </div>

        <div className={`flex-1 flex gap-2 ${shake ? 'animate-shake' : ''}`}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={digits}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            placeholder={`Enter ${digits}-digit number`}
            className="input-field font-mono text-xl tracking-widest text-center"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={disabled || loading || value.length !== digits}
            className="btn-primary whitespace-nowrap"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Guess'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-brand-red text-sm animate-fade-in">{error}</p>
      )}
    </form>
  );
}
