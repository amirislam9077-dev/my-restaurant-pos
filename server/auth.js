import crypto from 'crypto';
import './env.js';

const SECRET = process.env.AUTH_SECRET || 'change-this-secret';
const TOKEN_HOURS = 12;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function createToken(admin) {
  const payload = Buffer.from(JSON.stringify({
    id: admin.id,
    username: admin.username,
    exp: Date.now() + TOKEN_HOURS * 3600 * 1000,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const admin = verifyToken(token);
  if (!admin) return res.status(401).json({ error: 'Login required' });
  req.admin = admin;
  next();
}

// Lets a route work for both public and admin callers
export function optionalAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  req.admin = verifyToken(token);
  next();
}
