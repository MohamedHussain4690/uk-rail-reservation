import {
  ICateringItem,
  ICateringOrder,
  IBookingPassenger,
  cateringTotal,
  firstClassConcession,
} from '../models/Booking';

/** The trolley cannot carry an unbounded order. */
export const MAX_ORDER_LINES = 40;
export const MAX_LINE_QUANTITY = 20;
export const MAX_MILESTONE_LENGTH = 120;

/** A prepared order, waiting for its generated id before persistence. */
export type PreparedOrder = Omit<ICateringOrder, 'orderId'>;

export interface CateringBookingContext {
  pnr?: string;
  fareType: string;
  fareName: string;
  originCode: string;
  passengers: IBookingPassenger[];
}

/** "Coach B (Luggage & Standard)" -> "Coach B"; the galley only needs the letter. */
export function shortCoach(coach: string): string {
  return coach.split('(')[0].trim();
}

/** Does this traveller hold the seat the order is addressed to? */
export function holdsSeat(passenger: IBookingPassenger, coach: string, seat: string): boolean {
  return (
    shortCoach(passenger.coach).toLowerCase() === shortCoach(coach).toLowerCase() &&
    passenger.seat.trim().toUpperCase() === seat.trim().toUpperCase()
  );
}

/** The seats this reservation actually holds, for helpful 400 responses. */
export function heldSeats(passengers: IBookingPassenger[]): string {
  return passengers
    .slice(0, 6)
    .map((passenger) => `${shortCoach(passenger.coach)} ${passenger.seat}`)
    .join(', ');
}

/** A stable fallback key when the client only sends a seat. */
export function fallbackPassengerId(coach: string, seat: string): string {
  return `${shortCoach(coach).replace(/[^a-z0-9]+/gi, '').toUpperCase()}-${seat
    .trim()
    .toUpperCase()}`;
}

/**
 * Validate the order lines. Names and unit prices are snapshotted onto the
 * reservation, so they are stored exactly as the board sold them; the totals
 * are always recomputed here rather than trusted from the browser.
 */
export function parseItems(raw: unknown): ICateringItem[] | string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return 'A catering order needs at least one item.';
  }
  if (raw.length > MAX_ORDER_LINES) {
    return `A catering order can hold at most ${MAX_ORDER_LINES} lines.`;
  }

  const items: ICateringItem[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < raw.length; index++) {
    const entry = (raw[index] ?? {}) as Record<string, unknown>;
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
 * Turn one payload entry into the order we will store.
 *
 * The seat is the authority: the traveller who holds it supplies the canonical
 * coach and seat. `passengerName` is required in multi-passenger payloads, but
 * a matching seat can never be claimed for an unreserved seat.
 */
export function prepareOrder(
  context: CateringBookingContext,
  raw: Record<string, unknown>,
  deliveryMilestone: string,
  requireName: boolean
): PreparedOrder | string {
  const assignedCoach = String(raw.assignedCoach ?? '').trim();
  const assignedSeat = String(raw.assignedSeat ?? '').trim().toUpperCase();

  if (!assignedCoach || !assignedSeat) {
    return 'assignedCoach and assignedSeat are required for each passenger order.';
  }

  const holder = context.passengers.find((passenger) =>
    holdsSeat(passenger, assignedCoach, assignedSeat)
  );

  if (!holder) {
    const refLabel = context.pnr ? `on ${context.pnr}` : 'on this booking';
    return `Seat ${assignedSeat} in ${shortCoach(assignedCoach)} is not reserved ${refLabel}. Reserved seats: ${heldSeats(context.passengers)}.`;
  }

  const suppliedName = String(raw.passengerName ?? '').trim();
  if (requireName && !suppliedName) {
    return `passengerName is required for ${shortCoach(holder.coach)} ${holder.seat}.`;
  }

  const items = parseItems(raw.items);
  if (typeof items === 'string') return items;

  const subtotal = cateringTotal(items);
  // The fare, not the browser, decides whether a concession applies.
  const concession = firstClassConcession(context.fareType, context.fareName, subtotal);
  const totalAmount = Math.round((subtotal - (concession?.amount ?? 0)) * 100) / 100;

  const suppliedId = String(raw.passengerId ?? '').trim();
  const passengerId = suppliedId || fallbackPassengerId(holder.coach, holder.seat);

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

/**
 * Validate and prepare a multi-passenger batch of catering orders against the
 * passengers in `context`. Enforces unique seats and unique passengerIds.
 */
export function prepareMultiPassengerOrders(
  context: CateringBookingContext,
  rawOrders: unknown[],
  deliveryMilestone: string
): PreparedOrder[] | string {
  if (rawOrders.length === 0) {
    return 'passengerOrders must contain at least one passenger order.';
  }

  if (rawOrders.length > context.passengers.length) {
    return `This reservation has ${context.passengers.length} passenger${
      context.passengers.length === 1 ? '' : 's'
    }; send at most one order per passenger.`;
  }

  const seenSeats = new Set<string>();
  const seenPassengerIds = new Set<string>();
  const prepared: PreparedOrder[] = [];

  for (let index = 0; index < rawOrders.length; index++) {
    const raw = rawOrders[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return `Passenger ${index + 1} must be an object with a name, seat and items.`;
    }

    const entry = raw as Record<string, unknown>;
    const order = prepareOrder(context, entry, deliveryMilestone, true);

    if (typeof order === 'string') {
      return `Passenger ${index + 1}: ${order}`;
    }

    // The subtotal is advisory rather than authoritative, but a bad figure
    // means the caller and the server disagree about what is being bought.
    const declaredSubtotal = entry.subtotal;
    if (declaredSubtotal !== undefined && declaredSubtotal !== null && `${declaredSubtotal}` !== '') {
      const subtotal = Number(declaredSubtotal);
      if (!Number.isFinite(subtotal)) {
        return `Passenger ${index + 1}: subtotal must be a number; the items come to £${order.subtotal.toFixed(2)}.`;
      }
      if (Math.abs(subtotal - order.subtotal) > 0.005) {
        return `Passenger ${index + 1}: subtotal does not match the items; expected £${order.subtotal.toFixed(2)}.`;
      }
    }

    const seatKey = `${order.assignedCoach.toUpperCase()}|${order.assignedSeat}`;
    if (seenSeats.has(seatKey)) {
      return `Passenger ${index + 1}: ${order.assignedCoach} ${order.assignedSeat} already has an order in this request.`;
    }
    seenSeats.add(seatKey);

    const passengerKey = order.passengerId.toUpperCase();
    if (seenPassengerIds.has(passengerKey)) {
      return `Passenger ${index + 1}: passengerId ${order.passengerId} is duplicated in this request.`;
    }
    seenPassengerIds.add(passengerKey);

    prepared.push(order);
  }

  return prepared;
}

/** The unique index is the final arbiter; a collision retries with a new run. */
export function withOrderIds(
  orders: PreparedOrder[],
  originCode: string,
  attempt: number
): ICateringOrder[] {
  const base = Date.now() + attempt * 1000;
  const crs = (originCode || 'UKR').toUpperCase().slice(0, 3);

  return orders.map((order, index) => ({
    ...order,
    orderId: `DINING-${base + index}-${crs}`,
  }));
}
