/**
 * Fare catalogue and pricing — owned by the server.
 *
 * The browser never decides what a ticket costs. It sends the fare type, the
 * route and the passengers; this module derives the price from the
 * authenticated passenger's railcard. That keeps the amount in the wallet, on
 * the ticket and on the receipt identical, and makes the price impossible to
 * tamper with by editing a request.
 */

export type FareType = 'Advance' | 'Off-Peak' | 'Anytime' | 'First Class';

export interface FareDefinition {
  type: FareType;
  name: string;
  /** Undiscounted adult price for a standard-length route. */
  basePrice: number;
}

/** A group booking is capped so a single pass stays readable on one sheet. */
export const MAX_PASSENGERS = 4;

export const FARES: FareDefinition[] = [
  { type: 'Advance', name: 'Advance Single', basePrice: 42.5 },
  { type: 'Off-Peak', name: 'Off-Peak Single', basePrice: 78.5 },
  { type: 'Anytime', name: 'Anytime Single', basePrice: 135 },
  { type: 'First Class', name: 'First Class Advance', basePrice: 185 },
];

/** Money is always rounded to whole pence. */
const round2 = (value: number): number => Number(value.toFixed(2));

/**
 * Long-distance Anglo-Scottish and Manchester services carry a premium.
 * Mirrors the multiplier the planner has always used, so prices do not shift.
 */
export function routeMultiplier(originCode: string, destinationCode: string): number {
  if (originCode === 'KGX' && destinationCode === 'EDB') return 1.6;
  if (originCode === 'EUS' && destinationCode === 'MAN') return 1.3;
  return 1;
}

export interface FareQuote {
  type: FareType;
  name: string;
  /** Adult price for this route before any railcard concession. */
  originalPrice: number;
  /** Price per passenger after the railcard concession. */
  price: number;
}

/**
 * Every fare category for a route, priced for one passenger holding the given
 * railcard. Multiply `price` by the party size for a booking total.
 */
export function quoteFares(
  originCode: string,
  destinationCode: string,
  railcardDiscountPercent: number
): FareQuote[] {
  const multiplier = routeMultiplier(originCode.toUpperCase(), destinationCode.toUpperCase());
  // Clamp defensively: a bad stored discount must never produce a negative fare.
  const discount = Math.min(Math.max(Number(railcardDiscountPercent) || 0, 0), 100);

  return FARES.map((fare) => {
    const originalPrice = round2(fare.basePrice * multiplier);
    const price = round2(originalPrice * (1 - discount / 100));
    return { type: fare.type, name: fare.name, originalPrice, price };
  });
}

export function findFare(type: string): FareDefinition | undefined {
  return FARES.find((fare) => fare.type === type);
}

/** Price a single passenger on one fare category, or `null` if unknown. */
export function quoteFare(
  type: string,
  originCode: string,
  destinationCode: string,
  railcardDiscountPercent: number
): FareQuote | null {
  return (
    quoteFares(originCode, destinationCode, railcardDiscountPercent).find(
      (quote) => quote.type === type
    ) ?? null
  );
}
