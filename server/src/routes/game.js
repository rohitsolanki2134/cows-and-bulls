const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { generateSecretNumber, calculateCowsBulls, validateGuess, getModeConfig } = require('../utils/gameLogic');

const router = express.Router();

router.post('/single/start', authenticateToken, (req, res) => {
  const { mode, proDigits, proRepeat, proZero } = req.body;
  const config = getModeConfig(mode, proDigits, proRepeat, proZero);
  const gameId = uuidv4();
  const secret = generateSecretNumber(config.digits, config.allowRepeat, config.allowZero);

  db.prepare(`
    INSERT INTO games (id, mode, digits, allow_repeat, allow_zero, type, status)
    VALUES (?, ?, ?, ?, ?, 'single', 'active')
  `).run(gameId, mode, config.digits, config.allowRepeat ? 1 : 0, config.allowZero ? 1 : 0);

  const gp = db.prepare(`
    INSERT INTO game_players (game_id, user_id, secret_number)
    VALUES (?, ?, ?)
  `).run(gameId, req.user.id, secret);

  res.json({
    gameId,
    gamePlayerId: gp.lastInsertRowid,
    mode,
    digits: config.digits,
    allowRepeat: config.allowRepeat,
    allowZero: config.allowZero,
    startedAt: Date.now(),
  });
});

router.post('/single/guess', authenticateToken, (req, res) => {
  const { gameId, guess } = req.body;

  const game = db.prepare("SELECT * FROM games WHERE id = ? AND type = 'single'").get(gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'active') return res.status(400).json({ error: 'Game is already over' });

  const gp = db.prepare('SELECT * FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, req.user.id);
  if (!gp) return res.status(404).json({ error: 'Player not found in game' });

  const validation = validateGuess(guess, game.digits, !!game.allow_repeat, !!game.allow_zero);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  if (db.prepare('SELECT id FROM guesses WHERE game_player_id = ? AND guess = ?').get(gp.id, guess)) {
    return res.status(400).json({ error: 'You already tried this number' });
  }

  const attempt = gp.attempts + 1;
  const { cows, bulls } = calculateCowsBulls(gp.secret_number, guess);

  db.prepare('INSERT INTO guesses (game_player_id, guess, cows, bulls, attempt_number) VALUES (?, ?, ?, ?, ?)')
    .run(gp.id, guess, cows, bulls, attempt);
  db.prepare('UPDATE game_players SET attempts = ? WHERE id = ?').run(attempt, gp.id);

  const won = cows === game.digits;
  if (won) {
    const now = Math.floor(Date.now() / 1000);
    const timeTaken = now - game.created_at;
    db.prepare("UPDATE games SET status = 'completed', completed_at = ? WHERE id = ?").run(now, gameId);
    db.prepare('UPDATE game_players SET won = 1, completed_at = ?, time_taken = ? WHERE id = ?').run(now, timeTaken, gp.id);
  }

  res.json({
    guess,
    cows,
    bulls,
    attemptNumber: attempt,
    won,
    secret: won ? gp.secret_number : undefined,
  });
});

router.get('/single/:gameId', authenticateToken, (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const gp = db.prepare('SELECT * FROM game_players WHERE game_id = ? AND user_id = ?').get(game.id, req.user.id);
  if (!gp) return res.status(404).json({ error: 'Not your game' });

  const guesses = db.prepare('SELECT * FROM guesses WHERE game_player_id = ? ORDER BY attempt_number ASC').all(gp.id);

  res.json({
    game,
    gamePlayer: gp,
    guesses,
    secret: game.status !== 'active' ? gp.secret_number : undefined,
  });
});

router.post('/single/giveup', authenticateToken, (req, res) => {
  const { gameId } = req.body;
  const game = db.prepare("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gameId);
  if (!game) return res.status(404).json({ error: 'Active game not found' });

  const gp = db.prepare('SELECT * FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, req.user.id);
  if (!gp) return res.status(404).json({ error: 'Not your game' });

  db.prepare("UPDATE games SET status = 'abandoned' WHERE id = ?").run(gameId);
  res.json({ secret: gp.secret_number });
});

module.exports = router;
