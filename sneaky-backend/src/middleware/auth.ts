import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { prisma } from '@/database/connection';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { 
          id: decoded.userId,
          isActive: true
        },
        select: {
          id: true,
          email: true,
          role: true,
          organizationId: true,
          lastLoginAt: true
        }
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid token - user not found' });
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || undefined
      };

      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed', { error: jwtError, token: token.substring(0, 20) + '...' });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireOrganization = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.organizationId) {
    res.status(403).json({ error: 'Organization membership required' });
    return;
  }
  next();
};