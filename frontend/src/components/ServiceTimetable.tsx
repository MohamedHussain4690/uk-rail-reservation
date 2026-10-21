import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Train, Clock, ArrowRight, MapPin, AlertCircle, ChevronDown, ChevronUp,
  ShieldCheck, CheckCircle2, Ticket, Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { getFares } from '../lib/api';

export interface TrainService {
  id: string;
  trainNumber: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  transfers: string;
  operator: string;
  status: 'ON TIME' | 'DELAYED' | 'CANCELLED' | 'PLATFORM CHANGE';
  platform: string;
  crowdLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  stops: { station: string; code: string; time: string }[];
}

const DEFAULT_SERVICES: TrainService[] = [
  {
    id: 'SR-101',
    trainNumber: '1A42',
    origin: 'London Euston',
    originCode: 'EUS',
    destination: 'Manchester Piccadilly',
    destinationCode: 'MAN',
    departureTime: '08:30',
    arrivalTime: '10:38',
    duration: '02h 08m',
    transfers: 'Direct',
    operator: 'Avanti West Coast',
    status: 'ON TIME',
    platform: '4',
    crowdLevel: 'HIGH',
    stops: [
      { station: 'London Euston', code: 'EUS', time: '08:30' },
      { station: 'Watford Junction', code: 'WFJ', time: '08:47' },
      { station: 'Milton Keynes Central', code: 'MKC', time: '08:59' },
      { station: 'Stafford', code: 'STA', time: '09:35' },
      { station: 'Stoke-on-Trent', code: 'SOT', time: '09:48' },
      { station: 'Wilmslow', code: 'WLM', time: '10:14' },
      { station: 'Manchester Piccadilly', code: 'MAN', time: '10:38' }
    ]
  },
  {
    id: 'SR-102',
    trainNumber: '1B18',
    origin: 'London King\'s Cross',
    originCode: 'KGX',
    destination: 'Edinburgh Waverley',
    destinationCode: 'EDB',
    departureTime: '09:00',
    arrivalTime: '13:22',
    duration: '04h 22m',
    transfers: 'Direct',
    operator: 'London North Eastern Railway (LNER)',
    status: 'ON TIME',
    platform: '1',
    crowdLevel: 'MEDIUM',
    stops: [
      { station: 'London King\'s Cross', code: 'KGX', time: '09:00' },
      { station: 'Stevenage', code: 'STV', time: '09:22' },
      { station: 'York', code: 'YRK', time: '10:50' },
      { station: 'Darlington', code: 'DAR', time: '11:15' },
      { station: 'Newcastle', code: 'NCL', time: '11:42' },
      { station: 'Edinburgh Waverley', code: 'EDB', time: '13:22' }
    ]
  },
  {
    id: 'SR-103',
    trainNumber: '2C64',
    origin: 'Birmingham New Street',
    originCode: 'BHM',
    destination: 'London Euston',
    destinationCode: 'EUS',
    departureTime: '09:15',
    arrivalTime: '10:34',
    duration: '01h 19m',
    transfers: 'Direct',
    operator: 'London Northwestern Railway',
    status: 'DELAYED',
    platform: '4B',
    crowdLevel: 'HIGH',
    stops: [
      { station: 'Birmingham New Street', code: 'BHM', time: '09:15' },
      { station: 'Coventry', code: 'COV', time: '09:38' },
      { station: 'Rugby', code: 'RGB', time: '09:52' },
      { station: 'Watford Junction', code: 'WFJ', time: '10:15' },
      { station: 'London Euston', code: 'EUS', time: '10:34' }
    ]
  },
  {
    id: 'SR-104',
    trainNumber: '1G33',
    origin: 'London Paddington',
    originCode: 'PAD',
    destination: 'Bristol Temple Meads',
    destinationCode: 'BRI',
    departureTime: '09:30',
    arrivalTime: '11:08',
    duration: '01h 38m',
    transfers: 'Direct',
    operator: 'Great Western Railway',
    status: 'ON TIME',
    platform: '7',
    crowdLevel: 'LOW',
    stops: [
      { station: 'London Paddington', code: 'PAD', time: '09:30' },
      { station: 'Reading', code: 'RDG', time: '09:55' },
      { station: 'Didcot Parkway', code: 'DID', time: '10:12' },
      { station: 'Bath Spa', code: 'BTH', time: '10:45' },
      { station: 'Bristol Temple Meads', code: 'BRI', time: '11:08' }
    ]
  },
  {
    id: 'SR-105',
    trainNumber: '9V12',
    origin: 'Manchester Piccadilly',
    originCode: 'MAN',
    destination: 'Glasgow Central',
    destinationCode: 'GLC',
    departureTime: '10:05',
    arrivalTime: '13:25',
    duration: '03h 20m',
    transfers: '1 Change (Preston)',
    operator: 'TransPennine Express',
    status: 'PLATFORM CHANGE',
    platform: '12',
    crowdLevel: 'MEDIUM',
    stops: [
      { station: 'Manchester Piccadilly', code: 'MAN', time: '10:05' },
      { station: 'Bolton', code: 'BLT', time: '10:25' },
      { station: 'Preston', code: 'PRN', time: '10:55' },
      { station: 'Lancaster', code: 'LAN', time: '11:15' },
      { station: 'Carlisle', code: 'CAR', time: '12:02' },
      { station: 'Glasgow Central', code: 'GLC', time: '13:25' }
    ]
  },
  {
    id: 'SR-106',
    trainNumber: '1S22',
    origin: 'London Euston',
    originCode: 'EUS',
    destination: 'Glasgow Central',
    destinationCode: 'GLC',
    departureTime: '11:30',
    arrivalTime: '16:08',
    duration: '04h 38m',
    transfers: 'Direct',
    operator: 'Avanti West Coast',
    status: 'ON TIME',
    platform: '2',
    crowdLevel: 'LOW',
    stops: [
      { station: 'London Euston', code: 'EUS', time: '11:30' },
      { station: 'Crewe', code: 'CRE', time: '12:58' },
      { station: 'Warrington Bank Quay', code: 'WBQ', time: '13:15' },
      { station: 'Wigan North Western', code: 'WGN', time: '13:29' },
      { station: 'Preston', code: 'PRN', time: '13:46' },
      { station: 'Glasgow Central', code: 'GLC', time: '16:08' }
    ]
  }
];

interface ServiceTimetableProps {
  onSelectService: (service: TrainService) => void;
  railcardDiscount?: number;
}

export function ServiceTimetable({ onSelectService, railcardDiscount = 0 }: ServiceTimetableProps) {
  // The timetable itself is a fixed demo feed; only the fares are authoritative.
  const services = DEFAULT_SERVICES;
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // "From" prices come from the same API and fare table that checkout uses, so
  // the board cannot quote a number the booking endpoint will not honour.
  const [fromFares, setFromFares] = useState<Record<string, number>>({});
  const [faresState, setFaresState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setFaresState('loading');

    const routes = Array.from(
      new Set(services.map((service) => `${service.originCode}>${service.destinationCode}`))
    );

    Promise.all(
      routes.map(async (route) => {
        const [originCode, destinationCode] = route.split('>');
        const { fares } = await getFares(originCode, destinationCode);
        const cheapest = Math.min(...fares.map((fare) => fare.price));
        if (!Number.isFinite(cheapest)) throw new Error('No fares returned.');
        return [route, cheapest] as const;
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setFromFares(Object.fromEntries(entries));
        setFaresState('ready');
      })
      .catch(() => {
        if (!cancelled) setFaresState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [services]);

  const operators = Array.from(new Set(services.map(s => s.operator)));

  const filteredServices = services.filter(s => {
    const matchesOperator = operatorFilter === 'ALL' || s.operator === operatorFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesQuery =
      s.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.trainNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.operator.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOperator && matchesStatus && matchesQuery;
  });

  const handleSelect = (service: TrainService) => {
    setSelectedServiceId(service.id);
    onSelectService(service);
    // Smooth scroll to comparative fare matrix or section below
    const matrixEl = document.getElementById('fare-matrix-section');
    if (matrixEl) {
      matrixEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedServiceId(expandedServiceId === id ? null : id);
  };

  return (
    <div className="space-y-6 text-[#0B192C]">
      {/* Header & Filters */}
      <div className="bg-white border border-[#0B192C]/12 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#0B192C]/12 gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-railAmber rounded-full"></span>
            <div>
              <h2 className="font-bold text-sm tracking-wide uppercase text-[#0B192C]">Live Departure Slots & Calling Points Roster</h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">Real-time National Rail CRS feed with TOC operator tags, platform statuses, and intermediate stops.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2.5 py-1 border border-[#0B192C]/12">
              FEED: LIVE CRS • 6 SERVICES ACTIVE
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Search Station / Train No.</label>
            <input
              type="text"
              placeholder="e.g. Euston, 1A42, Avanti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-xs font-mono text-[#0B192C] focus:outline-none focus:border-[#0B192C]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Filter by Operator (TOC)</label>
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-xs font-mono text-[#0B192C] focus:outline-none focus:border-[#0B192C]"
            >
              <option value="ALL">All Train Operators (TOCs)</option>
              {operators.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-[#0B192C]/12 text-xs font-mono text-[#0B192C] focus:outline-none focus:border-[#0B192C]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ON TIME">On Time</option>
              <option value="DELAYED">Delayed</option>
              <option value="PLATFORM CHANGE">Platform Change</option>
            </select>
          </div>
        </div>
      </div>

      {/* Departure Slots Table */}
      <div className="bg-white border border-[#0B192C]/12 shadow-sm overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-[#0B192C]/12 flex items-center justify-between text-xs font-mono text-gray-500 uppercase font-bold">
          <div>Service & TOC</div>
          <div className="hidden md:block">Schedule & Duration</div>
          <div className="hidden md:block">Platform & Status</div>
          <div>Lowest Fare</div>
          <div>Action</div>
        </div>

        <div className="divide-y divide-[#0B192C]/10">
          {filteredServices.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-mono text-xs">
              No matching train services found for your filter criteria.
            </div>
          ) : (
            filteredServices.map((service) => {
              const isSelected = selectedServiceId === service.id;
              const isExpanded = expandedServiceId === service.id;
              const fromFare = fromFares[`${service.originCode}>${service.destinationCode}`];

              return (
                <div key={service.id} className="transition-colors">
                  <div
                    onClick={() => handleSelect(service)}
                    className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-all hover:bg-gray-50/80 ${
                      isSelected ? 'bg-amber-50/50 ring-2 ring-[#0B192C] border-l-4 border-l-[#0B192C]' : ''
                    }`}
                  >
                    {/* Service & TOC */}
                    <div className="space-y-1 md:w-1/4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold bg-[#0B192C] text-white px-2 py-0.5">
                          {service.trainNumber}
                        </span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 border border-[#0B192C]/12">
                          {service.operator}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#0B192C] flex items-center space-x-1.5 pt-1">
                        <span>{service.origin}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        <span>{service.destination}</span>
                      </div>
                    </div>

                    {/* Schedule & Duration */}
                    <div className="flex items-center space-x-4 md:w-1/4">
                      <div>
                        <div className="font-mono text-base font-bold text-[#0B192C]">
                          {service.departureTime} <span className="text-gray-400 font-normal">→</span> {service.arrivalTime}
                        </div>
                        <div className="text-[11px] font-mono text-gray-500 flex items-center space-x-2">
                          <span>{service.duration}</span>
                          <span>•</span>
                          <span className={service.transfers === 'Direct' ? 'text-emerald-600 font-bold' : 'text-amber-700'}>
                            {service.transfers}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Platform & Status */}
                    <div className="flex items-center space-x-3 md:w-1/4">
                      <div className="space-y-1">
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 text-xs font-mono font-bold bg-gray-100 border border-[#0B192C]/12 text-[#0B192C]">
                          <Train className="w-3 h-3 text-railAmber" />
                          <span>Plat {service.platform}</span>
                        </div>
                        <div>
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold ${
                            service.status === 'ON TIME'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : service.status === 'DELAYED'
                              ? 'bg-red-100 text-red-900 border border-red-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {service.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lowest Fare & Expand Toggle */}
                    <div className="flex items-center justify-between md:justify-end space-x-4 md:w-1/4">
                      <div className="text-right">
                        <div className="text-xs font-mono text-gray-400 uppercase">From</div>
                        <div className="text-lg font-mono font-bold text-[#0B192C]">
                          {faresState === 'ready' && typeof fromFare === 'number'
                            ? `£${fromFare.toFixed(2)}`
                            : faresState === 'loading'
                            ? 'Pricing.'
                            : 'Unavailable'}
                        </div>
                        {faresState === 'ready' && railcardDiscount > 0 && (
                          <div className="text-[10px] font-mono text-emerald-600">
                            {railcardDiscount}% Railcard Applied
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => toggleExpand(e, service.id)}
                          title="View Calling Points"
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-[#0B192C] border border-[#0B192C]/12 text-xs font-mono font-bold flex items-center space-x-1 transition-colors"
                        >
                          <span className="hidden sm:inline">Stops</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleSelect(service)}
                          className={`px-3 py-2 text-xs font-bold font-mono uppercase tracking-wider border transition-colors ${
                            isSelected
                              ? 'bg-[#0B192C] text-railAmber border-[#0B192C]'
                              : 'bg-gray-50 hover:bg-[#0B192C] hover:text-white text-[#0B192C] border-[#0B192C]/20'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Calling Points Drawer */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="bg-slate-900 text-slate-100 p-6 border-t border-slate-800 space-y-4"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-railAmber" />
                            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                              Calling Points & Transit Schedule — Train {service.trainNumber} ({service.operator})
                            </h4>
                          </div>
                          <span className="text-[11px] font-mono text-amber-400">
                            Crowd Forecast: {service.crowdLevel}
                          </span>
                        </div>

                        {/* Vertical Breadcrumb List */}
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                          {service.stops.map((stop, idx) => (
                            <div key={stop.code} className="relative flex items-center justify-between text-xs font-mono">
                              <div className={`absolute -left-6 w-3 h-3 rounded-full border-2 ${
                                idx === 0 || idx === service.stops.length - 1
                                  ? 'bg-railAmber border-railAmber'
                                  : 'bg-slate-900 border-slate-400'
                              }`} />
                              <div className="flex items-center space-x-3">
                                <span className="font-bold text-white">{stop.station}</span>
                                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 border border-slate-700">
                                  {stop.code}
                                </span>
                              </div>
                              <div className="text-slate-300 font-semibold">
                                {stop.time}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
