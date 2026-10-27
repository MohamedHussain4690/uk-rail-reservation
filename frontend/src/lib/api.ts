/**
 * Thin client for the UK National Rail Reservation backend API.
 *
 * All requests use the relative `/api` prefix so the same code works in
 * development (Vite proxies /api -> http://localhost:5000) and in production
 * (Express serves both the built frontend and the API from one port).
 *
 * The session lives in an httpOnly cookie, which the browser attaches
 * automatically because the proxy keeps everything on one origin.
 */

import type { CateringOrder } from '../data/pantryMenu';

export interface Station {
  name: string;
  code: string;
  region: string;
}

export interface Railcard {
  type: string;
  number: string;
  expiresAt: string | null;
  discountPercent: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  railcard: Railcard;
  seatPreference: string;
  createdAt: string;
}

/** One traveller on a booking, with the seat reserved for them. */
export interface BookingPassenger {
  name: string;
  coach: string;
  seat: string;
}

/**
 * A booking request deliberately carries no price: the server prices the
 * journey from its own fare table and the stored railcard.
 */
export interface BookingRequest {
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  date: string;
  time: string;
  fareType: string;
  passengers: BookingPassenger[];
}

export interface Booking {
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
  /** Price for one passenger, after the railcard concession. */
  unitPrice: number;
  /** Total charged for the party. */
  price: number;
  passengerCount: number;
  passengers: BookingPassenger[];
  /** At-seat catering orders attached to this reservation, oldest first. */
  cateringOrders: CateringOrder[];
  status: 'CONFIRMED' | 'CANCELLED';
  /** Set once the booking is cancelled. */
  cancelledAt: string | null;
  /** When a cancelled pass drops out of the wallet; null while it is live. */
  removalAt: string | null;
  createdAt: string;
}

/** A server-priced fare category for one passenger. */
export interface FareQuote {
  type: string;
  name: string;
  originalPrice: number;
  price: number;
}

export interface FareQuoteResponse {
  success: boolean;
  railcard: Railcard;
  fares: FareQuote[];
}

export interface BookingResponse {
  success: boolean;
  pnr: string;
  message: string;
  booking: Booking;
}

export interface AuthResponse {
  success: boolean;
  user: User;
}

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new Error(
      'Cannot reach the National Rail API. Please check your network connection.'
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).trim();
    } catch {
      // ignore — we still surface the status code below
    }

    // Prefer the API's own JSON message when there is one.
    let message = '';
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        if (parsed && typeof parsed.message === 'string') message = parsed.message;
      } catch {
        // not JSON — fall through
      }
    }

    // Vite's dev proxy answers 500 with an empty body when the backend is
    // unreachable; reverse proxies typically use 502/503/504.
    if (!message && !detail && [500, 502, 503, 504].includes(response.status)) {
      throw new Error(
        `The National Rail API did not respond (HTTP ${response.status}). Please try again shortly.`
      );
    }

    throw new Error(
      message || `API request failed (${response.status} ${response.statusText})`
    );
  }

  return (await response.json()) as T;
}

/** GET /api/stations — the National Rail CRS station database. */
export function getStations(): Promise<Station[]> {
  return request<Station[]>('/stations');
}

/** POST /api/auth/login */
export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** POST /api/auth/register */
export function register(payload: {
  email: string;
  name: string;
  phone?: string;
  password: string;
  railcardType?: string;
  railcardNumber?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** POST /api/auth/logout */
export function logout(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/auth/logout', { method: 'POST' });
}

/** GET /api/auth/me — resolves the signed-in passenger, or throws on 401. */
export function getMe(): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/me');
}

/** PATCH /api/auth/me */
export function updateProfile(payload: {
  name?: string;
  phone?: string;
  railcardType?: string;
  railcardNumber?: string;
  seatPreference?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * GET /api/fares — authoritative per-passenger fares for a route, discounted
 * with the signed-in passenger's railcard.
 */
export function getFares(originCode: string, destinationCode: string): Promise<FareQuoteResponse> {
  const query = new URLSearchParams({ originCode, destinationCode }).toString();
  return request<FareQuoteResponse>(`/fares?${query}`);
}

/** POST /api/bookings — reserve seats and receive a persisted PNR. */
export function createBooking(payload: BookingRequest): Promise<BookingResponse> {
  return request<BookingResponse>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** GET /api/bookings - the signed-in passenger's ticket wallet. */
export function getBookings(): Promise<Booking[]> {
  return request<Booking[]>('/bookings');
}

/** A seat that has already been sold on a departure. */
export interface OccupiedSeat {
  coach: string;
  seat: string;
}

/**
 * GET /api/bookings/seats - seats already sold on a departure, so the picker
 * can grey them out instead of letting a passenger choose one that checkout
 * would reject.
 */
export function getOccupiedSeats(
  date: string,
  time: string
): Promise<{ success: boolean; seats: OccupiedSeat[] }> {
  const query = new URLSearchParams({ date, time }).toString();
  return request<{ success: boolean; seats: OccupiedSeat[] }>(`/bookings/seats?${query}`);
}

/** DELETE /api/bookings/:id — cancel one of your own bookings. */
export function cancelBooking(id: string): Promise<{ success: boolean; booking: Booking }> {
  return request<{ success: boolean; booking: Booking }>(`/bookings/${id}`, {
    method: 'DELETE',
  });
}

/** One line on an at-seat pantry order, priced when it leaves the board. */
export interface CateringOrderLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/** The concession the server attaches to a First Class Advance order. */
export interface CateringConcession {
  label: string;
  amount: number;
}

export interface CateringOrderRequest {
  /** PNR of the reservation the trolley delivers against. */
  bookingReference?: string;
  /** Seat label fallback when the PNR is unknown. */
  passengerId?: string;
  assignedCoach: string;
  assignedSeat: string;
  deliveryMilestone: string;
  items: CateringOrderLine[];
  /** Subtotal less any concession; recomputed and verified by the server. */
  totalAmount: number;
}

export interface CateringOrderResponse {
  success: boolean;
  orderId: string;
  totalAmount: number;
  concession: CateringConcession | null;
  updatedReservation: Booking;
}

/** One traveller's order inside a multi-passenger batch. */
export interface PassengerCateringOrderRequest {
  /** Stable client key for the traveller on this reservation. */
  passengerId: string;
  passengerName: string;
  assignedCoach: string;
  assignedSeat: string;
  items: CateringOrderLine[];
  /** Lines before any concession; the server recomputes and verifies it. */
  subtotal: number;
}

export interface CateringBatchRequest {
  bookingReference: string;
  deliveryMilestone: string;
  passengerOrders: PassengerCateringOrderRequest[];
}

export interface CateringBatchResponse {
  success: boolean;
  /** The reservation's complete catering order array, oldest first. */
  updatedOrders: CateringOrder[];
}

/**
 * POST /api/catering/order — persist one order per passenger in a single
 * `$push`. Used by the coach-order checkout so every traveller's lines land
 * against their own seat and name.
 */
export function postCateringOrders(
  payload: CateringBatchRequest
): Promise<CateringBatchResponse> {
  return request<CateringBatchResponse>('/catering/order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * POST /api/catering/order — persist an at-seat pantry order onto the
 * reservation. The server owns the money: it recomputes the lines, applies any
 * fare concession, and rejects a total that disagrees.
 */
export function postCateringOrder(
  payload: CateringOrderRequest
): Promise<CateringOrderResponse> {
  return request<CateringOrderResponse>('/catering/order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
