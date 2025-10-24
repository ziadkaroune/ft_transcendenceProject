import Fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import multipart from '@fastify/multipart';
import { pipeline } from 'stream/promises';

const fastify = Fastify({ logger: true });
const PORT = process.env.PORT || 3103;
const MATCHES_SERVICE_URL = process.env.MATCHES_SERVICE_URL || 'http://matches-service:3102';

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

const db = new Database(dbPath);

// Create users table with all required fields
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    avatar_url TEXT DEFAULT '/avatars/default.png',
    status TEXT DEFAULT 'offline',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

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
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS']
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
      SELECT id, username, display_name, avatar_url, status, created_at
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
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status,
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
  const { username, email, password, display_name } = request.body;

  const normalizedUsername = username?.trim();
  const normalizedEmail = email?.trim().toLowerCase();
  const requestedDisplayName = (display_name ?? normalizedUsername)?.trim();

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

  try {
    const password_hash = password ? await bcrypt.hash(password, 10) : null;
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, display_name)
      VALUES (?, ?, ?, ?)
    `).run(normalizedUsername, normalizedEmail, password_hash, displayName);
    
    // Initialize stats for new user
    db.prepare(`
      INSERT INTO user_stats (user_id) VALUES (?)
    `).run(result.lastInsertRowid);
    
    reply.code(201).send({ 
      message: 'User created',
      userId: result.lastInsertRowid 
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
  const { id } = request.params;
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
      updates.push('status = ?');
      values.push(status);
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

// Update user stats (after a match)
fastify.patch('/users/:id/stats', async (request, reply) => {
  const { id } = request.params;
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

// Get user's friends
fastify.get('/users/:id/friends', async (request, reply) => {
  const { id } = request.params;
  
  try {
    const friends = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, f.status as friendship_status
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'accepted'
    `).all(id);
    
    reply.send(friends);
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Database error' });
  }
});

// Delete user
fastify.delete('/users/:id', async (request, reply) => {
  const { id } = request.params;

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
fastify.post('/auth/login', async (request, reply) => {
  const { email, password } = request.body;
  
  if (!email || !password) {
    return reply.code(400).send({ error: 'Email and password required' });
  }
  
  try {
    const user = db.prepare(`
      SELECT id, username, email, password_hash, display_name, avatar_url, status
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
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('online', user.id);
    
    reply.send({
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url
    });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Login failed' });
  }
});

// Restore missing endpoints and startup
fastify.post('/auth/logout/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('offline', id);
    reply.send({ message: 'Logged out' });
  } catch (error) {
    fastify.log.error(error);
    reply.code(500).send({ error: 'Logout failed' });
  }
});

fastify.post('/users/:id/avatar', async (request, reply) => {
  const { id } = request.params;
  try {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const data = await request.file();
    if (!data || !data.filename) {
      return reply.code(400).send({ error: 'No file uploaded' });
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
