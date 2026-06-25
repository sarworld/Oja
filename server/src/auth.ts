import type { NextFunction, Request, Response } from 'express';

/** Express middleware guarding /api/* (except health + login). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session && (req.session as { authed?: boolean }).authed) {
    next();
    return;
  }
  res.status(401).json({ error: 'auth' });
}
