import Fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const fastify = Fastify({ logger: true });
const PORT = process.env.PORT || 3102;

// Player service URL (service name in Docker Compose)
const PLAYER_SERVICE_URL = "http://players-service:3101/players";
const SYSTEM_PLAYERS = new Set([
  'player',
  'CyberBot',
  'NeuroPaddle',
  'ByteCrusher',
  'CodeBreaker',
  'PingLord',
  'AlgoAce'
]);

function shouldSkipValidation(participants, userId) {
  return Boolean(userId) || participants.some(name => SYSTEM_PLAYERS.has(name));
}

// Database path
const dbPath = '/app/database/matches.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(dbPath);

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1 TEXT NOT NULL,
    player2 TEXT NOT NULL,
    winner TEXT NOT NULL,
    user_id INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Validate players exist in players-service
async function validatePlayers(p1, p2, win) {
  const res = await axios.get(PLAYER_SERVICE_URL);
  const players = res.data;
  return [p1, p2, win].every(p => players.includes(p));
}

// Routes
fastify.get('/matches', async () => {
  return db.prepare('SELECT * FROM matches ORDER BY played_at ASC').all();
});

fastify.post('/matches', async (request, reply) => {
  const { player1, player2, winner, user_id } = request.body;
  if (!player1 || !player2 || !winner)
    return reply.code(400).send({ error: 'Missing players or winner' });

  const participants = [player1, player2, winner];
  const skipValidation = shouldSkipValidation(participants, user_id);

  try {
    if (!skipValidation) {
      const valid = await validatePlayers(player1, player2, winner);
      if (!valid) return reply.code(400).send({ error: 'Invalid player(s)' });
    }

    db.prepare(
      'INSERT INTO matches (player1, player2, winner, user_id) VALUES (?, ?, ?, ?)'
    ).run(player1, player2, winner, user_id || null);

    reply.code(201).send({ message: 'Match recorded' });
  } catch (err) {
    fastify.log.error(err);
    return reply.code(503).send({ error: 'Player validation failed' });
  }
});

// Get matches for specific user
fastify.get('/matches/user/:userId', async (request, reply) => {
  const { userId } = request.params;
  
  try {
    const matches = db.prepare(
      'SELECT * FROM matches WHERE user_id = ? ORDER BY played_at DESC'
    ).all(userId);
    
    fastify.log.info(`Fetched ${matches.length} matches for user ${userId}`);
    reply.send(matches);
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Failed to fetch user matches' });
  }
});

fastify.delete('/matches/user/:userId', async (request, reply) => {
  const { userId } = request.params;

  try {
    const result = db.prepare('DELETE FROM matches WHERE user_id = ?').run(userId);
    reply.send({ message: 'User matches deleted', deleted: result.changes });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Failed to delete user matches' });
  }
});

fastify.delete('/matches', async () => {
  db.prepare('DELETE FROM matches').run();
  return { message: 'All matches deleted' };
});

// Health check
fastify.get('/health', async (_, reply) => {
  reply.send({ 
    status: 'ok', 
    service: 'matches', 
    port: PORT 
  });
});

// Start server
const start = async () => {
  try {
    await fastify.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS']
    });

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Matches Service running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
