import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthUser {
  userId: number;
  email: string;
  role: 'user' | 'admin';
}

export const verifyToken = (req: NextRequest): AuthUser | null => {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const requireAuth = (req: NextRequest): AuthUser => {
  const user = verifyToken(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
};

export const requireAdmin = (req: NextRequest): AuthUser => {
  const user = requireAuth(req);
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return user;
};

