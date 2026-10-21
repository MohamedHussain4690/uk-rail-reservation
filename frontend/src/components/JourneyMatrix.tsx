import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Train, Clock, ArrowRight, ArrowLeftRight, MapPin, Sparkles,
  ShieldCheck, CheckCircle2, Ticket, Users, AlertCircle, Info,
  ChevronRight, Tag, Percent, Calendar as CalendarIcon, Sunrise, Sunset,
  ChevronLeft, RefreshCw
} from 'lucide-react';
import { getStations, getFares, Station, FareQuote } from '../lib/api';
import { toLocalIsoDate } from '../lib/date';

export interface FareOption {
  type: 'Advance' | 'Off-Peak' | 'Anytime' | 'First Class';
  name: string;
  description: string;
  rules: string;
  price: number;
  originalPrice: number;
  available: boolean;
  splitTicketSaving?: string;
  seatIncluded: boolean;
}

interface JourneyMatrixProps {
  onSelectFare: (
    fare: FareOption,
    routeDetails: { origin: Station; destination: Station; date: string; time: string },
    passengers: number
  ) => void;
  /** Railcard discount percentage from the authenticated passenger profile. */
  railcardDiscount?: number;
  railcardType?: string;
}

export function JourneyMatrix({ onSelectFare, railcardDiscount = 0, railcardType = 'None' }: JourneyMatrixProps) {
  // Stations come from the backend (/api/stations) rather than a local copy.
  const [stations, setStations] = useState<Station[]>([]);
  const [origin, setOrigin] = useState<Station | null>(null);
  const [destination, setDestination] = useState<Station | null>(null);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [stationsError, setStationsError] = useState<string | null>(null);

  const loadStations = useCallback(() => {
    setStationsLoading(true);
    setStationsError(null);
    getStations()
      .then((data) => {
        setStations(data);
        // Keep any existing choice when reloading, otherwise default to the
        // first two stations returned by the API.
        setOrigin((prev) => prev ?? data[0] ?? null);
        setDestination((prev) => prev ?? data[1] ?? null);
      })
      .catch((err: Error) => setStationsError(err.message))
      .finally(() => setStationsLoading(false));
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const today = new Date();
  const todayIso = toLocalIsoDate(today);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(30);
  const [passengers, setPassengers] = useState(1);
  const [selectedFareType, setSelectedFareType] = useState<string | null>(null);

  // Fares are priced by the server from its own table and the linked railcard,
  // so the figure on the card is exactly what checkout will charge.
  const [quotes, setQuotes] = useState<FareQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  // Calendar View State
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const formattedTimeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
  const isPeakTime = (selectedHour >= 6 && selectedHour <= 9) || (selectedHour >= 16 && selectedHour <= 19);

  // The concession is owned by the passenger profile, not this screen.
  const hasRailcard = railcardType !== 'None';

  const loadQuotes = useCallback(() => {
    if (!origin || !destination) return;
    setQuotesLoading(true);
    setQuotesError(null);
    getFares(origin.code, destination.code)
      .then((data) => setQuotes(data.fares))
      .catch((err: Error) => {
        setQuotes([]);
        setQuotesError(err.message);
      })
      .finally(() => setQuotesLoading(false));
  }, [origin, destination]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  /** Pair the planner's descriptive copy with the server's authoritative price. */
  const buildFare = (
    type: FareOption['type'],
    presentation: Pick<
      FareOption,
      'description' | 'rules' | 'available' | 'splitTicketSaving' | 'seatIncluded'
    >
  ): FareOption => {
    const quote = quotes.find((entry) => entry.type === type);
    return {
      type,
      name: quote?.name ?? type,
      price: quote?.price ?? 0,
      originalPrice: quote?.originalPrice ?? 0,
      ...presentation,
    };
  };

  const fares: FareOption[] = [
    buildFare('Advance', {
      description: `Stated train (${formattedTimeString}) only. Lowest available price on this service.`,
      rules: 'Non-refundable. Seat reservation compulsory.',
      available: true,
      splitTicketSaving: 'Split at Crewe saves £14.20',
      seatIncluded: true,
    }),
    buildFare('Off-Peak', {
      description: 'Flexible travel on any off-peak service (after 09:30).',
      rules: 'Refundable with £10 admin fee. No seat reservation needed.',
      available: true,
      splitTicketSaving: 'Split at Rugby saves £8.50',
      seatIncluded: false,
    }),
    buildFare('Anytime', {
      description: 'Maximum flexibility. Travel on any train all day.',
      rules: 'Fully flexible. Fully refundable before departure.',
      available: true,
      seatIncluded: false,
    }),
    buildFare('First Class', {
      description: 'First class carriage, complimentary hot meals, drinks & Wi-Fi.',
      rules: 'Stated train only. Quiet coach access included.',
      available: true,
      splitTicketSaving: 'Split ticketing saves £28.40',
      seatIncluded: true,
    }),
  ];

  const faresReady = !quotesLoading && !quotesError && quotes.length > 0;

  const handleSwapStations = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSelectFareClick = (fare: FareOption) => {
    if (!origin || !destination || !faresReady) return;
    setSelectedFareType(fare.type);
    setTimeout(() => {
      onSelectFare(fare, { origin, destination, date: selectedDate, time: formattedTimeString }, passengers);
    }, 350);
  };

  // Generate days for the current calendar month view
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const maxDateObj = new Date();
  maxDateObj.setMonth(maxDateObj.getMonth() + 3);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  if (stationsLoading) {
    return (
      <div className="bg-white border border-[#0B192C]/12 p-12 text-center space-y-3 text-[#0B192C]">
        <RefreshCw className="w-6 h-6 mx-auto animate-spin" />
        <p className="text-sm font-mono font-bold">Loading National Rail CRS station database…</p>
        <p className="text-xs text-gray-500 font-mono">GET /api/stations</p>
      </div>
    );
  }

  if (stationsError) {
    return (
      <div className="bg-white border border-red-300 p-12 text-center space-y-4 text-[#0B192C]">
        <AlertCircle className="w-8 h-8 mx-auto text-red-600" />
        <div className="space-y-1">
          <h3 className="font-bold text-sm uppercase tracking-wide">Station Database Unavailable</h3>
          <p className="text-xs text-gray-600 font-mono">{stationsError}</p>
          <p className="text-xs text-gray-500">
            Start the backend with <code className="font-mono bg-gray-100 px-1">npm run dev</code> in{' '}
            <code className="font-mono bg-gray-100 px-1">UK_Rail_Reservation/backend</code>.
          </p>
        </div>
        <button
          onClick={loadStations}
          className="bg-[#0B192C] hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider inline-flex items-center space-x-2 border border-[#0B192C]"
        >
          <RefreshCw className="w-3.5 h-3.5 text-railAmber" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!origin || !destination) {
    return (
      <div className="bg-white border border-[#0B192C]/12 p-12 text-center space-y-2 text-[#0B192C]">
        <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
        <h3 className="font-bold text-sm uppercase tracking-wide">No Stations Available</h3>
        <p className="text-xs text-gray-500 font-mono">
          The API returned an empty station list, so no journey can be planned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[#0B192C]/12 p-6 shadow-sm text-[#0B192C]"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#0B192C]/12">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-[#0B192C] rounded-full"></span>
            <h2 className="font-bold text-sm tracking-wide uppercase text-[#0B192C]">UK Journey Planner & Modern Calendar Selector</h2>
          </div>
          <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 border border-[#0B192C]/12">
            CRS ROUTING v5.2 • 90-DAY TARIFF WINDOW
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Origin Station</label>
            <select
              value={origin.code}
              onChange={(e) => {
                const found = stations.find(s => s.code === e.target.value);
                if (found) setOrigin(found);
              }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-[#0B192C]/12 text-sm font-medium focus:outline-none focus:border-[#0B192C] font-mono text-[#0B192C]"
            >
              {stations.map(s => (
                <option key={s.code} value={s.code} className="text-[#0B192C] bg-white">{s.name} [{s.code}]</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex justify-center pb-0.5">
            <button
              onClick={handleSwapStations}
              title="Swap Origin and Destination"
              className="p-2.5 bg-gray-50 border border-[#0B192C]/12 hover:bg-gray-100 text-[#0B192C] transition-colors flex items-center space-x-1"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="text-xs font-mono font-bold">SWAP</span>
            </button>
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Destination Station</label>
            <select
              value={destination.code}
              onChange={(e) => {
                const found = stations.find(s => s.code === e.target.value);
                if (found) setDestination(found);
              }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-[#0B192C]/12 text-sm font-medium focus:outline-none focus:border-[#0B192C] font-mono text-[#0B192C]"
            >
              {stations.map(s => (
                <option key={s.code} value={s.code} className="text-[#0B192C] bg-white">{s.name} [{s.code}]</option>
              ))}
            </select>
          </div>
        </div>

        {/* Modern Creative Calendar Grid Picker */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5 text-railAmber" />
              Interactive Travel Calendar (Up to 3 Months Advance)
            </label>
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="text-gray-600">Selected Date: <strong className="text-[#0B192C]">{selectedDate}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gray-50 border border-[#0B192C]/12">
            {/* Modern Calendar Widget */}
            <div className="bg-white border border-[#0B192C]/12 p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#0B192C]/12 pb-3">
                <h3 className="font-bold font-mono text-sm text-[#0B192C]">
                  {monthNames[currentMonth]} {currentYear}
                </h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-[#0B192C] transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-[#0B192C] transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-gray-500 font-bold uppercase">
                <div>Su</div>
                <div>Mo</div>
                <div>Tu</div>
                <div>We</div>
                <div>Th</div>
                <div>Fr</div>
                <div>Sa</div>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-9"></div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateObj = new Date(currentYear, currentMonth, dayNum);
                  const isoStr = toLocalIsoDate(dateObj);
                  const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const isBeyondMax = dateObj > maxDateObj;
                  const isDisabled = isPast || isBeyondMax;
                  const isSelected = selectedDate === isoStr;
                  const isToday = isoStr === todayIso;

                  return (
                    <motion.button
                      whileHover={{ scale: isDisabled ? 1 : 1.1 }}
                      whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                      key={isoStr}
                      disabled={isDisabled}
                      onClick={() => setSelectedDate(isoStr)}
                      className={`h-9 flex flex-col items-center justify-center font-mono text-xs transition-all ${
                        isDisabled
                          ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#0B192C] text-railAmber font-bold shadow-md ring-2 ring-railAmber'
                          : isToday
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                          : 'bg-white text-[#0B192C] border border-gray-100 hover:border-[#0B192C]'
                      }`}
                    >
                      <span>{dayNum}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Quick Horizon Buttons & Details */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase text-gray-500 font-bold">Quick Horizon Selections</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: 'Next Weekend', days: 5 },
                    { label: 'In 30 Days', days: 30 },
                    { label: 'In 60 Days', days: 60 },
                    { label: 'In 90 Days (Max)', days: 89 }
                  ].map((item) => {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + item.days);
                    const isoStr = toLocalIsoDate(targetDate);
                    const isSelected = selectedDate === isoStr;
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          setSelectedDate(isoStr);
                          setCurrentMonth(targetDate.getMonth());
                          setCurrentYear(targetDate.getFullYear());
                        }}
                        className={`p-2.5 border text-xs font-mono font-bold transition-all text-left flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#0B192C] text-white border-[#0B192C]'
                            : 'bg-white text-[#0B192C] border-[#0B192C]/12 hover:border-[#0B192C]'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className={`text-[10px] mt-1 ${isSelected ? 'text-railAmber' : 'text-gray-500'}`}>{isoStr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-white border border-[#0B192C]/12 text-xs font-mono text-gray-600">
                <div>Selected Date: <strong className="text-[#0B192C]">{selectedDate}</strong></div>
                <div className="text-[10px] text-emerald-600 mt-1 font-bold">✓ Valid for Advance & Off-Peak National Rail Tariffs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Analog Clock / Precision Time Picker */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-railAmber" />
              Precision Clock & Departure Time Selector
            </label>
            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className={`px-2 py-0.5 font-bold uppercase text-[10px] ${isPeakTime ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900'}`}>
                {isPeakTime ? 'PEAK TARIFF' : 'OFF-PEAK TARIFF'}
              </span>
              <span className="text-[#0B192C] font-bold text-sm bg-gray-100 px-3 py-1 border border-[#0B192C]/12">
                {formattedTimeString}
              </span>
            </div>
          </div>

          <div className="p-5 bg-gray-50 border border-[#0B192C]/12 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Clock Face Simulation / Dial */}
            <div className="flex flex-col items-center justify-center p-4 bg-white border border-[#0B192C]/12 shadow-inner relative">
              <div className="w-36 h-36 rounded-full border-2 border-[#0B192C] relative flex items-center justify-center font-mono font-bold text-xs">
                <div className="absolute top-1 text-[10px] text-gray-500">12</div>
                <div className="absolute bottom-1 text-[10px] text-gray-500">06</div>
                <div className="absolute left-2 text-[10px] text-gray-500">09</div>
                <div className="absolute right-2 text-[10px] text-gray-500">03</div>

                {/* Clock Hands Representation */}
                <div
                  className="absolute w-1 bg-[#0B192C] h-12 origin-bottom bottom-1/2 transition-transform duration-300"
                  style={{ transform: `rotate(${(selectedHour % 12) * 30 + selectedMinute * 0.5}deg)` }}
                ></div>
                <div
                  className="absolute w-0.5 bg-railAmber h-14 origin-bottom bottom-1/2 transition-transform duration-300"
                  style={{ transform: `rotate(${selectedMinute * 6}deg)` }}
                ></div>
                <div className="w-3 h-3 bg-[#0B192C] rounded-full z-10"></div>
              </div>
              <div className="mt-3 text-xs font-mono text-gray-600">
                Selected Service: <strong className="text-[#0B192C]">{formattedTimeString}</strong> ({isPeakTime ? 'Peak Hours' : 'Off-Peak Hours'})
              </div>
            </div>

            {/* Hour & Minute Sliders / Steppers */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-gray-600 uppercase font-bold">Hour (05:00 - 23:00)</span>
                  <span className="font-bold text-base text-[#0B192C] bg-white px-3 py-1 border border-[#0B192C]/12">{String(selectedHour).padStart(2, '0')} hrs</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={23}
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Number(e.target.value))}
                  className="w-full accent-[#0B192C] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-gray-400">
                  <span>05:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#0B192C]/12">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-gray-600 uppercase font-bold">Minute Interval</span>
                  <span className="font-bold text-base text-[#0B192C] bg-white px-3 py-1 border border-[#0B192C]/12">{String(selectedMinute).padStart(2, '0')} min</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 15, 30, 45].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedMinute(m)}
                      className={`py-2 text-xs font-mono font-bold border transition-colors ${
                        selectedMinute === m
                          ? 'bg-[#0B192C] text-white border-[#0B192C]'
                          : 'bg-white text-gray-700 border-[#0B192C]/12 hover:bg-gray-100'
                      }`}
                    >
                      :{String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Railcard & Passenger Row */}
        <div className="mt-6 pt-4 border-t border-[#0B192C]/12 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-mono">RAILCARD:</span>
              <span
                className={`px-2.5 py-1 border font-mono text-xs font-bold ${
                  hasRailcard
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-gray-50 text-gray-600 border-[#0B192C]/12'
                }`}
              >
                {hasRailcard ? `${railcardType.toUpperCase()} · LINKED` : 'NO RAILCARD LINKED'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-mono">PASSENGERS:</span>
              <select
                value={passengers}
                onChange={(e) => setPassengers(Number(e.target.value))}
                className="bg-gray-50 border border-[#0B192C]/12 px-2.5 py-1 text-xs font-mono font-bold text-[#0B192C]"
              >
                <option value={1} className="text-[#0B192C] bg-white">1 Adult</option>
                <option value={2} className="text-[#0B192C] bg-white">2 Adults</option>
                <option value={3} className="text-[#0B192C] bg-white">3 Adults</option>
                <option value={4} className="text-[#0B192C] bg-white">4 Adults</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-emerald-600 font-mono">
            <Percent className="w-3.5 h-3.5" />
            <span>{hasRailcard ? `${railcardDiscount}% Railcard Discount Applied Automatically` : 'Add a railcard to save 33% on fares'}</span>
          </div>
        </div>
      </motion.div>

      {/* Split-Ticketing Recommendation Banner */}
      <div className="bg-amber-50 border border-amber-300 p-4 flex items-center justify-between text-[#0B192C]">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-amber-200 border border-amber-400 text-amber-900 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4 text-amber-800" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Split-Ticketing Algorithm Active</h4>
            <p className="text-xs text-amber-800">Our engine detected a split at <strong className="font-mono">Crewe [CRE]</strong> for <strong className="font-mono">{selectedDate} @ {formattedTimeString}</strong> that reduces your fare by <strong className="font-mono">£18.40</strong> with zero seat changes required.</p>
          </div>
        </div>
        <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-2 py-1 font-bold border border-amber-400 uppercase">
          Guaranteed Connection
        </span>
      </div>

      {quotesError && (
        <div className="bg-white border border-red-300 p-4 flex items-center justify-between text-[#0B192C]">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">Fare Engine Unavailable</h4>
              <p className="text-xs text-gray-600 font-mono">{quotesError}</p>
            </div>
          </div>
          <button
            onClick={loadQuotes}
            className="bg-[#0B192C] hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center space-x-2 border border-[#0B192C]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-railAmber" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Fare Matrix Comparative Ribbon */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-[#0B192C]">Comparative Fare Matrix : {origin.name} ({origin.code}) to {destination.name} ({destination.code})</h3>
            <p className="text-xs text-gray-500 font-mono">Select a fare category to proceed with seat reservation and secure checkout.</p>
          </div>
          <span className="text-xs font-mono text-gray-500">Horizon Date: {selectedDate} @ {formattedTimeString}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {fares.map((fare) => {
            const isSelected = selectedFareType === fare.type;
            const adjustedPrice = fare.price * passengers;
            const originalTotal = fare.originalPrice * passengers;
            return (
              <motion.div
                key={fare.type}
                animate={{
                  scale: isSelected ? 1.03 : 1,
                  opacity: selectedFareType && !isSelected ? 0.5 : 1
                }}
                transition={{ duration: 0.25 }}
                className={`bg-white border p-5 flex flex-col justify-between transition-all shadow-sm relative group text-[#0B192C] ${
                  isSelected ? 'border-railAmber ring-2 ring-railAmber shadow-xl' : 'border-[#0B192C]/12 hover:border-[#0B192C]'
                }`}
              >
                {fare.type === 'Advance' && (
                  <div className="absolute -top-2.5 right-4 bg-[#0B192C] text-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                    Best Value
                  </div>
                )}

                <div className="space-y-3">
                  <div className="border-b border-[#0B192C]/12 pb-3">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{fare.type} TARIFF</span>
                    <h4 className="font-bold text-base text-[#0B192C]">{fare.name}</h4>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">{fare.description}</p>

                  <div className="p-2.5 bg-gray-50 border border-[#0B192C]/12 text-[11px] font-mono text-gray-700 space-y-1">
                    <div>• {fare.rules}</div>
                    <div>• {fare.seatIncluded ? '✓ Seat reservation included' : '○ Optional seat reservation'}</div>
                  </div>

                  {fare.splitTicketSaving && (
                    <div className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 p-1.5 font-medium">
                      ✨ {fare.splitTicketSaving}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-[#0B192C]/12 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Total Fare</span>
                    <div className="text-right">
                      {faresReady ? (
                        <>
                          {hasRailcard && (
                            <span className="text-xs font-mono text-gray-400 line-through mr-2">£{originalTotal.toFixed(2)}</span>
                          )}
                          <span className="text-2xl font-bold font-mono text-[#0B192C]">£{adjustedPrice.toFixed(2)}</span>
                          {passengers > 1 && (
                            <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                              {passengers} × £{fare.price.toFixed(2)} per passenger
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-sm font-mono text-gray-400">
                          {quotesLoading ? 'Pricing…' : 'Unavailable'}
                        </span>
                      )}
                    </div>
                  </div>

                  <motion.button
                    whileHover={faresReady ? { scale: 1.02 } : undefined}
                    whileTap={faresReady ? { scale: 0.98 } : undefined}
                    onClick={() => handleSelectFareClick(fare)}
                    disabled={!faresReady}
                    className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border transition-colors ${
                      faresReady
                        ? 'bg-[#0B192C] hover:bg-slate-800 text-white border-[#0B192C]'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    <span>{isSelected ? 'Selected...' : faresReady ? 'Select & Book' : 'Awaiting Fares'}</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${faresReady ? 'text-railAmber' : 'text-gray-400'}`} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
