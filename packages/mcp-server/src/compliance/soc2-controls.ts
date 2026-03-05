// ─── SOC 2 / ISAE 3402 Control Matrix (MCP server copy — no API dependency) ─
// Same control definitions as packages/api/src/compliance/soc2-controls.ts
// for get_compliance_controls MCP tool.

export interface Control {
  id: string;
  tscCriteria: string;
  title: string;
  description: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  controlType: 'preventive' | 'detective' | 'corrective';
  automated: boolean;
  implementation: string;
  evidenceLocation: string;
  testingProcedure: string;
  riskAddressed: string;
}

export const SOC2_CONTROLS: Control[] = [
  {
    id: 'CC5-01',
    tscCriteria: 'CC5.1',
    title: 'Engine Result Hash Chain Integrity',
    description: 'Every engine result is cryptographically hash-chained (SHA-256). Each result contains a content hash computed from its predecessor hash, engine name, version, input, and output. Tamper with any historical result and all subsequent hashes become invalid.',
    frequency: 'continuous',
    controlType: 'detective',
    automated: true,
    implementation: 'packages/engines/src/integrity/hash-chain.ts — computeContentHash() and verifyHashChain()',
    evidenceLocation: 'engine_results table — content_hash and previous_hash columns',
    testingProcedure: 'Run verifyHashChain() on all engine results for a sample of deals. Verify no broken chains. Attempt to modify a historical result and confirm chain validation fails.',
    riskAddressed: 'Unauthorized modification of engine results',
  },
  {
    id: 'CC5-02',
    tscCriteria: 'CC5.1',
    title: 'Append-Only Engine Results',
    description: 'Engine results are insert-only with monotonically increasing version numbers. No UPDATE or DELETE operations are permitted on the engine_results table.',
    frequency: 'continuous',
    controlType: 'preventive',
    automated: true,
    implementation: 'Database schema with unique version index; application code uses INSERT only via insertEngineResult()',
    evidenceLocation: 'engine_results table — version column with unique index',
    testingProcedure: 'Verify no UPDATE or DELETE queries in application code for engine_results. Check database audit logs for any non-INSERT operations on this table.',
    riskAddressed: 'Loss or modification of historical computation records',
  },
  {
    id: 'CC5-03',
    tscCriteria: 'CC5.2',
    title: 'Four-Eyes Approval for Critical Actions',
    description: 'Material assumption changes, scenario promotions, and deal status changes require approval from a different user than the initiator. Segregation of duties enforced — same person cannot initiate and approve.',
    frequency: 'continuous',
    controlType: 'preventive',
    automated: true,
    implementation: 'packages/api/src/services/approval.ts — createPendingAction() and reviewPendingAction()',
    evidenceLocation: 'pending_actions table — initiator_id vs reviewer_id, materiality classification',
    testingProcedure: 'For a sample of approved actions, verify initiator_id !== reviewer_id. Verify HIGH materiality actions were approved by admin or lead-investor role. Attempt to self-approve and confirm rejection.',
    riskAddressed: 'Unauthorized or unreviewed changes to deal parameters',
  },
  {
    id: 'CC6-01',
    tscCriteria: 'CC6.1',
    title: 'JWT Authentication on All API Endpoints',
    description: 'Every API endpoint (except health check) requires a valid JWT token. Tokens expire after 24 hours and are signed with HMAC-SHA256.',
    frequency: 'continuous',
    controlType: 'preventive',
    automated: true,
    implementation: 'packages/api/src/middleware/auth.ts — authGuard hook on all routes',
    evidenceLocation: 'Fastify route registrations with preHandler: authGuard',
    testingProcedure: 'Attempt to access API endpoints without token — verify 401 response. Attempt with expired token — verify 401. Attempt with tampered token — verify 401.',
    riskAddressed: 'Unauthorized API access',
  },
  {
    id: 'CC6-02',
    tscCriteria: 'CC6.2',
    title: 'Role-Based Access Control (RBAC)',
    description: 'Users have system-level roles (viewer, analyst, lead-investor, admin) and deal-level access grants. Critical operations (deal creation, revaluation) require specific roles.',
    frequency: 'continuous',
    controlType: 'preventive',
    automated: true,
    implementation: 'packages/api/src/middleware/auth.ts — requireRole(); packages/db — dealAccess table',
    evidenceLocation: 'deal_access table, route registrations with requireRole()',
    testingProcedure: 'Attempt to create a deal with viewer role — verify 403. Attempt to revalue with viewer role — verify 403. Verify deal_access table enforces per-deal isolation.',
    riskAddressed: 'Privilege escalation and unauthorized deal access',
  },
  {
    id: 'CC6-03',
    tscCriteria: 'CC6.3',
    title: 'Rate Limiting and API Throttling',
    description: 'Per-IP rate limiting prevents abuse and DDoS. Default: 100 requests per minute per IP. Configurable via RATE_LIMIT_MAX environment variable.',
    frequency: 'continuous',
    controlType: 'preventive',
    automated: true,
    implementation: 'packages/api/src/middleware/rate-limit.ts — rateLimitHook',
    evidenceLocation: 'Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    testingProcedure: 'Send >100 requests in 60 seconds from same IP. Verify 429 response after threshold. Verify rate limit headers in normal responses.',
    riskAddressed: 'Denial of service, API abuse',
  },
  {
    id: 'CC2-01',
    tscCriteria: 'CC2.1',
    title: 'Comprehensive Audit Trail',
    description: 'Every mutation (assumption change, engine run, scenario promotion, month advance) is logged with user ID, role, module, action, timestamp, and before/after diff.',
    frequency: 'continuous',
    controlType: 'detective',
    automated: true,
    implementation: 'insertAuditEntry() called in all routes and recompute service',
    evidenceLocation: 'audit_log table with deal_id, user_id, role, module, action, diff JSONB',
    testingProcedure: 'For each type of mutation, verify a corresponding audit_log entry exists with correct user, action, and diff. Verify no mutation operations exist without audit logging.',
    riskAddressed: 'Untracked changes to deal data',
  },
  {
    id: 'CC2-02',
    tscCriteria: 'CC2.2',
    title: 'Market Data Provenance Tracking',
    description: 'Every market data indicator carries per-source metadata (asOfDate, source name, sourceType). Market data history is append-only logged for every fetch. UI displays provenance badges.',
    frequency: 'continuous',
    controlType: 'detective',
    automated: true,
    implementation: 'packages/mcp/src/types.ts — IndicatorMeta; packages/db — market_data_history table',
    evidenceLocation: 'market_data_history table; IndicatorMeta in API responses',
    testingProcedure: 'Verify every macro API response includes indicators with asOfDate, source, and sourceType. Verify market_data_history contains entries for each fetch.',
    riskAddressed: 'Use of stale or unattributed market data in investment decisions',
  },
  {
    id: 'CC3-01',
    tscCriteria: 'CC3.1',
    title: 'Model Validation Framework',
    description: 'Engine models undergo periodic back-testing against historical deals. Validation metrics (RMSE, MAE, calibration, verdict accuracy) are computed and compared against thresholds. Results stored in model_validation_results table.',
    frequency: 'quarterly',
    controlType: 'detective',
    automated: false,
    implementation: 'packages/engines/src/validation/model-validator.ts — runBacktest()',
    evidenceLocation: 'model_validation_results table',
    testingProcedure: 'Verify quarterly validation runs exist for each HIGH materiality model. Verify all passed validation or have documented exceptions.',
    riskAddressed: 'Model degradation, prediction inaccuracy',
  },
  {
    id: 'CC3-02',
    tscCriteria: 'CC3.2',
    title: 'Stress Testing',
    description: 'Deal portfolios undergo scenario shock analysis (rate hike, demand crash, CAPEX overrun, perfect storm) and reverse stress testing (find parameter values that break the deal).',
    frequency: 'quarterly',
    controlType: 'detective',
    automated: false,
    implementation: 'packages/engines/src/stress/stress-test.ts — runScenarioShocks(), runReverseStressTest()',
    evidenceLocation: 'Stress test results stored as engine_results with triggeredBy="stress-test"',
    testingProcedure: 'Verify quarterly stress test reports exist for active deals. Verify reverse stress test headroom documented for each key parameter.',
    riskAddressed: 'Unidentified tail risks and concentration risk',
  },
  {
    id: 'CC7-01',
    tscCriteria: 'CC7.1',
    title: 'Data Quality Monitoring',
    description: 'Aggregate data quality score (0-100) computed for market data with freshness, reliability, completeness, and consistency sub-scores. Warnings generated for stale, fallback, or inconsistent data.',
    frequency: 'continuous',
    controlType: 'detective',
    automated: true,
    implementation: 'packages/mcp/src/data-quality.ts — computeDataQualityScore()',
    evidenceLocation: 'GET /market/quality API endpoint',
    testingProcedure: 'Verify data quality score is computed and returned. Verify warnings are generated when data is stale or using fallback sources.',
    riskAddressed: 'Investment decisions based on poor quality market data',
  },
  {
    id: 'CC7-02',
    tscCriteria: 'CC7.2',
    title: 'Domain Event Processing',
    description: 'Event sourcing with idempotency keys, retry counts, and dead letter status. Events are processed exactly once. Failed events retry up to 3 times before dead-lettering.',
    frequency: 'continuous',
    controlType: 'corrective',
    automated: true,
    implementation: 'domain_events table with status lifecycle (PENDING → PROCESSED → FAILED → DEAD_LETTER)',
    evidenceLocation: 'domain_events table — status, retry_count, processed_at columns',
    testingProcedure: 'Verify no events in DEAD_LETTER status during normal operation. Simulate event processing failure and verify retry behavior. Verify idempotency key prevents duplicate processing.',
    riskAddressed: 'Lost or duplicated event processing',
  },
  {
    id: 'CC8-01',
    tscCriteria: 'CC8.1',
    title: 'Model Version Registry',
    description: 'Every engine result is tagged with the model version (semantic version) that produced it. Model inventory documents each version\'s methodology and limitations.',
    frequency: 'continuous',
    controlType: 'preventive',
    automated: true,
    implementation: 'packages/engines/src/integrity/hash-chain.ts — MODEL_VERSIONS; engine_results.model_version column',
    evidenceLocation: 'engine_results table — model_version column; MODEL_INVENTORY in model-inventory.ts',
    testingProcedure: 'Verify all engine results have a non-default model_version. Verify MODEL_INVENTORY contains entries for all current model versions.',
    riskAddressed: 'Untracked model changes affecting investment recommendations',
  },
  {
    id: 'CC1-01',
    tscCriteria: 'CC1.3',
    title: 'Data Retention and Right to Erasure',
    description: 'Users table includes soft delete (deleted_at), data retention expiry (data_retention_expires_at), and consent tracking (consent_given, consent_timestamp). Personal data can be anonymized upon erasure request.',
    frequency: 'monthly',
    controlType: 'corrective',
    automated: false,
    implementation: 'packages/db/src/schema — users table with deletedAt, dataRetentionExpiresAt, consentGiven, consentTimestamp columns',
    evidenceLocation: 'users table',
    testingProcedure: 'Verify soft-deleted users cannot authenticate. Verify data retention expiry dates are set for all users. Verify erasure process anonymizes personal data.',
    riskAddressed: 'Non-compliance with DPDP Act 2023 / GDPR data subject rights',
  },
];

function generateControlMatrix(): {
  totalControls: number;
  byType: Record<string, number>;
  byFrequency: Record<string, number>;
  automatedPct: number;
} {
  const byType: Record<string, number> = {};
  const byFrequency: Record<string, number> = {};
  let automated = 0;
  for (const c of SOC2_CONTROLS) {
    byType[c.controlType] = (byType[c.controlType] ?? 0) + 1;
    byFrequency[c.frequency] = (byFrequency[c.frequency] ?? 0) + 1;
    if (c.automated) automated++;
  }
  return {
    totalControls: SOC2_CONTROLS.length,
    byType,
    byFrequency,
    automatedPct: Math.round((automated / SOC2_CONTROLS.length) * 100),
  };
}

/** Returns controls and summary for MCP get_compliance_controls tool. */
export function getComplianceControlsSummary(): { controls: Control[]; summary: ReturnType<typeof generateControlMatrix> } {
  return { controls: SOC2_CONTROLS, summary: generateControlMatrix() };
}
