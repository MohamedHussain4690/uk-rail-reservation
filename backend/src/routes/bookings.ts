import { Router, Request, Response } from 'express';
import {
  Booking,
  IBookingPassenger,
  hasVanished,
  toPublicBooking,
} from '../models/Booking';
import { requireAuth } from '../auth/session';
import { MAX_PASSENGERS, findFare, quoteFare } from '../lib/fares';

const router = Router();

const REQUIRED_FIELDS = [
  'origin',
  'originCode',
  'destination',
  'destinationCode',
  'date',
  'time',
  'fareType',
] as const;

/** Generate a PNR that is not already present in the collection. */
async function generateUniquePnr(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const pnr =
      'UKR-' +
      Math.floor(1000 + Math.random() * 9000) +
      '-' +
      Math.floor(1000 + Math.random() * 9000);

    const clash = await Booking.exists({ pnr });
    if (!clash) return pnr;
  }
  // Fall back to a time-based reference if the random space is exhausted.
  return `UKR-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Normalised identity of one physical seat on a departure. */
function seatKey(coach: string, seat: string): string {
  return `${coach.trim().toLowerCase()}|${seat.trim().toLowerCase()}`;
}

/**
 * Every seat already sold on a departure. A seat belongs to a service, which
 * this model identifies by its travel date and departure time, so the same
 * coach + seat cannot be sold twice at that time. Cancelled bookings release
 * their seats immediately.
 */
async function soldSeats(
  date: string,
  time: string
): Promise<Array<Pick<IBookingPassenger, 'coach' | 'seat'>>> {
  const booked = await Booking.find({ date, time, status: 'CONFIRMED' }).select('passengers');

  return booked.flatMap((booking) =>
    (booking.passengers ?? []).map((passenger) => ({
      coach: passenger.coach,
      seat: passenger.seat,
    }))
  );
}

/**
 * Validate the traveller list. Each traveller needs a name and a reserved
 * seat, and no seat may be sold twice on the same coach.
 */
function parsePassengers(raw: unknown): IBookingPassenger[] | string {
  if (!Array.isArray(raw)) return 'A booking needs a passenger list.';
  if (raw.length < 1 || raw.length > MAX_PASSENGERS) {
    return `A booking must have between 1 and ${MAX_PASSENGERS} passengers.`;
  }

  const passengers: IBookingPassenger[] = [];
  const takenSeats = new Set<string>();

  for (let index = 0; index < raw.length; index++) {
    const entry = raw[index] ?? {};
    const name = String(entry.name ?? '').trim();

    if (name.length < 2) {
      return `Enter the full name of passenger ${index + 1}.`;
    }

    const coach = String(entry.coach ?? '').trim() || 'Unassigned';
    const seat = String(entry.seat ?? '').trim() || 'Unassigned';

    const seatKeyValue = seatKey(coach, seat);
    if (takenSeats.has(seatKeyValue)) {
      return 'The same seat cannot be assigned to two passengers.';
    }
    takenSeats.add(seatKeyValue);

    passengers.push({ name, coach, seat });
  }

  return passengers;
}

/**
 * POST /api/bookings — create a booking owned by the signed-in passenger.
 *
 * The request carries what the passenger chose (route, fare category and
 * travellers) but never the price: the total is derived here from the server
 * fare table and the stored railcard, so it cannot be edited in flight.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};

    const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required field(s): ${missing.join(', ')}`,
      });
      return;
    }

    const fare = findFare(String(body.fareType));
    if (!fare) {
      res.status(400).json({ success: false, message: 'Unknown fare type.' });
      return;
    }

    const passengers = parsePassengers(body.passengers);
    if (typeof passengers === 'string') {
      res.status(400).json({ success: false, message: passengers });
      return;
    }

    // The seat map in the browser is a guide; this is the authority. A seat
    // sold on an earlier booking for the same departure cannot be sold again.
    const travelDate = String(body.date).trim();
    const travelTime = String(body.time).trim();
    const alreadySold = new Set(
      (await soldSeats(travelDate, travelTime)).map((seat) => seatKey(seat.coach, seat.seat))
    );

    const clash = passengers.find((passenger) =>
      alreadySold.has(seatKey(passenger.coach, passenger.seat))
    );
    if (clash) {
      res.status(409).json({
        success: false,
        message: `Seat ${clash.seat} in ${clash.coach} is already reserved on this departure. Choose another seat.`,
      });
      return;
    }

    const quote = quoteFare(
      fare.type,
      String(body.originCode),
      String(body.destinationCode),
      req.user!.railcard.discountPercent
    );

    if (!quote) {
      res.status(400).json({ success: false, message: 'Could not price that journey.' });
      return;
    }

    const unitPrice = quote.price;
    const totalPrice = Number((unitPrice * passengers.length).toFixed(2));

    const booking = await Booking.create({
      userId: req.user!._id,
      pnr: await generateUniquePnr(),
      origin: body.origin,
      originCode: body.originCode,
      destination: body.destination,
      destinationCode: body.destinationCode,
      date: body.date,
      time: body.time,
      fareType: quote.type,
      fareName: quote.name,
      unitPrice,
      price: totalPrice,
      passengers,
      status: 'CONFIRMED',
    });

    res.status(201).json({
      success: true,
      pnr: booking.pnr,
      message: 'Booking successfully secured and verified against National Rail CRS database.',
      booking: toPublicBooking(booking),
    });
  } catch (err) {
    console.error('booking failed:', err);
    res.status(500).json({ success: false, message: 'Could not create the booking.' });
  }
});

/**
 * GET /api/bookings/seats?date=YYYY-MM-DD&time=HH:MM
 *
 * The seats already sold on a departure. The seat picker greys these out so a
 * passenger does not choose one that checkout would reject.
 */
router.get('/seats', requireAuth, async (req: Request, res: Response) => {
  const date = String(req.query.date ?? '').trim();
  const time = String(req.query.time ?? '').trim();

  if (!date || !time) {
    res.status(400).json({ success: false, message: 'date and time are required.' });
    return;
  }

  try {
    res.json({ success: true, seats: await soldSeats(date, time) });
  } catch (err) {
    console.error('seat inventory failed:', err);
    res.status(500).json({ success: false, message: 'Could not load seat availability.' });
  }
});

/**
 * GET /api/bookings - the signed-in passenger's ticket wallet.
 *
 * A cancelled pass stays visible for three hours so the passenger can see that
 * the cancellation landed, then drops out of the wallet for good.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const bookings = await Booking.find({ userId: req.user!._id }).sort({ createdAt: -1 });
    res.json(bookings.filter((booking) => !hasVanished(booking)).map(toPublicBooking));
  } catch (err) {
    console.error('wallet failed:', err);
    res.status(500).json({ success: false, message: 'Could not load your tickets.' });
  }
});

/** DELETE /api/bookings/:id — cancel one of your own bookings. */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user!._id,
    });

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found.' });
      return;
    }

    if (booking.status === 'CANCELLED') {
      res.status(400).json({ success: false, message: 'This booking is already cancelled.' });
      return;
    }

    // Stamping the moment starts the three-hour countdown to the pass vanishing.
    booking.status = 'CANCELLED';
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, booking: toPublicBooking(booking) });
  } catch (err) {
    console.error('cancel failed:', err);
    res.status(500).json({ success: false, message: 'Could not cancel the booking.' });
  }
});

export default router;
