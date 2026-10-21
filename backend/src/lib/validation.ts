/**
 * Passenger identity rules, shared by registration and profile updates.
 *
 * Accounts are restricted to Gmail addresses and Indian mobile numbers. The
 * Gmail restriction is a deliberate product rule (not an email-correctness
 * rule): `@gmail.com` is required exactly, so `user@googlemail.com`,
 * `user@yahoo.com` and `user@gmail.co.uk` are all rejected.
 */

/**
 * Gmail address, following Google's actual rules for the part before the `@`:
 * letters, digits and dots only, with no leading or trailing dot and no two
 * dots in a row. An optional `+tag` suffix is allowed because Gmail genuinely
 * delivers those (base+anything@gmail.com). Underscores, hyphens and percent
 * signs are *not* valid in a Gmail username, so they are rejected here.
 */
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9.]*[a-z0-9])?(?:\+[a-z0-9]+)?@gmail\.com$/;

/** Canonical stored form of an Indian mobile number, e.g. `+91 98765 43210`. */
const INDIAN_PHONE_STORED_RE = /^\+91 [6-9]\d{4} \d{5}$/;

/** Trim and lowercase — Gmail addresses are case-insensitive. */
export function normaliseEmail(input: string): string {
  return (input ?? '').trim().toLowerCase();
}

export function isGmailAddress(input: string): boolean {
  const email = normaliseEmail(input);
  if (!GMAIL_RE.test(email)) return false;

  // The regex allows any arrangement of dots, so reject repeats explicitly.
  const base = email.slice(0, email.indexOf('@')).split('+')[0];
  return !base.includes('..');
}

/**
 * Normalise an Indian mobile number to `+91 XXXXX XXXXX`, or return `null` if
 * it is not one.
 *
 * Accepts the forms people actually type — `9876543210`, `09876543210`,
 * `+91 98765 43210`, `91-98765-43210` — and ignores spaces, dashes and dots.
 * Indian mobile numbers are 10 digits long and begin with 6, 7, 8 or 9.
 */
export function normaliseIndianPhone(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');

  // Drop a country code (91) or a national trunk prefix (0), when present.
  let local = digits;
  if (local.length === 12 && local.startsWith('91')) {
    local = local.slice(2);
  } else if (local.length === 11 && local.startsWith('0')) {
    local = local.slice(1);
  }

  if (!/^[6-9]\d{9}$/.test(local)) return null;

  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function isValidIndianPhone(input: string): boolean {
  return normaliseIndianPhone(input) !== null;
}

/** True when the value is already in the canonical stored form. */
export function isStoredIndianPhone(input: string): boolean {
  return INDIAN_PHONE_STORED_RE.test(input);
}

/** Example values reused by the API error messages and the UI hints. */
export const GMAIL_EXAMPLE = 'yourname@gmail.com';
export const INDIAN_PHONE_EXAMPLE = '+91 98765 43210';
