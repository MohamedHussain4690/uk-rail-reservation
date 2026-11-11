import { Router, Request, Response } from 'express';
import {
  Booking,
  IBooking,
  cateringOrdersTotal,
  toPublicBooking,
} from '../models/Booking';
import { requireAuth } from '../auth/session';
import {
  MAX_MILESTONE_LENGTH,
  PreparedOrder,
  prepareMultiPassengerOrders,
  prepareOrder,
  withOrderIds,
} from '../lib/catering';

const router = Router();

/** YYYY-MM-DD in the server's own timezone, not UTC. */
function localIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Find the reservation the order belongs to.
 *
 * `bookingReference` is the PNR and is the reliable key. `passengerId` is the
 * fallback the app uses when it only knows a seat: it is matched against the
 * passenger's seat label on the caller's next confirmed trips.
 */
async function locateReservation(
  userId: string,
  bookingReference: string,
  passengerId: string
): Promise<IBooking | null> {
  if (bookingReference) {
    return Booking.findOne({
      pnr: bookingReference.trim().toUpperCase(),
      userId,
    });
  }

  if (!passengerId) return null;

  const seat = passengerId.trim().toUpperCase();
  const today = localIsoDate();

  const candidates = await Booking.find({
    userId,
    status: 'CONFIRMED',
    date: { $gte: today },
  }).sort({ date: 1, time: 1 });

  return (
    candidates.find((booking) =>
      booking.passengers.some((passenger) => passenger.seat.trim().toUpperCase() === seat)
    ) ?? null
  );
}


/**
 * POST /api/catering/order
 *
 * Persists one or more at-seat pantry orders onto the passenger's reservation
 * with a single `$push` (`$each`), so the orders land atomically alongside the
 * ticket they belong to. The multi-passenger payload is:
 *
 *   { bookingReference, deliveryMilestone, passengerOrders: [{ ... }] }
 *
 * The earlier single-seat payload remains accepted so existing clients and the
 * one-passenger checkout keep working during the rollout.
 */
router.post('/order', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const multiPassenger = Array.isArray(body.passengerOrders);

    const bookingReference = String(body.bookingReference ?? '').trim();
    const legacyPassengerId = String(body.passengerId ?? '').trim();

    if (!bookingReference && !legacyPassengerId) {
      res.status(400).json({
        success: false,
        message: 'Give a bookingReference (PNR) or a passengerId (seat label) to attach the order to.',
      });
      return;
    }

    if (multiPassenger && !bookingReference) {
      res.status(400).json({
        success: false,
        message: 'bookingReference is required when ordering for multiple passengers.',
      });
      return;
    }

    const booking = await locateReservation(
      req.user!._id.toString(),
      bookingReference,
      legacyPassengerId
    );

    if (!booking) {
      res.status(404).json({
        success: false,
        message: bookingReference
          ? `No reservation found for ${bookingReference.toUpperCase()}.`
          : `No upcoming reservation holds seat ${legacyPassengerId.toUpperCase()}.`,
      });
      return;
    }

    if (booking.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: 'This reservation has been cancelled; catering cannot be ordered against it.',
      });
      return;
    }

    const deliveryMilestone = String(body.deliveryMilestone ?? '').trim();
    if (!deliveryMilestone || deliveryMilestone.length > MAX_MILESTONE_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Choose a delivery milestone of up to ${MAX_MILESTONE_LENGTH} characters.`,
      });
      return;
    }

    let prepared: PreparedOrder[];
    let legacy = false;

    if (multiPassenger) {
      const result = prepareMultiPassengerOrders(
        booking,
        body.passengerOrders as unknown[],
        deliveryMilestone
      );
      if (typeof result === 'string') {
        res.status(400).json({ success: false, message: result });
        return;
      }
      prepared = result;
    } else {
      // Legacy single-seat order: the seat supplies the passenger identity.
      const assignedCoach = String(body.assignedCoach ?? '').trim();
      const assignedSeat = String(body.assignedSeat ?? '').trim().toUpperCase();

      if (!assignedCoach || !assignedSeat) {
        res.status(400).json({
          success: false,
          message: 'assignedCoach and assignedSeat are required.',
        });
        return;
      }

      const order = prepareOrder(
        booking,
        { ...body, passengerName: undefined, passengerId: legacyPassengerId || undefined },
        deliveryMilestone,
        false
      );

      if (typeof order === 'string') {
        res.status(400).json({ success: false, message: order });
        return;
      }

      // Preserve the legacy contract: the caller sends the net total and the
      // server rejects a forged figure with the expected amount.
      const declaredTotal = Number(body.totalAmount);
      if (!Number.isFinite(declaredTotal)) {
        res.status(400).json({
          success: false,
          message: `totalAmount is required; the order comes to £${order.totalAmount.toFixed(2)}.`,
        });
        return;
      }

      if (Math.abs(declaredTotal - order.totalAmount) > 0.005) {
        const concessionNote = order.concession
          ? ` (£${order.subtotal.toFixed(2)} less the £${order.concession.amount.toFixed(
              2
            )} First Class Advance concession)`
          : '';

        res.status(400).json({
          success: false,
          message: `Order total does not match the items; expected £${order.totalAmount.toFixed(
            2
          )}${concessionNote}.`,
        });
        return;
      }

      prepared = [order];
      legacy = true;
    }

    const updated = await pushOrders(booking, prepared, req.user!._id.toString());
    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Reservation disappeared before the order was saved.',
      });
      return;
    }

    if (legacy) {
      const order = updated.cateringOrders[updated.cateringOrders.length - 1];

      console.log(
        `catering order ${order.orderId}: ${order.items.length} line(s), GBP ${order.totalAmount.toFixed(
          2
        )}${order.concession ? ` after GBP ${order.concession.amount.toFixed(2)} concession` : ''} -> ${
          booking.pnr
        } ${order.assignedCoach} ${order.assignedSeat}`
      );

      res.json({
        success: true,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        concession: order.concession ?? null,
        updatedReservation: toPublicBooking(updated),
      });
      return;
    }

    console.log(
      `catering batch ${prepared.length} order(s) -> ${booking.pnr}: ${updated.cateringOrders
        .slice(-prepared.length)
        .map((order) => `${order.orderId} ${order.passengerName} (${order.assignedCoach} ${order.assignedSeat})`)
        .join(', ')}`
    );

    res.json({
      success: true,
      updatedOrders: updated.cateringOrders,
    });
  } catch (err) {
    console.error('catering order failed:', err);
    res.status(500).json({ success: false, message: 'Could not place the catering order.' });
  }
});

/**
 * Push the prepared orders in one atomic update. The unique index on
 * `cateringOrders.orderId` can reject a same-millisecond collision, so the
 * batch is regenerated with a later id run and retried.
 */
async function pushOrders(
  booking: IBooking,
  prepared: PreparedOrder[],
  userId: string
): Promise<IBooking | null> {
  const addedFoodTotal = cateringOrdersTotal(prepared);
  const existingFoodTotal =
    typeof booking.foodTotal === 'number'
      ? booking.foodTotal
      : cateringOrdersTotal(booking.cateringOrders ?? []);
  const hasUnifiedTotal =
    typeof booking.totalFare === 'number' && typeof booking.foodTotal === 'number';

  for (let attempt = 0; attempt < 3; attempt++) {
    const batch = withOrderIds(prepared, booking.originCode, attempt);
    const nextFoodTotal = Math.round((existingFoodTotal + addedFoodTotal) * 100) / 100;
    const nextTotalFare =
      Math.round(((Number(booking.price) || 0) + nextFoodTotal) * 100) / 100;

    try {
      return await Booking.findOneAndUpdate(
        { _id: booking._id, userId, status: 'CONFIRMED' },
        hasUnifiedTotal
          ? {
              $push: { cateringOrders: { $each: batch } },
              $inc: { foodTotal: addedFoodTotal, totalFare: addedFoodTotal },
            }
          : {
              $push: { cateringOrders: { $each: batch } },
              $set: { foodTotal: nextFoodTotal, totalFare: nextTotalFare },
            },
        { new: true, runValidators: true }
      );
    } catch (err) {
      const duplicate = (err as { code?: number }).code === 11000;
      if (duplicate && attempt < 2) continue;
      throw err;
    }
  }

  return null;
}

export default router;
