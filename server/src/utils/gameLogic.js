function generateSecretNumber(digits, allowRepeat, allowZero) {
  if (!allowRepeat) {
    const pool = '0123456789'.split('');
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let result = '';
    for (const d of pool) {
      if (result.length === 0 && !allowZero && d === '0') continue;
      result += d;
      if (result.length === digits) break;
    }
    return result;
  } else {
    const startRange = allowZero ? 10 : 9;
    const startOffset = allowZero ? 0 : 1;
    let secret = (Math.floor(Math.random() * startRange) + startOffset).toString();
    for (let i = 1; i < digits; i++) {
      secret += Math.floor(Math.random() * 10).toString();
    }
    return secret;
  }
}

// Secret: 4271, Guess: 1234 → 1C 2B
function calculateCowsBulls(secret, guess) {
  let cows = 0;
  let bulls = 0;
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) {
      cows++;
    } else if (secret.includes(guess[i])) {
      bulls++;
    }
  }
  return { cows, bulls };
}

function validateGuess(guess, digits, allowRepeat, allowZero) {
  if (!guess || typeof guess !== 'string') {
    return { valid: false, error: 'Invalid input' };
  }
  if (!/^\d+$/.test(guess)) {
    return { valid: false, error: 'Guess must contain only digits' };
  }
  if (guess.length !== digits) {
    return { valid: false, error: `Guess must be exactly ${digits} digits` };
  }
  if (!allowZero && guess[0] === '0') {
    return { valid: false, error: 'Number cannot start with 0' };
  }
  if (!allowRepeat) {
    if (new Set(guess).size !== digits) {
      return { valid: false, error: 'All digits must be unique in this mode' };
    }
  }
  return { valid: true };
}

function getModeConfig(mode, proDigits, proRepeat, proZero) {
  switch (mode) {
    case 'noob':
      return { digits: 4, allowRepeat: false, allowZero: false };
    case 'amateur':
      return { digits: 5, allowRepeat: false, allowZero: false };
    case 'pro':
      return {
        digits: proDigits != null ? Number(proDigits) : 4,
        allowRepeat: proRepeat === true || proRepeat === 'true',
        allowZero: proZero === true || proZero === 'true',
      };
    default:
      return { digits: 4, allowRepeat: false, allowZero: false };
  }
}

module.exports = { generateSecretNumber, calculateCowsBulls, validateGuess, getModeConfig };
