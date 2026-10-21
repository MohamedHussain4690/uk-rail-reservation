import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, LogOut, Save, CheckCircle2, AlertCircle, RefreshCw, Ticket,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isValidIndianPhone, normaliseIndianPhone, INDIAN_PHONE_EXAMPLE } from '../lib/validation';

const RAILCARD_OPTIONS = [
  { value: 'None', label: 'No Railcard (Standard)' },
  { value: '16-25', label: '16-25 Railcard (1/3 Off)' },
  { value: 'Senior', label: 'Senior Railcard (1/3 Off)' },
  { value: 'Two Together', label: 'Two Together (1/3 Off)' },
  { value: 'Network', label: 'Network Railcard (1/3 Off)' },
];

const SEAT_PREFERENCES = ['Window Seat (Forward)', 'Window Seat (Backward)', 'Aisle Seat', 'Quiet Coach'];

export function ProfilePanel() {
  const { user, updateProfile, logout } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [railcardType, setRailcardType] = useState(user?.railcard.type ?? 'None');
  const [railcardNumber, setRailcardNumber] = useState(user?.railcard.number ?? '');
  const [seatPreference, setSeatPreference] = useState(user?.seatPreference ?? SEAT_PREFERENCES[0]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Re-sync the form when the signed-in passenger changes.
  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setRailcardType(user?.railcard.type ?? 'None');
    setRailcardNumber(user?.railcard.number ?? '');
    setSeatPreference(user?.seatPreference ?? SEAT_PREFERENCES[0]);
  }, [user]);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // The API enforces the same rule; this just avoids a pointless round trip.
    if (phone.trim() && !isValidIndianPhone(phone)) {
      setError(`Enter a valid Indian mobile number (e.g. ${INDIAN_PHONE_EXAMPLE}).`);
      return;
    }

    setBusy(true);

    try {
      // Send the canonical form so the stored value never drifts.
      const canonicalPhone = phone.trim() ? normaliseIndianPhone(phone) ?? '' : '';
      await updateProfile({ name, phone: canonicalPhone, railcardType, railcardNumber, seatPreference });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full mt-1 px-3 py-2 bg-gray-50 border border-[#0B192C]/20 font-mono text-xs text-[#0B192C] focus:outline-none focus:border-[#0B192C]';
  const labelClass = 'block text-[11px] font-mono text-gray-500 uppercase';

  const hasRailcard = user.railcard.type !== 'None';
  const memberSince = new Date(user.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-[#0B192C]/12 p-8 shadow-sm relative overflow-hidden text-[#0B192C]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0B192C]/5 rounded-full -mr-12 -mt-12 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[#0B192C]/12">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-[#0B192C] text-white border-2 border-railAmber flex items-center justify-center font-bold text-xl font-mono shadow-md">
              {user.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Passenger Account & Railcard Profile</h2>
              <p className="text-xs font-mono text-gray-500">{user.email}</p>
              <div className="flex items-center space-x-2 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  ACCOUNT VERIFIED & SECURE
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {hasRailcard ? (
              <span className="px-3 py-1 bg-amber-100 text-amber-900 font-mono text-xs font-bold border border-amber-300">
                {user.railcard.type.toUpperCase()} RAILCARD LINKED (-{user.railcard.discountPercent}%)
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 font-mono text-xs font-bold border border-[#0B192C]/12">
                NO RAILCARD LINKED
              </span>
            )}
            <button
              onClick={() => logout()}
              className="px-3 py-1 bg-white hover:bg-gray-50 text-[#0B192C] font-mono text-xs font-bold border border-[#0B192C]/20 flex items-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                Primary Passenger Details
              </h3>

              {error && (
                <div className="bg-red-50 border border-red-300 p-3 text-[11px] font-mono text-red-800 flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {saved && (
                <div className="bg-emerald-50 border border-emerald-300 p-3 text-[11px] font-mono text-emerald-800 flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Profile saved to National Rail passenger database.</span>
                </div>
              )}

              <div>
                <label className={labelClass}>Full Legal Name (as on ID)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className={`${inputClass} opacity-60 cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Mobile Phone</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={INDIAN_PHONE_EXAMPLE}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>National Railcard ID</label>
                <div className="flex mt-1">
                  <input
                    type="text"
                    value={railcardNumber}
                    onChange={(e) => setRailcardNumber(e.target.value)}
                    disabled={railcardType === 'None'}
                    placeholder="RC-8849-2026-UK"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-[#0B192C]/20 font-mono text-xs text-[#0B192C] focus:outline-none focus:border-[#0B192C] disabled:opacity-50"
                  />
                  <span
                    className={`px-3 flex items-center font-mono text-[11px] font-bold border-y border-r border-[#0B192C]/20 ${
                      hasRailcard ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {hasRailcard ? 'VALID' : 'NONE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full bg-[#0B192C] hover:bg-slate-800 text-white font-mono text-xs font-bold uppercase tracking-wider py-2.5 transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-railAmber animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-railAmber" />
                    <span>Save Profile Details</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 border border-[#0B192C]/12 bg-gray-50 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                Saved Passenger Concessions
              </h3>

              <div className="space-y-3 font-mono text-xs">
                <div className="space-y-1">
                  <label className={labelClass}>Linked Railcard</label>
                  <select
                    value={railcardType}
                    onChange={(e) => setRailcardType(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-[#0B192C]/20 font-mono text-xs font-bold text-[#0B192C] focus:outline-none focus:border-[#0B192C]"
                  >
                    {RAILCARD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="text-[#0B192C] bg-white">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-white border border-[#0B192C]/12 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#0B192C]">
                      {hasRailcard ? `${user.railcard.type} Railcard` : 'No concession'}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {hasRailcard
                        ? `Expires: ${
                            user.railcard.expiresAt
                              ? new Date(user.railcard.expiresAt).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'
                          } • ${user.railcard.discountPercent}% off fares`
                        : 'Add a railcard to save 33% on fares'}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 font-bold ${
                      hasRailcard ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {hasRailcard ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="p-3 bg-white border border-[#0B192C]/12 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#0B192C]">Member Since</div>
                    <div className="text-[10px] text-gray-500">{memberSince}</div>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="p-5 border border-[#0B192C]/12 bg-gray-50 space-y-3 font-mono text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                Default Seating Preference
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {SEAT_PREFERENCES.map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setSeatPreference(pref)}
                    className={`p-3 bg-white text-[11px] font-bold text-center border transition-colors ${
                      seatPreference === pref
                        ? 'border-[#0B192C] text-[#0B192C]'
                        : 'border-[#0B192C]/20 text-gray-600 hover:border-[#0B192C]'
                    }`}
                  >
                    {pref}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border border-[#0B192C]/12 bg-gray-50 flex items-center justify-between font-mono text-[10px] text-gray-500">
              <span className="flex items-center">
                <Ticket className="w-3 h-3 mr-1.5 text-[#0B192C]" />
                PASSENGER ID
              </span>
              <span className="font-bold text-[#0B192C]">{user.id}</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
