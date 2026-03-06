'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { AuthProvider, useAuth } from '../lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FloatingAgent } from '../components/agent/FloatingAgent';
import { NavDealsIcon, NavPortfolioIcon, NavAgentIcon } from '../components/icons/PortalIcons';

// Real agent data from the registry
const NAV_NAV_AGENT_CATEGORIES = [
  {
    name: 'Core Analysis',
    agents: [
      { id: 'market-analyst', name: 'Market Intel', icon: '🌍' },
      { id: 'deal-underwriter', name: 'Deal Underwriter', icon: '📊' },
      { id: 'portfolio-risk-officer', name: 'Risk Officer', icon: '🛡️' },
      { id: 'capital-allocator', name: 'Capital Allocator', icon: '💰' },
    ],
  },
  {
    name: 'Compliance & Legal',
    agents: [
      { id: 'compliance-auditor', name: 'Compliance Auditor', icon: '📋' },
      { id: 'legal-regulatory', name: 'Legal & Regulatory', icon: '⚖️' },
      { id: 'tax-strategist', name: 'Tax Strategist', icon: '🏛️' },
      { id: 'forensic-auditor', name: 'Forensic Auditor', icon: '🔬' },
    ],
  },
  {
    name: 'Operations',
    agents: [
      { id: 'construction-monitor', name: 'Construction Monitor', icon: '🏗️' },
      { id: 'revenue-optimizer', name: 'Revenue Optimizer', icon: '📈' },
      { id: 'proptech-advisor', name: 'PropTech Advisor', icon: '💡' },
      { id: 'insurance-protection', name: 'Insurance & Protection', icon: '🛡️' },
    ],
  },
  {
    name: 'Strategy',
    agents: [
      { id: 'esg-analyst', name: 'ESG Analyst', icon: '🌱' },
      { id: 'debt-structuring', name: 'Debt Structuring', icon: '🏦' },
      { id: 'lp-relations', name: 'LP Relations', icon: '🤝' },
      { id: 'exit-strategist', name: 'Exit Strategist', icon: '🎯' },
    ],
  },
];

function AgentsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = pathname === '/agents' || pathname?.startsWith('/agents/');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
          isActive
            ? 'text-brand-400 border-brand-400'
            : 'text-surface-400 border-transparent hover:text-white hover:border-surface-600'
        }`}
      >
        <NavAgentIcon className={isActive ? 'w-5 h-5 text-brand-400' : 'w-5 h-5'} />
        CFO Agents
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-0 w-96 bg-surface-900 border border-white/10 rounded-xl shadow-glass-lg backdrop-blur-xl z-50">
          <div className="max-h-96 overflow-y-auto dark-scrollbar">
            {NAV_AGENT_CATEGORIES.map((category, idx) => (
              <div key={category.name}>
                <Link
                  href="/agents"
                  className="block px-4 py-3 text-sm font-semibold text-brand-400 hover:bg-white/5 transition-colors border-l-2 border-brand-500"
                  onClick={() => setIsOpen(false)}
                >
                  {category.name}
                </Link>
                {category.agents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-3 px-6 py-2.5 text-sm text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="text-lg">{agent.icon}</span>
                    <span>{agent.name}</span>
                  </Link>
                ))}
                {idx < NAV_AGENT_CATEGORIES.length - 1 && <div className="h-px bg-white/5 mx-2 my-1" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: '/invest', label: 'Invest', Icon: NavDealsIcon },
    { href: '/deals', label: 'Deals', Icon: NavDealsIcon },
    { href: '/portfolio', label: 'Portfolio', Icon: NavPortfolioIcon },
    { href: '/agent', label: 'Chat', Icon: NavAgentIcon },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-surface-900/95 backdrop-blur-xl border-b border-white/10 shadow-lg">
      <div className="max-w-[1440px] mx-auto flex justify-between items-center px-6">
        {/* Logo & Nav */}
        <div className="flex items-center gap-8">
          <Link href="/deals" className="flex items-center gap-2.5 py-4 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-shadow">
              <span className="text-white font-bold text-sm">V3</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-wide leading-none">GRAND</span>
              <span className="text-2xs text-brand-400 font-medium tracking-widest uppercase">Investment OS</span>
            </div>
          </Link>

          {user && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-6">
              {navLinks.map((link) => {
                const isActive = pathname === link.href ||
                  (link.href === '/invest' && pathname?.startsWith('/invest/')) ||
                  (link.href === '/deals' && pathname?.startsWith('/deals/')) ||
                  (link.href === '/agent' && pathname === '/agent');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all duration-200 border-b-2 ${
                      isActive
                        ? 'text-brand-400 border-brand-400'
                        : 'text-surface-400 border-transparent hover:text-white hover:border-surface-600'
                    }`}
                  >
                    <link.Icon className={isActive ? 'w-5 h-5 text-brand-400' : 'w-5 h-5'} />
                    {link.label}
                  </Link>
                );
              })}
              <AgentsDropdown />
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {user && (
            <>
              <Link
                href="/deals/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white
                           bg-gradient-to-r from-brand-500 to-brand-400 rounded-lg
                           hover:from-brand-600 hover:to-brand-500 shadow-sm hover:shadow-glow
                           transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New Deal
              </Link>

              <div className="h-6 w-px bg-white/10" />

              {/* Notification Bell */}
              <button
                className="p-2 text-surface-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150 relative"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-white leading-none">{user.name}</p>
                  <p className="text-2xs text-surface-400 mt-0.5">
                    {user.role.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="ml-2 p-1.5 text-surface-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150"
                  title="Sign Out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function LayoutContent({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Navbar />
      <main className="min-h-screen">
        <div className="max-w-[1440px] mx-auto px-6 py-8">
          {children}
        </div>
      </main>
      <FloatingAgent />
    </QueryClientProvider>
  );
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}
