const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const clean = username.trim();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(clean)) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(clean, hash);
  const user = { id: result.lastInsertRowid, username: clean };
  res.json({ token: issueToken(user), user });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: 'Invalid username or password' });
  }
  res.json({ token: issueToken(user), user: { id: user.id, username: user.username } });
});

router.post('/guest', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters' });
  }
  const clean = `${username.trim()}_guest`;
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(clean);
  if (!user) {
    const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(clean, '');
    user = { id: result.lastInsertRowid, username: clean };
  }
  res.json({ token: issueToken(user), user: { id: user.id, username: user.username } });
});

router.get('/me', (req, res) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.id);
    res.json({ user });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
});

module.exports = router;
