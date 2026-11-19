import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
  jurisdictionCode?: string;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token) return res.status(401).json({ message: 'Access token required' });
  if (!jwtSecret) return res.status(503).json({ message: 'Authentication is not configured' });

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err || !decoded || typeof decoded === 'string' || typeof decoded.userId !== 'string') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    return next();
  });
};

/** Every management write must use this middleware after authentication. */
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Administrator access required' });
    }
    return next();
  } catch {
    return res.status(500).json({ message: 'Unable to verify administrator permissions' });
  }
};

/**
 * Fail-closed gate for real-money routes. A trusted geolocation service,
 * active operator licence and jurisdiction/product policy must be wired before
 * this gate can be replaced with an allow decision.
 */
export const denyRealMoneyUntilAuthorised = (_req: Request, res: Response) => {
  return res.status(503).json({
    message: 'Real-money gaming is disabled until operator, product and jurisdiction authorisation and trusted geolocation are configured.',
    code: 'REAL_MONEY_NOT_ENABLED',
  });
};


export const requireComplianceOfficer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
    const user = await User.findById(req.userId).select('role');
    if (!user || !['admin', 'compliance'].includes(user.role)) return res.status(403).json({ message: 'Compliance officer access required' });
    return next();
  } catch {
    return res.status(500).json({ message: 'Unable to verify compliance permissions' });
  }
};
