// ─── Construction Tracking Types ──────────────────────────────────
export type COStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type RFIStatus = 'open' | 'answered' | 'closed';
export type MilestoneStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed';

export interface BudgetLine {
  id: string;
  dealId: string;
  costCode: string;
  description: string;
  category: string;
  originalAmount: number;
  approvedCOs: number;
  currentBudget: number;
  actualSpend: number;
  commitments: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeOrder {
  id: string;
  dealId: string;
  budgetLineId: string;
  coNumber: string;
  title: string;
  description: string;
  amount: number;
  status: COStatus;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RFI {
  id: string;
  dealId: string;
  rfiNumber: string;
  subject: string;
  question: string;
  answer: string | null;
  status: RFIStatus;
  raisedBy: string;
  answeredBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  dealId: string;
  name: string;
  description: string;
  targetDate: string;
  actualDate: string | null;
  status: MilestoneStatus;
  percentComplete: number;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConstructionSummary {
  totalBudget: number;
  totalApprovedCOs: number;
  totalActualSpend: number;
  totalCommitments: number;
  budgetVariance: number;
  completionPct: number;
}

export interface ConstructionDashboardView {
  budgetLines: BudgetLine[];
  changeOrders: ChangeOrder[];
  rfis: RFI[];
  milestones: Milestone[];
  summary: ConstructionSummary;
}
