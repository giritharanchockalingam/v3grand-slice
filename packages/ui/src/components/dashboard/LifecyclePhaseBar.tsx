// ─── Lifecycle Phase Bar ─────────────────────────────────────────────
'use client';

interface Props {
  currentPhase: string;
  currentMonth: number;
}

const PHASES = [
  'Feasibility',
  'Land Acquisition',
  'Entitlements',
  'Design',
  'Financing',
  'Construction',
  'FF&E',
  'Pre-Opening',
  'Operations',
] as const;

export function LifecyclePhaseBar({ currentPhase, currentMonth }: Props) {
  const currentIndex = PHASES.findIndex(p => p.toLowerCase() === currentPhase.toLowerCase());
  const progressPct = currentIndex >= 0 ? ((currentIndex + 0.5) / PHASES.length) * 100 : 0;

  return (
    <div className="rounded-xl bg-surface-50/80 border border-surface-200/60 p-4">
      {/* Progress Track */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-surface-200 rounded-full" />
        {/* Filled track */}
        <div
          className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-700"
          style={{ width: `calc(${progressPct}% - 2rem)` }}
        />

        {/* Phase Nodes */}
        <div className="relative flex items-center justify-between">
          {PHASES.map((phase, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <div key={phase} className="flex flex-col items-center z-10" style={{ width: `${100 / PHASES.length}%` }}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-2xs font-bold transition-all duration-300 ${
                    isCurrent
                      ? 'bg-brand-500 text-white ring-4 ring-brand-100 shadow-glow'
                      : isCompleted
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-surface-400 border-2 border-surface-200'
                  }`}
                  title={phase}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse-soft" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span className={`mt-2 text-2xs text-center leading-tight transition-colors ${
                  isCurrent
                    ? 'text-brand-700 font-semibold'
                    : isCompleted
                    ? 'text-brand-600 font-medium'
                    : 'text-surface-400'
                }`}>
                  {phase}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
