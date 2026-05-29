const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { mode, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT
      u.username,
      g.mode,
      g.digits,
      g.allow_repeat,
      g.allow_zero,
      gp.attempts,
      gp.time_taken,
      gp.completed_at
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    JOIN users u ON u.id = gp.user_id
    WHERE gp.won = 1 AND g.type = 'single'
      AND u.password_hash != ''
  `;
  const params = [];
  if (mode && mode !== 'all') {
    query += ' AND g.mode = ?';
    params.push(mode);
  }
  query += ' ORDER BY gp.attempts ASC, gp.time_taken ASC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const entries = db.prepare(query).all(...params);
  res.json({ entries });
});

router.get('/stats', (req, res) => {
  res.json({
    totalGames: db.prepare("SELECT COUNT(*) as c FROM games WHERE type = 'single'").get().c,
    totalPlayers: db.prepare("SELECT COUNT(*) as c FROM users WHERE password_hash != ''").get().c,
    gamesWon: db.prepare('SELECT COUNT(*) as c FROM game_players WHERE won = 1').get().c,
    avgAttempts: db.prepare("SELECT ROUND(AVG(attempts), 1) as a FROM game_players WHERE won = 1").get().a || 0,
  });
});

module.exports = router;
