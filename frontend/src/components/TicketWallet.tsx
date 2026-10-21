import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket, RefreshCw, AlertCircle, Download, Ban, MapPin, Calendar, Clock, Armchair,
} from 'lucide-react';
import { getBookings, cancelBooking, Booking } from '../lib/api';

/** "2h 14m" / "14m" — how long a cancelled pass has left on screen. */
function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function TicketWallet() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The interval is created once, so it reads the newest list through a ref.
  const bookingsRef = useRef<Booking[]>(bookings);
  bookingsRef.current = bookings;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getBookings()
      .then(setBookings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tick the countdowns, and refresh the moment a cancelled pass runs out so it
  // disappears without waiting for a manual Refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      const stamp = Date.now();
      setNow(stamp);

      const expired = bookingsRef.current.some(
        (booking) => booking.removalAt && new Date(booking.removalAt).getTime() <= stamp
      );
      if (expired) load();
    }, 30000);

    return () => clearInterval(timer);
  }, [load]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    setError(null);
    try {
      await cancelBooking(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#0B192C]/12 p-12 text-center space-y-3 text-[#0B192C]">
        <RefreshCw className="w-6 h-6 mx-auto animate-spin" />
        <p className="text-sm font-mono font-bold">Retrieving your e-ticket wallet…</p>
        <p className="text-xs text-gray-500 font-mono">GET /api/bookings</p>
      </div>
    );
  }

  const active = bookings.filter((b) => b.status === 'CONFIRMED');
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#0B192C]/12 p-6 text-[#0B192C]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#0B192C]/12">
          <div>
            <h2 className="font-bold text-sm tracking-wide uppercase">Active E-Ticket Wallet</h2>
            <p className="text-xs text-gray-500 font-mono">
              Stored digital passes ready for automatic ticket barrier scanning
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-1 border border-[#0B192C]/12">
              {active.length} ACTIVE
              {cancelled.length > 0 && ` · ${cancelled.length} CANCELLED`} / {bookings.length} TOTAL
            </span>
            <button
              onClick={load}
              className="text-xs font-mono text-gray-600 hover:text-[#0B192C] underline flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-300 p-3 text-[11px] font-mono text-red-800 flex items-start space-x-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="p-12 text-center space-y-2 border border-dashed border-[#0B192C]/20 bg-gray-50">
            <Ticket className="w-8 h-8 mx-auto text-gray-400" />
            <h3 className="font-bold text-sm uppercase tracking-wide">No Tickets in Wallet</h3>
            <p className="text-xs text-gray-500 font-mono">
              Complete a booking from the Journey Planner to see your pass here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bookings.map((booking) => {
              const isCancelled = booking.status === 'CANCELLED';
              const passengers = booking.passengers ?? [];
              const removalAt = booking.removalAt ? new Date(booking.removalAt).getTime() : 0;
              const remaining = removalAt ? Math.max(0, removalAt - now) : 0;
              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`border border-[#0B192C]/12 bg-gradient-to-br from-white to-gray-50 p-5 space-y-4 shadow-sm relative overflow-hidden ${
                    isCancelled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#0B192C]/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>

                  <div className="flex items-center justify-between border-b border-[#0B192C]/12 pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 bg-[#0B192C] text-white flex items-center justify-center font-bold text-xs">
                        UK
                      </div>
                      <span className="font-bold text-xs uppercase tracking-wider">National Rail Pass</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 font-bold ${
                        isCancelled
                          ? 'bg-red-100 text-red-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isCancelled ? 'CANCELLED' : 'VALIDATED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block">ORIGIN</span>
                      <span className="font-bold text-sm">{booking.origin}</span>
                      <span className="text-[10px] text-gray-500 block">[{booking.originCode}]</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">DESTINATION</span>
                      <span className="font-bold text-sm">{booking.destination}</span>
                      <span className="text-[10px] text-gray-500 block">[{booking.destinationCode}]</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">DATE & TIME</span>
                      <span className="font-bold">{booking.date} @ {booking.time}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">SEAT ASSIGNMENT</span>
                      <span className="font-bold text-emerald-600">
                        {passengers.length === 1
                          ? `${passengers[0].coach.split('(')[0].trim()}, Seat ${passengers[0].seat}`
                          : `${passengers.length} seats · ${passengers.map((p) => p.seat).join(', ')}`}
                      </span>
                    </div>
                  </div>

                  {passengers.length > 1 && (
                    <div className="border border-[#0B192C]/12 bg-white p-3 space-y-1 font-mono text-[10px]">
                      <div className="text-gray-500 uppercase tracking-wider">Passenger Manifest</div>
                      {passengers.map((passenger, index) => (
                        <div key={index} className="flex justify-between gap-2">
                          <span className="truncate">{index + 1}. {passenger.name}</span>
                          <span className="font-bold whitespace-nowrap">
                            {passenger.coach.split('(')[0].trim()} · {passenger.seat}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 border-t border-[#0B192C]/12 pt-3">
                    <span className="flex items-center">
                      <Ticket className="w-3 h-3 mr-1" />
                      {booking.fareName}
                    </span>
                    <span className="font-bold text-[#0B192C]">
                      £{booking.price.toFixed(2)}
                      {passengers.length > 1 && (
                        <span className="text-gray-400 font-normal"> · {passengers.length} pax</span>
                      )}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <div className="font-mono text-[10px] text-gray-500">REF: {booking.pnr}</div>
                    <div className="bg-[#0B192C] text-white px-3 py-1 font-mono text-[11px] font-bold tracking-widest">
                      ||||| | |||| ||| ||
                    </div>
                  </div>

                  {isCancelled ? (
                    <div className="border border-red-300 bg-red-50 p-2.5 font-mono text-[10px] text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1.5 shrink-0" />
                        Cancelled passes clear themselves out after 3 hours
                      </span>
                      <span className="font-bold whitespace-nowrap">
                        {remaining > 0 ? `Vanishes in ${formatRemaining(remaining)}` : 'Vanishing…'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                      className="w-full border border-[#0B192C]/20 hover:border-red-400 hover:bg-red-50 text-[#0B192C] hover:text-red-800 py-2 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      {cancellingId === booking.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                      <span>{cancellingId === booking.id ? 'Cancelling…' : 'Cancel Booking'}</span>
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-[#0B192C]/12 flex items-center justify-between text-[10px] font-mono text-gray-500">
          <span className="flex items-center">
            <MapPin className="w-3 h-3 mr-1" />
            Passes stored against your authenticated passenger account
          </span>
          <span className="flex items-center space-x-3">
            <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> Live from MongoDB</span>
            <span className="flex items-center"><Armchair className="w-3 h-3 mr-1" /> Seat reservations enforced</span>
            <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Cancelled passes vanish after 3 hours</span>
          </span>
        </div>
      </div>
    </div>
  );
}
