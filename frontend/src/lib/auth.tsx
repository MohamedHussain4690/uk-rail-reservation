import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  updateProfile as apiUpdateProfile,
} from './api';

interface AuthContextValue {
  user: User | null;
  /** True until the initial session check finishes. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Parameters<typeof apiRegister>[0]) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: Parameters<typeof apiUpdateProfile>[0]) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.user);
    } catch {
      // 401 simply means "not signed in".
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload: Parameters<typeof apiRegister>[0]) => {
    const res = await apiRegister(payload);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload: Parameters<typeof apiUpdateProfile>[0]) => {
    const res = await apiUpdateProfile(payload);
    setUser(res.user);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
