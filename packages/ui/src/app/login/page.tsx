'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/deals');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setError('');
    setLoading(true);
    try {
      await login(demoEmail, 'demo123');
      router.push('/deals');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-surface-950" />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/30 via-surface-950 to-blue-900/20" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mx-auto mb-4 shadow-glow-lg">
            <span className="text-white font-bold text-xl">V3</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">V3 GRAND</h1>
          <p className="text-sm text-surface-400 mt-1">Investment Operating System</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-glass-lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-surface-500
                           focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-surface-500
                           focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-brand-500 to-brand-400 text-white font-semibold rounded-xl
                         hover:from-brand-600 hover:to-brand-500 disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-md hover:shadow-glow transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-2xs text-surface-500 text-center mb-3 uppercase tracking-wider font-semibold">Quick Access — Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Lead Investor', email: 'lead@v3grand.com', color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400' },
                { label: 'Co-Investor', email: 'co@v3grand.com', color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400' },
                { label: 'Operator', email: 'ops@v3grand.com', color: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400' },
                { label: 'Viewer', email: 'viewer@v3grand.com', color: 'from-surface-500/10 to-surface-500/5 border-surface-500/20 text-surface-400' },
              ].map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => quickLogin(demo.email)}
                  className={`bg-gradient-to-br ${demo.color} border rounded-lg px-3 py-2 text-2xs font-medium
                             hover:brightness-125 transition-all text-center`}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-2xs text-surface-600 mt-6">
          V3 Grand Investment OS — Enterprise Real Estate Intelligence
        </p>
      </div>
    </div>
  );
}
