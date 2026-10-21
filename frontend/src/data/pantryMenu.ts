/**
 * At-seat catering catalogue.
 *
 * This file is the single source of truth for what the pantry can sell. The
 * board, the cart and the order payload all read from here, so a price or a
 * dietary claim cannot drift between what the passenger sees and what the
 * galley is asked to prepare.
 */

/**
 * Food photography lives in `public/images/pantry`. Building the path from
 * Vite's base URL keeps the images working under a GitHub Pages project path.
 */
const PANTRY_IMAGE_BASE = `${import.meta.env.BASE_URL}images/pantry`;

export type DietaryTag = 'Vegan' | 'Vegetarian' | 'Gluten-Free';

export type PantrySectionId =
  | 'morning-express'
  | 'great-british-deli'
  | 'brewery-cellar'
  | 'pantry-snacks';

/** Lifecycle of an order after it leaves the trolley. Mirrors the API enum. */
export type DeliveryStatus = 'confirmed' | 'galley_prep' | 'in_transit' | 'delivered';

/** A single sellable line on the pantry board. Prices are GBP, VAT inclusive. */
export interface PantryItem {
  id: string;
  name: string;
  section: PantrySectionId;
  price: number;
  /** Per serving, in kcal. */
  calories: number;
  dietaryTags: DietaryTag[];
  /** Minutes the galley needs to plate or pour this item. */
  preparationTimeMins: number;
  description: string;
  /** Optional food photograph for the menu board; display only. */
  image?: string;
}

/** A service group on the menu, with the hours the trolley honours it. */
export interface PantrySection {
  id: PantrySectionId;
  name: string;
  serviceNote: string;
}

/**
 * A point in the journey when the trolley can reach a seat. `offsetMins` is
 * measured from the departure, so the clock range printed on the order follows
 * whichever service the cart is bound to. `window` is the catalogue fallback
 * used only when the departure time is unknown.
 */
export interface DeliveryWindow {
  id: string;
  label: string;
  window: string;
  note: string;
  offsetMins: number;
}

/** A trolley run lasts this long, in minutes. */
export const DELIVERY_WINDOW_MINUTES = 25;

/**
 * First Class Advance fares carry a complimentary at-seat concession. The rule
 * is mirrored in `backend/src/models/Booking.ts`; the server recomputes it and
 * rejects a browser total that disagrees.
 */
export const FIRST_CLASS_CONCESSION_RATE = 0.1;

export interface PantryConcession {
  label: string;
  amount: number;
}

/** One line on a placed order, priced at the moment it was ordered. */
export interface CateringOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/** An order as stored on the reservation (mirrors the Mongoose sub-schema). */
export interface CateringOrder {
  orderId: string;
  /** Client key identifying the traveller on this reservation. */
  passengerId: string;
  /** Canonical name of the passenger whose seat is served. */
  passengerName: string;
  items: CateringOrderItem[];
  /** Sum of the lines before any fare concession. */
  subtotal: number;
  concession?: PantryConcession;
  totalAmount: number;
  assignedCoach: string;
  assignedSeat: string;
  deliveryMilestone: string;
  deliveryStatus: DeliveryStatus;
  /** ISO timestamp. */
  placedAt: string;
}

export const PANTRY_SECTIONS: PantrySection[] = [
  {
    id: 'morning-express',
    name: 'Morning Express',
    serviceNote: 'Served 06:00 - 11:00',
  },
  {
    id: 'great-british-deli',
    name: 'Deli & Mains',
    serviceNote: 'Served all day',
  },
  {
    id: 'brewery-cellar',
    name: 'Hot & Cold Drinks',
    serviceNote: 'Licensed service from 11:00 · Challenge 25',
  },
  {
    id: 'pantry-snacks',
    name: 'Snacks',
    serviceNote: 'Trolley staples, all day',
  },
];

export const PANTRY_MENU: PantryItem[] = [
  // Morning Express
  {
    id: 'cumberland-sausage-roll',
    name: 'Cumberland Sausage Roll',
    section: 'morning-express',
    price: 4.5,
    calories: 420,
    dietaryTags: [],
    preparationTimeMins: 3,
    description: 'Warm Cumberland pork sausage in flaky pastry.',
    image: `${PANTRY_IMAGE_BASE}/cumberland-sausage-roll.jpg`,
  },
  {
    id: 'artisan-porridge-pot',
    name: 'Artisan Porridge Pot',
    section: 'morning-express',
    price: 3.2,
    calories: 280,
    dietaryTags: ['Vegan', 'Vegetarian'],
    preparationTimeMins: 2,
    description: 'Oat porridge with berry compote, served warm.',
    image: `${PANTRY_IMAGE_BASE}/artisan-porridge-pot.jpg`,
  },
  {
    id: 'smoked-salmon-bagel',
    name: 'Smoked Salmon Bagel',
    section: 'morning-express',
    price: 5.8,
    calories: 390,
    dietaryTags: [],
    preparationTimeMins: 4,
    description: 'Scottish smoked salmon, cream cheese and capers.',
    image: `${PANTRY_IMAGE_BASE}/smoked-salmon-bagel.jpg`,
  },

  // Deli & Mains
  {
    id: 'cheddar-chutney-sandwich',
    name: 'Mature Cheddar & Chutney Sandwich',
    section: 'great-british-deli',
    price: 4.95,
    calories: 450,
    dietaryTags: ['Vegetarian'],
    preparationTimeMins: 4,
    description: 'Mature cheddar, ploughman\'s chutney, malted bloomer.',
    image: `${PANTRY_IMAGE_BASE}/cheddar-chutney-sandwich.jpg`,
  },
  {
    id: 'hot-roast-beef-baguette',
    name: 'Hot Roast Beef Baguette',
    section: 'great-british-deli',
    price: 6.2,
    calories: 520,
    dietaryTags: [],
    preparationTimeMins: 6,
    description: 'Yorkshire roast beef, horseradish and watercress.',
    image: `${PANTRY_IMAGE_BASE}/hot-roast-beef-baguette.jpg`,
  },
  {
    id: 'vegan-mezze-box',
    name: 'Vegan Mezze Box',
    section: 'great-british-deli',
    price: 5.5,
    calories: 310,
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free'],
    preparationTimeMins: 3,
    description: 'Hummus, falafel, pickled slaw and gluten-free flatbread.',
    image: `${PANTRY_IMAGE_BASE}/vegan-mezze-box.jpg`,
  },

  // Hot & Cold Drinks
  {
    id: 'camden-hells-lager',
    name: 'Camden Hells Lager',
    section: 'brewery-cellar',
    price: 4.8,
    calories: 210,
    dietaryTags: ['Vegan', 'Vegetarian'],
    preparationTimeMins: 1,
    description: '330ml bottle, 4.6% ABV, served chilled.',
    image: `${PANTRY_IMAGE_BASE}/camden-hells-lager.jpg`,
  },
  {
    id: 'english-sparkling-wine',
    name: 'English Sparkling Wine',
    section: 'brewery-cellar',
    price: 7.5,
    calories: 120,
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free'],
    preparationTimeMins: 1,
    description: '125ml glass, 12% ABV, Kentish vineyard.',
    image: `${PANTRY_IMAGE_BASE}/english-sparkling-wine.jpg`,
  },
  {
    id: 'yorkshire-tea',
    name: 'Yorkshire Tea',
    section: 'brewery-cellar',
    price: 2.4,
    calories: 12,
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free'],
    preparationTimeMins: 2,
    description: 'Proper strong brew, served black or with milk.',
    image: `${PANTRY_IMAGE_BASE}/yorkshire-tea.jpg`,
  },
  {
    id: 'flat-white',
    name: 'Flat White',
    section: 'brewery-cellar',
    price: 3.1,
    calories: 110,
    dietaryTags: ['Vegetarian', 'Gluten-Free'],
    preparationTimeMins: 2,
    description: 'Double espresso with steamed whole milk.',
    image: `${PANTRY_IMAGE_BASE}/flat-white.jpg`,
  },

  // Snacks
  {
    id: 'tyrrells-crisps',
    name: 'Tyrrells Crisps',
    section: 'pantry-snacks',
    price: 1.8,
    calories: 180,
    dietaryTags: ['Vegan', 'Vegetarian', 'Gluten-Free'],
    preparationTimeMins: 1,
    description: 'Lightly salted hand-cooked potato crisps, 40g.',
    image: `${PANTRY_IMAGE_BASE}/tyrrells-crisps.jpg`,
  },
  {
    id: 'clotted-cream-scone',
    name: 'Clotted Cream Scone',
    section: 'pantry-snacks',
    price: 3.4,
    calories: 380,
    dietaryTags: ['Vegetarian'],
    preparationTimeMins: 2,
    description: 'Fruit scone with Cornish clotted cream and jam.',
    image: `${PANTRY_IMAGE_BASE}/clotted-cream-scone.jpg`,
  },
];

export const DELIVERY_WINDOWS: DeliveryWindow[] = [
  {
    id: 'departure',
    label: 'Departure Service',
    window: '08:30 - 08:55',
    note: 'Galley opens as the train clears the platform.',
    offsetMins: 0,
  },
  {
    id: 'mid-journey',
    label: 'Mid-Journey Service',
    window: '09:15 - 09:35',
    note: 'Main trolley run once the service is underway.',
    offsetMins: 45,
  },
  {
    id: 'final-service',
    label: 'Final Service',
    window: '09:50 - 10:10',
    note: 'Last trolley run of the service.',
    offsetMins: 80,
  },
];

/** "14:15" + 45 -> "15:00"; null when the departure is not a valid clock time. */
export function shiftClock(time: string | undefined, minutes: number): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;

  const shifted = (hours * 60 + mins + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(shifted / 60)).padStart(2, '0')}:${String(
    shifted % 60
  ).padStart(2, '0')}`;
}

/**
 * The trolley runs printed for the bound service. Times follow the departure
 * so a 14:15 Leeds - York service offers 14:15, 15:00 and 15:35 runs rather
 * than another route's timetable.
 */
export function scheduledDeliveryWindows(departureTime?: string): DeliveryWindow[] {
  if (!departureTime) return DELIVERY_WINDOWS;

  return DELIVERY_WINDOWS.map((window) => {
    const start = shiftClock(departureTime, window.offsetMins);
    const end = shiftClock(departureTime, window.offsetMins + DELIVERY_WINDOW_MINUTES);
    return start && end ? { ...window, window: `${start} - ${end}` } : window;
  });
}

/**
 * The concession attached to a First Class Advance reservation, or null for
 * every other fare. Rounded to the penny, like every other amount on the bill.
 */
export function firstClassConcession(
  fareType: string | undefined,
  fareName: string | undefined,
  subtotal: number
): PantryConcession | null {
  if ((fareType ?? '').trim().toLowerCase() !== 'first class') return null;
  if ((fareName ?? '').trim().toLowerCase() !== 'first class advance') return null;

  const amount = Math.round(subtotal * FIRST_CLASS_CONCESSION_RATE * 100) / 100;
  return amount > 0 ? { label: 'First Class Advance concession', amount } : null;
}

/** Items in one section, in menu order. */
export function itemsBySection(section: PantrySectionId): PantryItem[] {
  return PANTRY_MENU.filter((item) => item.section === section);
}
