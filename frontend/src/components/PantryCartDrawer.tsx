import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, RefreshCw, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { usePantry, type CartItem, type PantryPassenger } from '../context/PantryContext';
import { postCateringOrders } from '../lib/api';

interface PantryCartDrawerProps {
  open: boolean;
  onClose: () => void;
}

function money(value: number): string {
  return `£${value.toFixed(2)}`;
}

/**
 * Checkout sheet for the at-seat pantry.
 *
 * The bill shown here is the bill the server checks: subtotal from the same
 * catalogue the board reads, less the First Class Advance concession the fare
 * earns. The order is only cleared once the API has accepted it.
 */
export function PantryCartDrawer({ open, onClose }: PantryCartDrawerProps) {
  const {
    cartItems,
    itemCount,
    combinedTotal,
    concession,
    total,
    assignment,
    isSeatBound,
    passengers,
    deliveryWindows,
    deliveryWindow,
    setDeliveryWindow,
    deliveryMilestone,
    clearCart,
    getPassengerTotal,
    recordOrder,
  } = usePantry();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every traveller gets a subsection, even before they have picked anything;
  // `parties` narrows that to the passengers actually going to the galley.
  const groups = useMemo(() => {
    const byPassenger = new Map<string, { passenger: PantryPassenger; lines: CartItem[] }>();

    for (const passenger of passengers) {
      byPassenger.set(passenger.id, { passenger, lines: [] });
    }

    for (const line of cartItems) {
      const existing = byPassenger.get(line.passengerId);
      if (existing) {
        existing.lines.push(line);
      } else {
        byPassenger.set(line.passengerId, {
          passenger: {
            id: line.passengerId,
            name: line.passengerName,
            coach: line.assignedCoach,
            seat: line.assignedSeat,
          },
          lines: [line],
        });
      }
    }

    return [...byPassenger.values()];
  }, [passengers, cartItems]);

  const parties = useMemo(
    () => groups.filter((group) => group.lines.length > 0),
    [groups]
  );

  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const clearOnExitRef = useRef(false);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  // Reset the failure state each time the sheet opens, and hand focus to it.
  useEffect(() => {
    if (!open) return;

    setError(null);
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const timer = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Escape closes, Tab stays inside the sheet, and the page behind is locked.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), [href], input, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  const handleBackdrop = useCallback(() => {
    if (!submittingRef.current) onClose();
  }, [onClose]);

  const handleDispatch = async () => {
    if (!assignment || !isSeatBound || parties.length === 0 || submittingRef.current) return;

    if (!assignment.pnr) {
      setError('This seat is not linked to a booking reference yet.');
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    setError(null);

    try {
      const result = await postCateringOrders({
        bookingReference: assignment.pnr,
        deliveryMilestone,
        passengerOrders: parties.map(({ passenger, lines }) => ({
          passengerId: passenger.id,
          passengerName: passenger.name,
          assignedCoach: passenger.coach,
          assignedSeat: passenger.seat,
          items: lines.map((line) => ({
            itemId: line.item.id,
            name: line.item.name,
            quantity: line.quantity,
            unitPrice: line.item.price,
          })),
          subtotal:
            Math.round(
              lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0) * 100
            ) / 100,
        })),
      });

      const accepted = result.updatedOrders.slice(-parties.length);

      recordOrder({
        orderIds: accepted.map((order) => order.orderId),
        totalAmount: total,
        concession,
        passengers: parties.map(({ passenger }) => passenger),
        orders: result.updatedOrders,
        milestone: deliveryMilestone,
        placedAt: new Date().toISOString(),
      });

      // Keep the lines on screen through the slide-out, then empty the cart.
      // The timeout is a fallback in case the sheet unmounts mid-exit.
      clearOnExitRef.current = true;
      onClose();

      window.setTimeout(() => {
        if (!clearOnExitRef.current) return;
        clearOnExitRef.current = false;
        clearCart();
      }, 400);
    } catch (err) {
      // The cart is deliberately left intact so the passenger can retry.
      setError((err as Error).message || 'The galley could not accept this order.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (!clearOnExitRef.current) return;
        clearOnExitRef.current = false;
        clearCart();
      }}
    >
      {open && (
        <motion.div
          key="pantry-checkout"
          className="fixed inset-0 z-[70] flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 bg-[#0B192C]/55"
            onClick={handleBackdrop}
            aria-hidden="true"
          />

          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pantry-checkout-title"
            aria-busy={submitting}
            className="relative flex h-full w-full max-w-[440px] flex-col border-l border-[#0B192C]/18 bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Sheet heading */}
            <div className="flex items-start justify-between gap-3 border-b border-[#0B192C]/15 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-[#0B192C]" aria-hidden="true" />
                  <h2
                    id="pantry-checkout-title"
                    className="text-base font-bold uppercase tracking-wide text-[#0B192C]"
                  >
                    Dispatch to seat
                  </h2>
                </div>
                <p className="mt-1 font-mono text-[10px] text-gray-500">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} · Ref {assignment?.pnr ?? '—'}
                </p>
              </div>

              <button
                ref={closeRef}
                type="button"
                onClick={handleBackdrop}
                disabled={submitting}
                aria-label="Close checkout"
                className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center border border-transparent text-gray-500 transition-colors hover:border-[#0B192C]/15 hover:text-[#0B192C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C] disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Delivery target */}
            <div className="border-b border-[#0B192C]/15 bg-[#0B192C] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold leading-snug">
                    Delivering to:{' '}
                    {isSeatBound && assignment
                      ? parties.length > 1
                        ? `${parties.length} passengers`
                        : `${parties[0]?.passenger.coach ?? assignment.coach}, Seat ${
                            parties[0]?.passenger.seat ?? assignment.seat
                          }`
                      : 'No seat bound'}
                  </p>
                  {assignment && (assignment.time || assignment.originCode) && (
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-gray-300">
                      {assignment.time} {assignment.origin ?? assignment.originCode} [
                      {assignment.originCode}] → {assignment.destination ?? assignment.destinationCode}{' '}
                      [{assignment.destinationCode}]
                    </p>
                  )}

                  {parties.length > 1 && (
                    <ul className="mt-2 space-y-0.5 border-t border-white/10 pt-2 font-mono text-[9px] text-gray-300">
                      {parties.map(({ passenger }) => (
                        <li key={passenger.id} className="flex justify-between gap-3">
                          <span className="truncate">{passenger.name}</span>
                          <span className="shrink-0 text-gray-400">
                            {passenger.coach} {passenger.seat}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="shrink-0 border border-railAmber/40 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-railAmber">
                  At-seat
                </span>
              </div>

              {assignment?.fareName && (
                <p className="mt-2 border-t border-white/10 pt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
                  Fare · <span className="text-gray-200">{assignment.fareName}</span>
                </p>
              )}
            </div>

            {/* Delivery window */}
            <div className="border-b border-[#0B192C]/12 px-5 py-4">
              <label
                htmlFor="pantry-delivery-window"
                className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500"
              >
                Scheduled service window
              </label>

              <div className="relative mt-1.5">
                <select
                  id="pantry-delivery-window"
                  value={deliveryWindow.id}
                  onChange={(event) => setDeliveryWindow(event.target.value)}
                  disabled={submitting}
                  className="h-9 w-full appearance-none border border-[#0B192C]/25 bg-white pl-3 pr-9 font-mono text-[11px] text-[#0B192C] transition-colors focus:border-[#0B192C] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C] disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {deliveryWindows.map((window) => (
                    <option key={window.id} value={window.id}>
                      {window.label}: {window.window}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
                  aria-hidden="true"
                />
              </div>

              <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500">
                {deliveryWindow.note}
              </p>
            </div>

            {/* Lines, one subsection per traveller on the ticket */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500">
                    Passenger orders
                  </h3>
                  <span className="font-mono text-[9px] text-gray-500">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {groups.map(({ passenger, lines }) => {
                  const passengerItems = lines.reduce((sum, line) => sum + line.quantity, 0);

                  return (
                    <section
                      key={passenger.id}
                      aria-label={`Passenger order for ${passenger.name}, ${passenger.coach}, seat ${passenger.seat}`}
                      className="mt-3 border border-[#0B192C]/12"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-[#0B192C]/10 bg-[#F8F9FA] px-3 py-2">
                        <h4 className="min-w-0 text-[11px] font-bold leading-snug text-[#0B192C]">
                          {passenger.name}
                          <span className="font-normal text-gray-500">
                            {' '}
                            — {passenger.coach}, Seat {passenger.seat}
                          </span>
                        </h4>
                        <span
                          className={`shrink-0 font-mono text-[9px] uppercase tracking-wider ${
                            lines.length > 0 ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          {passengerItems} {passengerItems === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {lines.length === 0 ? (
                        <p className="px-3 py-3 text-[10px] leading-relaxed text-gray-500">
                          No items selected for this passenger yet. Select their passenger tab on
                          the board to add a line.
                        </p>
                      ) : (
                        <>
                          <ul className="divide-y divide-[#0B192C]/10">
                            {lines.map((line) => (
                              <li
                                key={`${line.passengerId}-${line.item.id}`}
                                className="flex items-start justify-between gap-4 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold leading-tight text-[#0B192C]">
                                    {line.item.name}
                                  </p>
                                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-gray-500">
                                    {line.quantity} × {money(line.item.price)}
                                  </p>
                                </div>
                                <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-[#0B192C]">
                                  {money(line.item.price * line.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <div className="flex justify-between gap-3 border-t border-[#0B192C]/10 px-3 py-2 font-mono text-[9px]">
                            <span className="uppercase tracking-wider text-gray-500">
                              Passenger subtotal
                            </span>
                            <span className="font-bold tabular-nums text-[#0B192C]">
                              {money(getPassengerTotal(passenger.id))}
                            </span>
                          </div>
                        </>
                      )}
                    </section>
                  );
                })}

                {groups.length === 0 && (
                  <p className="py-6 text-center text-[11px] leading-relaxed text-gray-500">
                    No passengers are bound to this order.
                  </p>
                )}
              </div>
            </div>

            {/* Bill and dispatch */}
            <div className="border-t border-[#0B192C]/15">
              <div className="space-y-1.5 px-5 py-4 font-mono text-[11px]">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">
                    Combined subtotal · {parties.length}{' '}
                    {parties.length === 1 ? 'passenger' : 'passengers'}
                  </span>
                  <span className="tabular-nums text-[#0B192C]">{money(combinedTotal)}</span>
                </div>

                {concession && (
                  <div className="flex justify-between gap-4 text-emerald-700">
                    <span>{concession.label} · 10%</span>
                    <span className="tabular-nums">−{money(concession.amount)}</span>
                  </div>
                )}

                <div className="flex items-baseline justify-between gap-4 border-t border-[#0B192C]/12 pt-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#0B192C]">
                    Total due
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums text-[#0B192C]">
                    {money(total)}
                  </span>
                </div>

                <p className="text-[9px] uppercase tracking-wider text-gray-500">
                  VAT included · Charged to the card on file
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mx-5 mb-3 flex items-start gap-2 border border-railRed/40 bg-railRed/5 px-3 py-2.5"
                >
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-railRed" />
                  <p className="text-[11px] leading-snug text-railRed">{error}</p>
                </div>
              )}

              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={handleDispatch}
                  disabled={!isSeatBound || parties.length === 0 || submitting}
                  className={`flex h-11 w-full items-center justify-center gap-2 border text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-railAmber ${
                    !isSeatBound || parties.length === 0
                      ? 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
                      : submitting
                      ? 'cursor-wait border-[#0B192C] bg-[#0B192C] text-white'
                      : 'border-[#0B192C] bg-[#0B192C] text-white hover:bg-slate-800'
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw
                        className="h-3.5 w-3.5 animate-spin text-railAmber"
                        aria-hidden="true"
                      />
                      Dispatching all orders…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-railAmber" aria-hidden="true" />
                      Confirm &amp; Dispatch All Orders
                    </>
                  )}
                </button>

                <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-wider text-gray-500">
                  The galley confirms every line before the trolley leaves
                </p>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
