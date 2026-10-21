import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Minus, Plus, ShoppingBag, TrainFront, X } from 'lucide-react';
import { MAX_LINE_QUANTITY, usePantry } from '../context/PantryContext';
import { DietaryTag, PantryItem, PantrySectionId } from '../data/pantryMenu';
import { PantryCartDrawer } from './PantryCartDrawer';

/** "2026-11-26" -> "26 NOV 2026" without drifting across timezones. */
function formatServiceDate(iso?: string): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;

  return new Date(year, month - 1, day)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

const DIETARY_FILTERS: DietaryTag[] = ['Gluten-Free', 'Vegan'];

interface ItemCardProps {
  item: PantryItem;
  draft: number;
  inCart: number;
  /** Seat of the passenger the board is currently allocating to. */
  passengerSeat: string | null;
  addedQuantity: number | null;
  canOrder: boolean;
  onDraftChange: (quantity: number) => void;
  onAdd: () => void;
}

/** Two-letter monogram used when a photograph cannot be fetched. */
function itemInitials(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

/** The menu photograph, with a quiet transit fallback if Unsplash is unreachable. */
function PantryItemImage({ item }: { item: PantryItem }) {
  const [failed, setFailed] = useState(false);
  const initials = itemInitials(item.name);

  if (!item.image || failed) {
    return (
      <div
        className="flex h-36 w-full items-center justify-center rounded-t-sm border-b border-[#0B192C18] bg-[#F1F3F5] md:h-40"
        role="img"
        aria-label={`${item.name} — image unavailable`}
      >
        <div className="flex flex-col items-center gap-1.5">
          <TrainFront className="h-6 w-6 text-[#0B192C]/35" strokeWidth={1.5} aria-hidden="true" />
          <span className="font-mono text-[11px] font-bold tracking-[0.25em] text-[#0B192C]/55">
            {initials}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-t-sm border-b border-[#0B192C18] bg-[#F1F3F5]">
      <img
        src={item.image}
        alt={item.name}
        decoding="async"
        onError={() => setFailed(true)}
        className="w-full h-36 md:h-40 object-cover rounded-t-sm brightness-95 contrast-[1.05]"
      />
    </div>
  );
}

/** One sellable line on the board, carried by a fixed-height food photograph. */
function PantryItemCard({
  item,
  draft,
  inCart,
  passengerSeat,
  addedQuantity,
  canOrder,
  onDraftChange,
  onAdd,
}: ItemCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-t-sm border border-[#0B192C]/12 bg-white">
      <PantryItemImage item={item} />

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight text-[#0B192C]">{item.name}</h3>
            {item.dietaryTags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.dietaryTags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-[#0B192C]/20 px-1.5 py-px text-[9px] font-mono uppercase tracking-wider text-gray-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[9px] font-mono uppercase tracking-wider text-gray-500">Unit</div>
            <div className="font-mono text-sm font-bold tabular-nums text-[#0B192C]">
              £{item.price.toFixed(2)}
            </div>
            <div className="mt-0.5 font-mono text-[9px] tabular-nums text-gray-500">
              {item.calories} kcal
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs leading-snug text-gray-600">{item.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-mono uppercase tracking-wider text-gray-500">
          <span>{item.preparationTimeMins} min prep</span>
          {inCart > 0 && passengerSeat && (
            <span className="inline-flex items-center gap-1 border border-emerald-700/30 bg-emerald-50 px-1.5 py-px font-bold text-emerald-800">
              <Check className="h-3 w-3" />
              {passengerSeat} ×{inCart}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-t border-[#0B192C]/10 pt-3">
            <div
              className="inline-flex items-center border border-[#0B192C]/20 bg-white"
              role="group"
              aria-label={`Quantity for ${item.name}`}
            >
              <button
                type="button"
                onClick={() => onDraftChange(draft - 1)}
                disabled={draft <= 1}
                aria-label={`Decrease quantity of ${item.name}`}
                className="flex h-8 w-7 items-center justify-center text-[#0B192C] hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span
                className="w-7 text-center text-xs font-mono font-bold tabular-nums text-[#0B192C]"
                aria-live="polite"
              >
                {draft}
              </span>
              <button
                type="button"
                onClick={() => onDraftChange(draft + 1)}
                disabled={draft >= MAX_LINE_QUANTITY}
                aria-label={`Increase quantity of ${item.name}`}
                className="flex h-8 w-7 items-center justify-center text-[#0B192C] hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={onAdd}
              disabled={!canOrder}
              title={canOrder ? undefined : 'Book a journey to unlock at-seat delivery'}
              className={`flex h-auto min-h-8 w-full items-center justify-center gap-1.5 border px-3 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-wider transition-colors ${
                canOrder
                  ? 'border-[#0B192C] bg-[#0B192C] text-white hover:bg-slate-800'
                  : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
              }`}
            >
              {addedQuantity !== null ? (
                <>
                  <Check className="h-3 w-3 text-railAmber" />
                  Added ×{addedQuantity}
                </>
              ) : (
                <>
                  <ShoppingBag
                    className={`h-3 w-3 ${canOrder ? 'text-railAmber' : 'text-gray-400'}`}
                  />
                  Add to Coach Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * At-seat pantry board.
 *
 * The service ribbon is read from the reservation the cart is bound to — never
 * a sample timetable — so a passenger cannot order a trolley run that is not
 * their own. Money is shown from the catalogue, which is the same table the
 * order payload is built from.
 */
export function PantryMenu() {
  const {
    menu,
    sections,
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    itemCount,
    combinedTotal,
    assignment,
    isSeatBound,
    assignmentLoading,
    passengers,
    activePassengerId,
    activePassenger,
    setActivePassenger,
    getPassengerItems,
    getPassengerTotal,
    lastOrder,
    clearLastOrder,
  } = usePantry();

  const [category, setCategory] = useState<'all' | PantrySectionId>('all');
  const [dietary, setDietary] = useState<DietaryTag[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<{ id: string; quantity: number } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const addedTimer = useRef<number | null>(null);

  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);

  useEffect(
    () => () => {
      if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
    },
    []
  );

  const changeDraft = (itemId: string, next: number) => {
    if (!Number.isFinite(next)) return;
    const quantity = Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(next)));
    setDrafts((previous) => ({ ...previous, [itemId]: quantity }));
  };

  const handleAdd = (item: PantryItem) => {
    const quantity = drafts[item.id] ?? 1;

    addToCart(item, quantity);
    setDrafts((previous) => ({ ...previous, [item.id]: 1 }));
    setAdded({ id: item.id, quantity });

    if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(null), 1800);
  };

  const toggleDietary = (tag: DietaryTag) => {
    setDietary((previous) =>
      previous.includes(tag) ? previous.filter((entry) => entry !== tag) : [...previous, tag]
    );
  };

  const matchesFilters = (item: PantryItem, categoryId: 'all' | PantrySectionId) =>
    (categoryId === 'all' || item.section === categoryId) &&
    dietary.every((tag) => item.dietaryTags.includes(tag));

  const visibleSections = useMemo(
    () =>
      sections
        .filter((section) => category === 'all' || section.id === category)
        .map((section) => ({
          section,
          items: menu.filter((item) => matchesFilters(item, section.id)),
        }))
        .filter((group) => group.items.length > 0),
    [sections, menu, category, dietary]
  );

  const visibleCount = visibleSections.reduce((count, group) => count + group.items.length, 0);

  const tabs: Array<{ id: 'all' | PantrySectionId; label: string }> = [
    { id: 'all', label: 'All Items' },
    ...sections.map((section) => ({ id: section.id, label: section.name })),
  ];

  const routeKnown = Boolean(
    assignment?.time && assignment.originCode && assignment.destinationCode
  );
  const serviceDate = formatServiceDate(assignment?.date);

  // Lines scoped to the passenger the board is serving, and the whole coach
  // order grouped by traveller for the rail.
  const activeItems = activePassengerId ? getPassengerItems(activePassengerId) : [];
  const parties = useMemo(
    () =>
      passengers
        .map((passenger) => ({
          passenger,
          items: cartItems.filter((line) => line.passengerId === passenger.id),
        }))
        .filter((group) => group.items.length > 0),
    [passengers, cartItems]
  );

  return (
    <div className="space-y-5 text-[#0B192C]">
      {/* Board heading and the live seat this order is addressed to. */}
      <div className="border border-[#0B192C]/12 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 bg-railAmber" aria-hidden="true" />
            <div>
              <h1 className="text-base font-bold uppercase tracking-wide sm:text-lg">
                At-Seat Catering &amp; Pantry
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500 font-mono">
                Trolley service to reserved seats on the active National Rail service. Every line is
                prepared in the galley and charged at the price shown.
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 divide-x divide-[#0B192C]/12 border border-[#0B192C]/12 text-[10px] font-mono sm:grid-cols-[auto_auto_auto] lg:w-auto">
            <div className="px-3 py-2">
              <div className="uppercase tracking-wider text-gray-500">Delivery seat</div>
              <div className="mt-0.5 whitespace-nowrap text-xs font-bold">
                {activePassenger
                  ? `${activePassenger.coach} / ${activePassenger.seat}`
                  : isSeatBound && assignment
                  ? `${assignment.coach} / ${assignment.seat}`
                  : 'Not bound'}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="uppercase tracking-wider text-gray-500">Booking ref</div>
              <div className="mt-0.5 whitespace-nowrap text-xs font-bold">
                {assignment?.pnr ?? '—'}
              </div>
            </div>
            <div className="col-span-2 border-t border-[#0B192C]/12 px-3 py-2 sm:col-span-1 sm:border-t-0">
              <div className="uppercase tracking-wider text-gray-500">Coach order</div>
              <div className="mt-0.5 whitespace-nowrap text-xs font-bold">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt from the last accepted order, kept until dismissed. */}
      {lastOrder && (
        <div className="flex flex-col gap-3 border border-emerald-600/30 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Order dispatched to{' '}
                {lastOrder.passengers.length > 1
                  ? `${lastOrder.passengers.length} passengers`
                  : `${lastOrder.passengers[0]?.coach ?? assignment?.coach}, Seat ${
                      lastOrder.passengers[0]?.seat ?? assignment?.seat ?? '—'
                    }`}
              </p>
              <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-emerald-800/80">
                {lastOrder.orderIds.join(' · ')} · {lastOrder.milestone}
                {lastOrder.concession
                  ? ` · £${lastOrder.concession.amount.toFixed(2)} First Class concession applied`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
            <span className="font-mono text-sm font-bold tabular-nums text-emerald-900">
              £{lastOrder.totalAmount.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={clearLastOrder}
              aria-label="Dismiss dispatched order"
              className="flex h-6 w-6 items-center justify-center text-emerald-800/60 hover:text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Service ribbon: the exact working the trolley is on. */}
      <div className="flex flex-col gap-2 border border-[#0B192C] bg-[#0B192C] px-4 py-3 font-mono text-[11px] tracking-wide text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold text-railAmber">SERVICE:</span>

          {assignmentLoading ? (
            <span className="text-gray-300">RESOLVING ACTIVE RESERVATION…</span>
          ) : routeKnown && assignment ? (
            <>
              <span className="font-bold">
                {assignment.time} {assignment.origin ?? assignment.originCode}{' '}
                <span className="font-normal text-gray-400">[{assignment.originCode}]</span>
              </span>
              <span className="text-railAmber" aria-hidden="true">
                ➔
              </span>
              <span className="font-bold">
                {assignment.destination ?? assignment.destinationCode}{' '}
                <span className="font-normal text-gray-400">[{assignment.destinationCode}]</span>
              </span>
              <span className="text-gray-500" aria-hidden="true">
                •
              </span>
              <span className="font-bold text-emerald-400">AT-SEAT DISPATCH ACTIVE</span>
            </>
          ) : (
            <>
              <span className="text-gray-300">NO ACTIVE RESERVATION</span>
              <span className="text-gray-500" aria-hidden="true">
                •
              </span>
              <span className="text-gray-400">AT-SEAT DISPATCH STANDBY</span>
            </>
          )}
        </div>

        {(serviceDate || activePassenger || (isSeatBound && assignment)) && (
          <div className="flex shrink-0 items-center gap-2 text-[10px] text-gray-300">
            {serviceDate && <span>{serviceDate}</span>}
            {serviceDate && (activePassenger || (isSeatBound && assignment)) && (
              <span className="text-gray-600">|</span>
            )}
            {activePassenger ? (
              <span className="font-bold text-railAmber">
                {activePassenger.coach} / {activePassenger.seat}
              </span>
            ) : (
              isSeatBound &&
              assignment && (
                <span className="font-bold text-railAmber">
                  {assignment.coach} / {assignment.seat}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* Passenger allocation ribbon: every traveller on the ticket, with the
          number of lines already assigned to them. */}
      {passengers.length > 0 && (
        <div className="border border-[#0B192C]/12 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0B192C]/12 bg-[#F8F9FA] px-4 py-2">
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-500">
              Allocate to passenger
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500">
              {passengers.length} on ticket · {itemCount}{' '}
              {itemCount === 1 ? 'item' : 'items'} allocated
            </span>
          </div>

          <div
            className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Passenger allocation"
          >
            {passengers.map((passenger, index) => {
              const isActive = passenger.id === activePassengerId;
              const allocated = getPassengerItems(passenger.id).reduce(
                (sum, line) => sum + line.quantity,
                0
              );

              return (
                <button
                  key={passenger.id}
                  type="button"
                  onClick={() => setActivePassenger(passenger.id)}
                  aria-pressed={isActive}
                  className={`flex min-w-[230px] flex-1 items-center gap-2.5 border-r border-[#0B192C]/12 px-3 py-2.5 text-left transition-colors last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C] ${
                    isActive
                      ? 'bg-[#0B192C] text-white'
                      : 'bg-white text-[#0B192C] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${
                      isActive ? 'border-railAmber' : 'border-[#0B192C]/35'
                    }`}
                  >
                    {isActive && <span className="h-1.5 w-1.5 bg-railAmber" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold leading-tight">
                      Passenger {index + 1}: {passenger.name}
                    </span>
                    <span
                      className={`mt-0.5 block font-mono text-[9px] uppercase tracking-wider ${
                        isActive ? 'text-gray-300' : 'text-gray-500'
                      }`}
                    >
                      {passenger.coach} · Seat {passenger.seat}
                    </span>
                  </span>

                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                      isActive
                        ? 'border-railAmber/50 text-railAmber'
                        : 'border-[#0B192C]/20 text-gray-500'
                    }`}
                  >
                    {allocated} {allocated === 1 ? 'item' : 'items'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Menu board */}
        <div className="overflow-hidden border border-[#0B192C]/12 bg-white shadow-sm">
          <div className="overflow-x-auto border-b border-[#0B192C]/12">
            <div className="flex min-w-max">
              {tabs.map((tab) => {
                const isActive = category === tab.id;
                const count = menu.filter((item) => matchesFilters(item, tab.id)).length;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    aria-pressed={isActive}
                    className={`whitespace-nowrap border-r border-[#0B192C]/12 px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors last:border-r-0 ${
                      isActive
                        ? 'bg-[#0B192C] text-white'
                        : 'bg-white text-gray-600 hover:bg-[#F8F9FA] hover:text-[#0B192C]'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`ml-2 font-mono text-[10px] ${
                        isActive ? 'text-railAmber' : 'text-gray-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0B192C]/12 bg-[#F8F9FA] px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
                Dietary
              </span>
              {DIETARY_FILTERS.map((tag) => {
                const isActive = dietary.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleDietary(tag)}
                    aria-pressed={isActive}
                    className={`flex items-center gap-1 border px-2 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors ${
                      isActive
                        ? 'border-[#0B192C] bg-[#0B192C] text-white'
                        : 'border-[#0B192C]/20 bg-white text-gray-600 hover:border-[#0B192C] hover:text-[#0B192C]'
                    }`}
                  >
                    {isActive && <Check className="h-3 w-3 text-railAmber" />}
                    {tag}
                  </button>
                );
              })}
            </div>

            <span className="font-mono text-[10px] tracking-wider text-gray-500">
              {visibleCount} OF {menu.length} LINES
            </span>
          </div>

          {visibleSections.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="font-mono text-xs text-gray-500">
                No lines on the trolley match {dietary.join(' and ')} in this category.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDietary([]);
                  setCategory('all');
                }}
                className="mt-3 text-[10px] font-mono uppercase tracking-wider text-[#0B192C] underline underline-offset-4 hover:text-slate-600"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div>
              {visibleSections.map(({ section, items }) => (
                <section key={section.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#0B192C]/10 px-4 py-2 sm:px-5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h2 className="text-[11px] font-bold uppercase tracking-wider">
                        {section.name}
                      </h2>
                      <span className="text-[10px] font-mono text-gray-500">
                        {section.serviceNote}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">
                      {items.length} {items.length === 1 ? 'line' : 'lines'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 bg-white p-3 sm:grid-cols-2 sm:p-4">
                    {items.map((item) => (
                      <PantryItemCard
                        key={item.id}
                        item={item}
                        draft={drafts[item.id] ?? 1}
                        inCart={
                          activeItems.find((line) => line.item.id === item.id)?.quantity ?? 0
                        }
                        passengerSeat={activePassenger?.seat ?? null}
                        addedQuantity={added?.id === item.id ? added.quantity : null}
                        canOrder={isSeatBound}
                        onDraftChange={(quantity) => changeDraft(item.id, quantity)}
                        onAdd={() => handleAdd(item)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Coach order: what the trolley has been asked to carry. */}
        <aside className="border border-[#0B192C]/12 bg-white shadow-sm xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <div className="flex items-center justify-between bg-[#0B192C] px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-3.5 w-3.5 text-railAmber" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider">Coach Order</h2>
            </div>
            <span className="border border-railAmber/50 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-railAmber">
              Draft
            </span>
          </div>

          <div className="space-y-1.5 border-b border-[#0B192C]/12 px-4 py-3 font-mono text-[10px]">
            <div className="flex justify-between gap-3">
              <span className="uppercase tracking-wider text-gray-500">Serving</span>
              <span className="font-bold">
                {activePassenger
                  ? `${activePassenger.coach} / ${activePassenger.seat}`
                  : isSeatBound && assignment
                  ? `${assignment.coach} / ${assignment.seat}`
                  : 'Not bound'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="uppercase tracking-wider text-gray-500">Booking</span>
              <span>{assignment?.pnr ?? '—'}</span>
            </div>
          </div>

          {cartItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <ShoppingBag className="mx-auto h-6 w-6 text-gray-300" />
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                {isSeatBound
                  ? 'No lines yet. Pick a passenger, set a quantity and add it.'
                  : 'No seat is bound. Book a journey and the trolley will follow your reservation.'}
              </p>
            </div>
          ) : (
            <div>
              {parties.map(({ passenger, items }) => (
                <div key={passenger.id} className="border-b border-[#0B192C]/10 last:border-b-0">
                  <div className="flex items-center justify-between gap-2 bg-[#F8F9FA] px-4 py-1.5">
                    <button
                      type="button"
                      onClick={() => setActivePassenger(passenger.id)}
                      className="min-w-0 text-left text-[9px] font-mono uppercase tracking-[0.16em] text-gray-500 hover:text-[#0B192C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C]"
                    >
                      <span className="truncate text-[#0B192C]">{passenger.name}</span> ·{' '}
                      {passenger.coach} {passenger.seat}
                    </button>
                    <span className="shrink-0 font-mono text-[9px] tabular-nums text-gray-500">
                      £{getPassengerTotal(passenger.id).toFixed(2)}
                    </span>
                  </div>

                  {items.map((line) => (
                    <div
                      key={`${line.passengerId}-${line.item.id}`}
                      className="px-4 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold leading-tight text-[#0B192C]">
                          {line.item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.item.id, line.passengerId)}
                          aria-label={`Remove ${line.item.name} for ${line.passengerName}`}
                          className="shrink-0 text-gray-400 hover:text-railRed"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-[#0B192C]/20">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(line.item.id, line.quantity - 1, line.passengerId)
                            }
                            aria-label={`Decrease ${line.item.name}`}
                            className="flex h-6 w-6 items-center justify-center text-[#0B192C] hover:bg-gray-100"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-[10px] font-mono font-bold tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(line.item.id, line.quantity + 1, line.passengerId)
                            }
                            disabled={line.quantity >= MAX_LINE_QUANTITY}
                            aria-label={`Increase ${line.item.name}`}
                            className="flex h-6 w-6 items-center justify-center text-[#0B192C] hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="text-[11px] font-mono font-bold tabular-nums">
                          £{(line.item.price * line.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end justify-between border-t border-[#0B192C]/12 px-4 py-3">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
                Combined · {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </div>
              <div className="text-[9px] font-mono text-gray-500">
                {parties.length} {parties.length === 1 ? 'passenger' : 'passengers'} · VAT included
              </div>
            </div>
            <div className="font-mono text-xl font-bold tabular-nums">
              £{combinedTotal.toFixed(2)}
            </div>
          </div>

          <div className="border-t border-[#0B192C]/12 bg-[#F8F9FA] px-4 py-3">
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              disabled={!isSeatBound || cartItems.length === 0}
              className={`flex h-10 w-full items-center justify-center gap-2 border text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C] ${
                isSeatBound && cartItems.length > 0
                  ? 'border-[#0B192C] bg-[#0B192C] text-white hover:bg-slate-800'
                  : 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
              }`}
            >
              <ShoppingBag
                className={`h-3.5 w-3.5 ${
                  isSeatBound && cartItems.length > 0 ? 'text-railAmber' : 'text-gray-400'
                }`}
              />
              Review &amp; Dispatch
            </button>

            <p className="mt-1.5 text-center text-[9px] font-mono uppercase tracking-wider text-gray-500">
              Delivery point confirmed at checkout
            </p>
          </div>
        </aside>
      </div>

      <PantryCartDrawer open={checkoutOpen} onClose={closeCheckout} />
    </div>
  );
}
