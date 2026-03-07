/**
 * Agent Registry: Central catalog of all 16 CFO specialist agents.
 * Used by API routes and UI to discover and configure agents.
 *
 * Agents are organized into 4 categories:
 *   Core Analysis (4) | Compliance & Legal (4) | Operations (4) | Strategy (4)
 */

import type { AgentDefinition, AgentListItem } from './types';

// ─── Core Analysis ───
import { marketAnalyst } from './specialists/market-analyst';
import { dealUnderwriter } from './specialists/deal-underwriter';
import { portfolioRiskOfficer } from './specialists/portfolio-risk-officer';
import { capitalAllocator } from './specialists/capital-allocator';

// ─── Compliance & Legal ───
import { complianceAuditor } from './specialists/compliance-auditor';
import { legalRegulatory } from './specialists/legal-regulatory';
import { taxStrategist } from './specialists/tax-strategist';
import { forensicAuditor } from './specialists/forensic-auditor';

// ─── Operations ───
import { constructionMonitor } from './specialists/construction-monitor';
import { revenueOptimizer } from './specialists/revenue-optimizer';
import { proptechAdvisor } from './specialists/proptech-advisor';
import { insuranceProtection } from './specialists/insurance-protection';

// ─── Strategy ───
import { esgAnalyst } from './specialists/esg-analyst';
import { debtStructuring } from './specialists/debt-structuring';
import { lpRelations } from './specialists/lp-relations';
import { exitStrategist } from './specialists/exit-strategist';

/** Agent category groupings — Big 4 practice area structure */
export const AGENT_CATEGORIES = [
  {
    id: 'tas',
    label: 'Transaction Advisory Services',
    shortLabel: 'TAS',
    description: 'Deal origination, underwriting, market intelligence, and capital allocation — the core IC analysis engine.',
    agents: ['market-analyst', 'deal-underwriter', 'portfolio-risk-officer', 'capital-allocator'],
  },
  {
    id: 'rag',
    label: 'Risk Assurance & Governance',
    shortLabel: 'RA&G',
    description: 'Regulatory compliance, legal due diligence, tax structuring, and forensic audit — protecting the firm.',
    agents: ['compliance-auditor', 'legal-regulatory', 'tax-strategist', 'forensic-auditor'],
  },
  {
    id: 'otc',
    label: 'Operations & Technology Consulting',
    shortLabel: 'OTC',
    description: 'Construction oversight, revenue management, PropTech advisory, and asset protection — maximizing NOI.',
    agents: ['construction-monitor', 'revenue-optimizer', 'proptech-advisor', 'insurance-protection'],
  },
  {
    id: 'scm',
    label: 'Strategy & Capital Markets',
    shortLabel: 'S&CM',
    description: 'ESG integration, debt structuring, LP relations, and exit planning — long-term value creation.',
    agents: ['esg-analyst', 'debt-structuring', 'lp-relations', 'exit-strategist'],
  },
] as const;

/** All 16 CFO specialist agents */
export const AGENTS: AgentDefinition[] = [
  // Core Analysis
  marketAnalyst,
  dealUnderwriter,
  portfolioRiskOfficer,
  capitalAllocator,
  // Compliance & Legal
  complianceAuditor,
  legalRegulatory,
  taxStrategist,
  forensicAuditor,
  // Operations
  constructionMonitor,
  revenueOptimizer,
  proptechAdvisor,
  insuranceProtection,
  // Strategy
  esgAnalyst,
  debtStructuring,
  lpRelations,
  exitStrategist,
];

/** Map for O(1) lookup by agent ID */
const agentMap = new Map<string, AgentDefinition>(
  AGENTS.map((a) => [a.id, a])
);

/** Get an agent by ID, or null if not found */
export function getAgent(id: string): AgentDefinition | null {
  return agentMap.get(id) ?? null;
}

/** Get all agents as lightweight list items (for the UI catalog) */
export function getAgentList(): AgentListItem[] {
  return AGENTS.map(({ id, name, title, description, icon, color, practiceArea, practiceAreaShort, designation, suggestedPrompts }) => ({
    id,
    name,
    title,
    description,
    icon,
    color,
    practiceArea,
    practiceAreaShort,
    designation,
    suggestedPrompts,
  }));
}

/**
 * Auto-route: given a user message, pick the best agent.
 * Simple keyword heuristic (no LLM call needed for routing).
 */
export function routeToAgent(message: string): AgentDefinition {
  const lower = message.toLowerCase();

  // ─── New specialist agents (check first for specificity) ───

  // Tax keywords
  if (/\b(tax|gst|tds|depreciat|section 80|entity structur|income tax|deduction)\b/.test(lower)) {
    return taxStrategist;
  }

  // Legal / regulatory keywords
  if (/\b(rera|zoning|environmental clear|land title|encumbrance|legal|regulatory|crz|eia)\b/.test(lower)) {
    return legalRegulatory;
  }

  // ESG keywords
  if (/\b(esg|sustainab|carbon|green build|igbc|griha|renewable|water usage|emission)\b/.test(lower)) {
    return esgAnalyst;
  }

  // Revenue optimization keywords
  if (/\b(adr|channel mix|revenue optim|ancillary|f&b|revpar|pricing|yield manage|competitive set)\b/.test(lower)) {
    return revenueOptimizer;
  }

  // Debt structuring keywords
  if (/\b(debt|ltv|refinanc|covenant|interest swap|mezzanine|loan structur|dscr)\b/.test(lower)) {
    return debtStructuring;
  }

  // LP relations keywords
  if (/\b(lp |waterfall|distribution|capital call|nav|commitment|investor report|moic|dpi)\b/.test(lower)) {
    return lpRelations;
  }

  // Exit strategy keywords
  if (/\b(exit|cap rate|sale compar|buyer profil|transaction cost|disposition|sell)\b/.test(lower)) {
    return exitStrategist;
  }

  // Insurance keywords
  if (/\b(insurance|liability|business interrupt|hazard|flood|seismic|cyclone|d&o)\b/.test(lower)) {
    return insuranceProtection;
  }

  // PropTech keywords
  if (/\b(proptech|pms|iot|smart build|revenue management system|rms|keyless|technology stack)\b/.test(lower)) {
    return proptechAdvisor;
  }

  // Forensic keywords
  if (/\b(forensic|anomal|fraud|reconcil|benford|whistleblow|expense polic|financial statement)\b/.test(lower)) {
    return forensicAuditor;
  }

  // ─── Original 6 agents ───

  // Risk keywords
  if (/\b(risk|stress test|sensitivity|breach|concentrat|hedge|var |value.at.risk)\b/.test(lower)) {
    return portfolioRiskOfficer;
  }

  // Deal analysis / underwriting keywords
  if (/\b(underwr|ic memo|factor scor|montecarlo|monte carlo|readiness|due diligence|irr)\b/.test(lower)) {
    return dealUnderwriter;
  }

  // Construction keywords
  if (/\b(construct|budget|milestone|s-curve|scurve|overrun|change order|rfi|earned value)\b/.test(lower)) {
    return constructionMonitor;
  }

  // Compliance keywords
  if (/\b(compliance|audit|hash chain|soc2|soc 2|tamper|governance|integrity)\b/.test(lower)) {
    return complianceAuditor;
  }

  // Market keywords
  if (/\b(market|macro|city|demand|rbi|gdp|inflation|occupancy|sentiment)\b/.test(lower)) {
    return marketAnalyst;
  }

  // Capital allocation keywords
  if (/\b(allocat|deploy|capital|wacc|hurdle|portfolio optim|dry powder|efficient frontier)\b/.test(lower)) {
    return capitalAllocator;
  }

  // Default to deal underwriter (most general-purpose)
  return dealUnderwriter;
}
