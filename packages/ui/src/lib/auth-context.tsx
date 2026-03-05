'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@v3grand/core';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ── Demo users for deployed preview (no backend required) ── */
const DEMO_USERS: Record<string, { user: User; role: string }> = {
  'lead@v3grand.com': {
    user: { id: 'demo-lead-001', email: 'lead@v3grand.com', name: 'Alexandra Chen', role: 'lead_investor' } as User,
    role: 'Lead Investor',
  },
  'co@v3grand.com': {
    user: { id: 'demo-co-001', email: 'co@v3grand.com', name: 'Marcus Rodriguez', role: 'co_investor' } as User,
    role: 'Co-Investor',
  },
  'ops@v3grand.com': {
    user: { id: 'demo-ops-001', email: 'ops@v3grand.com', name: 'Sarah Kim', role: 'operator' } as User,
    role: 'Operator',
  },
  'viewer@v3grand.com': {
    user: { id: 'demo-view-001', email: 'viewer@v3grand.com', name: 'David Park', role: 'viewer' } as User,
    role: 'Viewer',
  },
};

const DEMO_TOKEN = 'demo-jwt-token-v3grand-preview';

function isDemoMode(): boolean {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  // Demo mode when no API URL is configured or we're on Vercel without a backend
  if (!apiBase) return true;
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) return true;
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('v3grand-auth');
    if (stored) {
      try {
        const { user: storedUser, token: storedToken } = JSON.parse(stored);
        setUser(storedUser);
        setToken(storedToken);
      } catch (err) {
        console.error('Failed to restore auth:', err);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    /* ── Demo mode: authenticate against local demo users ── */
    if (isDemoMode()) {
      const demoEntry = DEMO_USERS[email.toLowerCase()];
      if (!demoEntry) {
        throw new Error('Invalid demo credentials. Use one of the Quick Access buttons below.');
      }
      setUser(demoEntry.user);
      setToken(DEMO_TOKEN);
      sessionStorage.setItem('v3grand-auth', JSON.stringify({ user: demoEntry.user, token: DEMO_TOKEN }));
      return;
    }

    /* ── Live mode: authenticate against backend API ── */
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api';
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: _password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    const { user: newUser, token: newToken } = await res.json();
    setUser(newUser);
    setToken(newToken);
    sessionStorage.setItem('v3grand-auth', JSON.stringify({ user: newUser, token: newToken }));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('v3grand-auth');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
