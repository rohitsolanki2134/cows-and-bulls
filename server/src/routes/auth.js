const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { username, password, email, fullName } = req.body;

  // Validate username
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  // Validate password
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  // Validate email
  if (!email || !isValidEmail(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  // Validate name
  if (!fullName || fullName.trim().length < 2) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters' });
  }

  const cleanUsername = username.trim();
  const cleanEmail    = email.trim().toLowerCase();
  const cleanName     = fullName.trim();

  // Check username uniqueness
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername)) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  // Check email uniqueness — give a specific error so user knows to log in
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
    return res.status(400).json({ error: 'An account with this email already exists. Please log in instead.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, email, full_name) VALUES (?, ?, ?, ?)'
  ).run(cleanUsername, hash, cleanEmail, cleanName);

  const user = { id: result.lastInsertRowid, username: cleanUsername, email: cleanEmail, fullName: cleanName };
  res.json({ token: issueToken(user), user });
});

// ── Login (accepts username OR email) ────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  // Try username first, then treat input as email
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user && isValidEmail(username)) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(username.trim().toLowerCase());
  }

  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: 'Invalid username/email or password' });
  }

  res.json({
    token: issueToken(user),
    user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name },
  });
});

// ── Guest ─────────────────────────────────────────────────────────────────────
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

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, email, full_name FROM users WHERE id = ?').get(decoded.id);
    res.json({ user: { ...user, fullName: user.full_name } });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
});

module.exports = router;
