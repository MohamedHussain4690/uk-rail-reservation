import { Router, Request, Response } from 'express';
import { User, toPublicUser } from '../models/User';
import { hashPassword, verifyPassword } from '../auth/password';
import { createSession, destroySession, requireAuth } from '../auth/session';
import {
  normaliseEmail,
  isGmailAddress,
  normaliseIndianPhone,
  GMAIL_EXAMPLE,
  INDIAN_PHONE_EXAMPLE,
} from '../lib/validation';

const router = Router();

const RAILCARD_DISCOUNTS: Record<string, number> = {
  None: 0,
  '16-25': 34,
  Senior: 34,
  'Two Together': 34,
  Network: 34,
};

interface RegisterBody {
  email?: string;
  name?: string;
  phone?: string;
  password?: string;
  railcardType?: string;
  railcardNumber?: string;
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, phone, password, railcardType, railcardNumber } = req.body as RegisterBody;

    const errors: string[] = [];
    if (!email || !isGmailAddress(email)) {
      errors.push(`a valid Gmail address (e.g. ${GMAIL_EXAMPLE})`);
    }
    if (!name || name.trim().length < 2) errors.push('a full name');
    if (!password || password.length < 8) errors.push('a password of at least 8 characters');
    // The phone is optional, but when supplied it must be a valid Indian mobile.
    if (phone && phone.trim() && !normaliseIndianPhone(phone)) {
      errors.push(`a valid Indian mobile number (e.g. ${INDIAN_PHONE_EXAMPLE})`);
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, message: `Please provide ${errors.join(', ')}.` });
      return;
    }

    const normalisedEmail = normaliseEmail(email!);
    const existing = await User.findOne({ email: normalisedEmail });
    if (existing) {
      res.status(409).json({ success: false, message: 'An account with that email already exists.' });
      return;
    }

    const type = railcardType && railcardType !== 'None' ? railcardType : 'None';
    const hasRailcard = type !== 'None';

    const user = await User.create({
      email: normalisedEmail,
      name: name!.trim(),
      // Stored canonically as "+91 XXXXX XXXXX"; empty when omitted.
      phone: phone ? normaliseIndianPhone(phone) ?? '' : '',
      passwordHash: await hashPassword(password!),
      railcard: {
        type,
        number: hasRailcard ? (railcardNumber || '').trim() : '',
        expiresAt: hasRailcard ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
        discountPercent: RAILCARD_DISCOUNTS[type] ?? 0,
      },
    });

    await createSession(user._id.toString(), res);

    res.status(201).json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error('register failed:', err);
    res.status(500).json({ success: false, message: 'Could not create the account.' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: normaliseEmail(email) });

    // Same response for unknown email and wrong password so the endpoint
    // cannot be used to discover which addresses have accounts.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ success: false, message: 'Incorrect email or password.' });
      return;
    }

    await createSession(user._id.toString(), res);

    res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error('login failed:', err);
    res.status(500).json({ success: false, message: 'Could not sign in.' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    await destroySession(req, res);
    res.json({ success: true, message: 'Signed out.' });
  } catch (err) {
    console.error('logout failed:', err);
    res.status(500).json({ success: false, message: 'Could not sign out.' });
  }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, user: toPublicUser(req.user!) });
});

router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, phone, railcardType, railcardNumber, seatPreference } = req.body as {
      name?: string;
      phone?: string;
      railcardType?: string;
      railcardNumber?: string;
      seatPreference?: string;
    };

    const user = req.user!;

    if (name !== undefined) {
      if (name.trim().length < 2) {
        res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
        return;
      }
      user.name = name.trim();
    }

    if (phone !== undefined) {
      if (!phone.trim()) {
        user.phone = '';
      } else {
        const normalisedPhone = normaliseIndianPhone(phone);
        if (!normalisedPhone) {
          res.status(400).json({
            success: false,
            message: `Enter a valid Indian mobile number (e.g. ${INDIAN_PHONE_EXAMPLE}).`,
          });
          return;
        }
        user.phone = normalisedPhone;
      }
    }
    if (seatPreference !== undefined) user.seatPreference = seatPreference.trim();

    if (railcardType !== undefined) {
      const type = railcardType === 'None' ? 'None' : railcardType;
      user.railcard.type = type;
      user.railcard.discountPercent = RAILCARD_DISCOUNTS[type] ?? 0;
      user.railcard.number = type === 'None' ? '' : (railcardNumber ?? user.railcard.number);
      user.railcard.expiresAt =
        type === 'None' ? null : user.railcard.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (railcardNumber !== undefined) {
      user.railcard.number = railcardNumber.trim();
    }

    await user.save();
    res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    console.error('profile update failed:', err);
    res.status(500).json({ success: false, message: 'Could not save the profile.' });
  }
});

export default router;
