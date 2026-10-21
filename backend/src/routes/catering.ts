import { Router, Request, Response } from 'express';
import {
  Booking,
  ICateringItem,
  ICateringOrder,
  IBooking,
  IBookingPassenger,
  cateringTotal,
  firstClassConcession,
  toPublicBooking,
} from '../models/Booking';
import { requireAuth } from '../auth/session';

const router = Router();

/** The trolley cannot carry an unbounded order. */
const MAX_ORDER_LINES = 40;
const MAX_LINE_QUANTITY = 20;
const MAX_MILESTONE_LENGTH = 120;

/** A prepared order, waiting for its generated id before the $push. */
type PreparedOrder = Omit<ICateringOrder, 'orderId'>;

/** "Coach B (Luggage & Standard)" -> "Coach B"; the galley only needs the letter. */
function shortCoach(coach: string): string {
  return coach.split('(')[0].trim();
}

/** Does this traveller hold the seat the order is addressed to? */
function holdsSeat(passenger: IBookingPassenger, coach: string, seat: string): boolean {
  return (
    shortCoach(passenger.coach).toLowerCase() === shortCoach(coach).toLowerCase() &&
    passenger.seat.trim().toUpperCase() === seat.trim().toUpperCase()
  );
}

/** YYYY-MM-DD in the server's own timezone, not UTC. */
function localIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate the order lines. Names and unit prices are snapshotted onto the
 * reservation, so they are stored exactly as the board sold them; the totals
 * are always recomputed here rather than trusted from the browser.
 */
function parseItems(raw: unknown): ICateringItem[] | string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return 'A catering order needs at least one item.';
  }
  if (raw.length > MAX_ORDER_LINES) {
    return `A catering order can hold at most ${MAX_ORDER_LINES} lines.`;
  }

  const items: ICateringItem[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < raw.length; index++) {
    const entry = raw[index] ?? {};
    const itemId = String(entry.itemId ?? '').trim();
    const name = String(entry.name ?? '').trim();
    const quantity = Number(entry.quantity);
    const unitPrice = Number(entry.unitPrice);

    if (!itemId || !name) {
      return `Item ${index + 1} needs an itemId and a name.`;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      return `Item ${index + 1} must have a whole quantity between 1 and ${MAX_LINE_QUANTITY}.`;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return `Item ${index + 1} has an invalid unit price.`;
    }
    if (seen.has(itemId)) {
      return `Item ${itemId} appears twice; send one line with the combined quantity.`;
    }

    seen.add(itemId);
    items.push({
      itemId,
      name,
      quantity,
      unitPrice: Math.round(unitPrice * 100) / 100,
    });
  }

  return items;
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

/** The seats this reservation actually holds, for helpful 400 responses. */
function heldSeats(booking: IBooking): string {
  return booking.passengers
    .slice(0, 6)
    .map((passenger) => `${shortCoach(passenger.coach)} ${passenger.seat}`)
    .join(', ');
}

/** A stable fallback key when the client only sends a seat. */
function fallbackPassengerId(coach: string, seat: string): string {
  return `${shortCoach(coach).replace(/[^a-z0-9]+/gi, '').toUpperCase()}-${seat
    .trim()
    .toUpperCase()}`;
}

/**
 * Turn one payload entry into the order we will store.
 *
 * The seat is the authority: the traveller who holds it supplies the canonical
 * name, coach and seat. `passengerName` is still required in the new
 * multi-passenger payload, but a matching seat can never be claimed by another
 * name. Legacy single-order callers omit the name and inherit it from the seat
 * holder.
 */
function prepareOrder(
  booking: IBooking,
  raw: Record<string, unknown>,
  deliveryMilestone: string,
  requireName: boolean
): PreparedOrder | string {
  const assignedCoach = String(raw.assignedCoach ?? '').trim();
  const assignedSeat = String(raw.assignedSeat ?? '').trim().toUpperCase();

  if (!assignedCoach || !assignedSeat) {
    return 'assignedCoach and assignedSeat are required for each passenger order.';
  }

  const holder = booking.passengers.find((passenger) =>
    holdsSeat(passenger, assignedCoach, assignedSeat)
  );

  if (!holder) {
    return `Seat ${assignedSeat} in ${shortCoach(assignedCoach)} is not reserved on ${booking.pnr}. This reservation holds: ${heldSeats(booking)}.`;
  }

  const suppliedName = String(raw.passengerName ?? '').trim();
  if (requireName && !suppliedName) {
    return `passengerName is required for ${shortCoach(holder.coach)} ${holder.seat}.`;
  }

  const items = parseItems(raw.items);
  if (typeof items === 'string') return items;

  const subtotal = cateringTotal(items);
  // The fare, not the browser, decides whether a concession applies.
  const concession = firstClassConcession(booking.fareType, booking.fareName, subtotal);
  const totalAmount = Math.round((subtotal - (concession?.amount ?? 0)) * 100) / 100;

  const suppliedId = String(raw.passengerId ?? '').trim();
  const passengerId =
    suppliedId || fallbackPassengerId(holder.coach, holder.seat);

  return {
    passengerId,
    // The seat is authoritative; the supplied name is the label stored on the
    // coupon. Legacy callers omit it and inherit the reservation's spelling.
    passengerName: suppliedName || holder.name.trim(),
    assignedCoach: shortCoach(holder.coach),
    assignedSeat: holder.seat.trim().toUpperCase(),
    items,
    subtotal,
    ...(concession ? { concession } : {}),
    totalAmount,
    deliveryMilestone,
    deliveryStatus: 'confirmed',
    placedAt: new Date(),
  };
}

/** The unique index is the final arbiter; a collision retries with a new run. */
function withOrderIds(
  orders: PreparedOrder[],
  booking: IBooking,
  attempt: number
): ICateringOrder[] {
  const base = Date.now() + attempt * 1000;
  const crs = (booking.originCode || 'UKR').toUpperCase().slice(0, 3);

  return orders.map((order, index) => ({
    ...order,
    orderId: `DINING-${base + index}-${crs}`,
  }));
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
      const rawOrders = body.passengerOrders as unknown[];
      if (rawOrders.length === 0) {
        res.status(400).json({
          success: false,
          message: 'passengerOrders must contain at least one passenger order.',
        });
        return;
      }

      if (rawOrders.length > booking.passengers.length) {
        res.status(400).json({
          success: false,
          message: `This reservation has ${booking.passengers.length} passenger${
            booking.passengers.length === 1 ? '' : 's'
          }; send at most one order per passenger.`,
        });
        return;
      }

      const seenSeats = new Set<string>();
      const seenPassengerIds = new Set<string>();
      prepared = [];

      for (let index = 0; index < rawOrders.length; index++) {
        const raw = rawOrders[index];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          res.status(400).json({
            success: false,
            message: `Passenger ${index + 1} must be an object with a name, seat and items.`,
          });
          return;
        }

        const entry = raw as Record<string, unknown>;
        const order = prepareOrder(booking, entry, deliveryMilestone, true);

        if (typeof order === 'string') {
          res.status(400).json({
            success: false,
            message: `Passenger ${index + 1}: ${order}`,
          });
          return;
        }

        // The subtotal is advisory rather than authoritative, but a bad figure
        // means the caller and the server disagree about what is being bought.
        const declaredSubtotal = entry.subtotal;
        if (declaredSubtotal !== undefined && declaredSubtotal !== null && `${declaredSubtotal}` !== '') {
          const subtotal = Number(declaredSubtotal);
          if (!Number.isFinite(subtotal)) {
            res.status(400).json({
              success: false,
              message: `Passenger ${index + 1}: subtotal must be a number; the items come to £${order.subtotal.toFixed(2)}.`,
            });
            return;
          }
          if (Math.abs(subtotal - order.subtotal) > 0.005) {
            res.status(400).json({
              success: false,
              message: `Passenger ${index + 1}: subtotal does not match the items; expected £${order.subtotal.toFixed(2)}.`,
            });
            return;
          }
        }

        const seatKey = `${order.assignedCoach.toUpperCase()}|${order.assignedSeat}`;
        if (seenSeats.has(seatKey)) {
          res.status(400).json({
            success: false,
            message: `Passenger ${index + 1}: ${order.assignedCoach} ${order.assignedSeat} already has an order in this request.`,
          });
          return;
        }
        seenSeats.add(seatKey);

        const passengerKey = order.passengerId.toUpperCase();
        if (seenPassengerIds.has(passengerKey)) {
          res.status(400).json({
            success: false,
            message: `Passenger ${index + 1}: passengerId ${order.passengerId} is duplicated in this request.`,
          });
          return;
        }
        seenPassengerIds.add(passengerKey);

        prepared.push(order);
      }
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
  for (let attempt = 0; attempt < 3; attempt++) {
    const batch = withOrderIds(prepared, booking, attempt);

    try {
      return await Booking.findOneAndUpdate(
        { _id: booking._id, userId, status: 'CONFIRMED' },
        { $push: { cateringOrders: { $each: batch } } },
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
