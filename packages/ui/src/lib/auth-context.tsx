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

  const login = async (email: string, password: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
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
