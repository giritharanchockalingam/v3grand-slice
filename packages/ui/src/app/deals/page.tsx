'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';

export const dynamic = 'force-dynamic';

interface DealSummary {
  id: string;
  name: string;
  assetClass: string;
  status: string;
  lifecyclePhase: string;
  updatedAt: string;
  userRole?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  draft: 'badge-neutral',
  archived: 'badge-neutral',
  paused: 'badge-warning',
};

export default function DealsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const { data: deals = [], isLoading: dealsLoading, error } = useQuery<DealSummary[]>({
    queryKey: ['deals'],
    queryFn: () => api.get('/deals'),
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!loading && !user) {
    router.push('/login');
    return null;
  }

  if (loading || dealsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="elevated-card p-8">
          <div className="shimmer h-8 w-52 mb-3" />
          <div className="shimmer h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="elevated-card p-6">
              <div className="shimmer h-6 w-40 mb-4" />
              <div className="flex gap-2 mb-4">
                <div className="shimmer h-6 w-16 rounded-full" />
                <div className="shimmer h-6 w-20 rounded-full" />
              </div>
              <div className="shimmer h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="elevated-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-400 to-teal-300" />
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Portfolio Dashboard</h1>
            <p className="text-sm text-surface-500 mt-1">
              {deals.length} deal{deals.length !== 1 ? 's' : ''} in your portfolio
            </p>
          </div>
          <Link href="/deals/new" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Deal
          </Link>
        </div>
      </div>

      {error && (
        <div className="toast-error">
          <span className="font-medium">{(error as Error).message}</span>
        </div>
      )}

      {deals.length === 0 ? (
        <div className="elevated-card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mb-1">No deals found</h2>
          <p className="text-sm text-surface-500 mb-6">Create your first deal to get started with investment analysis.</p>
          <Link href="/deals/new" className="btn-primary">Create Your First Deal</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {deals.map((deal) => (
            <Link
              key={deal.id}
              href={`/deals/${deal.id}`}
              className="elevated-card overflow-hidden group"
            >
              <div className="h-0.5 bg-gradient-to-r from-brand-500 to-brand-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-surface-900 group-hover:text-brand-700 transition-colors">
                    {deal.name}
                  </h2>
                  <p className="text-2xs text-surface-400 mt-1 font-mono">
                    Updated {new Date(deal.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="badge-brand">{deal.assetClass}</span>
                  <span className="badge bg-brand-50/50 text-brand-600 border border-brand-200/30">
                    {deal.lifecyclePhase}
                  </span>
                  <span className={STATUS_COLORS[deal.status] ?? 'badge-neutral'}>
                    {deal.status}
                  </span>
                </div>

                {deal.userRole && (
                  <div className="pt-3 border-t border-surface-100">
                    <p className="text-xs text-surface-500">
                      <span className="font-medium">Access:</span>{' '}
                      {deal.userRole.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-brand-600 font-semibold text-sm group-hover:text-brand-700">
                  <span>Open Dashboard</span>
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
