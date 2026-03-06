/**
 * Agent Registry: Central catalog of all 6 CFO specialist agents.
 * Used by API routes and UI to discover and configure agents.
 */

import type { AgentDefinition, AgentListItem } from './types';
import { portfolioRiskOfficer } from './specialists/portfolio-risk-officer';
import { dealUnderwriter } from './specialists/deal-underwriter';
import { constructionMonitor } from './specialists/construction-monitor';
import { complianceAuditor } from './specialists/compliance-auditor';
import { marketAnalyst } from './specialists/market-analyst';
import { capitalAllocator } from './specialists/capital-allocator';

/** All 6 CFO specialist agents, ordered by typical usage priority */
export const AGENTS: AgentDefinition[] = [
  portfolioRiskOfficer,
  dealUnderwriter,
  constructionMonitor,
  complianceAuditor,
  marketAnalyst,
  capitalAllocator,
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
  return AGENTS.map(({ id, name, title, description, icon, color, suggestedPrompts }) => ({
    id,
    name,
    title,
    description,
    icon,
    color,
    suggestedPrompts,
  }));
}

/**
 * Auto-route: given a user message, pick the best agent.
 * Simple keyword heuristic (no LLM call needed for routing).
 */
export function routeToAgent(message: string): AgentDefinition {
  const lower = message.toLowerCase();

  // Risk keywords
  if (/\b(risk|stress test|sensitivity|breach|concentrat|hedge)\b/.test(lower)) {
    return portfolioRiskOfficer;
  }

  // Deal analysis / underwriting keywords
  if (/\b(underwr|ic memo|factor scor|montecarlo|monte carlo|readiness|due diligence|irr)\b/.test(lower)) {
    return dealUnderwriter;
  }

  // Construction keywords
  if (/\b(construct|budget|milestone|s-curve|scurve|overrun|change order|rfi)\b/.test(lower)) {
    return constructionMonitor;
  }

  // Compliance keywords
  if (/\b(compliance|audit|hash chain|soc2|soc 2|tamper|governance|integrity)\b/.test(lower)) {
    return complianceAuditor;
  }

  // Market keywords
  if (/\b(market|macro|city|demand|rbi|gdp|inflation|revpar|occupancy)\b/.test(lower)) {
    return marketAnalyst;
  }

  // Capital allocation keywords
  if (/\b(allocat|deploy|capital|wacc|hurdle|portfolio optim|dry powder)\b/.test(lower)) {
    return capitalAllocator;
  }

  // Default to deal underwriter (most general-purpose)
  return dealUnderwriter;
}
