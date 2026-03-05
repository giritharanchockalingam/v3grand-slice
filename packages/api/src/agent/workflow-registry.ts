/**
 * Fixed workflow recipes (HMS-style). No YAML; recipes defined in code.
 * Builds ExecutionPlan from workflow name + input.
 */

import type {
  ExecutionPlan,
  WorkflowStep,
  VerificationCheck,
  WorkflowType,
} from './orchestrator-types.js';

export interface WorkflowSpec {
  name: string;
  type: WorkflowType;
  description: string;
  inputRequired: string[]; // e.g. [] or ['dealId']
  buildPlan: (input: Record<string, unknown>) => Omit<ExecutionPlan, 'planId' | 'createdAt'>;
}

/** Get value from tool result content (first JSON-like content item). */
export function getValueFromToolContent(content: Array<{ type: string; text?: string }>, path: string): unknown {
  for (const c of content) {
    if (c.type === 'text' && c.text) {
      try {
        const data = JSON.parse(c.text) as unknown;
        return getNestedValue(data, path);
      } catch {
        // not JSON, skip
      }
    }
  }
  return undefined;
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.replace(/\.(\d+)/g, '.[$1]').split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (part.match(/^\d+$/)) {
      current = (current as unknown[])[Number(part)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

/** Resolve $stepId.path in args from stepResults map (values are tool result content arrays). */
export function resolveStepRefs(
  args: Record<string, unknown>,
  stepResults: Map<string, Array<{ type: string; text?: string }>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.startsWith('$') && v.includes('.')) {
      const [stepId, path] = v.slice(1).split(/\.(.+)/);
      const content = stepResults.get(stepId);
      out[k] = content ? getValueFromToolContent(content, path) : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const SERVER: 'v3grand' = 'v3grand';

/** deal_dashboard_stress: list deals → get first dealId → get_deal_dashboard + run_stress_test; verify dashboard has deal and stress has shocks */
export const DEAL_DASHBOARD_STRESS: WorkflowSpec = {
  name: 'deal_dashboard_stress',
  type: 'deal_dashboard_stress',
  description: 'Dashboard & stress test (first deal)',
  inputRequired: [],
  buildPlan(input: Record<string, unknown>) {
    const steps: WorkflowStep[] = [
      {
        id: 'list_deals',
        description: 'List deals',
        server: SERVER,
        tool: 'list_deals',
        args: { limit: 10 },
        dependsOn: [],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
      {
        id: 'get_dashboard',
        description: 'Get dashboard for first deal',
        server: SERVER,
        tool: 'get_deal_dashboard',
        args: { dealId: '$list_deals.deals.0.id' },
        dependsOn: ['list_deals'],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
      {
        id: 'run_stress',
        description: 'Run stress test for first deal',
        server: SERVER,
        tool: 'run_stress_test',
        args: { dealId: '$list_deals.deals.0.id' },
        dependsOn: ['list_deals'],
        isReadOnly: false,
        isVerification: false,
        maxRetries: 2,
      },
    ];
    const verificationChecks: VerificationCheck[] = [
      {
        description: 'Dashboard contains deal',
        server: SERVER,
        tool: 'get_deal_dashboard',
        args: { dealId: '$list_deals.deals.0.id' },
        assertion: { field: 'deal.id', operator: 'exists', expected: true },
      },
      {
        description: 'Stress test returned shocks',
        server: SERVER,
        tool: 'run_stress_test',
        args: { dealId: '$list_deals.deals.0.id' },
        assertion: { field: 'shocks', operator: 'exists', expected: true },
      },
    ];
    return {
      workflowType: 'deal_dashboard_stress',
      steps,
      expectedOutcome: 'Dashboard and stress test results for first deal',
      verificationChecks,
      context: input,
    };
  },
};

/** deal_summary_validation: optional dealId → get_deal_dashboard + get_validation_models; verify recommendation exists */
export const DEAL_SUMMARY_VALIDATION: WorkflowSpec = {
  name: 'deal_summary_validation',
  type: 'deal_summary_validation',
  description: 'Deal summary & validation',
  inputRequired: ['dealId'],
  buildPlan(input: Record<string, unknown>) {
    const dealId = input.dealId as string;
    const steps: WorkflowStep[] = [
      {
        id: 'get_dashboard',
        description: 'Get deal dashboard',
        server: SERVER,
        tool: 'get_deal_dashboard',
        args: { dealId },
        dependsOn: [],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
      {
        id: 'get_models',
        description: 'Get validation models',
        server: SERVER,
        tool: 'get_validation_models',
        args: {},
        dependsOn: [],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
    ];
    const verificationChecks: VerificationCheck[] = [
      {
        description: 'Dashboard has recommendation',
        server: SERVER,
        tool: 'get_deal_dashboard',
        args: { dealId },
        assertion: { field: 'latestRecommendation', operator: 'exists', expected: true },
      },
    ];
    return {
      workflowType: 'deal_summary_validation',
      steps,
      expectedOutcome: 'Deal summary and validation model list',
      verificationChecks,
      context: input,
    };
  },
};

/** market_and_deal_health: macro + market health + list deals + first deal dashboard; verify data present */
export const MARKET_AND_DEAL_HEALTH: WorkflowSpec = {
  name: 'market_and_deal_health',
  type: 'market_and_deal_health',
  description: 'Market & deal health check',
  inputRequired: [],
  buildPlan(input: Record<string, unknown>) {
    const steps: WorkflowStep[] = [
      {
        id: 'macro',
        description: 'Get macro indicators',
        server: SERVER,
        tool: 'get_macro_indicators',
        args: {},
        dependsOn: [],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
      {
        id: 'market_health',
        description: 'Get market data health',
        server: SERVER,
        tool: 'market_health',
        args: {},
        dependsOn: [],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
      {
        id: 'list_deals',
        description: 'List deals',
        server: SERVER,
        tool: 'list_deals',
        args: { limit: 5 },
        dependsOn: [],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
      {
        id: 'get_dashboard',
        description: 'Get dashboard for first deal',
        server: SERVER,
        tool: 'get_deal_dashboard',
        args: { dealId: '$list_deals.deals.0.id' },
        dependsOn: ['list_deals'],
        isReadOnly: true,
        isVerification: false,
        maxRetries: 2,
      },
    ];
    const verificationChecks: VerificationCheck[] = [
      {
        description: 'Macro indicators returned',
        server: SERVER,
        tool: 'get_macro_indicators',
        args: {},
        assertion: { field: 'data', operator: 'exists', expected: true },
      },
      {
        description: 'Dashboard contains deal',
        server: SERVER,
        tool: 'get_deal_dashboard',
        args: { dealId: '$list_deals.deals.0.id' },
        assertion: { field: 'deal.id', operator: 'exists', expected: true },
      },
    ];
    return {
      workflowType: 'market_and_deal_health',
      steps,
      expectedOutcome: 'Market and deal pipeline health snapshot',
      verificationChecks,
      context: input,
    };
  },
};

/** deal_ic_readiness: dashboard + stress + sensitivity + verify chain + compliance + risks; IC memo summary */
export const DEAL_IC_READINESS: WorkflowSpec = {
  name: 'deal_ic_readiness',
  type: 'deal_ic_readiness',
  description: 'IC readiness',
  inputRequired: ['dealId'],
  buildPlan(input: Record<string, unknown>) {
    const dealId = input.dealId as string;
    const steps: WorkflowStep[] = [
      { id: 'get_dashboard', description: 'Get deal dashboard', server: SERVER, tool: 'get_deal_dashboard', args: { dealId }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'run_stress', description: 'Run stress test', server: SERVER, tool: 'run_stress_test', args: { dealId }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'run_sensitivity', description: 'Run sensitivity (ADR)', server: SERVER, tool: 'run_sensitivity', args: { dealId, parameter: 'adr', min: 0.8, max: 1.2, steps: 10 }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'verify_chain', description: 'Verify hash chain (factor)', server: SERVER, tool: 'verify_hash_chain', args: { dealId, engine: 'factor' }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'get_compliance', description: 'Get compliance controls', server: SERVER, tool: 'get_compliance_controls', args: {}, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'get_risks', description: 'Get risks', server: SERVER, tool: 'get_risks', args: { dealId }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
    ];
    const verificationChecks: VerificationCheck[] = [
      { description: 'Dashboard has recommendation', server: SERVER, tool: 'get_deal_dashboard', args: { dealId }, assertion: { field: 'latestRecommendation', operator: 'exists', expected: true } },
      { description: 'Stress returned shocks', server: SERVER, tool: 'run_stress_test', args: { dealId }, assertion: { field: 'shocks', operator: 'exists', expected: true } },
      { description: 'Sensitivity returned results', server: SERVER, tool: 'run_sensitivity', args: { dealId, parameter: 'adr', min: 0.8, max: 1.2, steps: 10 }, assertion: { field: 'sensitivity', operator: 'exists', expected: true } },
      { description: 'Hash chain valid', server: SERVER, tool: 'verify_hash_chain', args: { dealId, engine: 'factor' }, assertion: { field: 'valid', operator: 'eq', expected: true }, advisory: true },
    ];
    return { workflowType: 'deal_ic_readiness', steps, expectedOutcome: 'IC readiness summary with stress, sensitivity, chain, risks', verificationChecks, context: input };
  },
};

/** deal_market_alignment: deal + city profile + demand + construction; compare assumptions to market */
export const DEAL_MARKET_ALIGNMENT: WorkflowSpec = {
  name: 'deal_market_alignment',
  type: 'deal_market_alignment',
  description: 'Deal vs market alignment',
  inputRequired: ['dealId'],
  buildPlan(input: Record<string, unknown>) {
    const dealId = input.dealId as string;
    const steps: WorkflowStep[] = [
      { id: 'get_deal', description: 'Get deal', server: SERVER, tool: 'get_deal', args: { dealId }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'get_city', description: 'Get city profile', server: SERVER, tool: 'get_city_profile', args: { city: '$get_deal.property.location.city' }, dependsOn: ['get_deal'], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'get_demand', description: 'Get demand signals', server: SERVER, tool: 'get_demand_signals', args: { city: '$get_deal.property.location.city' }, dependsOn: ['get_deal'], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'get_construction', description: 'Get construction costs', server: SERVER, tool: 'get_construction_costs', args: {}, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
    ];
    const verificationChecks: VerificationCheck[] = [
      { description: 'Deal has property', server: SERVER, tool: 'get_deal', args: { dealId }, assertion: { field: 'property', operator: 'exists', expected: true } },
    ];
    return { workflowType: 'deal_market_alignment', steps, expectedOutcome: 'Deal vs market comparison', verificationChecks, context: input };
  },
};

/** deal_full_recompute_verify: factor → montecarlo → budget → scurve → dashboard → verify chain */
export const DEAL_FULL_RECOMPUTE_VERIFY: WorkflowSpec = {
  name: 'deal_full_recompute_verify',
  type: 'deal_full_recompute_verify',
  description: 'Full recompute & verify',
  inputRequired: ['dealId'],
  buildPlan(input: Record<string, unknown>) {
    const dealId = input.dealId as string;
    const steps: WorkflowStep[] = [
      { id: 'run_factor', description: 'Run factor', server: SERVER, tool: 'run_factor', args: { dealId }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'run_mc', description: 'Run Monte Carlo', server: SERVER, tool: 'run_montecarlo', args: { dealId }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'run_budget', description: 'Run budget', server: SERVER, tool: 'run_budget', args: { dealId }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'run_scurve', description: 'Run S-Curve', server: SERVER, tool: 'run_scurve', args: { dealId }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'get_dashboard', description: 'Get dashboard', server: SERVER, tool: 'get_deal_dashboard', args: { dealId }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'verify_chain', description: 'Verify hash chain', server: SERVER, tool: 'verify_hash_chain', args: { dealId, engine: 'factor' }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
    ];
    const verificationChecks: VerificationCheck[] = [
      { description: 'Dashboard has recommendation', server: SERVER, tool: 'get_deal_dashboard', args: { dealId }, assertion: { field: 'latestRecommendation', operator: 'exists', expected: true } },
      { description: 'Hash chain valid', server: SERVER, tool: 'verify_hash_chain', args: { dealId, engine: 'factor' }, assertion: { field: 'valid', operator: 'eq', expected: true }, advisory: true },
    ];
    return { workflowType: 'deal_full_recompute_verify', steps, expectedOutcome: 'Full recompute and integrity check', verificationChecks, context: input };
  },
};

/** deal_stress_to_risks: run stress test; verification that shocks exist (risk suggestions via get_risks / create_risk separately) */
export const DEAL_STRESS_TO_RISKS: WorkflowSpec = {
  name: 'deal_stress_to_risks',
  type: 'deal_stress_to_risks',
  description: 'Stress test → risk register',
  inputRequired: ['dealId'],
  buildPlan(input: Record<string, unknown>) {
    const dealId = input.dealId as string;
    const steps: WorkflowStep[] = [
      { id: 'run_stress', description: 'Run stress test', server: SERVER, tool: 'run_stress_test', args: { dealId }, dependsOn: [], isReadOnly: false, isVerification: false, maxRetries: 2 },
      { id: 'get_risks', description: 'Get current risks', server: SERVER, tool: 'get_risks', args: { dealId }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
    ];
    const verificationChecks: VerificationCheck[] = [
      { description: 'Stress returned shocks', server: SERVER, tool: 'run_stress_test', args: { dealId }, assertion: { field: 'shocks', operator: 'exists', expected: true } },
    ];
    return { workflowType: 'deal_stress_to_risks', steps, expectedOutcome: 'Stress results and risk list for IC', verificationChecks, context: input };
  },
};

/** market_snapshot_for_deal: macro + city profile + demand + construction for a city (for deal create) */
export const MARKET_SNAPSHOT_FOR_DEAL: WorkflowSpec = {
  name: 'market_snapshot_for_deal',
  type: 'market_snapshot_for_deal',
  description: 'Market snapshot for deal create',
  inputRequired: [],
  buildPlan(input: Record<string, unknown>) {
    const city = (input.city as string) || 'Mumbai';
    const steps: WorkflowStep[] = [
      { id: 'macro', description: 'Get macro indicators', server: SERVER, tool: 'get_macro_indicators', args: {}, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'city_profile', description: 'Get city profile', server: SERVER, tool: 'get_city_profile', args: { city }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'demand', description: 'Get demand signals', server: SERVER, tool: 'get_demand_signals', args: { city }, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
      { id: 'construction', description: 'Get construction costs', server: SERVER, tool: 'get_construction_costs', args: {}, dependsOn: [], isReadOnly: true, isVerification: false, maxRetries: 2 },
    ];
    const verificationChecks: VerificationCheck[] = [
      { description: 'Macro data present', server: SERVER, tool: 'get_macro_indicators', args: {}, assertion: { field: 'repoRate', operator: 'exists', expected: true } },
      { description: 'City profile present', server: SERVER, tool: 'get_city_profile', args: { city }, assertion: { field: 'city', operator: 'exists', expected: true } },
    ];
    return { workflowType: 'market_snapshot_for_deal', steps, expectedOutcome: 'Market and macro snapshot for deal create', verificationChecks, context: input };
  },
};

const REGISTRY = new Map<string, WorkflowSpec>();
REGISTRY.set(DEAL_DASHBOARD_STRESS.name, DEAL_DASHBOARD_STRESS);
REGISTRY.set(DEAL_SUMMARY_VALIDATION.name, DEAL_SUMMARY_VALIDATION);
REGISTRY.set(MARKET_AND_DEAL_HEALTH.name, MARKET_AND_DEAL_HEALTH);
REGISTRY.set(DEAL_IC_READINESS.name, DEAL_IC_READINESS);
REGISTRY.set(DEAL_MARKET_ALIGNMENT.name, DEAL_MARKET_ALIGNMENT);
REGISTRY.set(DEAL_FULL_RECOMPUTE_VERIFY.name, DEAL_FULL_RECOMPUTE_VERIFY);
REGISTRY.set(DEAL_STRESS_TO_RISKS.name, DEAL_STRESS_TO_RISKS);
REGISTRY.set(MARKET_SNAPSHOT_FOR_DEAL.name, MARKET_SNAPSHOT_FOR_DEAL);

export function getWorkflow(name: string): WorkflowSpec | undefined {
  return REGISTRY.get(name);
}

export function listWorkflows(): Array<{ name: string; type: WorkflowType; description: string; inputRequired: string[] }> {
  return Array.from(REGISTRY.values()).map((s) => ({
    name: s.name,
    type: s.type,
    description: s.description,
    inputRequired: s.inputRequired,
  }));
}
