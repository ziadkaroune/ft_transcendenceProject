import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import multipart from '@fastify/multipart';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const fastify = Fastify({ logger: true });
const PORT = process.env.PORT || 3103;
const MATCHES_SERVICE_URL = process.env.MATCHES_SERVICE_URL || 'http://matches-service:3102';
const TWO_FA_SERVICE_URL = process.env.TWO_FA_SERVICE_URL || 'http://auth-service:3105';
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const RATE_LIMIT_TIME_WINDOW = process.env.RATE_LIMIT_TIME_WINDOW || '1 minute';
const SENSITIVE_RATE_LIMIT_MAX = Number(process.env.SENSITIVE_RATE_LIMIT_MAX || 10);
const SENSITIVE_RATE_LIMIT_WINDOW = process.env.SENSITIVE_RATE_LIMIT_WINDOW || '1 minute';
const RATE_LIMIT_ALLOW_LIST = (process.env.RATE_LIMIT_ALLOW_LIST || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ft_transcendence.clients';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ft_transcendence.auth';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'ft_session';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be defined and at least 32 characters long for users-service.');
}

const nowIso = () => new Date().toISOString();

function parseCookies(header) {
  if (!header || typeof header !== 'string') return {};
  return header.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) return acc;
    acc[name] = rest.join('=').trim();
    return acc;
  }, {});
}

function getAuthenticatedUserId(request) {
  const cookies = parseCookies(request.headers?.cookie || request.headers?.Cookie || '');
  const token = cookies[JWT_COOKIE_NAME];
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER
    });
    if (typeof payload !== 'object' || !payload.sub) {
      return null;
    }
    const id = Number(payload.sub);
    return Number.isNaN(id) ? null : id;
  } catch (err) {
    fastify.log.warn({ err }, 'Failed to verify JWT for users-service');
    return null;
  }
}

function requireSameUser(request, reply) {
  const targetId = Number(request.params?.id);
  if (!Number.isFinite(targetId)) {
    reply.code(400).send({ error: 'Invalid user id' });
    return null;
  }

  const authId = getAuthenticatedUserId(request);
  if (!authId) {
    reply.code(401).send({ error: 'Authentication required' });
    return null;
  }

  if (authId !== targetId) {
    reply.code(403).send({ error: 'Forbidden' });
    return null;
  }

  return authId;
}

// Initialize SQLite database
const dbPath = '/app/database/users.db';
const dbDir = path.dirname(dbPath);

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure avatars directory under the persisted database folder (so files persist on host)
const avatarsDir = path.join(dbDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_AVATAR_FILE = 'user.png';
const DEFAULT_AVATAR_URL = `/avatars/${DEFAULT_AVATAR_FILE}`;

const ensureDefaultAvatar = () => {
  const destination = path.join(avatarsDir, DEFAULT_AVATAR_FILE);
  if (fs.existsSync(destination)) return;

  const candidatePaths = [
    path.resolve(__dirname, 'assets', DEFAULT_AVATAR_FILE),
    path.resolve(process.cwd(), DEFAULT_AVATAR_FILE),
    path.resolve(process.cwd(), 'public', DEFAULT_AVATAR_FILE),
    path.resolve(process.cwd(), '..', 'frontend', 'public', 'avatars', DEFAULT_AVATAR_FILE),
    path.resolve(process.cwd(), '..', '..', 'frontend', 'public', 'avatars', DEFAULT_AVATAR_FILE)
  ];

  const sourcePath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!sourcePath) {
    console.warn(`[users-service] Default avatar source not found for ${DEFAULT_AVATAR_FILE}`);
    return;
  }

  try {
    fs.copyFileSync(sourcePath, destination);
    console.log(`[users-service] Copied default avatar from ${sourcePath}`);
  } catch (err) {
    console.error(`[users-service] Failed to copy default avatar:`, err);
  }
};

ensureDefaultAvatar();

function buildRateLimitRouteConfig(max = SENSITIVE_RATE_LIMIT_MAX, timeWindow = SENSITIVE_RATE_LIMIT_WINDOW) {
  return {
    config: {
      rateLimit: {
        max,
        timeWindow
      }
    }
  };
}

const db = new Database(dbPath);
const VALID_STATUSES = new Set(['online', 'offline', 'away']);

// Create users table with all required fields
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT DEFAULT '${DEFAULT_AVATAR_URL}',
    status TEXT DEFAULT 'offline',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN last_seen DATETIME`);
} catch (error) {
  if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
    throw error;
  }
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'email'`);
} catch (error) {
  if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
    throw error;
  }
}

db.prepare(`
  UPDATE users
  SET avatar_url = ?
  WHERE avatar_url IS NULL
     OR avatar_url = ''
     OR avatar_url = '/avatars/default.png'
`).run(DEFAULT_AVATAR_URL);

db.prepare(`
  UPDATE users
  SET last_seen = COALESCE(last_seen, updated_at, created_at, ?)
  WHERE last_seen IS NULL
`).run(nowIso());

// Create user stats table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_matches INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Create friends table
db.exec(`
  CREATE TABLE IF NOT EXISTS friends (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Register CORS
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  credentials: true
});

await fastify.register(rateLimit, {
  global: true,
  max: RATE_LIMIT_MAX,
  timeWindow: RATE_LIMIT_TIME_WINDOW,
  allowList: RATE_LIMIT_ALLOW_LIST,
  skipOnError: true,
  addHeaders: true,
  addHeadersOnSuccess: true,
  addHeadersOnExceeding: true,
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please wait before retrying.',
    retryAfter: Math.ceil(context.ttl / 1000)
  })
});

await fastify.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit to prevent oversized uploads
  }
});

fastify.get('/avatars/:filename', async (request, reply) => {
  try {
    const { filename } = request.params;
    const safeName = path.basename(filename);
    const filePath = path.resolve(avatarsDir, safeName);

    if (!filePath.startsWith(path.resolve(avatarsDir))) {
      return reply.code(400).send({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Avatar not found' });
    }

    const stream = fs.createReadStream(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    reply.type(mimeTypes[ext] || 'application/octet-stream');
    return reply.send(stream);
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to load avatar' });
  }
});

// Health check
fastify.get('/health', async (_, reply) => {
  reply.send({ 
    status: 'ok', 
    service: 'users', 
    port: PORT 
  });
});

// Get all users (basic info only)
fastify.get('/users', async (_, reply) => {
  try {
    const users = db.prepare(`
      SELECT id, username, display_name, avatar_url, status, last_seen, created_at
      FROM users ORDER BY username ASC
    `).all();
    reply.send(users);
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Database error' });
  }
});

// Get user by ID
fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    const user = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, u.last_seen,
             u.created_at,
             COALESCE(s.wins, 0) AS wins,
             COALESCE(s.losses, 0) AS losses,
             COALESCE(s.total_matches, 0) AS total_matches,
             COALESCE(s.win_streak, 0) AS win_streak,
             COALESCE(s.level, 1) AS level,
             COALESCE(s.experience, 0) AS experience
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE u.id = ?
    `).get(id);
    
    if (!user) return reply.code(404).send({ error: 'User not found' });
    reply.send(user);
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Database error' });
  }
});

// Create new user (registration)
fastify.post('/users', async (request, reply) => {
  const { username, email, password, display_name, authType, verificationToken } = request.body;

  const normalizedUsername = username?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const requestedDisplayName = (display_name ?? normalizedUsername)?.trim();
  const userAuthType = authType || 'email';
  const normalizedVerificationToken = typeof verificationToken === 'string' ? verificationToken.trim() : '';

  if (!normalizedUsername || !normalizedEmail) {
    return reply.code(400).send({ error: 'Username and email required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return reply.code(400).send({ error: 'Invalid email format' });
  }

  const displayName = requestedDisplayName || normalizedUsername;
  const displayNameInUse = db.prepare(
    'SELECT 1 FROM users WHERE display_name = ?'
  ).get(displayName);

  if (displayNameInUse) {
    return reply.code(409).send({ error: 'Display name already in use' });
  }

  const cleanupUser = (id) => {
    try {
      db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(id);
    } catch (err) {
      fastify.log.error({ err }, 'Failed to cleanup user_stats after registration failure');
    }
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    } catch (err) {
      fastify.log.error({ err }, 'Failed to cleanup users after registration failure');
    }
  };

  try {
    const password_hash = password ? await bcrypt.hash(password, 10) : null;
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name, avatar_url, last_seen, auth_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(normalizedUsername, normalizedEmail, password_hash, displayName, DEFAULT_AVATAR_URL, nowIso(), userAuthType);
    const newUserId = result.lastInsertRowid;
    
    // Initialize stats for new user
    db.prepare(`
      INSERT INTO user_stats (user_id) VALUES (?)
    `).run(newUserId);

    if (normalizedVerificationToken) {
      try {
        const finalizeRes = await fetch(`${TWO_FA_SERVICE_URL}/auth/2fa/register/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: normalizedVerificationToken, userId: newUserId })
        });
        const finalizePayload = await finalizeRes.json().catch(() => ({}));
        if (!finalizeRes.ok) {
          const message = finalizePayload.error || 'Failed to finalize two-factor setup';
          cleanupUser(newUserId);
          return reply.code(finalizeRes.status).send({ error: message });
        }
      } catch (err) {
        cleanupUser(newUserId);
        fastify.log.error({ err }, '2FA finalize request failed');
        return reply.code(500).send({ error: 'Failed to finalize two-factor setup' });
      }
    } else if (userAuthType === 'authApp') {
      cleanupUser(newUserId);
      return reply.code(400).send({ error: 'verificationToken is required to enable authenticator 2FA' });
    }
    
    reply.code(201).send({ 
      message: 'User created',
      user: {
        id: newUserId,
        username: normalizedUsername,
        email: normalizedEmail,
        display_name: displayName,
        auth_type: userAuthType
      }
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      reply.code(409).send({ error: 'Username or email already exists' });
    } else {
      fastify.log.error(err);
      reply.code(500).send({ error: 'Failed to create user' });
    }
  }
});

// Update user profile
fastify.patch('/users/:id', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  const { display_name, avatar_url, status, username, email } = request.body;

  try {
    const updates = [];
    const values = [];

    if (username !== undefined) {
      const normalizedUsername = username.trim();
      if (!normalizedUsername) {
        return reply.code(400).send({ error: 'Username cannot be empty' });
      }
      const usernameConflict = db.prepare(
        'SELECT 1 FROM users WHERE username = ? AND id != ?'
      ).get(normalizedUsername, id);
      if (usernameConflict) {
        return reply.code(409).send({ error: 'Username already in use' });
      }
      updates.push('username = ?');
      values.push(normalizedUsername);
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return reply.code(400).send({ error: 'Invalid email format' });
      }
      const emailConflict = db.prepare(
        'SELECT 1 FROM users WHERE email = ? AND id != ?'
      ).get(normalizedEmail, id);
      if (emailConflict) {
        return reply.code(409).send({ error: 'Email already in use' });
      }
      updates.push('email = ?');
      values.push(normalizedEmail);
    }

    if (display_name !== undefined) {
      const normalizedDisplayName = display_name.trim();
      if (!normalizedDisplayName) {
        return reply.code(400).send({ error: 'Display name cannot be empty' });
      }
      const displayNameConflict = db.prepare(
        'SELECT 1 FROM users WHERE display_name = ? AND id != ?'
      ).get(normalizedDisplayName, id);
      if (displayNameConflict) {
        return reply.code(409).send({ error: 'Display name already in use' });
      }
      updates.push('display_name = ?');
      values.push(normalizedDisplayName);
    }

    if (avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatar_url);
    }

    if (status !== undefined) {
      const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
      if (!VALID_STATUSES.has(normalizedStatus)) {
        return reply.code(400).send({ error: 'Invalid status value' });
      }
      updates.push('status = ?');
      values.push(normalizedStatus);
      updates.push('last_seen = ?');
      values.push(nowIso());
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    reply.send({ message: 'User updated' });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to update user' });
  }
});

// Update user presence status
fastify.post('/users/:id/status', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  const { status } = request.body ?? {};

  const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : 'online';
  if (!VALID_STATUSES.has(normalizedStatus)) {
    return reply.code(400).send({ error: 'Invalid status value' });
  }

  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    db.prepare(`
      UPDATE users
      SET status = ?, last_seen = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(normalizedStatus, nowIso(), id);

    const updated = db.prepare('SELECT status, last_seen FROM users WHERE id = ?').get(id);
    reply.send(updated);
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to update status' });
  }
});

// Update user password
fastify.patch('/users/:id/password', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  const { current_password, new_password } = request.body ?? {};

  if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
    return reply.code(400).send({ error: 'New password must be at least 8 characters long' });
  }

  try {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (!user.password_hash) {
      return reply.code(400).send({ error: 'Password change not supported for this account' });
    }

    if (!current_password || typeof current_password !== 'string') {
      return reply.code(400).send({ error: 'Current password required' });
    }

    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const samePassword = await bcrypt.compare(new_password, user.password_hash);
    if (samePassword) {
      return reply.code(400).send({ error: 'New password must be different' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, id);

    reply.send({ message: 'Password updated successfully' });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to update password' });
  }
});

// Update user stats (after a match)
fastify.patch('/users/:id/stats', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  const { won, experience_gained } = request.body;

  try {
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(id);
    if (!userExists) {
      return reply.code(404).send({ error: 'User not found' });
    }

    db.prepare('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)').run(id);
    const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(id);
    
    const newWins = stats.wins + (won ? 1 : 0);
    const newLosses = stats.losses + (won ? 0 : 1);
    const newStreak = won ? stats.win_streak + 1 : 0;
    const newExp = stats.experience + (experience_gained || 0);
    const newLevel = Math.floor(newExp / 100) + 1;
    
    db.prepare(`
      UPDATE user_stats
      SET wins = ?, losses = ?, total_matches = ?, win_streak = ?,
          experience = ?, level = ?
      WHERE user_id = ?
    `).run(newWins, newLosses, stats.total_matches + 1, newStreak, newExp, newLevel, id);

    const updatedStats = db.prepare(`
      SELECT wins, losses, total_matches, win_streak, level, experience
      FROM user_stats WHERE user_id = ?
    `).get(id);

    reply.send({ message: 'Stats updated', stats: updatedStats });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to update stats' });
  }
});

// Get user's friends and requests
fastify.get('/users/:id/friends', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  
  try {
    const friends = db.prepare(`
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.status,
        u.last_seen,
        f.status as friendship_status,
        f.created_at
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY 
        CASE f.status
          WHEN 'pending' THEN 0
          WHEN 'requested' THEN 1
          WHEN 'accepted' THEN 2
          ELSE 3
        END,
        u.username ASC
    `).all(id);
    
    reply.send(friends);
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Database error' });
  }
});

// Send or auto-accept friend requests
fastify.post('/users/:id/friends', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  const { friend_id, friend_username } = request.body ?? {};

  try {
    const requesterId = Number(id);
    if (Number.isNaN(requesterId)) {
      return reply.code(400).send({ error: 'Invalid user id' });
    }

    let target;
    if (friend_id !== undefined) {
      const targetId = Number(friend_id);
      if (Number.isNaN(targetId)) {
        return reply.code(400).send({ error: 'Invalid friend id' });
      }
      target = db.prepare(`
        SELECT id, username, display_name FROM users WHERE id = ?
      `).get(targetId);
    } else if (friend_username) {
      target = db.prepare(`
        SELECT id, username, display_name FROM users WHERE LOWER(username) = LOWER(?)
      `).get(friend_username.trim());
    } else {
      return reply.code(400).send({ error: 'Friend identifier required' });
    }

    if (!target) {
      return reply.code(404).send({ error: 'User not found' });
    }

    if (target.id === requesterId) {
      return reply.code(400).send({ error: 'Cannot add yourself as a friend' });
    }

    const existing = db.prepare(`
      SELECT status FROM friends WHERE user_id = ? AND friend_id = ?
    `).get(requesterId, target.id);

    if (existing?.status === 'accepted') {
      return reply.code(409).send({ error: 'Already friends' });
    }

    if (existing?.status === 'requested') {
      return reply.code(409).send({ error: 'Friend request already sent' });
    }

    if (existing?.status === 'pending') {
      db.prepare(`
        UPDATE friends
        SET status = 'accepted', created_at = CURRENT_TIMESTAMP
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
      `).run(requesterId, target.id, target.id, requesterId);
      return reply.send({ message: 'Friend request accepted automatically' });
    }

    const reverse = db.prepare(`
      SELECT status FROM friends WHERE user_id = ? AND friend_id = ?
    `).get(target.id, requesterId);

    if (reverse?.status === 'accepted') {
      return reply.code(409).send({ error: 'Already friends' });
    }

    if (reverse?.status === 'requested') {
      db.prepare(`
        UPDATE friends
        SET status = 'accepted', created_at = CURRENT_TIMESTAMP
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
      `).run(requesterId, target.id, target.id, requesterId);
      return reply.send({ message: 'Friend request accepted automatically' });
    }

    if (reverse?.status === 'pending') {
      db.prepare(`
        UPDATE friends
        SET status = 'accepted', created_at = CURRENT_TIMESTAMP
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
      `).run(requesterId, target.id, target.id, requesterId);
      return reply.send({ message: 'Friend request accepted automatically' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)
    `);

    const insert = db.transaction(() => {
      insertStmt.run(requesterId, target.id, 'requested');
      insertStmt.run(target.id, requesterId, 'pending');
    });

    insert();

    reply.code(201).send({ message: 'Friend request sent', targetId: target.id });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return reply.code(409).send({ error: 'Friend relationship already exists' });
    }
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to send friend request' });
  }
});

// Accept or reject friend requests
fastify.patch('/users/:id/friends/:friendId', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const { friendId } = request.params;
  const { action } = request.body ?? {};

  if (!['accept', 'reject'].includes(action)) {
    return reply.code(400).send({ error: 'Invalid action' });
  }

  const userId = Number(selfId);
  const targetId = Number(friendId);
  if (Number.isNaN(userId) || Number.isNaN(targetId)) {
    return reply.code(400).send({ error: 'Invalid identifier' });
  }

  try {
    const relation = db.prepare(`
      SELECT status FROM friends WHERE user_id = ? AND friend_id = ?
    `).get(userId, targetId);

    if (!relation) {
      return reply.code(404).send({ error: 'Friend request not found' });
    }

    if (relation.status !== 'pending') {
      return reply.code(409).send({ error: 'No incoming friend request to respond to' });
    }

    if (action === 'accept') {
      db.prepare(`
        UPDATE friends
        SET status = 'accepted', created_at = CURRENT_TIMESTAMP
        WHERE (user_id = ? AND friend_id = ?)
           OR (user_id = ? AND friend_id = ?)
      `).run(userId, targetId, targetId, userId);

      return reply.send({ message: 'Friend request accepted' });
    }

    db.prepare(`
      DELETE FROM friends
      WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)
    `).run(userId, targetId, targetId, userId);

    reply.send({ message: 'Friend request declined' });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to update friend request' });
  }
});

// Remove friend or cancel request
fastify.delete('/users/:id/friends/:friendId', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const { friendId } = request.params;

  const userId = Number(selfId);
  const targetId = Number(friendId);
  if (Number.isNaN(userId) || Number.isNaN(targetId)) {
    return reply.code(400).send({ error: 'Invalid identifier' });
  }

  try {
    const relation = db.prepare(`
      SELECT status FROM friends WHERE user_id = ? AND friend_id = ?
    `).get(userId, targetId);

    if (!relation) {
      return reply.code(404).send({ error: 'Friend relationship not found' });
    }

    db.prepare(`
      DELETE FROM friends
      WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)
    `).run(userId, targetId, targetId, userId);

    const message = relation.status === 'accepted'
      ? 'Friend removed'
      : relation.status === 'requested'
        ? 'Friend request cancelled'
        : 'Friend request cleared';

    reply.send({ message });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to remove friend' });
  }
});

// Delete user
fastify.delete('/users/:id', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);

  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }

    let matchesRemoved = null;
    try {
      const res = await fetch(`${MATCHES_SERVICE_URL}/matches/user/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const payload = await res.json().catch(() => ({}));
        matchesRemoved = payload.deleted ?? 0;
      } else {
        matchesRemoved = 'failed';
      }
    } catch (err) {
      fastify.log.error({ err }, 'Failed to purge matches for user');
      matchesRemoved = 'failed';
    }

    reply.send({ message: 'User deleted', matchesRemoved });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Failed to delete user' });
  }
});

// Login endpoint
fastify.post('/auth/login', buildRateLimitRouteConfig(), async (request, reply) => {
  const { email, password } = request.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email and password required' });
  }
  
  try {
    const user = db.prepare(`
      SELECT id, username, email, password_hash, display_name, avatar_url, status, auth_type
      FROM users WHERE email = ?
    `).get(email);
    
    if (!user || !user.password_hash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    // Update user status to online
    db.prepare(`
      UPDATE users
      SET status = ?, last_seen = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('online', nowIso(), user.id);
    
    // Return user info with 2FA requirement flag
    reply.send({
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      requires2FA: true,
      authType: user.auth_type || 'email'
    });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Login failed' });
  }
});

// Restore missing endpoints and startup
fastify.post('/auth/logout/:id', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  try {
    db.prepare(`
      UPDATE users
      SET status = ?, last_seen = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('offline', nowIso(), id);
    reply.send({ message: 'Logged out' });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Logout failed' });
  }
});

fastify.post('/users/:id/avatar', async (request, reply) => {
  const selfId = requireSameUser(request, reply);
  if (selfId === null) return;

  const id = String(selfId);
  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const data = await request.file();
    if (!data || !data.filename) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const allowedMimeTypes = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp'
    ]);
    if (!allowedMimeTypes.has(data.mimetype)) {
      return reply.code(400).send({ error: 'Unsupported file type. Please upload an image.' });
    }

    const safeName = data.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `user_${id}_${Date.now()}_${safeName}`;
    const destPath = path.join(avatarsDir, filename);

    const writeStream = fs.createWriteStream(destPath);
    await pipeline(data.file, writeStream);

    const avatar_url = `/avatars/${filename}`;
    db.prepare('UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(avatar_url, id);

    reply.send({ message: 'Avatar uploaded', avatar_url });
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: 'Failed to upload avatar' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Users Service running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
