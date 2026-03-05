'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { AgentPageContent } from './AgentPageContent';

export default function AgentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-surface-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <AgentPageContent />;
}
