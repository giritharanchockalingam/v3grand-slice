'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';

interface DealSummary {
  id: string;
  name: string;
  assetClass: string;
  status: string;
  lifecyclePhase: string;
  updatedAt: string;
}

export default function DealsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!token) return;

    const fetchDeals = async () => {
      try {
        const res = await fetch('/api/deals', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setError('Failed to load deals');
          return;
        }

        const data = await res.json();
        setDeals(data);
      } catch (err) {
        console.error('Error fetching deals:', err);
        setError('Error loading deals');
      } finally {
        setDealsLoading(false);
      }
    };

    fetchDeals();
  }, [token]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Deals</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 text-red-600">
            {error}
          </div>
        )}

        {deals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            No deals found. Contact an administrator to create a new deal.
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
