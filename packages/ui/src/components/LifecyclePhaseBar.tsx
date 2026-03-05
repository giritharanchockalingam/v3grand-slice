/**
 * ─── LifecyclePhaseBar Component ─────────────────────────────────────
 * Visual timeline bar showing 3 lifecycle phases.
 * Highlights current phase and shows percent complete within current phase.
 */

import React, { useMemo } from 'react';

type LifecyclePhase = 'Pre-Investment' | 'Construction' | 'Operations';

interface LifecyclePhaseBarProps {
  currentPhase: LifecyclePhase;
  percentCompleteInPhase: number; // 0-100
}

const PHASES: LifecyclePhase[] = ['Pre-Investment', 'Construction', 'Operations'];

/**
 * Get color for a phase (active vs inactive)
 */
function getPhaseColor(
  phase: LifecyclePhase,
  currentPhase: LifecyclePhase,
  isCompleted: boolean
): string {
  if (phase === currentPhase) {
    return 'bg-blue-600'; // Active phase
  }
  if (isCompleted) {
    return 'bg-green-600'; // Completed phase
  }
  return 'bg-gray-300'; // Future phase
}

/**
 * Get text color for phase label
 */
function getPhaseTextColor(
  phase: LifecyclePhase,
  currentPhase: LifecyclePhase
): string {
  if (phase === currentPhase) {
    return 'text-blue-700 font-semibold';
  }
  return 'text-gray-600';
}

export const LifecyclePhaseBar: React.FC<LifecyclePhaseBarProps> = ({
  currentPhase,
  percentCompleteInPhase,
}) => {
  const currentPhaseIndex = PHASES.indexOf(currentPhase);

  // Determine which phases are completed
  const completedPhases = useMemo(() => {
    return PHASES.filter((_, index) => index < currentPhaseIndex);
  }, [currentPhaseIndex]);

  const isPhaseCompleted = (phase: LifecyclePhase): boolean => {
    return completedPhases.includes(phase);
  };

  // Ensure percent is within 0-100
  const normalizedPercent = Math.max(0, Math.min(100, percentCompleteInPhase));

  return (
    <div className="space-y-3">
      {/* Phase Labels & Progress */}
      <div className="space-y-2">
        {PHASES.map((phase) => {
          const isCurrent = phase === currentPhase;
          const isCompleted = isPhaseCompleted(phase);
          const phaseColor = getPhaseColor(phase, currentPhase, isCompleted);
          const textColor = getPhaseTextColor(phase, currentPhase);

          return (
            <div key={phase} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={`text-sm ${textColor}`}>{phase}</label>
                {isCurrent && (
                  <span className="text-xs text-gray-500">
                    {normalizedPercent}% complete
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                {isCurrent ? (
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${normalizedPercent}%` }}
                    role="progressbar"
                    aria-valuenow={normalizedPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${phase}: ${normalizedPercent}% complete`}
                  />
                ) : (
                  <div
                    className={`h-full ${phaseColor}`}
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline Visualization */}
      <div className="flex items-center gap-2 mt-4 px-1">
        {PHASES.map((phase, index) => {
          const isCurrent = phase === currentPhase;
          const isCompleted = isPhaseCompleted(phase);
          const color = getPhaseColor(phase, currentPhase, isCompleted);

          return (
            <React.Fragment key={phase}>
              {/* Phase Dot */}
              <div
                className={`flex-shrink-0 w-4 h-4 rounded-full ${color} border-2 border-white shadow-sm transition-all`}
                title={phase}
              />

              {/* Connector Line (not after last phase) */}
              {index < PHASES.length - 1 && (
                <div
                  className={`flex-grow h-1 ${
                    isCompleted || isCurrent ? 'bg-blue-600' : 'bg-gray-300'
                  } transition-colors`}
                  style={{ minWidth: '8px' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current Phase Summary */}
      <div className="text-sm text-gray-600 pt-2">
        <span className="font-medium">Current Phase:</span> {currentPhase}
      </div>
    </div>
  );
};
