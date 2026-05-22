const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { calculateCowsBulls, validateGuess, getModeConfig } = require('../utils/gameLogic');

// In-memory room state (supplemental to DB)
const rooms = new Map();

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[ws] connected: ${socket.user.username}`);

    socket.on('room:create', ({ mode, proDigits, proRepeat, proZero } = {}) => {
      const config = getModeConfig(mode || 'noob', proDigits, proRepeat, proZero);
      let roomCode;
      let attempts = 0;
      do {
        roomCode = genRoomCode();
        attempts++;
      } while (db.prepare('SELECT id FROM games WHERE room_code = ?').get(roomCode) && attempts < 20);

      const gameId = uuidv4();
      db.prepare(`
        INSERT INTO games (id, mode, digits, allow_repeat, allow_zero, type, status, room_code)
        VALUES (?, ?, ?, ?, ?, 'multi', 'waiting', ?)
      `).run(gameId, mode, config.digits, config.allowRepeat ? 1 : 0, config.allowZero ? 1 : 0, roomCode);

      const gp = db.prepare('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)').run(gameId, socket.user.id);

      rooms.set(roomCode, {
        gameId,
        mode,
        config,
        players: [{
          socketId: socket.id,
          userId: socket.user.id,
          username: socket.user.username,
          gpId: gp.lastInsertRowid,
          ready: false,
          attempts: 0,
        }],
        currentTurn: null,
        started: false,
      });

      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.emit('room:created', { roomCode, gameId, mode, config });
    });

    socket.on('room:join', ({ roomCode } = {}) => {
      const game = db.prepare("SELECT * FROM games WHERE room_code = ? AND status = 'waiting'").get(roomCode);
      if (!game) return socket.emit('room:error', { message: 'Room not found or game already started' });

      const room = rooms.get(roomCode);
      if (!room) return socket.emit('room:error', { message: 'Room not found' });
      if (room.players.length >= 2) return socket.emit('room:error', { message: 'Room is full' });
      if (room.players.some(p => p.userId === socket.user.id)) {
        return socket.emit('room:error', { message: 'You are already in this room' });
      }

      const gp = db.prepare('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)').run(game.id, socket.user.id);
      room.players.push({
        socketId: socket.id,
        userId: socket.user.id,
        username: socket.user.username,
        gpId: gp.lastInsertRowid,
        ready: false,
        attempts: 0,
      });

      socket.join(roomCode);
      socket.roomCode = roomCode;

      const playerList = room.players.map(p => ({ userId: p.userId, username: p.username, ready: p.ready }));
      io.to(roomCode).emit('room:joined', {
        roomCode,
        gameId: game.id,
        mode: game.mode,
        config: { digits: game.digits, allowRepeat: !!game.allow_repeat, allowZero: !!game.allow_zero },
        players: playerList,
      });
    });

    socket.on('game:set_secret', ({ roomCode, secret } = {}) => {
      const room = rooms.get(roomCode);
      if (!room) return socket.emit('game:error', { message: 'Room not found' });

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return socket.emit('game:error', { message: 'You are not in this room' });
      if (player.ready) return socket.emit('game:error', { message: 'Secret already set' });

      const game = db.prepare('SELECT * FROM games WHERE room_code = ?').get(roomCode);
      const v = validateGuess(secret, game.digits, !!game.allow_repeat, !!game.allow_zero);
      if (!v.valid) return socket.emit('game:error', { message: v.error });

      db.prepare('UPDATE game_players SET secret_number = ? WHERE id = ?').run(secret, player.gpId);
      player.ready = true;
      socket.emit('game:secret_set', { ok: true });

      const playerList = room.players.map(p => ({ userId: p.userId, username: p.username, ready: p.ready }));

      if (room.players.length === 2 && room.players.every(p => p.ready)) {
        db.prepare("UPDATE games SET status = 'active' WHERE room_code = ?").run(roomCode);
        room.started = true;
        room.currentTurn = room.players[0].userId;
        io.to(roomCode).emit('game:started', {
          currentTurn: room.currentTurn,
          players: playerList,
        });
      } else {
        io.to(roomCode).emit('room:player_ready', { userId: socket.user.id, players: playerList });
      }
    });

    socket.on('game:guess', ({ roomCode, guess } = {}) => {
      const room = rooms.get(roomCode);
      if (!room || !room.started) return socket.emit('game:error', { message: 'Game not started' });
      if (room.currentTurn !== socket.user.id) return socket.emit('game:error', { message: 'Not your turn' });

      const game = db.prepare("SELECT * FROM games WHERE room_code = ? AND status = 'active'").get(roomCode);
      if (!game) return socket.emit('game:error', { message: 'Game not active' });

      const v = validateGuess(guess, game.digits, !!game.allow_repeat, !!game.allow_zero);
      if (!v.valid) return socket.emit('game:error', { message: v.error });

      const me = room.players.find(p => p.userId === socket.user.id);
      const opp = room.players.find(p => p.userId !== socket.user.id);
      if (!me || !opp) return;

      if (db.prepare('SELECT id FROM guesses WHERE game_player_id = ? AND guess = ?').get(me.gpId, guess)) {
        return socket.emit('game:error', { message: 'Already tried this number' });
      }

      const oppData = db.prepare('SELECT * FROM game_players WHERE id = ?').get(opp.gpId);
      const { cows, bulls } = calculateCowsBulls(oppData.secret_number, guess);
      me.attempts++;

      db.prepare('INSERT INTO guesses (game_player_id, guess, cows, bulls, attempt_number) VALUES (?, ?, ?, ?, ?)')
        .run(me.gpId, guess, cows, bulls, me.attempts);
      db.prepare('UPDATE game_players SET attempts = ? WHERE id = ?').run(me.attempts, me.gpId);

      if (cows === game.digits) {
        const now = Math.floor(Date.now() / 1000);
        db.prepare("UPDATE games SET status = 'completed', completed_at = ? WHERE room_code = ?").run(now, roomCode);
        db.prepare('UPDATE game_players SET won = 1, completed_at = ?, time_taken = ? WHERE id = ?')
          .run(now, now - game.created_at, me.gpId);

        io.to(roomCode).emit('game:over', {
          winner: { userId: me.userId, username: me.username },
          loser: { userId: opp.userId, username: opp.username },
          winnerAttempts: me.attempts,
          secret: oppData.secret_number,
          lastGuess: { guess, cows, bulls },
        });
        rooms.delete(roomCode);
      } else {
        room.currentTurn = opp.userId;
        io.to(roomCode).emit('game:guess_result', {
          playerId: socket.user.id,
          playerName: socket.user.username,
          guess,
          cows,
          bulls,
          attemptNumber: me.attempts,
          nextTurn: room.currentTurn,
        });
      }
    });

    socket.on('room:leave', () => handleLeave(socket, io));
    socket.on('disconnect', () => handleLeave(socket, io));
  });
}

function handleLeave(socket, io) {
  const roomCode = socket.roomCode;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (room) {
    io.to(roomCode).emit('room:player_left', {
      userId: socket.user.id,
      username: socket.user.username,
    });
    db.prepare("UPDATE games SET status = 'abandoned' WHERE room_code = ?").run(roomCode);
    rooms.delete(roomCode);
  }
  console.log(`[ws] disconnected: ${socket.user.username}`);
}

module.exports = { setupSocket };
