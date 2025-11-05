import Fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
// import axios from 'axios';
import { exec } from 'child_process'; // Import exec

export async function sendMailerooEmail(from, to, display_name, subject, html, plain_text) {
  // const apiKey = process.env.MAILEROO;
  const apiKey = '048b98ee34401e9ba50f717c0c8ef11b985b82f4522ec8b6e6390409300f3d9c';
  if (!apiKey) {
    throw new Error('Set the MAILEROO environment variable first.');
    console.log('MAILEROO API key missing');
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
      // Maileroo can still return an error JSON with a 200 OK from curl's perspective
      // A simple check for a success-like field in the response is good practice.
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
        // If stdout is not JSON, it's likely an unexpected response from a proxy/firewall
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

// Initialize SQLite database (kept from original file)
const dbPath = '/app/database/2fa.db';
const dbDir = path.dirname(dbPath);

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
} catch (err) {
  fastify.log.warn('Could not open DB, continuing with in-memory token map', err);
}

// Register CORS
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS']
});

const token_map = new Map(); // userId -> { type: 'email'|'authApp', code?, secret?, validUntil?, failedAttempts?, lockoutUntil? }

// Utility: generate numeric code
function generateNumericCode(length = 6) {
  const max = 10 ** length;
  const num = Math.floor(Math.random() * max);
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

// Endpoint: send email code to user (development: returns code when MAILEROO is missing)
fastify.post('/auth/2fa/send', async (request, reply) => {
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

  // Try to send via Maileroo if configured. If not configured, fallback to logging and return code (dev).
  const fromAddress = 'no-reply@19d4dcf591331c5a.maileroo.org';
  const displayName = '2FA Server';

  if (recipient) {
    try {
      // if ('048b98ee34401e9ba50f717c0c8ef11b985b82f4522ec8b6e6390409300f3d9c') {
      //   // dev fallback: log and return code
      //   fastify.log.warn('MAILEROO not configured — logging code instead of sending email');
      //   fastify.log.info(`2FA email code for ${recipient}: ${code} (valid until ${new Date(validUntil).toISOString()})`);
      //   return reply.send({ success: true, method: 'console', code });
      // }

      // send mail
      fastify.log.info(`2FA code emailed to ${recipient} for user ${userId || email}`);
      const response = await sendMailerooEmail(fromAddress, recipient, displayName, subject, html, plain);
      fastify.log.debug(`Maileroo response: ${response}`);
      // Production: do NOT return the code in response
      return reply.send({ success: true, method: 'maileroo' });
    } catch (err) {
      fastify.log.error({ err, status: err.status, body: err.body }, 'Failed to send 2FA email via Maileroo');
      return reply.status(500).send({
        success: false,
        error: 'Failed to send email',
        details: err && err.message ? err.message : String(err),
        code // still return code in dev to unblock login flows
      });
    }
  } else {
    // No recipient known (we only have numeric userId). Log and return success with code for dev.
    fastify.log.info(`2FA code for user ${userId} generated: ${code} (no recipient email provided)`);
    return reply.send({ success: true, method: 'console', code });
  }
});

// Endpoint: setup authenticator app for user (returns secret + otpauth_url)
fastify.post('/auth/2fa/setup', async (request, reply) => {
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

fastify.post('/auth/2fa/verify', async (request, reply) => {
  const { userId, code } = request.body || {};
  if (!userId || !code) {
    return reply.status(400).send({ error: 'userId and code are required' });
  }

  const entry = token_map.get(String(userId));
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
      token_map.delete(String(userId));
    } else {
      // For authApp, just reset any failure tracking
      delete entry.failedAttempts;
      delete entry.lockoutUntil;
      token_map.set(String(userId), entry);
    }

    // Return a demo "user" object — in production, fetch actual user from users service
    const demoUser = { id: userId, username: `user${userId}` };
    return reply.send(demoUser);
  } else {
    // Failure: update attempt counter and potentially lock out
    entry.failedAttempts = (entry.failedAttempts || 0) + 1;

    if (entry.failedAttempts >= MAX_ATTEMPTS) {
      entry.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      delete entry.failedAttempts; // Reset counter after lockout is set
      fastify.log.warn(`User ${userId} locked out due to too many failed 2FA attempts.`);
    }

    token_map.set(String(userId), entry);

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
  const entry = token_map.get(String(userId));
  if (entry && entry.type === 'authApp' && entry.secret) {
    return reply.send({ requires2FA: true, type: 'authApp' });
  }

  // If you have access to users database, query it:
  // const user = db.prepare('SELECT auth_type FROM users WHERE id = ?').get(userId);
  // if (user && user.auth_type) {
  //   return reply.send({ requires2FA: true, type: user.auth_type });
  // }

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
      'no-reply@19d4dcf591331c5a.maileroo.org',
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
    await testMailSend();

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`2FA Service running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

};

start();