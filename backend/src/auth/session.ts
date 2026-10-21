import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Session } from '../models/Session';
import { User, IUser } from '../models/User';

export const SESSION_COOKIE = 'ukr_session';
const SESSION_DAYS = 7;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/** Create a session document and set the httpOnly cookie. */
export async function createSession(userId: string, res: Response): Promise<void> {
  const sid = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({ sid, userId, expiresAt });

  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

/** Delete the session document (if any) and clear the cookie. */
export async function destroySession(req: Request, res: Response): Promise<void> {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) {
    await Session.deleteOne({ sid });
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Populate req.user when a valid, unexpired session cookie is present. */
export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (!sid) return next();

    const session = await Session.findOne({ sid });
    if (!session) return next();

    if (session.expiresAt.getTime() < Date.now()) {
      await Session.deleteOne({ sid });
      return next();
    }

    const user = await User.findById(session.userId);
    if (user) req.user = user;

    next();
  } catch (err) {
    next(err);
  }
}

/** Reject the request unless a session resolved to a user. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }
  next();
}
