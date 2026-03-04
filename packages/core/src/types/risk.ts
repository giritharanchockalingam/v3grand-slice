// ─── Risk Management Types ─────────────────────────────────────────

export type RiskCategory = 'market' | 'construction' | 'financial' | 'regulatory' | 'operational';
export type RiskStatus = 'identified' | 'mitigating' | 'accepted' | 'closed';
export type RiskImpactLevel = 1 | 2 | 3 | 4 | 5;
export type RiskProbabilityLevel = 1 | 2 | 3 | 4 | 5;

export interface Risk {
  id: string;
  dealId: string;
  category: RiskCategory;
  title: string;
  description: string;
  probability: RiskProbabilityLevel;  // 1 (unlikely) to 5 (almost certain)
  impact: RiskImpactLevel;            // 1 (minimal) to 5 (catastrophic)
  riskScore: number;                  // probability * impact (1-25)
  status: RiskStatus;
  mitigation: string;
  costExposureCr: number;             // financial exposure in crores
  owner: string;                      // userId
  createdBy: string;                  // userId
  createdAt: string;
  updatedAt: string;
}

export interface RiskRegister {
  dealId: string;
  risks: Risk[];
  totalExposure: number;              // sum of costExposure
  highRiskCount: number;              // count of risks with score >= 15
  updatedAt: string;
}
