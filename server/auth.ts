import bcrypt from 'bcryptjs';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db';

const router = express.Router();
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured');
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  emergency_contact: string | null;
  created_at: Date;
};

const toUser = (user: UserRow) => ({
  name: user.name,
  email: user.email,
  phone: user.emergency_contact || '',
  emergencyContactPhone: user.emergency_contact || '',
  tier: 'Free',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
  joinedDate: user.created_at.toISOString(),
  emergencyTriggerDelayHours: 48,
  biometricEnabled: false,
  mfaEnabled: false,
  zeroKnowledgeKeyBackup: false,
  emergencyModeActive: false,
});

const createToken = (userId: string) => jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' });

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (typeof payload.userId !== 'string') throw new Error('Invalid token');
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

router.post('/signup', async (req, res) => {
  const { name, email, password, emergencyContact } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!name?.trim() || !normalizedEmail || !password || password.length < 8) {
    return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query<UserRow>(
      `INSERT INTO users (name, email, password_hash, emergency_contact)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, emergency_contact, created_at`,
      [name.trim(), normalizedEmail, passwordHash, emergencyContact?.trim() || null],
    );
    const user = result.rows[0];
    return res.status(201).json({ token: createToken(user.id), user: toUser(user) });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Unable to create your account.' });
  }
});

router.post('/login', async (req, res) => {
  const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  try {
    const result = await pool.query<UserRow & { password_hash: string }>(
      `SELECT id, name, email, emergency_contact, created_at, password_hash FROM users WHERE email = $1`,
      [normalizedEmail],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    return res.json({ token: createToken(user.id), user: toUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Unable to sign in.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, emergency_contact, created_at FROM users WHERE id = $1`,
    [req.userId],
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  return res.json({ user: toUser(user) });
});

export default router;

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
