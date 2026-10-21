import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/session';
import { quoteFares } from '../lib/fares';

const router = Router();

/**
 * GET /api/fares?originCode=KGX&destinationCode=EDB
 *
 * Authoritative fare quotes for the signed-in passenger. The railcard discount
 * comes from the stored profile rather than the query string, so the planner
 * can display exactly what the booking endpoint will charge.
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  const originCode = String(req.query.originCode ?? '').trim().toUpperCase();
  const destinationCode = String(req.query.destinationCode ?? '').trim().toUpperCase();

  if (!originCode || !destinationCode) {
    res.status(400).json({
      success: false,
      message: 'originCode and destinationCode are required.',
    });
    return;
  }

  res.json({
    success: true,
    railcard: req.user!.railcard,
    fares: quoteFares(originCode, destinationCode, req.user!.railcard.discountPercent),
  });
});

export default router;
