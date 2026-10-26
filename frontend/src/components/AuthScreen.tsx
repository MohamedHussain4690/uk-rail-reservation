import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Train, ShieldCheck, Mail, Lock, User as UserIcon, Phone,
  AlertCircle, RefreshCw, ArrowRight, Ticket, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { isGmailAddress, isValidIndianPhone, GMAIL_EXAMPLE, INDIAN_PHONE_EXAMPLE } from '../lib/validation';

type Mode = 'login' | 'register';

const RAILCARD_OPTIONS = [
  { value: 'None', label: 'No Railcard (Standard)' },
  { value: '16-25', label: '16-25 Railcard (1/3 Off)' },
  { value: 'Senior', label: 'Senior Railcard (1/3 Off)' },
  { value: 'Two Together', label: 'Two Together (1/3 Off)' },
  { value: 'Network', label: 'Network Railcard (1/3 Off)' },
];

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [railcardType, setRailcardType] = useState('16-25');
  const [railcardNumber, setRailcardNumber] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Registration rules are enforced by the API too; checking here just gives
    // an immediate answer instead of a round trip.
    if (mode === 'register') {
      if (!isGmailAddress(email)) {
        setError(`Please use a Gmail address ending in @gmail.com (e.g. ${GMAIL_EXAMPLE}).`);
        return;
      }
      if (phone.trim() && !isValidIndianPhone(phone)) {
        setError(`Please enter a valid Indian mobile number (e.g. ${INDIAN_PHONE_EXAMPLE}).`);
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, name, phone, password, railcardType, railcardNumber });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 bg-gray-50 border border-[#0B192C]/12 text-sm font-medium text-[#0B192C] focus:outline-none focus:border-[#0B192C]';
  const labelClass = 'text-xs font-semibold text-gray-600 uppercase';

  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white border border-[#0B192C]/12 shadow-sm"
      >
        {/* Terminal header — matches the navy blocks used across the app */}
        <div className="bg-[#0B192C] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white/10 border border-white/20 flex items-center justify-center">
              <Train className="w-5 h-5 text-railAmber" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide uppercase">Passenger Authentication</h2>
              <p className="text-[10px] font-mono text-gray-400 tracking-tight">
                NATIONAL RAIL SECURE PASSENGER GATEWAY
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-railAmber border border-railAmber/40 px-2 py-1 hidden sm:inline">
            256-BIT SSL
          </span>
        </div>

        {/* Mode tabs — same underline ribbon as the main navigation */}
        <div className="flex border-b border-[#0B192C]/12">
          {([
            { id: 'login' as Mode, label: 'Sign In' },
            { id: 'register' as Mode, label: 'Create Account' },
          ]).map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchMode(tab.id)}
                className={`flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative ${
                  isActive ? 'text-[#0B192C]' : 'text-gray-500 hover:text-[#0B192C]'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="authTabRibbon"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0B192C]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-300 p-3 text-[11px] font-mono text-red-800 flex items-start space-x-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="space-y-1">
                <label className={labelClass}>Full Legal Name (as on ID)</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Arthur Pendelton"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Mobile Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={INDIAN_PHONE_EXAMPLE}
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <p className="text-[10px] font-mono text-gray-500">
                  Indian mobile number — 10 digits, optionally prefixed with +91.
                </p>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className={labelClass}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="arthur.pendelton@gmail.com"
                className={`${inputClass} pl-9`}
              />
            </div>
            {mode === 'register' && (
              <p className="text-[10px] font-mono text-gray-500">
                Gmail addresses only — must end in @gmail.com
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                className={`${inputClass} pl-9`}
              />
            </div>
            {mode === 'register' && (
              <p className="text-[10px] font-mono text-gray-500">
                Stored as a scrypt hash — never in plain text.
              </p>
            )}
          </div>

          {mode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Railcard</label>
                <select
                  value={railcardType}
                  onChange={(e) => setRailcardType(e.target.value)}
                  className={`${inputClass} font-mono`}
                >
                  {RAILCARD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="text-[#0B192C] bg-white">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Railcard Number</label>
                <input
                  type="text"
                  value={railcardNumber}
                  onChange={(e) => setRailcardNumber(e.target.value)}
                  disabled={railcardType === 'None'}
                  placeholder="RC-8849-2026-UK"
                  className={`${inputClass} font-mono disabled:opacity-50`}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#0B192C] hover:bg-slate-800 text-white py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 border border-[#0B192C] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <RefreshCw className="w-4 h-4 text-railAmber animate-spin" />
                <span>Authenticating…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-railAmber" />
                <span>{mode === 'login' ? 'Sign In to Passenger Account' : 'Create Passenger Account'}</span>
              </>
            )}
          </button>

          <div className="pt-2 border-t border-[#0B192C]/12 flex items-center justify-between text-[10px] font-mono text-gray-500">
            <span className="flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
              Session secured via httpOnly cookie
            </span>
            <span>SYS_ID: UKR-AUTH</span>
          </div>
        </form>
      </motion.div>

      {/* Demo credentials — click to autofill */}
      <div
        onClick={() => {
          setMode('login');
          setEmail('arthur.pendelton@gmail.com');
          setPassword('railway2026');
          setError(null);
        }}
        title="Click to autofill demo credentials"
        className="mt-4 bg-amber-50 hover:bg-amber-100/90 border border-amber-300 p-4 flex items-start space-x-3 text-[#0B192C] cursor-pointer transition-colors group"
      >
        <div className="w-8 h-8 bg-amber-200 border border-amber-400 text-amber-900 flex items-center justify-center font-bold shrink-0">
          <Ticket className="w-4 h-4 text-amber-800" />
        </div>
        <div className="text-xs">
          <div className="flex items-center space-x-2">
            <h4 className="font-bold uppercase tracking-wider text-amber-900">Demo Passenger Account</h4>
            <span className="text-[9px] font-mono font-bold uppercase text-amber-800 bg-amber-200/70 border border-amber-300 px-1.5 py-0.5 rounded">
              Click to Autofill
            </span>
          </div>
          <p className="text-amber-800 font-mono text-[11px] mt-0.5">
            arthur.pendelton@gmail.com / railway2026
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-amber-800 ml-auto shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}
