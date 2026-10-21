import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Booking, getBookings } from '../lib/api';
import { toLocalIsoDate } from '../lib/date';
import {
  DELIVERY_WINDOWS,
  DeliveryWindow,
  PANTRY_MENU,
  PANTRY_SECTIONS,
  PantryConcession,
  PantryItem,
  PantrySection,
  firstClassConcession,
  scheduledDeliveryWindows,
  type CateringOrder,
} from '../data/pantryMenu';

/** A traveller the trolley can serve on the bound reservation. */
export interface PantryPassenger {
  /** Stable cart key: normalised coach + seat, e.g. "COACHB-12A". */
  id: string;
  name: string;
  /** Short coach label, in trolley-friendly form. */
  coach: string;
  seat: string;
}

/** A traveller as a reservation supplies them, before normalisation. */
export interface PantryPassengerInput {
  name?: string;
  coach?: string;
  seat?: string;
}

/** A normalised reservation: the head seat plus every traveller on it. */
export interface PantryAssignment {
  /** Short coach label: "Coach B", not "Coach B (Luggage & Standard)". */
  coach: string;
  seat: string;
  passengerName?: string;
  /** Every traveller, normalised; never empty when the assignment exists. */
  passengers: PantryPassenger[];
  pnr?: string;
  /** Live service the trolley is working, when the ticket knows it. */
  origin?: string;
  originCode?: string;
  destination?: string;
  destinationCode?: string;
  /** ISO date (YYYY-MM-DD) and 24h departure time of the service. */
  date?: string;
  time?: string;
  /** The fare held on the reservation, used for the First Class concession. */
  fareType?: string;
  fareName?: string;
}

/**
 * A reservation as the rest of the app supplies it, before normalisation.
 * `passengers` carries the whole party when the ticket knows it; otherwise the
 * single coach/seat pair is treated as a one-passenger reservation.
 */
export interface PantryReservation {
  coach: string;
  seat: string;
  passengerName?: string;
  passengers?: PantryPassengerInput[];
  pnr?: string;
  origin?: string;
  originCode?: string;
  destination?: string;
  destinationCode?: string;
  date?: string;
  time?: string;
  fareType?: string;
  fareName?: string;
}

/** The receipt the board shows once the galley has accepted an order. */
export interface DispatchedOrder {
  /** Every order id the batch produced, oldest first. */
  orderIds: string[];
  totalAmount: number;
  concession: PantryConcession | null;
  /** Where the trolley is headed, one entry per served passenger. */
  passengers: PantryPassenger[];
  /** The reservation's complete catering array as the server returned it. */
  orders: CateringOrder[];
  milestone: string;
  placedAt: string;
}

/** One line in the pantry cart, tagged to the passenger who ordered it. */
export interface CartItem {
  item: PantryItem;
  quantity: number;
  passengerId: string;
  passengerName: string;
  assignedCoach: string;
  assignedSeat: string;
}

/** @deprecated use CartItem; kept so older imports still resolve. */
export type CartLine = CartItem;

export type PantryAssignmentSource = 'reservation' | 'wallet' | 'manual' | 'none';

/** A trolley cannot sensibly carry more than this of one line. */
export const MAX_LINE_QUANTITY = 10;

interface PantryContextValue {
  menu: PantryItem[];
  sections: PantrySection[];

  cartItems: CartItem[];
  /** Tag the item to the currently selected passenger and add it. */
  addToCart: (item: PantryItem, quantity?: number) => void;
  /** Remove one passenger's line; omit passengerId to clear it everywhere. */
  removeFromCart: (itemId: string, passengerId?: string) => void;
  /** Set one passenger's line; omit passengerId to change it everywhere. */
  updateQuantity: (itemId: string, quantity: number, passengerId?: string) => void;
  clearCart: () => void;
  quantityOf: (itemId: string, passengerId?: string) => number;
  itemCount: number;
  /** Every passenger's lines, penny-rounded. */
  subtotal: number;
  /** Alias of subtotal, named for the multi-passenger rail. */
  combinedTotal: number;
  /** First Class Advance concession, when the bound fare earns one. */
  concession: PantryConcession | null;
  /** Subtotal less any concession; the amount the API will verify. */
  total: number;

  /** Travellers on the bound reservation, in seat order. */
  passengers: PantryPassenger[];
  /** The passenger new lines are tagged to. */
  activePassengerId: string;
  activePassenger: PantryPassenger | null;
  setActivePassenger: (id: string) => void;
  /** One passenger's lines, in the order they were added. */
  getPassengerItems: (passengerId: string) => CartItem[];
  /** One passenger's meal subtotal, before any concession. */
  getPassengerTotal: (passengerId: string) => number;

  /** Where the order will be delivered; null until a seat is known. */
  assignment: PantryAssignment | null;
  isSeatBound: boolean;
  assignmentSource: PantryAssignmentSource;
  /** True while the wallet lookup is still in flight, so the board can say so. */
  assignmentLoading: boolean;
  /** Bind the pantry to a ticket the passenger picked out of the wallet. */
  bindToSeat: (
    coach: string,
    seat: string,
    extras?: { passengerName?: string; pnr?: string }
  ) => void;
  /** Drop a manual binding and fall back to the active reservation. */
  releaseBinding: () => void;

  deliveryWindows: DeliveryWindow[];
  deliveryWindow: DeliveryWindow;
  setDeliveryWindow: (id: string) => void;
  /** Milestone string written onto the order, e.g. "Mid-Journey Service (15:00 - 15:20)". */
  deliveryMilestone: string;

  /** The most recent accepted order, shown on the board after the sheet closes. */
  lastOrder: DispatchedOrder | null;
  recordOrder: (order: DispatchedOrder) => void;
  clearLastOrder: () => void;
}

const PantryContext = createContext<PantryContextValue | null>(null);

/** "Coach B (Luggage & Standard)" -> "Coach B". */
function shortCoach(coach: string): string {
  return coach.split('(')[0].trim();
}

/** Stable cart key for one traveller: "Coach B" + "12A" -> "COACHB-12A". */
function passengerKey(coach: string, seat: string): string {
  return `${coach.replace(/[^a-z0-9]+/gi, '').toUpperCase()}-${seat
    .trim()
    .toUpperCase()}`;
}

/**
 * Every traveller the reservation holds, normalised to short coach + seat and
 * de-duplicated. A reservation that only knows one seat still yields one entry.
 */
function normalisePassengers(reservation: PantryReservation): PantryPassenger[] {
  const source: PantryPassengerInput[] =
    reservation.passengers && reservation.passengers.length > 0
      ? reservation.passengers
      : [
          {
            name: reservation.passengerName,
            coach: reservation.coach,
            seat: reservation.seat,
          },
        ];

  const seen = new Set<string>();
  const passengers: PantryPassenger[] = [];

  for (const traveller of source) {
    const coach = shortCoach(traveller.coach ?? reservation.coach ?? '');
    const seat = (traveller.seat ?? '').trim().toUpperCase();
    if (!coach || !seat || seat === 'UNASSIGNED') continue;

    const id = passengerKey(coach, seat);
    if (seen.has(id)) continue;
    seen.add(id);

    passengers.push({
      id,
      name: (traveller.name ?? '').trim() || 'Passenger',
      coach,
      seat,
    });
  }

  return passengers;
}

function normaliseAssignment(
  reservation: PantryReservation | null | undefined
): PantryAssignment | null {
  if (!reservation) return null;

  const coach = shortCoach(reservation.coach ?? '');
  const seat = (reservation.seat ?? '').trim().toUpperCase();
  if (!coach || !seat || seat === 'UNASSIGNED') return null;

  return {
    coach,
    seat,
    passengerName: reservation.passengerName?.trim() || undefined,
    passengers: normalisePassengers(reservation),
    pnr: reservation.pnr,
    origin: reservation.origin?.trim() || undefined,
    originCode: reservation.originCode?.trim().toUpperCase() || undefined,
    destination: reservation.destination?.trim() || undefined,
    destinationCode: reservation.destinationCode?.trim().toUpperCase() || undefined,
    date: reservation.date?.trim() || undefined,
    time: reservation.time?.trim() || undefined,
    fareType: reservation.fareType?.trim() || undefined,
    fareName: reservation.fareName?.trim() || undefined,
  };
}

/**
 * The nearest upcoming live trip in the wallet, used when the passenger is not
 * mid-booking. Cancelled passes and journeys already in the past are ignored.
 */
function nextUpcomingSeat(bookings: Booking[]): PantryReservation | null {
  const today = toLocalIsoDate(new Date());

  const upcoming = bookings
    .filter(
      (booking) =>
        booking.status === 'CONFIRMED' &&
        booking.passengers.length > 0 &&
        booking.date >= today
    )
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const booking = upcoming[0];
  if (!booking) return null;

  const passenger = booking.passengers[0];
  return {
    coach: passenger.coach,
    seat: passenger.seat,
    passengerName: passenger.name,
    passengers: booking.passengers,
    pnr: booking.pnr,
    origin: booking.origin,
    originCode: booking.originCode,
    destination: booking.destination,
    destinationCode: booking.destinationCode,
    date: booking.date,
    time: booking.time,
    fareType: booking.fareType,
    fareName: booking.fareName,
  };
}

interface PantryProviderProps {
  children: React.ReactNode;
  /**
   * The seat held by the booking flow. Omit it to fall back to the passenger's
   * next confirmed wallet reservation.
   */
  reservation?: PantryReservation;
  /**
   * Called with the reservation's full catering array after a batch is
   * accepted, so the booking held by the app reflects the new orders.
   */
  onReservationOrdersUpdated?: (orders: CateringOrder[]) => void;
}

export function PantryProvider({
  children,
  reservation,
  onReservationOrdersUpdated,
}: PantryProviderProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [manual, setManual] = useState<PantryReservation | null | undefined>(undefined);
  const [wallet, setWallet] = useState<PantryReservation | null>(null);
  const [walletSettled, setWalletSettled] = useState(false);
  const [activePassengerId, setActivePassengerId] = useState('');
  const [deliveryWindowId, setDeliveryWindowId] = useState<string>(DELIVERY_WINDOWS[0].id);
  const [lastOrder, setLastOrder] = useState<DispatchedOrder | null>(null);

  // Returning passengers can order against a trip they booked earlier. The
  // booking flow overrides this the moment a seat is chosen.
  useEffect(() => {
    let cancelled = false;

    getBookings()
      .then((bookings) => {
        if (!cancelled) setWallet(nextUpcomingSeat(bookings));
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      })
      .finally(() => {
        if (!cancelled) setWalletSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Precedence: a wallet ticket the passenger picked, then the live booking
  // flow, then their next confirmed trip.
  const assignmentSource: PantryAssignmentSource =
    manual !== undefined
      ? 'manual'
      : reservation !== undefined
      ? 'reservation'
      : wallet
      ? 'wallet'
      : 'none';

  const sourceReservation =
    manual !== undefined ? manual : reservation !== undefined ? reservation : wallet;

  const assignment = useMemo(
    () => normaliseAssignment(sourceReservation),
    [sourceReservation]
  );

  // Only the wallet path is asynchronous; a seat supplied by the booking flow
  // or bound by hand is known immediately.
  const assignmentLoading =
    reservation === undefined && manual === undefined && !walletSettled;

  const passengers = useMemo(() => assignment?.passengers ?? [], [assignment]);

  // Keep the selection valid when the bound reservation changes underneath us.
  const resolvedActivePassengerId = passengers.some(
    (passenger) => passenger.id === activePassengerId
  )
    ? activePassengerId
    : passengers[0]?.id ?? '';

  const activePassenger =
    passengers.find((passenger) => passenger.id === resolvedActivePassengerId) ?? null;

  const setActivePassenger = useCallback((id: string) => setActivePassengerId(id), []);

  const addToCart = useCallback(
    (item: PantryItem, quantity = 1) => {
      if (!Number.isFinite(quantity) || !activePassenger) return;
      const add = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)));
      const passenger = activePassenger;

      setCartItems((previous) => {
        const existing = previous.find(
          (line) => line.item.id === item.id && line.passengerId === passenger.id
        );

        if (!existing) {
          return [
            ...previous,
            {
              item,
              quantity: add,
              passengerId: passenger.id,
              passengerName: passenger.name,
              assignedCoach: passenger.coach,
              assignedSeat: passenger.seat,
            },
          ];
        }

        return previous.map((line) =>
          line.item.id === item.id && line.passengerId === passenger.id
            ? { ...line, quantity: Math.min(MAX_LINE_QUANTITY, line.quantity + add) }
            : line
        );
      });
    },
    [activePassenger]
  );

  const removeFromCart = useCallback((itemId: string, passengerId?: string) => {
    setCartItems((previous) =>
      previous.filter(
        (line) =>
          !(
            line.item.id === itemId &&
            (passengerId === undefined || line.passengerId === passengerId)
          )
      )
    );
  }, []);

  const updateQuantity = useCallback(
    (itemId: string, quantity: number, passengerId?: string) => {
      if (!Number.isFinite(quantity)) return;
      const next = Math.min(MAX_LINE_QUANTITY, Math.floor(quantity));

      setCartItems((previous) => {
        const matches = (line: CartItem) =>
          line.item.id === itemId &&
          (passengerId === undefined || line.passengerId === passengerId);

        if (next <= 0) return previous.filter((line) => !matches(line));
        return previous.map((line) => (matches(line) ? { ...line, quantity: next } : line));
      });
    },
    []
  );

  const clearCart = useCallback(() => setCartItems([]), []);

  const quantityOf = useCallback(
    (itemId: string, passengerId?: string) =>
      cartItems
        .filter(
          (line) =>
            line.item.id === itemId &&
            (passengerId === undefined || line.passengerId === passengerId)
        )
        .reduce((sum, line) => sum + line.quantity, 0),
    [cartItems]
  );

  const getPassengerItems = useCallback(
    (passengerId: string) => cartItems.filter((line) => line.passengerId === passengerId),
    [cartItems]
  );

  const getPassengerTotal = useCallback(
    (passengerId: string) =>
      Math.round(
        cartItems
          .filter((line) => line.passengerId === passengerId)
          .reduce((sum, line) => sum + line.item.price * line.quantity, 0) * 100
      ) / 100,
    [cartItems]
  );

  const itemCount = useMemo(
    () => cartItems.reduce((count, line) => count + line.quantity, 0),
    [cartItems]
  );

  const subtotal = useMemo(
    () =>
      Math.round(
        cartItems.reduce((sum, line) => sum + line.item.price * line.quantity, 0) * 100
      ) / 100,
    [cartItems]
  );

  /** The whole party's lines; identical to subtotal, named for the multi rail. */
  const combinedTotal = subtotal;

  // First Class Advance passengers order against a concession; every other
  // fare pays the board price. The server applies the same rule on checkout.
  const concession = useMemo(
    () => firstClassConcession(assignment?.fareType, assignment?.fareName, subtotal),
    [assignment?.fareType, assignment?.fareName, subtotal]
  );

  const total = useMemo(
    () => Math.round((subtotal - (concession?.amount ?? 0)) * 100) / 100,
    [subtotal, concession]
  );

  const bindToSeat = useCallback(
    (coach: string, seat: string, extras?: { passengerName?: string; pnr?: string }) => {
      setManual({ coach, seat, ...extras });
    },
    []
  );

  const releaseBinding = useCallback(() => setManual(undefined), []);

  const recordOrder = useCallback(
    (order: DispatchedOrder) => {
      setLastOrder(order);
      onReservationOrdersUpdated?.(order.orders);
    },
    [onReservationOrdersUpdated]
  );
  const clearLastOrder = useCallback(() => setLastOrder(null), []);

  // Trolley runs follow the bound departure, so the sheet never offers another
  // route's timetable.
  const deliveryWindows = useMemo(
    () => scheduledDeliveryWindows(assignment?.time),
    [assignment?.time]
  );

  const deliveryWindow = useMemo(
    () => deliveryWindows.find((window) => window.id === deliveryWindowId) ?? deliveryWindows[0],
    [deliveryWindowId, deliveryWindows]
  );

  const setDeliveryWindow = useCallback((id: string) => {
    if (DELIVERY_WINDOWS.some((window) => window.id === id)) {
      setDeliveryWindowId(id);
    }
  }, []);

  const deliveryMilestone = `${deliveryWindow.label} (${deliveryWindow.window})`;

  const value = useMemo<PantryContextValue>(
    () => ({
      menu: PANTRY_MENU,
      sections: PANTRY_SECTIONS,
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      quantityOf,
      itemCount,
      subtotal,
      combinedTotal,
      concession,
      total,
      passengers,
      activePassengerId: resolvedActivePassengerId,
      activePassenger,
      setActivePassenger,
      getPassengerItems,
      getPassengerTotal,
      assignment,
      isSeatBound: assignment !== null,
      assignmentSource,
      assignmentLoading,
      bindToSeat,
      releaseBinding,
      deliveryWindows,
      deliveryWindow,
      setDeliveryWindow,
      deliveryMilestone,
      lastOrder,
      recordOrder,
      clearLastOrder,
    }),
    [
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      quantityOf,
      itemCount,
      subtotal,
      combinedTotal,
      concession,
      total,
      passengers,
      resolvedActivePassengerId,
      activePassenger,
      setActivePassenger,
      getPassengerItems,
      getPassengerTotal,
      assignment,
      assignmentSource,
      assignmentLoading,
      bindToSeat,
      releaseBinding,
      deliveryWindows,
      deliveryWindow,
      setDeliveryWindow,
      deliveryMilestone,
      lastOrder,
      recordOrder,
      clearLastOrder,
    ]
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry(): PantryContextValue {
  const context = useContext(PantryContext);
  if (!context) {
    throw new Error('usePantry must be used inside <PantryProvider>');
  }
  return context;
}
