import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { exec } from 'child_process';
import axios from 'axios';
import jwt from 'jsonwebtoken';

export async function sendMailerooEmail(from, to, display_name, subject, html, plain_text) {
  const apiKey = process.env.MAILEROO;
  if (!apiKey) {
    // This error will be caught by the calling function and handled gracefully.
    throw new Error('MAILEROO API key is not configured in environment variables.');
  }

  const url = 'https://smtp.maileroo.com/api/v2/emails';

  const recipients = Array.isArray(to) ? to : [to];
  const toPayload = recipients.map((address, idx) => ({
    address,
    ...(idx === 0 && display_name ? { display_name } : {})
  }));

  const payload = {
    from: {
      address: from,
      display_name
    },
    to: toPayload,
    subject,
    html,
    plain: plain_text,
    tracking: true
  };

 const escapedPayload = JSON.stringify(payload).replace(/'/g, "'\\''");

  const command = `curl -s -X POST "${url}" \
    -H "Authorization: Bearer ${apiKey}" \
    -H "Content-Type: application/json" \
    -d '${escapedPayload}'`;

  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`curl command failed: ${stderr}`);
        err.status = 500;
        err.body = stderr;
        return reject(err);
      }
     
      try {
        const response = JSON.parse(stdout);
        // Assuming a successful response has an 'id' or 'status' field. Adjust if needed.
        if (response.id || response.status === 'sent' || response.success === true) {
          resolve(stdout);
        } else {
          const err = new Error(`Maileroo API returned an error: ${stdout}`);
          err.status = 400; // Or parse status from response if available
          err.body = stdout;
          reject(err);
        }
      } catch (parseError) {
        const err = new Error(`Failed to parse Maileroo response: ${stdout}`);
        err.status = 502; // Bad Gateway
        err.body = stdout;
        reject(err);
      }
    });
  });
}


const fastify = Fastify({ logger: true });
const PORT = process.env.PORT || 3105;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be defined and at least 32 characters long.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ft_transcendence.auth';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ft_transcendence.clients';
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'ft_session';
const JWT_COOKIE_DOMAIN = process.env.JWT_COOKIE_DOMAIN || undefined;
const JWT_COOKIE_PATH = process.env.JWT_COOKIE_PATH || '/';
const JWT_COOKIE_SAMESITE = process.env.JWT_COOKIE_SAMESITE || 'Strict';
const COOKIE_SECURE = process.env.JWT_COOKIE_SECURE ? process.env.JWT_COOKIE_SECURE === 'true' : (process.env.NODE_ENV !== 'development');
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const RATE_LIMIT_TIME_WINDOW = process.env.RATE_LIMIT_TIME_WINDOW || '1 minute';
const SENSITIVE_RATE_LIMIT_MAX = Number(process.env.SENSITIVE_RATE_LIMIT_MAX || 10);
const SENSITIVE_RATE_LIMIT_WINDOW = process.env.SENSITIVE_RATE_LIMIT_WINDOW || '1 minute';
const RATE_LIMIT_ALLOW_LIST = (process.env.RATE_LIMIT_ALLOW_LIST || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const ENCRYPTED_SECRET_PREFIX = 'enc:';
const SECRET_ENCRYPTION_ALGO = 'aes-256-gcm';
const SECRET_IV_LENGTH = 12;
const SECRET_TAG_LENGTH = 16;
const SECRET_ENCRYPTION_KEY = (() => {
  const rawKey = process.env.TOTP_SECRET_KEY || JWT_SECRET;
  return crypto.createHash('sha256').update(String(rawKey)).digest();
})();
const COOKIE_LOG_FILE = process.env.COOKIE_LOG_FILE || '/app/logs/cookie-log.ndjson';

const PRIMARY_AUTH_SERVICE_URL = process.env.PRIMARY_AUTH_SERVICE_URL || 'http://localhost:3103';
const PRIMARY_AUTH_VERIFY_PATH = process.env.PRIMARY_AUTH_VERIFY_PATH || '/users';
const ALLOW_USER_VALIDATION_BYPASS = process.env.ALLOW_USER_VALIDATION_BYPASS === 'true';

function parseExpiry(value) {
  if (typeof value === 'number') return value;
  const match = /^(\d+)([smhd])?$/.exec(String(value).trim());
  if (!match) return 3600;
  const amount = Number(match[1]);
  const unit = match[2] || 's';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

const JWT_MAX_AGE_SECONDS = parseExpiry(JWT_EXPIRES_IN);

function issueSessionCookie(reply, payload) {
  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256'
  });

  const parts = [
    `${JWT_COOKIE_NAME}=${token}`,
    'HttpOnly',
    `Path=${JWT_COOKIE_PATH}`,
    `SameSite=${JWT_COOKIE_SAMESITE}`,
    `Max-Age=${JWT_MAX_AGE_SECONDS}`
  ];

  if (COOKIE_SECURE) {
    parts.push('Secure');
  }

  if (JWT_COOKIE_DOMAIN) {
    parts.push(`Domain=${JWT_COOKIE_DOMAIN}`);
  }

  reply.header('Set-Cookie', parts.join('; '));
}

async function fetchUserFromPrimaryAuth(userId) {
  if (!PRIMARY_AUTH_SERVICE_URL || !PRIMARY_AUTH_VERIFY_PATH) {
    return null;
  }

  const normalizedId = encodeURIComponent(String(userId).trim());
  const normalizedPath = PRIMARY_AUTH_VERIFY_PATH.endsWith('/')
    ? PRIMARY_AUTH_VERIFY_PATH.slice(0, -1)
    : PRIMARY_AUTH_VERIFY_PATH;
  const url = `${PRIMARY_AUTH_SERVICE_URL}${normalizedPath}/${normalizedId}`;

  try {
    const response = await axios.get(url, { timeout: 4000 });
    if (response.status >= 200 && response.status < 300 && response.data) {
      const user = response.data.user || response.data;
      if (user && user.id) {
        return user;
      }
    }
    return null;
  } catch (err) {
    fastify.log.error({ err, userId }, 'Failed to validate user against primary auth service');
    return null;
  }
}

function sanitizeUserProfile(user, fallbackId) {
  if (!user) {
    return {
      id: fallbackId,
      username: `user${fallbackId}`
    };
  }

  const {
    password,
    hashed_password,
    totp_secret,
    secret,
    ...safeUser
  } = user;

  if (!safeUser.username && fallbackId) {
    safeUser.username = `user${fallbackId}`;
  }

  return safeUser;
}

function encryptTotpSecret(plaintext) {
  const iv = crypto.randomBytes(SECRET_IV_LENGTH);
  const cipher = crypto.createCipheriv(SECRET_ENCRYPTION_ALGO, SECRET_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_SECRET_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

function decryptTotpSecret(storedValue) {
  if (typeof storedValue !== 'string') {
    throw new Error('Invalid stored secret value');
  }
  if (!storedValue.startsWith(ENCRYPTED_SECRET_PREFIX)) {
    throw new Error('Secret is not encrypted');
  }
  const payload = Buffer.from(storedValue.slice(ENCRYPTED_SECRET_PREFIX.length), 'base64');
  if (payload.length <= SECRET_IV_LENGTH + SECRET_TAG_LENGTH) {
    throw new Error('Encrypted payload too short');
  }
  const iv = payload.subarray(0, SECRET_IV_LENGTH);
  const authTag = payload.subarray(SECRET_IV_LENGTH, SECRET_IV_LENGTH + SECRET_TAG_LENGTH);
  const ciphertext = payload.subarray(SECRET_IV_LENGTH + SECRET_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(SECRET_ENCRYPTION_ALGO, SECRET_ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// Initialize SQLite database (kept from original file)
const dbPath = '/app/database/2fa.db';
const dbDir = path.dirname(dbPath);

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const cookieLogDir = path.dirname(COOKIE_LOG_FILE);
if (!fs.existsSync(cookieLogDir)) {
  fs.mkdirSync(cookieLogDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  fastify.log.warn('Could not open DB, continuing with in-memory token map', err);
}

let upsertTotpSecretStmt;
let selectTotpSecretStmt;
let deleteTotpSecretStmt;

if (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS totp_secrets (
      user_id TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      auth_type TEXT DEFAULT 'authApp',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  upsertTotpSecretStmt = db.prepare(`
    INSERT INTO totp_secrets (user_id, secret, auth_type)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET secret = excluded.secret,
                  auth_type = excluded.auth_type,
                  updated_at = CURRENT_TIMESTAMP
  `);

  selectTotpSecretStmt = db.prepare(`
    SELECT secret, auth_type FROM totp_secrets WHERE user_id = ?
  `);

  deleteTotpSecretStmt = db.prepare(`
    DELETE FROM totp_secrets WHERE user_id = ?
  `);
}

function persistTotpSecret(userId, secret, authType = 'authApp') {
  if (!upsertTotpSecretStmt) return false;
  const storedSecret = encryptTotpSecret(secret);
  upsertTotpSecretStmt.run(String(userId), storedSecret, authType);
  return true;
}

function loadTotpSecret(userId) {
  if (!selectTotpSecretStmt) return null;
  const row = selectTotpSecretStmt.get(String(userId));
  if (!row || !row.secret) {
    return null;
  }

  const storedValue = row.secret;
  const authType = row.auth_type || 'authApp';

  if (typeof storedValue === 'string' && storedValue.startsWith(ENCRYPTED_SECRET_PREFIX)) {
    try {
      const plaintext = decryptTotpSecret(storedValue);
      return { secret: plaintext, auth_type: authType };
    } catch (err) {
      fastify.log.error({ err, userId }, 'Failed to decrypt TOTP secret');
      return null;
    }
  }

  // Legacy plaintext secret detected — re-encrypt transparently
  fastify.log.warn({ userId }, 'Detected plaintext TOTP secret; encrypting now');
  persistTotpSecret(userId, storedValue, authType);
  return { secret: storedValue, auth_type: authType };
}

function removeTotpSecret(userId) {
  if (!deleteTotpSecretStmt) return false;
  deleteTotpSecretStmt.run(String(userId));
  return true;
}

function hydrateAuthAppEntry(userId) {
  const key = String(userId);
  const existing = token_map.get(key);
  if (existing && existing.type === 'authApp' && existing.secret) {
    return existing;
  }

  const row = loadTotpSecret(key);
  if (row && row.secret) {
    const entry = { type: row.auth_type || 'authApp', secret: row.secret };
    token_map.set(key, entry);
    return entry;
  }

  return null;
}

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

function appendCookieLog(entry) {
  return new Promise((resolve, reject) => {
    const line = `${JSON.stringify(entry)}\n`;
    fs.appendFile(COOKIE_LOG_FILE, line, (err) => {
      if (err) {
        fastify.log.error({ err }, 'Failed to append cookie log entry');
        return reject(err);
      }
      resolve();
    });
  });
}

// Register CORS
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
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

fastify.addHook('onRequest', async (request) => {
  const rawCookieHeader = request.headers.cookie || null;
  fastify.log.info({ cookies: rawCookieHeader }, 'Incoming request cookies');
});

fastify.post('/diagnostics/cookie-log', async (request, reply) => {
  try {
    const { timestamp, method, target, cookies } = request.body || {};
    const entry = {
      timestamp: timestamp || new Date().toISOString(),
      method: method || request.method,
      target: target || request.headers['x-forwarded-url'] || request.url,
      cookies: cookies ?? request.headers.cookie ?? ''
    };

    await appendCookieLog(entry);
    return reply.send({ success: true });
  } catch (err) {
    return reply.status(500).send({ error: 'Failed to write cookie log entry' });
  }
});

const token_map = new Map(); // userId -> { type: 'email'|'authApp', code?, secret?, validUntil?, failedAttempts?, lockoutUntil? }
const registration_tokens = new Map(); // verificationToken -> { email, username, authType, code?, secret?, validUntil }

function generateNumericCode(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, '0');
}

// Base32 encode/decode (RFC4648, no padding)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const cleaned = String(str).replace(/=+$/g, '').toUpperCase();
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// TOTP implementation (SHA-1, 6 digits, 30s period)
function generateTOTP(secretBase32, forTime = Date.now(), digits = 6, period = 30) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(forTime / 1000 / period);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits));
  return String(code).padStart(digits, '0');
}

function verifyTOTP(secretBase32, token, window = 1, digits = 6, period = 30) {
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const t = Date.now() + errorWindow * period * 1000;
    if (generateTOTP(secretBase32, t, digits, period) === token) {
      return true;
    }
  }
  return false;
}

// small helper to generate random base32 secret
function generateBase32Secret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  return base32Encode(buf);
}

// small helper used by original /2FA/generateAccessToken
function generateRandomToken(len = 48) {
  return crypto.randomBytes(len).toString('hex');
}

// Endpoint: Initiate registration process
fastify.post('/auth/2fa/register/initiate', buildRateLimitRouteConfig(), async (request, reply) => {
  const { email, username, authType } = request.body || {};
  if (!email || !username || !authType) {
    return reply.status(400).send({ error: 'email, username, and authType are required' });
  }

  const verificationToken = generateRandomToken(32);
  const validUntil = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  if (authType === 'email') {
    const code = generateNumericCode(6);
    registration_tokens.set(verificationToken, { email, username, authType, code, validUntil });

    const subject = 'Verify Your Email for Registration';
    const html = `<p>Welcome, ${username}!</p><p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`;
    const plain = `Welcome, ${username}!\nYour verification code is: ${code}\nThis code is valid for 10 minutes.`;
    const fromAddress = process.env.MAILEROO_FROM || 'no-reply@example.com';

    try {
      if (!process.env.MAILEROO) {
        fastify.log.warn(`MAILEROO env not set. Registration code for ${email}: ${code}`);
        return reply.send({ verificationToken });
      }
      await sendMailerooEmail(fromAddress, email, username, subject, html, plain);
      fastify.log.info(`Registration code sent to ${email}`);
      return reply.send({ verificationToken });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to send registration email');
      return reply.status(500).send({ error: 'Failed to send verification email' });
    }
  } else if (authType === 'authApp') {
    const secret = generateBase32Secret(20);
    registration_tokens.set(verificationToken, { email, username, authType, secret, validUntil });

    const label = `ft_transcendence:${username}`;
    const issuer = 'ft_transcendence';
    const otpauth_url = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    fastify.log.info(`TOTP secret generated for pending registration of user ${username}`);
    return reply.send({ verificationToken, secret, otpauth_url });
  } else {
    return reply.status(400).send({ error: 'Invalid authType specified' });
  }
});

// Endpoint: Verify code for a pending registration
fastify.post('/auth/2fa/register/verify', buildRateLimitRouteConfig(), async (request, reply) => {
  const { verificationToken, code } = request.body || {};
  if (!verificationToken || !code) {
    return reply.status(400).send({ error: 'verificationToken and code are required' });
  }

  const entry = registration_tokens.get(verificationToken);
  if (!entry) {
    return reply.status(400).send({ error: 'Invalid or expired verification token' });
  }

  if (Date.now() > entry.validUntil) {
    registration_tokens.delete(verificationToken);
    return reply.status(400).send({ error: 'Verification token expired' });
  }

  const normalizedCode = String(code).trim();

  if (entry.authType === 'email' && entry.code === normalizedCode) {
    // For email, the code is one-time. We can now consider it verified.
    entry.verified = true;
    registration_tokens.set(verificationToken, entry);
    fastify.log.info(`Registration for ${entry.email} verified successfully.`);
    return reply.send({ verificationToken });
  }

  if (entry.authType === 'authApp') {
    if (!entry.secret) {
      return reply.status(400).send({ error: 'Missing authenticator secret for this token' });
    }
    if (!verifyTOTP(entry.secret, normalizedCode, 1, 6, 30)) {
      return reply.status(400).send({ error: 'Invalid code' });
    }
    entry.verified = true;
    registration_tokens.set(verificationToken, entry);
    fastify.log.info(`Authenticator setup for ${entry.email} validated successfully.`);
    return reply.send({ verificationToken });
  }

  return reply.status(400).send({ error: 'Invalid code' });
});

// Endpoint: finalize registration (persist 2FA preferences)
fastify.post('/auth/2fa/register/complete', buildRateLimitRouteConfig(), async (request, reply) => {
  const { verificationToken, userId } = request.body || {};
  if (!verificationToken || !userId) {
    return reply.status(400).send({ error: 'verificationToken and userId are required' });
  }

  const entry = registration_tokens.get(verificationToken);
  if (!entry) {
    return reply.status(400).send({ error: 'Invalid or expired verification token' });
  }

  if (Date.now() > entry.validUntil) {
    registration_tokens.delete(verificationToken);
    return reply.status(400).send({ error: 'Verification token expired' });
  }

  if (entry.authType === 'authApp') {
    if (!entry.verified) {
      return reply.status(400).send({ error: 'Authenticator code has not been verified yet' });
    }
    if (!entry.secret) {
      return reply.status(400).send({ error: 'Missing authenticator secret for this token' });
    }

    persistTotpSecret(userId, entry.secret, 'authApp');
    token_map.set(String(userId), { type: 'authApp', secret: entry.secret });
    registration_tokens.delete(verificationToken);

    return reply.send({ success: true, authType: 'authApp' });
  }

  if (entry.authType === 'email') {
    if (!entry.verified) {
      return reply.status(400).send({ error: 'Email verification has not been completed yet' });
    }
    registration_tokens.delete(verificationToken);
    return reply.send({ success: true, authType: 'email' });
  }

  return reply.status(400).send({ error: 'Unsupported authentication type' });
});

// Endpoint: send email code to user (development: returns code when MAILEROO is missing)
fastify.post('/auth/2fa/send', buildRateLimitRouteConfig(), async (request, reply) => {
  const { userId, email } = request.body || {};
  if (!userId && !email) {
    return reply.status(400).send({ error: 'userId or email is required' });
  }

  // create a 6-digit code valid for 10 minutes
  const code = generateNumericCode(6);
  const validUntil = Date.now() + 10 * 60 * 1000;

  // persist the code in memory (one-time)
  token_map.set(String(userId || email), { type: 'email', code, validUntil });

  // Determine recipient email: prefer explicit email param, else if userId looks like an email use that
  const recipient = email || (typeof userId === 'string' && userId.includes('@') ? userId : null);

  // Compose message
  const subject = 'Your verification code';
  const html = `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`;
  const plain = `Your verification code is: ${code}\nThis code is valid for 10 minutes.`;

  const fromAddress = process.env.MAILEROO_FROM || 'no-reply@example.com';
  const displayName = '2FA Server';

  if (recipient) {
    try {
      if (!process.env.MAILEROO) {
        fastify.log.warn('MAILEROO env variable not set — logging code instead of sending email');
        fastify.log.info(`2FA email code for ${recipient}: ${code}`);
        return reply.send({ success: true, method: 'console' });
      }

      fastify.log.info(`2FA code emailed to ${recipient} for user ${userId || email}`);
      const response = await sendMailerooEmail(fromAddress, recipient, displayName, subject, html, plain);
      fastify.log.debug(`Maileroo response: ${response}`);
      
      return reply.send({ success: true, method: 'maileroo' });
    } catch (err) {
      fastify.log.error({ err, status: err.status, body: err.body }, 'Failed to send 2FA email');
      return reply.status(500).send({
        success: false,
        error: 'Failed to send email',
        details: err && err.message ? err.message : String(err)
      });
    }
  } else {
    fastify.log.info(`2FA code for user ${userId} generated: ${code} (no recipient email provided)`);
    return reply.send({ success: true, method: 'console' });
  }
});

// Endpoint: setup authenticator app for user (returns secret + otpauth_url)
fastify.post('/auth/2fa/setup', buildRateLimitRouteConfig(), async (request, reply) => {
  const { userId, issuer } = request.body || {};
  if (!userId) {
    return reply.status(400).send({ error: 'userId is required' });
  }

  const secret = generateBase32Secret(20); // 160 bits
  token_map.set(String(userId), { type: 'authApp', secret });

  // Build otpauth URL for QR generation in client (label: issuer:userId)
  const label = `${(issuer || 'FTTranscendence')}:${userId}`;
  const otpauth = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer || 'FTTranscendence')}&algorithm=SHA1&digits=6&period=30`;

  fastify.log.info(`2FA TOTP secret created for user ${userId}`);

  return reply.send({ success: true, secret, otpauth_url: otpauth });
});

// Endpoint: verify a code (email or authApp)
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

fastify.post('/auth/2fa/verify', buildRateLimitRouteConfig(), async (request, reply) => {
  const { userId, code } = request.body || {};
  if (!userId || !code) {
    return reply.status(400).send({ error: 'userId and code are required' });
  }

  const key = String(userId);
  let entry = token_map.get(key);
  if (!entry) {
    entry = hydrateAuthAppEntry(key);
  }
  if (!entry) {
    return reply.status(400).send({ error: 'No 2FA setup or code found for this user' });
  }

  // Check for lockout
  if (entry.lockoutUntil && Date.now() < entry.lockoutUntil) {
    const remainingSeconds = Math.ceil((entry.lockoutUntil - Date.now()) / 1000);
    return reply.status(429).send({
      error: 'Too many failed attempts. Please try again later.',
      retryAfter: remainingSeconds
    });
  }

  let isValid = false;

  if (entry.type === 'email') {
    const now = Date.now();
    if (!entry.code || !entry.validUntil) {
      return reply.status(400).send({ error: 'No code available for this user' });
    }
    if (now > entry.validUntil) {
      // Clean up expired code
      token_map.delete(String(userId));
      return reply.status(400).send({ error: 'Code expired' });
    }
    if (entry.code === String(code).trim()) {
      isValid = true;
    }
  } else if (entry.type === 'authApp') {
    const secret = entry.secret;
    if (!secret) {
      return reply.status(400).send({ error: 'No secret configured for this user' });
    }
    if (verifyTOTP(secret, String(code).trim(), 1, 6, 30)) {
      isValid = true;
    }
  } else {
    return reply.status(400).send({ error: 'Unknown 2FA type' });
  }

  if (isValid) {
    // Success: clean up and send response
    if (entry.type === 'email') {
      // on success, remove the stored code (one-time)
      token_map.delete(key);
    } else {
      // For authApp, just reset any failure tracking
      delete entry.failedAttempts;
      delete entry.lockoutUntil;
      token_map.set(key, entry);
    }

    const verifiedUser = await fetchUserFromPrimaryAuth(userId);
    if (!verifiedUser && !ALLOW_USER_VALIDATION_BYPASS) {
      return reply.status(403).send({ error: 'Unable to verify user with primary auth service' });
    }

    const safeUser = sanitizeUserProfile(verifiedUser, userId);
    issueSessionCookie(reply, {
      sub: String(safeUser.id || userId),
      authType: entry.type
    });

    return reply.send({ success: true, user: safeUser, sessionIssued: true });
  } else {
    // Failure: update attempt counter and potentially lock out
    entry.failedAttempts = (entry.failedAttempts || 0) + 1;

    if (entry.failedAttempts >= MAX_ATTEMPTS) {
      entry.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      delete entry.failedAttempts; // Reset counter after lockout is set
      fastify.log.warn(`User ${userId} locked out due to too many failed 2FA attempts.`);
    }

    token_map.set(key, entry);

    return reply.status(400).send({ error: 'Invalid code' });
  }
});

// Endpoint: check 2FA status (does user have TOTP configured?)
// Returns { requires2FA: boolean, type?: 'authApp' }
fastify.post('/auth/2fa/status', async (request, reply) => {
  const { userId } = request.body || {};
  if (!userId) {
    return reply.status(400).send({ error: 'userId is required' });
  }

  // Check in-memory map first (for authApp TOTP secrets)
  const key = String(userId);
  let entry = token_map.get(key);
  if (entry && entry.type === 'authApp' && entry.secret) {
    return reply.send({ requires2FA: true, type: 'authApp' });
  }

  entry = hydrateAuthAppEntry(key);
  if (entry && entry.type === 'authApp' && entry.secret) {
    return reply.send({ requires2FA: true, type: 'authApp' });
  }

  // For now, assume all users require 2FA via email if not configured for authApp
  return reply.send({ requires2FA: true, type: 'email' });
});

// Keep the original sample endpoint (generateAccessToken) and ensure generateRandomToken exists
fastify.post('/2FA/generateAccessToken', async (request, reply) => {
  const { alias } = request.body || {};

  if (!alias) {
    return reply.status(400).send({ error: 'Alias is required' });
  }

  const token = generateRandomToken();
  const validUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
  const permission = true;

  token_map.set(alias, { token, validUntil, permission });

  return reply.send({ token });
});

async function testMailSend()
{
  try {
    const responseHtml = await sendMailerooEmail(
      process.env.MAILEROO_FROM || 'no-reply@example.com',
      'stormer0209@gmail.com',
      'Mateusz',
      'Your one-time code',
      "<h1>Your one-time code</h1><p>Please use the following code to complete your authentication:</p><p><strong>123456</strong></p>",
      'Your one-time code is 123456.'
    );

    console.log('Maileroo response:');
    console.log(responseHtml);
  } catch (err) {
    console.error('Failed to send email:', err);
    process.exitCode = 1;
  }
}

const start = async () => {
  try {
    // await testMailSend();

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`2FA Service running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

};

start();