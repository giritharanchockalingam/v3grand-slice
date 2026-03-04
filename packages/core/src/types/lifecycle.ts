// ─── Lifecycle and Project Management Types ────────────────────────

export enum LifecyclePhase {
  FEASIBILITY = 'feasibility',
  LAND_ACQUISITION = 'land-acquisition',
  ENTITLEMENTS = 'entitlements',
  DESIGN = 'design',
  FINANCING = 'financing',
  CONSTRUCTION = 'construction',
  FFE_PROCUREMENT = 'ffe-procurement',
  PRE_OPENING = 'pre-opening',
  OPERATIONS = 'operations',
}

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';

export interface Task {
  id: string;
  dealId: string;
  name: string;
  description?: string;
  phase: LifecyclePhase;
  status: TaskStatus;
  owner?: string;                    // userId
  createdAt: string;
  updatedAt: string;
}

export interface PhaseMilestone {
  id: string;
  dealId: string;
  name: string;
  description?: string;
  phase: LifecyclePhase;
  targetDate: string;
  actualDate?: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'cancelled';
  percentComplete: number;           // 0-100
  dependencies: string[];            // milestone IDs
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleView {
  dealId: string;
  currentPhase: LifecyclePhase;
  completedPhases: LifecyclePhase[];
  upcomingPhases: LifecyclePhase[];
  tasks: Task[];
  milestones: PhaseMilestone[];
  overallProgress: number;           // 0-100
}
