import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Luggage, Bike, User, Zap, ArrowRight, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { BookingPassenger, getOccupiedSeats } from '../lib/api';

interface Seat {
  id: string;
  number: string;
  row: number;
  col: 'A' | 'B' | 'C' | 'D';
  type: 'Window' | 'Aisle' | 'Table';
  status: 'available' | 'reserved' | 'selected' | 'accessible';
  power: boolean;
  facing: 'forward' | 'backward';
}

interface Coach {
  id: string;
  name: string;
  type: 'Standard' | 'First' | 'Quiet';
  description: string;
  layout: '2+2' | '2+1';
  seats: Seat[];
}

interface SeatAssignment {
  coach: Coach;
  seat: Seat;
}

const COACHES: Coach[] = [
  {
    id: 'coach-a',
    name: 'Coach A (Quiet Zone)',
    type: 'Quiet',
    description: 'No mobile phone calls, reduced lighting, silent working zone with USB power.',
    layout: '2+2',
    seats: [
      { id: 'a-1a', number: '1A', row: 1, col: 'A', type: 'Window', status: 'reserved', power: true, facing: 'forward' },
      { id: 'a-1b', number: '1B', row: 1, col: 'B', type: 'Aisle', status: 'reserved', power: true, facing: 'forward' },
      { id: 'a-1c', number: '1C', row: 1, col: 'C', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'a-1d', number: '1D', row: 1, col: 'D', type: 'Window', status: 'available', power: true, facing: 'forward' },

      { id: 'a-2a', number: '2A', row: 2, col: 'A', type: 'Window', status: 'available', power: true, facing: 'forward' },
      { id: 'a-2b', number: '2B', row: 2, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'a-2c', number: '2C', row: 2, col: 'C', type: 'Table', status: 'reserved', power: true, facing: 'forward' },
      { id: 'a-2d', number: '2D', row: 2, col: 'D', type: 'Table', status: 'available', power: true, facing: 'forward' },

      { id: 'a-3a', number: '3A', row: 3, col: 'A', type: 'Window', status: 'available', power: true, facing: 'backward' },
      { id: 'a-3b', number: '3B', row: 3, col: 'B', type: 'Aisle', status: 'reserved', power: true, facing: 'backward' },
      { id: 'a-3c', number: '3C', row: 3, col: 'C', type: 'Table', status: 'available', power: true, facing: 'backward' },
      { id: 'a-3d', number: '3D', row: 3, col: 'D', type: 'Table', status: 'available', power: true, facing: 'backward' },

      { id: 'a-4a', number: '4A', row: 4, col: 'A', type: 'Window', status: 'available', power: true, facing: 'backward' },
      { id: 'a-4b', number: '4B', row: 4, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'backward' },
      { id: 'a-4c', number: '4C', row: 4, col: 'C', type: 'Aisle', status: 'available', power: true, facing: 'backward' },
      { id: 'a-4d', number: '4D', row: 4, col: 'D', type: 'Window', status: 'reserved', power: true, facing: 'backward' }
    ]
  },
  {
    id: 'coach-b',
    name: 'Coach B (Luggage & Standard)',
    type: 'Standard',
    description: 'Standard class seating with overhead luggage racks and large item bays.',
    layout: '2+2',
    seats: [
      { id: 'b-1a', number: '12A', row: 1, col: 'A', type: 'Window', status: 'available', power: true, facing: 'forward' },
      { id: 'b-1b', number: '12B', row: 1, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'b-1c', number: '12C', row: 1, col: 'C', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'b-1d', number: '12D', row: 1, col: 'D', type: 'Window', status: 'reserved', power: true, facing: 'forward' },

      { id: 'b-2a', number: '14A', row: 2, col: 'A', type: 'Window', status: 'available', power: true, facing: 'forward' },
      { id: 'b-2b', number: '14B', row: 2, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'b-2c', number: '14C', row: 2, col: 'C', type: 'Table', status: 'available', power: true, facing: 'forward' },
      { id: 'b-2d', number: '14D', row: 2, col: 'D', type: 'Table', status: 'available', power: true, facing: 'forward' },

      { id: 'b-3a', number: '15A', row: 3, col: 'A', type: 'Window', status: 'reserved', power: true, facing: 'backward' },
      { id: 'b-3b', number: '15B', row: 3, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'backward' },
      { id: 'b-3c', number: '15C', row: 3, col: 'C', type: 'Table', status: 'reserved', power: true, facing: 'backward' },
      { id: 'b-3d', number: '15D', row: 3, col: 'D', type: 'Table', status: 'available', power: true, facing: 'backward' },

      { id: 'b-4a', number: '16A', row: 4, col: 'A', type: 'Window', status: 'available', power: true, facing: 'backward' },
      { id: 'b-4b', number: '16B', row: 4, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'backward' },
      { id: 'b-4c', number: '16C', row: 4, col: 'C', type: 'Aisle', status: 'available', power: true, facing: 'backward' },
      { id: 'b-4d', number: '16D', row: 4, col: 'D', type: 'Window', status: 'available', power: true, facing: 'backward' }
    ]
  },
  {
    id: 'coach-c',
    name: 'Coach C (Accessible / Cycle Space)',
    type: 'Standard',
    description: 'Priority seating, wheelchair accessible space, and secure bicycle storage bay.',
    layout: '2+2',
    seats: [
      { id: 'c-1a', number: '21A', row: 1, col: 'A', type: 'Window', status: 'accessible', power: true, facing: 'forward' },
      { id: 'c-1b', number: '21B', row: 1, col: 'B', type: 'Aisle', status: 'accessible', power: true, facing: 'forward' },
      { id: 'c-1c', number: '21C', row: 1, col: 'C', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'c-1d', number: '21D', row: 1, col: 'D', type: 'Window', status: 'available', power: true, facing: 'forward' },

      { id: 'c-2a', number: '22A', row: 2, col: 'A', type: 'Window', status: 'available', power: true, facing: 'forward' },
      { id: 'c-2b', number: '22B', row: 2, col: 'B', type: 'Aisle', status: 'reserved', power: true, facing: 'forward' },
      { id: 'c-2c', number: '22C', row: 2, col: 'C', type: 'Table', status: 'available', power: true, facing: 'forward' },
      { id: 'c-2d', number: '22D', row: 2, col: 'D', type: 'Table', status: 'available', power: true, facing: 'forward' }
    ]
  },
  {
    id: 'coach-k',
    name: 'Coach K (First Class Lounge)',
    type: 'First',
    description: 'First Class 2+1 seating with wider recline, complimentary hot meals and Wi-Fi.',
    layout: '2+1',
    seats: [
      { id: 'k-1a', number: '1A', row: 1, col: 'A', type: 'Window', status: 'reserved', power: true, facing: 'forward' },
      { id: 'k-1b', number: '1B', row: 1, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'forward' },
      { id: 'k-1c', number: '1C', row: 1, col: 'C', type: 'Window', status: 'available', power: true, facing: 'forward' },

      { id: 'k-2a', number: '2A', row: 2, col: 'A', type: 'Window', status: 'available', power: true, facing: 'forward' },
      { id: 'k-2b', number: '2B', row: 2, col: 'B', type: 'Aisle', status: 'reserved', power: true, facing: 'forward' },
      { id: 'k-2c', number: '2C', row: 2, col: 'C', type: 'Table', status: 'available', power: true, facing: 'forward' },

      { id: 'k-3a', number: '3A', row: 3, col: 'A', type: 'Window', status: 'available', power: true, facing: 'backward' },
      { id: 'k-3b', number: '3B', row: 3, col: 'B', type: 'Aisle', status: 'available', power: true, facing: 'backward' },
      { id: 'k-3c', number: '3C', row: 3, col: 'C', type: 'Table', status: 'available', power: true, facing: 'backward' }
    ]
  }
];

interface CarriageSeatPickerProps {
  passengerCount: number;
  leadPassengerName: string;
  /** Travel date and departure, used to look up seats already sold. */
  date: string;
  time: string;
  onConfirmSeats: (passengers: BookingPassenger[]) => void;
  onBack: () => void;
}

/** Normalised identity of one physical seat on a departure. */
function seatKey(coach: string, seat: string): string {
  return `${coach.trim().toLowerCase()}|${seat.trim().toLowerCase()}`;
}

export function CarriageSeatPicker({
  passengerCount,
  leadPassengerName,
  date,
  time,
  onConfirmSeats,
  onBack,
}: CarriageSeatPickerProps) {
  const [selectedCoachId, setSelectedCoachId] = useState<string>('coach-b');
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Seats sold by other passengers on this departure, loaded from the API.
  const [soldSeats, setSoldSeats] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setInventory('loading');

    getOccupiedSeats(date, time)
      .then((res) => {
        if (cancelled) return;
        setSoldSeats(new Set(res.seats.map((seat) => seatKey(seat.coach, seat.seat))));
        setInventory('ready');
      })
      .catch(() => {
        if (!cancelled) setInventory('error');
      });

    return () => {
      cancelled = true;
    };
  }, [date, time]);

  /** A seat is unavailable if the map says so or the departure sold it. */
  const isSeatSold = (coach: Coach, seat: Seat) =>
    seat.status === 'reserved' || soldSeats.has(seatKey(coach.name, seat.number));

  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: passengerCount }, (_, index) => (index === 0 ? leadPassengerName : ''))
  );

  const [assignments, setAssignments] = useState<(SeatAssignment | null)[]>(() =>
    Array.from({ length: passengerCount }, () => null)
  );

  const currentCoach = COACHES.find((coach) => coach.id === selectedCoachId) ?? COACHES[0];

  const ownerIndex = (seatId: string) => assignments.findIndex((a) => a?.seat.id === seatId);

  const handleSeatClick = (coach: Coach, seat: Seat) => {
    if (isSeatSold(coach, seat)) return;

    const holder = ownerIndex(seat.id);
    if (holder === activeIndex) {
      setAssignments(assignments.map((a, i) => (i === holder ? null : a)));
      return;
    }

    const next = assignments.map((a) => (a?.seat.id === seat.id ? null : a));
    next[activeIndex] = { coach, seat };
    setAssignments(next);

    for (let step = 1; step <= passengerCount; step++) {
      const candidate = (activeIndex + step) % passengerCount;
      if (!next[candidate]) {
        setActiveIndex(candidate);
        return;
      }
    }
  };

  const allocatedCount = assignments.filter(Boolean).length;
  const missingSeats = passengerCount - allocatedCount;
  const namesComplete = names.every((name) => name.trim().length >= 2);
  const canConfirm = missingSeats === 0 && namesComplete;

  const handleConfirm = () => {
    if (!canConfirm) return;

    onConfirmSeats(
      assignments.map((assignment, index) => ({
        name: names[index].trim(),
        coach: assignment!.coach.name,
        seat: assignment!.seat.number,
      }))
    );
  };

  return (
    <div className="space-y-6 text-[#0B192C]">
      <div className="bg-white border border-[#0B192C]/12 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#0B192C]/12">
          <div>
            <h2 className="font-bold text-sm tracking-wide uppercase">Interactive Carriage & Seat Allocation</h2>
            <p className="text-xs text-gray-500 font-mono">
              Allocating {passengerCount} {passengerCount === 1 ? 'seat' : 'seats'} for this journey
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-xs font-mono text-gray-600 hover:text-[#0B192C] underline"
          >
            ← Back to Fare Options
          </button>
        </div>

        {/* Coach Navigation Tabs Ribbon */}
        <div className="flex flex-wrap gap-2 pt-4">
          {COACHES.map((coach) => (
            <button
              key={coach.id}
              onClick={() => setSelectedCoachId(coach.id)}
              className={`px-4 py-2.5 text-xs font-mono font-bold uppercase transition-colors border ${
                selectedCoachId === coach.id
                  ? 'bg-[#0B192C] text-railAmber border-[#0B192C] shadow-sm'
                  : 'bg-gray-50 text-gray-700 border-[#0B192C]/12 hover:bg-gray-100'
              }`}
            >
              {coach.name}
            </button>
          ))}
        </div>

        {/* Train Direction & Infrastructure Banner */}
        <div className="mt-4 p-4 bg-gray-50 border border-[#0B192C]/12 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono text-gray-500 uppercase">COACH SPECIFICATION & AMENITIES</span>
            <div className="text-sm font-bold text-[#0B192C]">{currentCoach.name}</div>
            <p className="text-xs text-gray-600">{currentCoach.description}</p>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono text-gray-600">
            <span className="flex items-center"><Luggage className="w-3.5 h-3.5 mr-1 text-gray-500" /> Luggage Bays</span>
            <span>•</span>
            <span className="flex items-center"><Bike className="w-3.5 h-3.5 mr-1 text-gray-500" /> Cycle Bay</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 border border-emerald-200">
              ◀ Direction of Travel: Towards Manchester Piccadilly
            </span>
          </div>
        </div>

        {/* Passenger Manifest */}
        <div className="mt-4 border border-[#0B192C]/12 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-gray-500 uppercase font-bold">
              Passenger Manifest • {allocatedCount}/{passengerCount} seats allocated
            </span>
            <span className="text-[10px] font-mono text-gray-500 uppercase text-right leading-relaxed">
              <span className="block">Highlight a passenger, then tap a seat on the map below</span>
              <span className={`block ${inventory === 'error' ? 'text-red-700' : 'text-gray-500'}`}>
                {inventory === 'loading' && 'Checking live seat inventory.'}
                {inventory === 'error' && 'Live inventory unavailable - seat verified at checkout'}
                {inventory === 'ready' &&
                  (soldSeats.size > 0
                    ? `${soldSeats.size} seat${soldSeats.size === 1 ? '' : 's'} already reserved on this departure`
                    : 'All mapped seats available on this departure')}
              </span>
            </span>
          </div>

          {Array.from({ length: passengerCount }).map((_, index) => {
            const assignment = assignments[index];
            const isActive = activeIndex === index;

            return (
              <div
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`p-3 border flex flex-col md:flex-row md:items-center gap-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'border-[#0B192C] ring-2 ring-railAmber bg-amber-50/30'
                    : 'border-[#0B192C]/12 bg-gray-50 hover:border-[#0B192C]'
                }`}
              >
                <div className="flex items-center space-x-2 md:w-28">
                  <span
                    className={`w-9 h-9 flex items-center justify-center font-mono text-xs font-bold border ${
                      isActive
                        ? 'bg-[#0B192C] text-railAmber border-[#0B192C]'
                        : 'bg-white text-[#0B192C] border-[#0B192C]/12'
                    }`}
                  >
                    P{index + 1}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-gray-500">
                    {index === 0 ? 'Lead' : `Guest ${index}`}
                  </span>
                </div>

                <div className="flex-1">
                  {index === 0 ? (
                    <div className="px-3 py-2 bg-gray-100 border border-[#0B192C]/12 font-mono text-xs text-[#0B192C]">
                      {names[0]} <span className="text-gray-500">· account holder</span>
                    </div>
                  ) : (
                    <input
                      value={names[index]}
                      onChange={(e) =>
                        setNames(names.map((n, i) => (i === index ? e.target.value : n)))
                      }
                      onFocus={() => setActiveIndex(index)}
                      maxLength={80}
                      placeholder={`Full name of passenger ${index + 1}`}
                      className="w-full px-3 py-2 bg-white border border-[#0B192C]/20 font-mono text-xs text-[#0B192C] focus:outline-none focus:border-[#0B192C]"
                    />
                  )}
                </div>

                <div className="md:w-64 font-mono text-xs text-[#0B192C]">
                  {assignment ? (
                    <span className="text-emerald-700 font-bold">
                      {assignment.coach.name.split('(')[0].trim()} — Seat{' '}
                      <strong>{assignment.seat.number}</strong> ({assignment.seat.type}, {assignment.seat.facing})
                    </span>
                  ) : (
                    <span className="text-amber-700">Awaiting seat selection…</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ergonomic Seat Grid Layout */}
        <div className="mt-6 border border-[#0B192C]/12 p-6 bg-slate-950 text-white relative overflow-hidden shadow-inner">
          <div className="absolute top-3 right-4 font-mono text-[10px] text-slate-400">
            LAYOUT: {currentCoach.layout} • 2+2 / 2+1 ERGONOMIC SEATING
          </div>

          <div className="text-center font-mono text-xs text-railAmber mb-6 uppercase tracking-wider flex items-center justify-center space-x-2">
            <span>◀ Front of Train (Locomotive Direction)</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentCoach.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl mx-auto space-y-4 relative"
            >
              {Array.from(new Set(currentCoach.seats.map(s => s.row))).map((rowIndex) => {
                const rowSeats = currentCoach.seats.filter(s => s.row === rowIndex);
                // Group into left and right blocks for aisle gap
                const leftSeats = rowSeats.filter(s => s.col === 'A' || s.col === 'B');
                const rightSeats = rowSeats.filter(s => s.col === 'C' || s.col === 'D');

                return (
                  <div key={rowIndex} className="flex items-center justify-between bg-slate-900/90 p-3.5 border border-slate-800">
                    <div className="font-mono text-xs text-slate-400 w-12 text-center font-bold">
                      Row {rowIndex}
                    </div>

                    {/* Left Side (e.g. A & B) */}
                    <div className="flex items-center space-x-2">
                      {leftSeats.map((seat) => {
                        const holder = ownerIndex(seat.id);
                        const isAllocated = holder >= 0;
                        const isReserved = isSeatSold(currentCoach, seat);
                        const isAccessible = seat.status === 'accessible';

                        return (
                          <motion.button
                            key={seat.id}
                            whileHover={{ scale: isReserved ? 1 : 1.05 }}
                            whileTap={{ scale: isReserved ? 1 : 0.95 }}
                            disabled={isReserved}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            onClick={() => handleSeatClick(currentCoach, seat)}
                            className={`w-16 h-14 flex flex-col items-center justify-center font-mono text-xs border transition-all relative ${
                              isReserved
                                ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed line-through'
                                : isAllocated
                                ? 'bg-railAmber text-[#0B192C] border-white shadow-lg font-bold'
                                : isAccessible
                                ? 'bg-blue-900/50 text-blue-200 border-blue-400 hover:border-white'
                                : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-center space-x-1">
                              <span className="font-bold text-xs">{seat.number}</span>
                              {seat.power && <Zap className="w-2.5 h-2.5 text-railAmber" />}
                            </div>
                            <span className="text-[10px] opacity-80">
                              {isAllocated ? `P${holder + 1}` : seat.type}
                            </span>
                            <span className="text-[8px] text-slate-400">
                              {seat.facing === 'forward' ? '▲ Fwd' : '▼ Bwd'}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Center Aisle Marker */}
                    <div className="px-4 text-center font-mono text-[10px] text-slate-600 uppercase tracking-widest border-x border-slate-800 py-2">
                      Aisle
                    </div>

                    {/* Right Side (e.g. C & D) */}
                    <div className="flex items-center space-x-2">
                      {rightSeats.map((seat) => {
                        const holder = ownerIndex(seat.id);
                        const isAllocated = holder >= 0;
                        const isReserved = isSeatSold(currentCoach, seat);
                        const isAccessible = seat.status === 'accessible';

                        return (
                          <motion.button
                            key={seat.id}
                            whileHover={{ scale: isReserved ? 1 : 1.05 }}
                            whileTap={{ scale: isReserved ? 1 : 0.95 }}
                            disabled={isReserved}
                            onMouseEnter={() => setHoveredSeat(seat)}
                            onMouseLeave={() => setHoveredSeat(null)}
                            onClick={() => handleSeatClick(currentCoach, seat)}
                            className={`w-16 h-14 flex flex-col items-center justify-center font-mono text-xs border transition-all relative ${
                              isReserved
                                ? 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed line-through'
                                : isAllocated
                                ? 'bg-railAmber text-[#0B192C] border-white shadow-lg font-bold'
                                : isAccessible
                                ? 'bg-blue-900/50 text-blue-200 border-blue-400 hover:border-white'
                                : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-center space-x-1">
                              <span className="font-bold text-xs">{seat.number}</span>
                              {seat.power && <Zap className="w-2.5 h-2.5 text-railAmber" />}
                            </div>
                            <span className="text-[10px] opacity-80">
                              {isAllocated ? `P${holder + 1}` : seat.type}
                            </span>
                            <span className="text-[8px] text-slate-400">
                              {seat.facing === 'forward' ? '▲ Fwd' : '▼ Bwd'}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Seat Hover Inspector */}
          <div className="mt-4 min-h-[32px] text-center font-mono text-xs text-railAmber flex items-center justify-center space-x-2">
            {hoveredSeat ? (
              <span>
                Seat {hoveredSeat.number} • Position: {hoveredSeat.type} • Orientation: {hoveredSeat.facing} • USB Power: Included
              </span>
            ) : (
              <span className="text-slate-500">Hover over any available seat to view power and orientation specs</span>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-300">
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 bg-slate-900 border border-slate-700"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 bg-railAmber border border-white"></div>
              <span>Selected (Transit Amber)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 bg-blue-900/50 border border-blue-400"></div>
              <span>Accessible / Priority</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 bg-slate-800/40 border border-slate-800"></div>
              <span>Reserved</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-3.5 h-3.5 text-railAmber" />
              <span>USB Power Socket</span>
            </div>
          </div>
        </div>

        {/* Selection Basket & Confirmation */}
        <div className="mt-6 pt-6 border-t border-[#0B192C]/12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-gray-500 uppercase font-bold">ALLOCATION SUMMARY</div>
            <div className="text-sm font-bold text-[#0B192C] font-mono">
              {allocatedCount} of {passengerCount} {passengerCount === 1 ? 'seat' : 'seats'} successfully reserved
            </div>
            {!canConfirm && (
              <div className="text-[11px] font-mono text-amber-700 flex items-center">
                <User className="w-3 h-3 mr-1" />
                {missingSeats > 0
                  ? `Select ${missingSeats} more ${missingSeats === 1 ? 'seat' : 'seats'} to continue`
                  : 'Enter the full name of every passenger to continue'}
              </div>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full md:w-auto bg-[#0B192C] hover:bg-slate-800 text-white px-8 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border border-[#0B192C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-4 h-4 text-railAmber" />
            <span>
              Confirm {passengerCount} {passengerCount === 1 ? 'Seat' : 'Seats'} & Proceed to Payment
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-railAmber" />
          </button>
        </div>
      </div>
    </div>
  );
}
