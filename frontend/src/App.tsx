import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Train, Clock, CheckCircle2, RefreshCw, LogOut, UtensilsCrossed
} from 'lucide-react';
import { JourneyMatrix, FareOption } from './components/JourneyMatrix';
import { ServiceTimetable } from './components/ServiceTimetable';
import { CarriageSeatPicker } from './components/CarriageSeatPicker';
import { TicketSummary } from './components/TicketSummary';
import { AuthScreen } from './components/AuthScreen';
import { ProfilePanel } from './components/ProfilePanel';
import { TicketWallet } from './components/TicketWallet';
import { PantryMenu } from './components/PantryMenu';
import { createBooking, BookingResponse, Station, User, BookingPassenger } from './lib/api';
import type { CateringOrder } from './data/pantryMenu';
import { useAuth } from './lib/auth';
import { PantryProvider, PantryReservation, usePantry } from './context/PantryContext';

type BookingStep = 'matrix' | 'seats' | 'dining-prompt' | 'dining' | 'checkout' | 'confirmation';

/**
 * The authenticated application shell.
 *
 * Rendered with `key={user.id}` so that signing in as a different passenger
 * remounts it from scratch. Without that, the selected tab and any in-flight
 * booking or issued PNR would survive a sign-out and leak into the next
 * session.
 */
function RailReservationApp({ user }: { user: User }) {
  const [selectedFare, setSelectedFare] = useState<{
    fare: FareOption;
    route: { origin: Station; destination: Station; date: string; time: string };
  } | null>(null);
  const [selectedPassengers, setSelectedPassengers] = useState<BookingPassenger[] | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [bookingStep, setBookingStep] = useState<BookingStep>('matrix');

  // The pantry follows the seat the passenger is actually holding: an issued
  // pass first, then the seats chosen for the booking in progress. When there
  // is neither, the provider falls back to the next confirmed wallet trip.
  const pantryReservation = useMemo<PantryReservation | undefined>(() => {
    const party = booking?.booking.passengers?.length
      ? booking.booking.passengers
      : selectedPassengers ?? [];
    const passenger = party[0];
    if (!passenger) return undefined;

    const issued = booking?.booking ?? null;
    const route = selectedFare?.route;

    return {
      coach: passenger.coach,
      seat: passenger.seat,
      passengerName: passenger.name,
      passengers: party,
      pnr: booking?.pnr,
      origin: issued?.origin ?? route?.origin.name,
      originCode: issued?.originCode ?? route?.origin.code,
      destination: issued?.destination ?? route?.destination.name,
      destinationCode: issued?.destinationCode ?? route?.destination.code,
      date: issued?.date ?? route?.date,
      time: issued?.time ?? route?.time,
      fareType: issued?.fareType ?? selectedFare?.fare.type,
      fareName: issued?.fareName ?? selectedFare?.fare.name,
    };
  }, [booking, selectedPassengers, selectedFare]);

  // A dispatched batch rewrites the reservation's catering array on the
  // server; mirror that authoritative array and food totals onto the pass held in this tab.
  const handleReservationOrdersUpdated = useCallback((orders: CateringOrder[]) => {
    const foodTotal = Math.round(orders.reduce((sum, order) => sum + order.totalAmount, 0) * 100) / 100;
    setBooking((current) =>
      current
        ? {
            ...current,
            booking: {
              ...current.booking,
              cateringOrders: orders,
              foodTotal,
              totalFare: Math.round((current.booking.price + foodTotal) * 100) / 100,
            },
          }
        : current
    );
  }, []);

  return (
    <PantryProvider
      reservation={pantryReservation}
      onReservationOrdersUpdated={handleReservationOrdersUpdated}
    >
      <RailReservationShell
        user={user}
        selectedFare={selectedFare}
        setSelectedFare={setSelectedFare}
        selectedPassengers={selectedPassengers}
        setSelectedPassengers={setSelectedPassengers}
        partySize={partySize}
        setPartySize={setPartySize}
        booking={booking}
        setBooking={setBooking}
        bookingStep={bookingStep}
        setBookingStep={setBookingStep}
      />
    </PantryProvider>
  );
}

interface RailReservationShellProps {
  user: User;
  selectedFare: {
    fare: FareOption;
    route: { origin: Station; destination: Station; date: string; time: string };
  } | null;
  setSelectedFare: React.Dispatch<
    React.SetStateAction<{
      fare: FareOption;
      route: { origin: Station; destination: Station; date: string; time: string };
    } | null>
  >;
  selectedPassengers: BookingPassenger[] | null;
  setSelectedPassengers: React.Dispatch<React.SetStateAction<BookingPassenger[] | null>>;
  partySize: number;
  setPartySize: React.Dispatch<React.SetStateAction<number>>;
  booking: BookingResponse | null;
  setBooking: React.Dispatch<React.SetStateAction<BookingResponse | null>>;
  bookingStep: BookingStep;
  setBookingStep: React.Dispatch<React.SetStateAction<BookingStep>>;
}

function RailReservationShell({
  user,
  selectedFare,
  setSelectedFare,
  selectedPassengers,
  setSelectedPassengers,
  partySize,
  setPartySize,
  booking,
  setBooking,
  bookingStep,
  setBookingStep,
}: RailReservationShellProps) {
  const { logout } = useAuth();
  const {
    buildPassengerOrderPayloads,
    deliveryMilestone,
    clearCart,
    clearLastOrder,
    refreshWallet,
  } = usePantry();

  const [activeTab, setActiveTab] = useState<
    'planner' | 'departures' | 'tickets' | 'dining' | 'status' | 'profile'
  >('planner');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [timeTicker, setTimeTicker] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    // Ensure light mode is permanently set on document
    document.documentElement.classList.remove('dark');
    localStorage.setItem('uk_rail_theme', 'light');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // On narrow tablets the header rail scrolls instead of wrapping; keep the
  // tab the passenger is actually on inside the visible strip.
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const scrollActiveIntoView = () => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
      if (!nav || !active) return;

      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      if (left < nav.scrollLeft) nav.scrollLeft = left;
      else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
    };

    scrollActiveIntoView();
    window.addEventListener('resize', scrollActiveIntoView);
    return () => window.removeEventListener('resize', scrollActiveIntoView);
  }, [activeTab]);

  const handleAuthorizePayment = async () => {
    if (!selectedFare || !selectedPassengers) return;

    setIsSubmitting(true);
    setBookingError(null);

    try {
      const passengerOrders = buildPassengerOrderPayloads();
      const result = await createBooking({
        origin: selectedFare.route.origin.name,
        originCode: selectedFare.route.origin.code,
        destination: selectedFare.route.destination.name,
        destinationCode: selectedFare.route.destination.code,
        date: selectedFare.route.date,
        time: selectedFare.route.time,
        fareType: selectedFare.fare.type,
        passengers: selectedPassengers,
        ...(passengerOrders.length > 0
          ? { catering: { deliveryMilestone, passengerOrders } }
          : {}),
      });

      clearCart();
      clearLastOrder();
      refreshWallet();
      setBooking(result);
      setBookingStep('confirmation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setBookingError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToMatrix = () => {
    clearCart();
    clearLastOrder();
    setBookingStep('matrix');
    setBooking(null);
    setSelectedPassengers(null);
    setBookingError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
      <div className="min-h-screen bg-[#F8F9FA] text-[#0B192C] flex flex-col font-sans transition-colors duration-200 print-sheet">
        {/* Live Status Ticker */}
        <div className="bg-[#0B192C] text-white px-4 py-2.5 text-xs font-mono tracking-wider flex items-center justify-between border-b border-white/10 overflow-hidden no-print print:hidden">
          <div className="flex items-center space-x-3 whitespace-nowrap overflow-hidden">
            <div className="flex items-center space-x-2 shrink-0">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping inline-block"></span>
              <span className="bg-railRed text-white px-1.5 py-0.5 text-[10px] font-bold rounded-none uppercase">Live Feed</span>
            </div>
            <div className="flex space-x-8 animate-[marquee_25s_linear_infinite]">
              <span className="text-railAmber font-semibold">NORTHERN LINE: MINOR DELAYS (SIGNAL FAULT NEAR CREWE)</span>
              <span className="text-gray-400">•</span>
              <span>WEST COAST MAIN LINE: GOOD SERVICE • ALL AVANTI & LNER SERVICES RUNNING ON SCHEDULE</span>
              <span className="text-gray-400">•</span>
              <span className="text-emerald-400">EAST COAST MAIN LINE: ON TIME • PEAK CAPACITY NORMAL</span>
            </div>
          </div>
          <div className="flex items-center space-x-4 pl-4 shrink-0">
            <span className="text-gray-300 flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-railAmber" /> {timeTicker} BST</span>
            <span className="text-gray-400 hidden sm:inline">SYS_ID: UKR-9984-A</span>
          </div>
        </div>

        {/* Main Navigation Header */}
        <header className="bg-white border-b border-[#0B192C]/12 sticky top-0 z-30 transition-colors no-print print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 bg-[#0B192C] text-white flex items-center justify-center font-bold text-lg rounded-none border border-[#0B192C]">
                  <Train className="w-5 h-5 text-railAmber" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm sm:text-base leading-tight tracking-tight uppercase whitespace-nowrap text-[#0B192C]">National Rail Enquiries</span>
                  <span className="text-[10px] sm:text-[11px] text-gray-500 font-mono tracking-tight whitespace-nowrap">UK TRANS-NATIONAL TRANSIT AUTHORITY</span>
                </div>
              </div>
            </div>

            <nav ref={navRef} className="hidden md:flex items-center space-x-1 relative min-w-0 overflow-x-auto xl:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: 'planner', label: 'Journey Planner & Fares', short: 'Planner' },
                { id: 'departures', label: 'Live Departures & Arrivals', short: 'Departures' },
                { id: 'tickets', label: 'My Tickets & Wallet', short: 'Tickets' },
                { id: 'dining', label: 'At-Seat Dining', short: 'Dining' },
                { id: 'status', label: 'Network Status', short: 'Status' },
                { id: 'profile', label: 'Passenger Profile', short: 'Profile' }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    data-tab={tab.id}
                    title={tab.label}
                    onClick={() => {
                      // Clicking the planner while already there starts a new
                      // search. Coming back from another tab keeps the pass on
                      // screen so a dining order placed mid-journey can be
                      // checked against the ticket it belongs to.
                      if (tab.id === 'planner' && activeTab === 'planner') {
                        setBookingStep('matrix');
                      }
                      setActiveTab(tab.id as any);
                    }}
                    className={`shrink-0 whitespace-nowrap xl:shrink xl:whitespace-normal px-3 py-2 text-sm font-medium transition-colors relative ${
                      isActive
                        ? 'text-[#0B192C] font-bold'
                        : 'text-gray-600 hover:text-[#0B192C]'
                    }`}
                  >
                    <span className="xl:hidden">{tab.short}</span>
                    <span className="hidden xl:inline">{tab.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabRibbon"
                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0B192C]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center space-x-4">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-semibold text-[#0B192C]">{user.name.toUpperCase()}</span>
                <span className="text-[10px] font-mono text-gray-500">CRS LIVE // 256-BIT SSL</span>
              </div>
              <div
                onClick={() => setActiveTab('profile')}
                title="View Passenger Profile"
                className="w-8 h-8 rounded-full bg-[#0B192C] text-railAmber border border-[#0B192C] flex items-center justify-center font-bold text-xs cursor-pointer hover:opacity-90 transition-opacity"
              >
                {user.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="text-gray-500 hover:text-[#0B192C] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full print-sheet">
          {activeTab === 'planner' && (
            <div className="space-y-6">
              {bookingStep === 'matrix' && (
                <div id="fare-matrix-section" className="space-y-6">
                  <JourneyMatrix
                    railcardType={user.railcard.type}
                    railcardDiscount={user.railcard.discountPercent}
                    onSelectFare={(fare, route, passengers) => {
                      clearCart();
                      clearLastOrder();
                      setSelectedFare({ fare, route });
                      setPartySize(passengers);
                      setSelectedPassengers(null);
                      setBooking(null);
                      setBookingError(null);
                      setBookingStep('seats');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                </div>
              )}

              {bookingStep === 'seats' && selectedFare && (
                <CarriageSeatPicker
                  passengerCount={partySize}
                  leadPassengerName={user.name}
                  initialPassengers={selectedPassengers}
                  date={selectedFare.route.date}
                  time={selectedFare.route.time}
                  onConfirmSeats={(passengers) => {
                    setSelectedPassengers(passengers);
                    setBookingError(null);
                    setBookingStep('dining-prompt');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onBack={() => setBookingStep('matrix')}
                />
              )}

              {bookingStep === 'dining-prompt' && selectedFare && selectedPassengers && (
                <div className="max-w-3xl mx-auto bg-white border border-[#0B192C]/18 p-6 sm:p-8 shadow-sm space-y-6 text-[#0B192C]">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#0B192C]/12 pb-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-railNavy text-white flex items-center justify-center border border-railNavy shrink-0">
                        <UtensilsCrossed className="w-5 h-5 text-railAmber" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 bg-railAmber inline-block" aria-hidden="true" />
                          <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide text-railNavy">
                            GALLEY &amp; PANTRY CATERING SERVICE
                          </h2>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          Fresh meals &amp; refreshments delivered directly to your reserved seat(s).
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBookingStep('seats')}
                      className="text-xs font-mono text-gray-600 hover:text-railNavy underline"
                    >
                      ← Back to Seat Selection
                    </button>
                  </div>

                  {/* Reserved seat manifest summary */}
                  <div className="border border-[#0B192C]/12 bg-[#F8F9FA] p-4 space-y-3 font-mono text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0B192C]/12 pb-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        Reserved Seats Confirmed for Delivery
                      </span>
                      <span className="font-bold text-railNavy">
                        {selectedFare.route.origin.code} → {selectedFare.route.destination.code} ·{' '}
                        {selectedFare.route.date} @ {selectedFare.route.time}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedPassengers.map((passenger, index) => (
                        <div
                          key={`${passenger.coach}-${passenger.seat}`}
                          className="flex items-center justify-between gap-2 border border-[#0B192C]/12 bg-white px-3 py-2"
                        >
                          <span className="truncate font-sans font-semibold text-railNavy">
                            P{index + 1} · {passenger.name}
                          </span>
                          <span className="shrink-0 font-bold text-emerald-700">
                            {passenger.coach.split('(')[0].trim()} · {passenger.seat}
                          </span>
                        </div>
                      ))}
                    </div>

                    {selectedFare.fare.type === 'First Class' &&
                      selectedFare.fare.name === 'First Class Advance' && (
                        <p className="text-[10px] uppercase tracking-wider text-emerald-700 pt-1">
                          First Class Advance privilege active: 10% at-seat catering concession applies automatically.
                        </p>
                      )}
                  </div>

                  {/* Prompt Actions: Option A & Option B */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBookingStep('dining');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex-1 bg-railNavy hover:bg-slate-800 text-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider border border-railNavy transition-colors flex items-center justify-center gap-2"
                    >
                      <span>ADD AT-SEAT DINING ➔</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearCart();
                        clearLastOrder();
                        setBookingStep('checkout');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex-1 bg-white hover:bg-[#F8F9FA] text-railNavy px-6 py-3.5 text-xs font-bold uppercase tracking-wider border border-[#0B192C]/18 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>SKIP &amp; PROCEED TO CHECKOUT ➔</span>
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 'dining' && selectedFare && selectedPassengers && (
                <PantryMenu
                  onConfirmSelections={() => {
                    setBookingStep('checkout');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onSkipDining={() => {
                    clearCart();
                    clearLastOrder();
                    setBookingStep('checkout');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onBackToPrompt={() => {
                    setBookingStep('dining-prompt');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {bookingStep === 'checkout' && selectedFare && selectedPassengers && (
                <TicketSummary
                  fare={selectedFare.fare}
                  route={selectedFare.route}
                  passengers={selectedPassengers}
                  unitPrice={selectedFare.fare.price}
                  cardholderName={user.name}
                  railcardLabel={
                    user.railcard.discountPercent > 0
                      ? `${user.railcard.type} · ${user.railcard.discountPercent}% off`
                      : undefined
                  }
                  isSubmitting={isSubmitting}
                  bookingError={bookingError}
                  onConfirmAndPay={handleAuthorizePayment}
                  onBackToDining={() => {
                    setBookingStep('dining');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onBackToSeats={() => {
                    setBookingStep('seats');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onNewBooking={handleResetToMatrix}
                />
              )}

              {bookingStep === 'confirmation' && selectedFare && booking && (
                <TicketSummary
                  fare={selectedFare.fare}
                  route={selectedFare.route}
                  passengers={booking.booking.passengers}
                  unitPrice={booking.booking.unitPrice}
                  pnr={booking.pnr}
                  createdAt={booking.booking.createdAt}
                  message={booking.message}
                  initialCateringOrders={booking.booking.cateringOrders}
                  foodTotal={booking.booking.foodTotal}
                  totalFare={booking.booking.totalFare}
                  onNewBooking={handleResetToMatrix}
                />
              )}
            </div>
          )}

          {activeTab === 'departures' && (
            <ServiceTimetable
              railcardDiscount={user.railcard.discountPercent}
              onSelectService={() => {
                setActiveTab('planner');
                setBookingStep('matrix');
              }}
            />
          )}

          {activeTab === 'tickets' && <TicketWallet />}

          {activeTab === 'dining' && (
            <PantryMenu
              {...(selectedPassengers && !booking
                ? {
                    onConfirmSelections: () => {
                      setActiveTab('planner');
                      setBookingStep('checkout');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    },
                    onSkipDining: () => {
                      clearCart();
                      clearLastOrder();
                      setActiveTab('planner');
                      setBookingStep('checkout');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    },
                  }
                : {})}
            />
          )}

          {activeTab === 'status' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#0B192C]/12 p-6 space-y-6 text-[#0B192C]">
                <div className="flex items-center justify-between pb-4 border-b border-[#0B192C]/12">
                  <div>
                    <h2 className="font-bold text-sm tracking-wide uppercase">National Rail Network Health & Status</h2>
                    <p className="text-xs text-gray-500 font-mono">System-wide telegraphic update and engineering work notices</p>
                  </div>
                  <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 font-bold">ALL SYSTEMS OPERATIONAL</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border border-[#0B192C]/12 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase">West Coast Main Line</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    </div>
                    <p className="text-xs text-gray-600">Good service operating between London Euston, Birmingham, Manchester and Glasgow.</p>
                  </div>
                  <div className="p-4 border border-[#0B192C]/12 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase">East Coast Main Line</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    </div>
                    <p className="text-xs text-gray-600">Normal operations across LNER services between King's Cross, York and Edinburgh.</p>
                  </div>
                  <div className="p-4 border border-[#0B192C]/12 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase">Great Western Route</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    </div>
                    <p className="text-xs text-gray-600">Minor signal maintenance near Reading. Expect 5-10 minute advisory delays.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#0B192C]/12 flex items-center justify-between text-xs font-mono text-gray-500">
                  <span>Network Protocol: NR-TELEGRAPH-2026</span>
                  <span>Automatic Refresh Every 30s</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && <ProfilePanel />}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-[#0B192C]/12 mt-auto transition-colors text-gray-600 no-print print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
            <div>
              <span className="font-bold text-[#0B192C]">UK TRANS-NATIONAL TRANSIT AUTHORITY</span> • National Rail Enquiries System
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-emerald-600 flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> 256-Bit SSL Encrypted</span>
              <span>API v4.2.0</span>
              <span>Terms & Conditions</span>
            </div>
          </div>
        </footer>
      </div>
  );
}

/**
 * Root component: shows the passenger gateway while signed out, and the
 * application shell once a session exists.
 *
 * The shell is keyed by user id so that each sign-in starts from a clean
 * slate — no tab selection, in-flight booking or issued PNR can carry over
 * from the previous passenger.
 */
export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-[#0B192C]">
        <div className="text-center space-y-3">
          <RefreshCw className="w-6 h-6 mx-auto animate-spin" />
          <p className="text-xs font-mono uppercase tracking-wider">Verifying passenger session…</p>
        </div>
      </div>
    );
  }

  if (!user) return <PassengerGateway />;

  return <RailReservationApp key={user.id} user={user} />;
}

/** Signed-out shell: status band, branding, the auth form and the footer. */
function PassengerGateway() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0B192C] flex flex-col font-sans">
      <div className="bg-[#0B192C] text-white px-4 py-2.5 text-xs font-mono tracking-wider flex items-center justify-between border-b border-white/10">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping inline-block"></span>
          <span className="bg-railRed text-white px-1.5 py-0.5 text-[10px] font-bold uppercase">Secure</span>
          <span className="text-gray-300">NATIONAL RAIL PASSENGER GATEWAY</span>
        </div>
        <span className="text-gray-400">SYS_ID: UKR-AUTH-01</span>
      </div>

      <div className="flex-grow flex items-center justify-center px-4 py-10">
        <div className="w-full">
          <div className="max-w-lg mx-auto mb-6 flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-[#0B192C] text-white flex items-center justify-center font-bold text-lg border border-[#0B192C]">
              <Train className="w-5 h-5 text-railAmber" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight uppercase">National Rail Enquiries</span>
              <span className="text-[10px] text-gray-500 font-mono tracking-tight">
                UK TRANS-NATIONAL TRANSIT AUTHORITY
              </span>
            </div>
          </div>
          <AuthScreen />
        </div>
      </div>

      <footer className="bg-white border-t border-[#0B192C]/12 text-gray-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] font-mono">
          <span className="font-bold text-[#0B192C]">UK TRANS-NATIONAL TRANSIT AUTHORITY</span>
          <span className="flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            Secure Passenger Session
          </span>
        </div>
      </footer>
    </div>
  );
}
