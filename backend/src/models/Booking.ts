import { Schema, model, Document, Types } from 'mongoose';
import { MAX_PASSENGERS } from '../lib/fares';

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

/**
 * A cancelled pass stays on screen for three hours so the passenger can see
 * that the cancellation landed, and then clears itself out of the wallet.
 */
export const CANCELLATION_VISIBILITY_HOURS = 3;
export const CANCELLATION_VISIBILITY_MS = CANCELLATION_VISIBILITY_HOURS * 60 * 60 * 1000;

/** One traveller on a booking, with the seat reserved for them. */
export interface IBookingPassenger {
  name: string;
  coach: string;
  seat: string;
}

/** Lifecycle of an at-seat catering order, from checkout to the tray table. */
export type DeliveryStatus = 'confirmed' | 'galley_prep' | 'in_transit' | 'delivered';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'confirmed',
  'galley_prep',
  'in_transit',
  'delivered',
] as const;

/** One line on a pantry order. Prices are captured when the order is placed. */
export interface ICateringItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/** A fare concession applied to an at-seat order. */
export interface ICateringConcession {
  label: string;
  amount: number;
}

/** A meal or pantry order delivered to a passenger's seat. */
export interface ICateringOrder {
  orderId: string;
  /** Client key identifying the traveller on this reservation. */
  passengerId: string;
  /** Canonical name of the passenger whose seat the trolley visits. */
  passengerName: string;
  items: ICateringItem[];
  /** Sum of the lines before any fare concession. */
  subtotal: number;
  /** Set when the bound fare earns a complimentary concession. */
  concession?: ICateringConcession;
  /** subtotal less any concession, recomputed on save. */
  totalAmount: number;
  assignedCoach: string;
  assignedSeat: string;
  deliveryMilestone: string;
  deliveryStatus: DeliveryStatus;
  placedAt: Date;
}

/** Sum of an order's lines, rounded to the penny. */
export function cateringTotal(
  items: ReadonlyArray<Pick<ICateringItem, 'quantity' | 'unitPrice'>>
): number {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return Math.round(total * 100) / 100;
}

/**
 * First Class Advance fares include a 10% at-seat concession. This is the
 * authoritative rule; the pantry board mirrors it for the bill, and the order
 * route uses it to recompute what the browser must send.
 */
export const FIRST_CLASS_CONCESSION_RATE = 0.1;

export function firstClassConcession(
  fareType: string,
  fareName: string,
  subtotal: number
): ICateringConcession | null {
  if (fareType.trim().toLowerCase() !== 'first class') return null;
  if (fareName.trim().toLowerCase() !== 'first class advance') return null;

  const amount = Math.round(subtotal * FIRST_CLASS_CONCESSION_RATE * 100) / 100;
  return amount > 0 ? { label: 'First Class Advance concession', amount } : null;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  pnr: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  date: string;
  time: string;
  fareType: string;
  fareName: string;
  /** Price for one passenger, after the railcard concession. */
  unitPrice: number;
  /** Total charged: unitPrice × passengers.length. */
  price: number;
  passengers: IBookingPassenger[];
  /** At-seat catering orders tied to this reservation. */
  cateringOrders: ICateringOrder[];
  status: BookingStatus;
  /**
   * When the passenger cancelled. Absent on a live pass — deliberately, so the
   * TTL index above has nothing to collect.
   */
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const passengerSchema = new Schema<IBookingPassenger>(
  {
    name: { type: String, required: true, trim: true },
    coach: { type: String, default: 'Unassigned', trim: true },
    seat: { type: String, default: 'Unassigned', trim: true },
  },
  { _id: false }
);

const cateringItemSchema = new Schema<ICateringItem>(
  {
    itemId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const cateringConcessionSchema = new Schema<ICateringConcession>(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const cateringOrderSchema = new Schema<ICateringOrder>(
  {
    orderId: { type: String, required: true, trim: true, uppercase: true },
    passengerId: { type: String, required: true, trim: true, maxlength: 80 },
    passengerName: { type: String, required: true, trim: true, maxlength: 80 },
    items: {
      type: [cateringItemSchema],
      validate: {
        validator: (items: ICateringItem[]) => items.length >= 1 && items.length <= 40,
        message: 'A catering order needs between 1 and 40 lines.',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    concession: { type: cateringConcessionSchema, default: undefined },
    totalAmount: { type: Number, required: true, min: 0 },
    assignedCoach: { type: String, required: true, trim: true },
    assignedSeat: { type: String, required: true, trim: true },
    deliveryMilestone: { type: String, required: true, trim: true },
    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: 'confirmed',
    },
    placedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new Schema<IBooking>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pnr: { type: String, required: true, unique: true, trim: true },
    origin: { type: String, required: true, trim: true },
    originCode: { type: String, required: true, trim: true, uppercase: true },
    destination: { type: String, required: true, trim: true },
    destinationCode: { type: String, required: true, trim: true, uppercase: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    fareType: { type: String, default: '', trim: true },
    fareName: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    passengers: {
      type: [passengerSchema],
      validate: {
        validator: (list: IBookingPassenger[]) =>
          list.length >= 1 && list.length <= MAX_PASSENGERS,
        message: `A booking must have between 1 and ${MAX_PASSENGERS} passengers.`,
      },
    },
    cateringOrders: { type: [cateringOrderSchema], default: [] },
    status: {
      type: String,
      enum: ['CONFIRMED', 'CANCELLED'],
      default: 'CONFIRMED',
    },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

/**
 * An order id identifies exactly one order. The index is partial so that
 * reservations with no catering - the overwhelming majority - are not all
 * indexed under `undefined` and rejected as duplicates.
 */
bookingSchema.index(
  { 'cateringOrders.orderId': 1 },
  { unique: true, partialFilterExpression: { 'cateringOrders.0': { $exists: true } } }
);

/**
 * The server owns the money. Whatever total a caller supplies, the stored one
 * is recomputed from the lines less any fare concession, so a reservation can
 * never carry a total that disagrees with its items.
 */
bookingSchema.pre('validate', function () {
  for (const order of this.cateringOrders ?? []) {
    const gross = cateringTotal(order.items);
    const discount = Math.min(gross, Math.max(0, order.concession?.amount ?? 0));

    order.subtotal = gross;
    if (order.concession) {
      order.concession.amount = Math.round(discount * 100) / 100;
    }
    order.totalAmount = Math.round((gross - discount) * 100) / 100;
  }
});

/**
 * The purge. MongoDB's TTL monitor deletes a cancelled booking once
 * `cancelledAt` is three hours old, so the record leaves the database for good
 * rather than only disappearing from the wallet.
 *
 * Confirmed bookings never carry the field, and a TTL index ignores documents
 * whose indexed field is missing, so only cancellations are ever collected.
 * The monitor sweeps about once a minute, so the exact three-hour boundary is
 * enforced by `hasVanished` on the way out of `GET /api/bookings`, with the
 * physical delete following moments later.
 */
bookingSchema.index({ cancelledAt: 1 }, { expireAfterSeconds: CANCELLATION_VISIBILITY_MS / 1000 });

/** When the pass was cancelled; falls back to the last update for older rows. */
export function cancellationTime(
  booking: Pick<IBooking, 'status' | 'cancelledAt' | 'updatedAt'>
): Date | null {
  if (booking.status !== 'CANCELLED') return null;
  return booking.cancelledAt ?? booking.updatedAt ?? null;
}

/** The instant a cancelled pass leaves the wallet, or null if it is live. */
export function removalTime(
  booking: Pick<IBooking, 'status' | 'cancelledAt' | 'updatedAt'>
): Date | null {
  const cancelledAt = cancellationTime(booking);
  if (!cancelledAt) return null;
  return new Date(cancelledAt.getTime() + CANCELLATION_VISIBILITY_MS);
}

/** True once a cancelled pass has served its three hours on screen. */
export function hasVanished(
  booking: Pick<IBooking, 'status' | 'cancelledAt' | 'updatedAt'>,
  now: number = Date.now()
): boolean {
  const cancelledAt = cancellationTime(booking);
  if (!cancelledAt) return false;
  return now >= cancelledAt.getTime() + CANCELLATION_VISIBILITY_MS;
}

/** Shape returned to the browser. */
export interface PublicBooking {
  id: string;
  pnr: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  date: string;
  time: string;
  fareType: string;
  fareName: string;
  unitPrice: number;
  price: number;
  passengerCount: number;
  passengers: IBookingPassenger[];
  /** At-seat catering orders, oldest first. */
  cateringOrders: ICateringOrder[];
  status: BookingStatus;
  /** Set once the booking is cancelled. */
  cancelledAt: Date | null;
  /** When the cancelled pass drops out of the wallet; null while it is live. */
  removalAt: Date | null;
  createdAt: Date;
}

export function toPublicBooking(booking: IBooking): PublicBooking {
  const passengers = booking.passengers ?? [];

  return {
    id: booking._id.toString(),
    pnr: booking.pnr,
    origin: booking.origin,
    originCode: booking.originCode,
    destination: booking.destination,
    destinationCode: booking.destinationCode,
    date: booking.date,
    time: booking.time,
    fareType: booking.fareType,
    fareName: booking.fareName,
    unitPrice: booking.unitPrice,
    price: booking.price,
    passengerCount: passengers.length,
    passengers: passengers.map((passenger) => ({
      name: passenger.name,
      coach: passenger.coach,
      seat: passenger.seat,
    })),
    cateringOrders: (booking.cateringOrders ?? []).map((order) => ({
      orderId: order.orderId,
      passengerId: order.passengerId,
      passengerName: order.passengerName,
      items: (order.items ?? []).map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal: order.subtotal,
      concession: order.concession
        ? { label: order.concession.label, amount: order.concession.amount }
        : undefined,
      totalAmount: order.totalAmount,
      assignedCoach: order.assignedCoach,
      assignedSeat: order.assignedSeat,
      deliveryMilestone: order.deliveryMilestone,
      deliveryStatus: order.deliveryStatus,
      placedAt: order.placedAt,
    })),
    status: booking.status,
    cancelledAt: booking.cancelledAt ?? null,
    removalAt: removalTime(booking),
    createdAt: booking.createdAt,
  };
}

export const Booking = model<IBooking>('Booking', bookingSchema);
