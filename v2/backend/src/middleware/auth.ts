import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

// Simple demo auth middleware (replace with real JWT validation)
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError('Access token required', 401);
  }
  
  const token = authHeader.substring(7);
  
  // Demo: Accept any token that says "demo-token"
  if (token === 'demo-token') {
    req.user = {
      id: 'demo-user-id',
      email: 'demo@example.com',
      name: 'Demo User'
    };
    next();
  } else {
    throw createError('Invalid token', 401);
  }
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    authMiddleware(req, res, next);
  } catch (error) {
    // Continue without authentication
    next();
  }
};