import React, { useEffect, useState } from 'react';
import {
  Train,
  CheckCircle2,
  QrCode,
  Printer,
  ArrowRight,
  UtensilsCrossed,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { BookingPassenger, getBookings } from '../lib/api';
import { usePantry } from '../context/PantryContext';
import type { CateringOrder, DeliveryStatus } from '../data/pantryMenu';

/** The four states an at-seat order moves through after checkout. */
const DINING_STEPS: ReadonlyArray<{ id: DeliveryStatus; label: string }> = [
  { id: 'confirmed', label: 'Order Confirmed' },
  { id: 'galley_prep', label: 'Galley Prep' },
  { id: 'in_transit', label: 'In Transit' },
  { id: 'delivered', label: 'Delivered to Seat' },
];

function diningStepIndex(status: DeliveryStatus): number {
  const index = DINING_STEPS.findIndex((step) => step.id === status);
  return index < 0 ? 0 : index;
}

/** "2026-10-20T21:17:12.000Z" -> "20 OCT 2026 · 21:17". */
function formatPlacedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', ' · ')
    .toUpperCase();
}

interface TicketSummaryProps {
  fare: {
    name: string;
    price: number;
    originalPrice?: number;
    type: string;
  };
  route: {
    origin: { name: string; code: string };
    destination: { name: string; code: string };
    date: string;
    time: string;
  };
  passengers: BookingPassenger[];
  unitPrice: number;
  cardholderName?: string;
  railcardLabel?: string;
  pnr?: string;
  createdAt?: string;
  message?: string;
  initialCateringOrders?: CateringOrder[];
  foodTotal?: number;
  totalFare?: number;
  isSubmitting?: boolean;
  bookingError?: string | null;
  onConfirmAndPay?: () => void;
  onBackToDining?: () => void;
  onBackToSeats?: () => void;
  onNewBooking: () => void;
}

export function TicketSummary({
  fare,
  route,
  passengers,
  unitPrice,
  cardholderName,
  railcardLabel,
  pnr,
  createdAt,
  message,
  initialCateringOrders,
  foodTotal,
  totalFare,
  isSubmitting = false,
  bookingError,
  onConfirmAndPay,
  onBackToDining,
  onBackToSeats,
  onNewBooking,
}: TicketSummaryProps) {
  const coachLabel = (coach: string) => coach.split('(')[0].trim();

  const {
    itemCount: pantryItemCount,
    orderedPassengerCount,
    concession: cateringConcession,
    total: pantryTotal,
    deliveryMilestone,
  } = usePantry();

  const railNetTotal = Number((unitPrice * passengers.length).toFixed(2));
  const perPassengerOriginal =
    fare.originalPrice && fare.originalPrice > unitPrice ? fare.originalPrice : unitPrice;
  const railGrossTotal = Number((perPassengerOriginal * passengers.length).toFixed(2));
  const railcardDeduction = Number(Math.max(0, railGrossTotal - railNetTotal).toFixed(2));

  // The reservation owns its catering orders once issued, so read them back from
  // the API rather than relying only on initial props. During pre-confirmation
  // checkout (!pnr), skip the wallet lookup and read live pantry cart totals.
  const [cateringOrders, setCateringOrders] = useState<CateringOrder[]>(
    () => initialCateringOrders ?? []
  );
  const [issuedAt, setIssuedAt] = useState<string>(
    () => createdAt ?? initialCateringOrders?.[0]?.placedAt ?? ''
  );

  useEffect(() => {
    if (createdAt) setIssuedAt(createdAt);
  }, [createdAt]);

  useEffect(() => {
    if (initialCateringOrders) {
      setCateringOrders(initialCateringOrders);
    }
  }, [initialCateringOrders]);

  useEffect(() => {
    if (!pnr) return;
    let cancelled = false;

    getBookings()
      .then((bookings) => {
        if (cancelled) return;
        const reservation = bookings.find((entry) => entry.pnr === pnr);
        if (reservation) {
          setCateringOrders(reservation.cateringOrders ?? []);
          if (reservation.createdAt) setIssuedAt(reservation.createdAt);
        }
      })
      .catch(() => {
        // Keep initialCateringOrders intact if background refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [pnr]);

  // Pre-confirmation unified checkout view
  if (!pnr) {
    const hasCatering = pantryItemCount > 0;
    const cateringCharge = hasCatering ? pantryTotal : 0;
    const combinedTotal = Number((railNetTotal + cateringCharge).toFixed(2));

    return (
      <div className="space-y-6 max-w-4xl mx-auto text-[#0B192C]">
        <div className="bg-white border border-[#0B192C]/12 p-5 sm:p-8 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#0B192C]/12">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#0B192C] text-white flex items-center justify-center border border-[#0B192C]">
                <ShieldCheck className="w-5 h-5 text-railAmber" />
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight uppercase tracking-wide">
                  Unified Transit &amp; Catering Checkout
                </h2>
                <p className="text-xs text-gray-500 font-mono">
                  National Rail Financial Clearinghouse • Single-Settlement Gateway
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono no-print print:hidden">
              {onBackToDining && (
                <button
                  type="button"
                  onClick={onBackToDining}
                  className="text-[#0B192C] hover:underline font-bold"
                >
                  {hasCatering ? 'Edit Dining Selections' : '+ Add At-Seat Dining'}
                </button>
              )}
              {onBackToSeats && (
                <button
                  type="button"
                  onClick={onBackToSeats}
                  className="text-gray-600 hover:text-[#0B192C] underline"
                >
                  ← Back to Seat Selection
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left column: Payment card details & seat manifest */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-3 border border-[#0B192C]/12 bg-[#F8F9FA] p-4 font-mono text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Journey &amp; Reserved Seats
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Route</span>
                  <span className="font-bold text-[#0B192C]">
                    {route.origin.code} → {route.destination.code}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Departure</span>
                  <span className="font-bold text-[#0B192C]">
                    {route.date} @ {route.time}
                  </span>
                </div>
                <div className="border-t border-[#0B192C]/12 pt-2 space-y-1">
                  {passengers.map((passenger, index) => (
                    <div key={index} className="flex justify-between gap-2">
                      <span className="truncate text-gray-600">
                        P{index + 1} · {passenger.name}
                      </span>
                      <span className="font-bold text-emerald-700 whitespace-nowrap">
                        {coachLabel(passenger.coach)} — Seat {passenger.seat}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-600 uppercase">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    defaultValue={cardholderName || passengers[0]?.name || ''}
                    className="w-full px-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-sm font-medium text-[#0B192C]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-600 uppercase">
                    Card Number
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      defaultValue="4921 •••• •••• 8842"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-sm font-mono text-[#0B192C]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-600 uppercase">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      defaultValue="08/28"
                      className="w-full px-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-sm font-mono text-[#0B192C]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-600 uppercase">
                      CVV / CVC
                    </label>
                    <input
                      type="password"
                      defaultValue="382"
                      className="w-full px-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-sm font-mono text-[#0B192C]"
                    />
                  </div>
                </div>
                <label className="flex items-center space-x-2 pt-1 text-xs text-gray-600">
                  <input type="checkbox" defaultChecked className="text-[#0B192C]" />
                  <span>Send e-ticket PDF, Aztec pass and catering vouchers</span>
                </label>
              </div>
            </div>

            {/* Right column: Itemized Single-Settlement Table */}
            <div className="lg:col-span-7 border border-[#0B192C]/12 bg-[#F8F9FA] p-5 sm:p-6 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-[#0B192C]/12 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B192C]">
                    Itemized Single-Settlement Bill
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                    One Combined Charge
                  </span>
                </div>

                <div className="divide-y divide-[#0B192C]/12 text-xs">
                  {/* Line 1: Rail Fare */}
                  <div className="flex items-baseline justify-between gap-4 py-3.5">
                    <div>
                      <div className="font-semibold text-[#0B192C]">
                        {fare.name} Rail Fare (x{passengers.length})
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        £{perPassengerOriginal.toFixed(2)} per passenger · {fare.type}
                      </div>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-[#0B192C]">
                      £{railGrossTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Line 2: Railcard Concession Deduction (if applicable) */}
                  {railcardDeduction > 0 && (
                    <div className="flex items-baseline justify-between gap-4 py-3.5">
                      <div>
                        <div className="font-semibold text-emerald-700">
                          Railcard Concession Deduction
                        </div>
                        {railcardLabel && (
                          <div className="font-mono text-[10px] text-emerald-700/80">
                            {railcardLabel}
                          </div>
                        )}
                      </div>
                      <span className="font-mono font-bold tabular-nums text-emerald-700">
                        -£{railcardDeduction.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Line 3: At-Seat Galley Catering */}
                  <div className="flex items-baseline justify-between gap-4 py-3.5">
                    <div>
                      <div className="font-semibold text-[#0B192C]">
                        {hasCatering
                          ? `At-Seat Galley Catering (${pantryItemCount} ${
                              pantryItemCount === 1 ? 'item' : 'items'
                            } ordered across ${orderedPassengerCount} ${
                              orderedPassengerCount === 1 ? 'passenger' : 'passengers'
                            })`
                          : 'At-Seat Galley Catering'}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {hasCatering ? (
                          <>
                            Window: {deliveryMilestone}
                            {cateringConcession && cateringConcession.amount > 0 && (
                              <span className="text-emerald-700">
                                {' '}
                                · Net of -£{cateringConcession.amount.toFixed(2)} concession
                              </span>
                            )}
                          </>
                        ) : (
                          'No trolley catering added for this reservation'
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold tabular-nums whitespace-nowrap ${
                        hasCatering ? 'text-[#0B192C]' : 'text-gray-500'
                      }`}
                    >
                      {hasCatering ? `£${cateringCharge.toFixed(2)}` : 'Declined / £0.00'}
                    </span>
                  </div>
                </div>

                {/* Line 4: Space Mono Total Banner */}
                <div className="mt-2 bg-[#0B192C] text-white px-4 py-3.5 border border-[#0B192C] flex items-center justify-between gap-3 font-mono">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-railAmber">
                    TOTAL CHARGEABLE:
                  </span>
                  <span className="text-xl font-bold tabular-nums text-white">
                    £{combinedTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {bookingError && (
                <div className="bg-red-50 border border-red-300 p-3 text-[11px] font-mono text-red-800 flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Booking failed — {bookingError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={onConfirmAndPay}
                disabled={isSubmitting || !onConfirmAndPay}
                className="w-full bg-[#0B192C] hover:bg-slate-800 text-white py-3.5 px-5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border border-[#0B192C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-railAmber animate-spin" />
                    <span>Authorising £{combinedTotal.toFixed(2)} with National Rail…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-railAmber" />
                    <span>CONFIRM &amp; PAY £{combinedTotal.toFixed(2)}</span>
                    <ArrowRight className="w-4 h-4 text-railAmber" />
                  </>
                )}
              </button>

              <p className="text-center font-mono text-[9px] uppercase tracking-wider text-gray-500">
                Atomic booking · Rail seats and galley orders issue on one PNR reference
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resolvedFoodTotal =
    cateringOrders.length > 0
      ? Math.round(cateringOrders.reduce((sum, order) => sum + order.totalAmount, 0) * 100) / 100
      : foodTotal ?? 0;
  const total =
    totalFare !== undefined && cateringOrders.length === (initialCateringOrders?.length ?? 0)
      ? totalFare
      : Number((railNetTotal + resolvedFoodTotal).toFixed(2));

  // A batch writes one order per passenger; count seats rather than orders so
  // a passenger who ordered twice still counts once in the section summary.
  const diningPassengerCount = new Set(
    cateringOrders.map((order) => `${order.assignedCoach}|${order.assignedSeat}`)
  ).size;

  const issuedTimestamp = formatPlacedAt(
    issuedAt || cateringOrders[0]?.placedAt || new Date().toISOString()
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto print-sheet print:max-w-none print:w-full print:space-y-0 text-[#0B192C]">
      <div className="bg-white border border-[#0B192C]/12 p-4 sm:p-8 space-y-6 shadow-sm print-ticket print:p-0 print:border-0 print:shadow-none print:space-y-0 print:h-[134mm] print:grid print:grid-cols-12 print:grid-rows-[auto_1fr] print:gap-x-3 print:gap-y-1.5 print:items-stretch">
        {/* Centered Print Header Block (Half-A4 Boarding Pass Document Credential) */}
        <header className="hidden print:flex flex-col w-full text-center items-center justify-center border-b border-railNavy/15 pb-1 print:col-span-12">
          <div className="w-full text-center flex items-center justify-center font-sans font-bold tracking-wider text-xs text-railNavy uppercase">
            NATIONAL RAIL ENQUIRIES &amp; BOOKING | UK TRANS-NATIONAL TRANSIT
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] text-zinc-500 uppercase tracking-widest text-center">
            ISSUED {issuedTimestamp} • PNR {pnr} • OFFICIAL E-TICKET &amp; CATERING CREDENTIAL
          </div>
        </header>

        {/* Left Column (7/12 in Print): Primary Travel Pass & Barrier Barcode */}
        <div className="space-y-6 print:col-span-7 print:space-y-0 print:flex print:flex-col print:justify-between print:gap-1.5 print:h-full print:min-h-0 print-barrier-pass">
          <div className="flex items-center justify-between pb-4 border-b border-[#0B192C]/12 print:pb-1">
            <div className="flex items-center space-x-3 print:space-x-2">
              <div className="w-10 h-10 print:w-6 print:h-6 bg-[#0B192C] text-white flex items-center justify-center font-bold text-lg border border-[#0B192C]">
                <Train className="w-5 h-5 print:w-3.5 print:h-3.5 text-railAmber" />
              </div>
              <div>
                <h2 className="font-bold text-base print:text-xs leading-tight uppercase">National Rail E-Ticket &amp; Pass</h2>
                <p className="text-xs print:text-[8.5px] text-gray-500 font-mono">AUTHORISED PASSENGER TRANSPORT AUTHORITY • PNR: {pnr}</p>
              </div>
            </div>
            <span className="text-xs print:text-[8.5px] font-mono bg-emerald-100 text-emerald-800 px-3 py-1 print:px-2 print:py-0.5 font-bold uppercase border border-emerald-300">
              VALIDATED &amp; PAID
            </span>
          </div>

          {message && (
            <div className="bg-emerald-50 border border-emerald-300 p-3 text-xs font-mono text-emerald-900 flex items-start space-x-2 no-print print:hidden">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Authentic UK Orange/White Magnetic Stripe Ticket Simulation */}
          <div className="bg-amber-500 text-slate-950 border-2 border-[#0B192C] p-6 print:p-2 print:flex-1 print:flex print:flex-col print:justify-between shadow-md print:shadow-none relative overflow-hidden font-mono print-barrier-pass">
            <div className="absolute top-0 right-0 w-32 h-full bg-white/20 skew-x-12 pointer-events-none"></div>

            <div className="flex justify-between items-start border-b border-slate-900/30 pb-4 mb-4 print:pb-1 print:mb-1">
              <div>
                <span className="text-[10px] print:text-[8px] bg-slate-950 text-white px-2 py-0.5 font-bold uppercase">NATIONAL RAIL SINGLE</span>
                <div className="text-xl print:text-sm font-bold tracking-tight mt-1 print:mt-0.5">{fare.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl print:text-base font-bold">£{total.toFixed(2)}</div>
                <div className="text-[10px] print:text-[8.5px] text-slate-900/80 print:text-slate-950">
                  {resolvedFoodTotal > 0
                    ? `RAIL £${railNetTotal.toFixed(2)} + DINING £${resolvedFoodTotal.toFixed(2)}`
                    : passengers.length === 1
                    ? 'STANDARD CLASS'
                    : `${passengers.length} × £${unitPrice.toFixed(2)} · STANDARD CLASS`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-4 py-2 border-b border-slate-900/30 pb-4 mb-4 text-xs print:gap-2 print:py-0.5 print:pb-1 print:mb-1">
              <div>
                <span className="text-[10px] print:text-[8px] uppercase opacity-75 block">ORIGIN CRS</span>
                <span className="text-base print:text-xs font-bold leading-tight">{route.origin.name}</span>
                <span className="text-[10px] print:text-[8.5px] block font-mono">[{route.origin.code}]</span>
              </div>
              <div>
                <span className="text-[10px] print:text-[8px] uppercase opacity-75 block">DESTINATION CRS</span>
                <span className="text-base print:text-xs font-bold leading-tight">{route.destination.name}</span>
                <span className="text-[10px] print:text-[8.5px] block font-mono">[{route.destination.code}]</span>
              </div>
              <div>
                <span className="text-[10px] print:text-[8px] uppercase opacity-75 block">DATE &amp; TIME</span>
                <span className="text-base print:text-xs font-bold leading-tight">{route.date}</span>
                <span className="text-[10px] print:text-[8.5px] block font-mono">{route.time} DEPARTURE</span>
              </div>
              <div>
                <span className="text-[10px] print:text-[8px] uppercase opacity-75 block">RESERVATION</span>
                <span className="text-base print:text-xs font-bold text-slate-950 leading-tight">
                  {passengers.length === 1 ? coachLabel(passengers[0].coach) : `${passengers.length} SEATS`}
                </span>
                <span className="text-[10px] print:text-[8.5px] block font-mono">
                  Seat {passengers.map((passenger) => passenger.seat).join(', ')}
                </span>
              </div>
            </div>

            <div className="border-b border-slate-900/30 pb-3 mb-3 print:pb-1 print:mb-1">
              <div className="flex items-center justify-between text-[10px] print:text-[8px] uppercase opacity-75 mb-1.5 print:mb-0.5">
                <span>Passenger Manifest</span>
                <span>
                  {passengers.length} {passengers.length === 1 ? 'Traveller' : 'Travellers'} · Total £{total.toFixed(2)}
                  {resolvedFoodTotal > 0 ? ` (incl. £${resolvedFoodTotal.toFixed(2)} catering)` : ''}
                </span>
              </div>
              <div className="divide-y divide-slate-900/15">
                {passengers.map((passenger, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 py-1.5 print:py-0 text-xs print:text-[9.5px] print:leading-snug">
                    <span className="truncate">
                      <strong className="mr-1.5">{String(index + 1).padStart(2, '0')}</strong>
                      {passenger.name}
                    </span>
                    <span className="whitespace-nowrap">
                      {coachLabel(passenger.coach)} · Seat <strong>{passenger.seat}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row print:flex-row items-center justify-between gap-4 pt-2 print:gap-2 print:pt-0.5">
              <div className="text-[11px] print:text-[8.5px] leading-tight space-y-0.5 opacity-90 text-slate-950">
                <div>Valid only on booked service. Subject to National Rail Conditions of Travel.</div>
                <div>BARRIER PASS CODE: 9942-8810-UKR-PASS</div>
              </div>
              <div className="bg-slate-950 text-white px-4 py-2 print:px-2.5 print:py-0.5 font-mono text-xs print:text-[9px] font-bold tracking-widest text-center shrink-0">
                ||| ||||| || ||| | |||||
              </div>
            </div>
          </div>

          {/* QR Code / Aztec Pass Card */}
          <div className="border border-[#0B192C]/12 bg-gray-50 print:bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-6 p-5 print:gap-2.5 print:p-2 items-center print-barrier-pass">
              <div className="bg-white border border-[#0B192C]/12 p-4 print:p-1.5 flex flex-col items-center justify-center space-y-2 print:space-y-0.5 text-center">
                <div className="w-24 h-24 print:w-16 print:h-16 bg-[#0B192C] text-white flex items-center justify-center font-mono font-bold text-xs">
                  <QrCode className="w-16 h-16 print:w-12 print:h-12 text-railAmber" />
                </div>
                <span className="text-[10px] print:text-[8px] font-mono text-gray-500">Scan at Barrier Gate</span>
              </div>

              <div className="md:col-span-2 print:col-span-2 divide-y divide-[#0B192C]/12 text-xs print:text-[10px] font-mono text-gray-700">
                <div className="flex justify-between py-1.5 print:py-0.5">
                  <span className="text-gray-500">LEAD PASSENGER:</span>
                  <span className="font-bold text-[#0B192C]">{passengers[0]?.name}</span>
                </div>
                <div className="flex justify-between py-1.5 print:py-0.5">
                  <span className="text-gray-500">PARTY SIZE:</span>
                  <span className="font-bold text-[#0B192C]">
                    {passengers.length} {passengers.length === 1 ? 'ADULT' : 'ADULTS'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 print:py-0.5">
                  <span className="text-gray-500">TICKET REFERENCE:</span>
                  <span className="font-bold text-[#0B192C]">{pnr}</span>
                </div>
                <div className="flex justify-between py-1.5 print:py-0.5">
                  <span className="text-gray-500">OPERATOR:</span>
                  <span className="font-bold text-[#0B192C]">Avanti West Coast / National Rail</span>
                </div>
                <div className="flex justify-between pt-1.5 print:pt-0.5">
                  <span className="text-gray-500">STATUS:</span>
                  <span className="font-bold text-emerald-600">READY FOR TRAVEL</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5/12 in Print): Fare Breakdown & At-Seat Dining Vouchers */}
        <div className="space-y-6 print:col-span-5 print:space-y-0 print:flex print:flex-col print:justify-between print:gap-1.5 print:h-full print:min-h-0 print-dining-vouchers">
          {/* Print-only Itemized Fare Breakdown */}
          <div className="hidden print:block border border-[#0B192C]/15 bg-[#F8F9FA] p-2 font-mono shrink-0">
            <div className="flex items-center justify-between border-b border-[#0B192C]/15 pb-0.5 mb-1">
              <span className="font-sans text-[8.5px] font-bold uppercase tracking-[0.14em] text-railNavy">
                Journey Settlement Summary
              </span>
              <span className="text-[7.5px] uppercase text-zinc-500">PNR {pnr}</span>
            </div>
            <div className="space-y-0.5 text-[9px] text-gray-700 leading-tight">
              <div className="flex justify-between">
                <span>
                  Rail Fare ({passengers.length} × £{unitPrice.toFixed(2)})
                </span>
                <span className="font-bold text-[#0B192C] tabular-nums">£{railNetTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  At-Seat Galley Catering ({cateringOrders.length}{' '}
                  {cateringOrders.length === 1 ? 'voucher' : 'vouchers'})
                </span>
                <span className="font-bold text-[#0B192C] tabular-nums">
                  {resolvedFoodTotal > 0 ? `£${resolvedFoodTotal.toFixed(2)}` : '£0.00 (None)'}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-baseline border-t border-[#0B192C]/20 mt-1 pt-0.5 text-[10px] font-bold text-[#0B192C]">
              <span>TOTAL PAID</span>
              <span className="tabular-nums">£{total.toFixed(2)}</span>
            </div>
          </div>

          {cateringOrders.length > 0 && (
            <section
              className="border border-[#0B192C]/12 bg-gray-50 print:bg-white px-3 py-4 sm:px-5 print:px-2 print:py-1.5 print:flex-1 print:flex print:flex-col print:justify-between print:min-h-0 print-dining-vouchers"
              aria-labelledby="dining-vouchers-title"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 shrink-0">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-3.5 w-3.5 print:h-3 print:w-3 text-[#0B192C]" aria-hidden="true" />
                  <h3
                    id="dining-vouchers-title"
                    className="text-[10px] print:text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#0B192C]"
                  >
                    On-board dining vouchers
                  </h3>
                </div>
                <span className="font-mono text-[9px] print:text-[7.5px] uppercase tracking-wider text-gray-500">
                  {diningPassengerCount} {diningPassengerCount === 1 ? 'passenger' : 'passengers'} ·{' '}
                  {cateringOrders.length} {cateringOrders.length === 1 ? 'voucher' : 'vouchers'}
                </span>
              </div>

              <div
                className={`mt-3 gap-3 print:mt-1 print:gap-1 grid ${
                  cateringOrders.length <= 2 ? 'print:my-auto' : ''
                } ${
                  cateringOrders.length > 2
                    ? 'md:grid-cols-2 print:grid-cols-2'
                    : cateringOrders.length > 1
                      ? 'md:grid-cols-2 print:grid-cols-1'
                      : ''
                }`}
              >
                {cateringOrders.map((order, index) => {
                  const step = diningStepIndex(order.deliveryStatus);
                  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                  const compactGrid = cateringOrders.length > 2;

                  return (
                    <article
                      key={order.orderId}
                      aria-label={`Dining voucher ${index + 1} for ${order.passengerName}, ${order.assignedCoach}, seat ${order.assignedSeat}`}
                      className="print-voucher-card break-inside-avoid border border-[#0B192C]/20 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-dashed border-[#0B192C]/25 bg-[#F8F9FA] px-3 py-2 print:px-1.5 print:py-0.5">
                        <div className="min-w-0">
                          <div
                            className={`font-mono text-[8px] print:text-[6.5px] uppercase tracking-[0.18em] text-gray-500 ${
                              compactGrid ? 'print:hidden' : ''
                            }`}
                          >
                            On-board dining voucher
                          </div>
                          <h4
                            className={`mt-0.5 print:mt-0 text-[11px] font-bold leading-snug text-[#0B192C] ${
                              compactGrid ? 'print:text-[8px] print:leading-tight print:truncate' : 'print:text-[9px]'
                            }`}
                          >
                            {order.passengerName}{' '}
                            <span className="font-normal text-gray-400">•</span>{' '}
                            {order.assignedCoach}, Seat {order.assignedSeat}
                          </h4>
                        </div>
                        <span className="shrink-0 border border-[#0B192C]/20 px-1.5 py-0.5 font-mono text-[8px] print:text-[6.5px] tabular-nums text-gray-500">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 px-3 py-2 print:gap-1 print:px-1.5 print:py-0.5 font-mono">
                        <div className="min-w-0">
                          <div className="text-[8px] print:text-[6px] uppercase tracking-wider text-gray-500">
                            Catering reference
                          </div>
                          <div
                            className={`mt-0.5 font-bold leading-tight text-[#0B192C] sm:text-[9px] ${
                              compactGrid ? 'print:mt-0 print:text-[6px] print:truncate' : 'break-all text-[8px] print:text-[7px]'
                            }`}
                          >
                            {order.orderId}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[8px] print:text-[6px] uppercase tracking-wider text-gray-500">
                            Scheduled window
                          </div>
                          <div
                            className={`mt-0.5 font-bold leading-tight text-[#0B192C] ${
                              compactGrid ? 'print:mt-0 print:text-[6px] print:truncate' : 'text-[9px] print:text-[7px]'
                            }`}
                          >
                            {order.deliveryMilestone}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-[#0B192C]/10 px-3 py-2 print:px-1.5 print:py-0.5">
                        <div className="flex items-baseline justify-between gap-3 font-mono text-[8px] print:text-[6px] uppercase tracking-wider text-gray-500">
                          <span>Items</span>
                          <span>
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5 print:mt-0.5 print:space-y-0">
                          {order.items.map((item) => (
                            <li
                              key={item.itemId}
                              className={`flex items-baseline justify-between gap-2 text-xs leading-snug text-[#0B192C] ${
                                compactGrid ? 'print:text-[7.5px] print:leading-[1.15]' : 'print:text-[8.5px] print:leading-[1.2]'
                              }`}
                            >
                              <span className="min-w-0 truncate">
                                {item.name}{' '}
                                <span
                                  className={`font-mono font-bold ${
                                    compactGrid ? 'text-[9px] print:text-[7px]' : 'text-[9px] print:text-[7.5px]'
                                  }`}
                                >
                                  ×{item.quantity}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 font-mono tabular-nums text-gray-600 ${
                                  compactGrid ? 'text-[9px] print:text-[7px]' : 'text-[9px] print:text-[7.5px]'
                                }`}
                              >
                                £{(item.unitPrice * item.quantity).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="relative border-t border-dashed border-[#0B192C]/25 px-3 py-2 print:px-1.5 print:py-0.5">
                        <span
                          className="absolute -left-[5px] -top-[5px] h-2.5 w-2.5 border border-[#0B192C]/20 bg-[#F8F9FA] print:hidden"
                          aria-hidden="true"
                        />
                        <span
                          className="absolute -right-[5px] -top-[5px] h-2.5 w-2.5 border border-[#0B192C]/20 bg-[#F8F9FA] print:hidden"
                          aria-hidden="true"
                        />
                        <ol
                          className="grid grid-cols-4 gap-1 print:gap-0.5"
                          aria-label={`Dining progress for ${order.passengerName}: ${DINING_STEPS.map(
                            (entry) => entry.label
                          ).join(', ')}`}
                        >
                          {DINING_STEPS.map((entry, stepIndex) => {
                            const done = stepIndex < step;
                            const current = stepIndex === step;

                            return (
                              <li
                                key={entry.id}
                                className="min-w-0"
                                aria-current={current ? 'step' : undefined}
                              >
                                <div className="flex items-center">
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 border ${
                                      done
                                        ? 'border-[#0B192C] bg-[#0B192C]'
                                        : current
                                          ? 'border-[#0B192C] bg-railAmber'
                                          : 'border-[#0B192C]/25 bg-white'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {stepIndex < DINING_STEPS.length - 1 && (
                                    <span
                                      className={`ml-1 h-px flex-1 ${
                                        stepIndex < step ? 'bg-[#0B192C]' : 'bg-[#0B192C]/20'
                                      }`}
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div
                                  className={`mt-1 print:mt-0.5 pr-0.5 font-mono text-[8px] tracking-wide ${
                                    compactGrid
                                      ? 'print:text-[5.5px] print:leading-none print:truncate'
                                      : 'print:text-[6px] print:leading-[1.1]'
                                  } ${
                                    done || current
                                      ? 'font-bold text-[#0B192C]'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  {entry.label}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>

                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-[#0B192C]/10 bg-[#F8F9FA] px-3 py-1.5 print:px-1.5 print:py-0.5 font-mono text-[8px] print:text-[6.5px] uppercase tracking-wider text-gray-500">
                        <span>
                          Total{' '}
                          <span className="font-bold text-[#0B192C]">
                            £{order.totalAmount.toFixed(2)}
                          </span>
                          {order.concession && order.concession.amount > 0 && (
                            <> · concession −£{order.concession.amount.toFixed(2)}</>
                          )}
                        </span>
                        <span>Placed {formatPlacedAt(order.placedAt)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {cateringOrders.length === 0 && (
            <div className="hidden print:flex print:flex-1 flex-col justify-between border border-dashed border-[#0B192C]/25 bg-[#F8F9FA] p-2.5 font-mono print:min-h-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 border-b border-[#0B192C]/15 pb-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-railNavy" aria-hidden="true" />
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-railNavy">
                    AT-SEAT CATERING: NONE / STANDARD CONDITIONS OF CARRIAGE
                  </span>
                </div>
                <p className="text-[9px] text-gray-600 leading-relaxed">
                  No pre-ordered galley &amp; pantry selections attached to this reservation. Complimentary at-seat
                  trolley refreshments remain available for purchase onboard subject to route catering availability.
                </p>
              </div>
              <div className="border-t border-[#0B192C]/15 pt-2 mt-2 space-y-1 text-[8.5px] text-gray-500 uppercase tracking-wider">
                <div className="flex justify-between">
                  <span>Validity</span>
                  <span className="font-bold text-[#0B192C]">Booked Train Only</span>
                </div>
                <div className="flex justify-between">
                  <span>Gate Inspection</span>
                  <span className="font-bold text-[#0B192C]">Aztec Pass + Seat Manifest</span>
                </div>
                <div className="flex justify-between">
                  <span>Authority</span>
                  <span className="font-bold text-[#0B192C]">National Rail Conditions of Travel</span>
                </div>
              </div>
            </div>
          )}

          {/* Crisp Transit Audit Line */}
          <div className="hidden print:flex items-center justify-center border-t border-[#0B192C]/15 pt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-[#0B192C]/75 font-bold text-center shrink-0">
            VALIDATED ELECTRONIC CREDENTIAL • DO NOT FOLD ACROSS AZTEC MATRIX
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t border-[#0B192C]/12 no-print print:hidden">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto bg-white hover:bg-gray-50 text-[#0B192C] border border-[#0B192C]/12 px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4 text-[#0B192C]" />
            <span>Print / Export PDF</span>
          </button>
          <button
            onClick={onNewBooking}
            className="w-full sm:w-auto bg-[#0B192C] hover:bg-slate-800 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border border-[#0B192C]"
          >
            <span>Book Another Journey</span>
            <ArrowRight className="w-4 h-4 text-railAmber" />
          </button>
        </div>
      </div>
    </div>
  );
}
