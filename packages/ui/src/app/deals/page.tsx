'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';

interface DealSummary {
  id: string;
  name: string;
  assetClass: string;
  status: string;
  lifecyclePhase: string;
  updatedAt: string;
  userRole?: string;
}

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Deals</h1>
            <p className="text-sm text-gray-500 mt-1">{deals.length} deal{deals.length !== 1 ? 's' : ''} you have access to</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              <strong>{user?.name}</strong>
              <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">{user?.role}</span>
            </span>
            <button
              onClick={() => { sessionStorage.removeItem('v3grand-auth'); router.push('/login'); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Log out
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 text-red-600">
            {(error as Error).message}
          </div>
        )}

        {deals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            No deals found. Contact an administrator to grant access.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition block p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{deal.name}</h2>
                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p><span className="font-medium">Asset Class:</span> {deal.assetClass}</p>
                  <p><span className="font-medium">Status:</span> {deal.status}</p>
                  <p><span className="font-medium">Phase:</span> {deal.lifecyclePhase}</p>
                  <p><span className="font-medium">Updated:</span> {new Date(deal.updatedAt).toLocaleDateString()}</p>
                </div>
                {deal.userRole && (
                  <div className="mb-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      Your role: {deal.userRole}
                    </span>
                  </div>
                )}
                <div className="pt-4 border-t border-gray-200">
                  <span className="text-indigo-600 font-medium hover:text-indigo-700">
                    View Dashboard →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
