/**
 * Passenger identity rules — mirrors `backend/src/lib/validation.ts`.
 *
 * The backend is the authority; this copy exists purely so the forms can show
 * a message immediately instead of waiting for the API to reject the request.
 * If you change the rules, change them in both places.
 */

/** Gmail address — letters, digits and dots only (plus an optional +tag). */
const GMAIL_RE = /^[a-z0-9](?:[a-z0-9.]*[a-z0-9])?(?:\+[a-z0-9]+)?@gmail\.com$/;

export const GMAIL_EXAMPLE = 'yourname@gmail.com';
export const INDIAN_PHONE_EXAMPLE = '+91 98765 43210';

export function normaliseEmail(input: string): string {
  return (input ?? '').trim().toLowerCase();
}

export function isGmailAddress(input: string): boolean {
  const email = normaliseEmail(input);
  if (!GMAIL_RE.test(email)) return false;

  const base = email.slice(0, email.indexOf('@')).split('+')[0];
  return !base.includes('..');
}

/**
 * Normalise an Indian mobile number to `+91 XXXXX XXXXX`, or return `null`.
 * Accepts `9876543210`, `09876543210`, `+91 98765 43210`, `91-98765-43210`.
 */
export function normaliseIndianPhone(input: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');

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
