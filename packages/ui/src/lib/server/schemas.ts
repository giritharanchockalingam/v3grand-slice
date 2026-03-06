/**
 * Zod validation schemas for all API inputs.
 * Prevents injection, enforces type safety, limits field lengths.
 */
import { z } from 'zod';

// Sanitize string - trim and limit length
const safeString = (max = 500) => z.string().trim().max(max);
const safeId = z.string().uuid('Invalid ID format');

export const createDealSchema = z.object({
  name: safeString(200).min(1, 'Deal name required'),
  assetClass: z.enum(['hotel', 'residential', 'commercial', 'mixed-use', 'industrial']),
  city: safeString(100).optional(),
  state: safeString(100).optional(),
  totalInvestment: z.number().positive().max(1e12),
  targetIRR: z.number().min(0).max(1).optional(),
});

export const updateDealSchema = createDealSchema.partial();

export const createRiskSchema = z.object({
  dealId: safeId,
  category: z.enum(['market', 'construction', 'financial', 'regulatory', 'operational', 'environmental']),
  title: safeString(300),
  description: safeString(2000).optional(),
  likelihood: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  mitigationPlan: safeString(2000).optional(),
});

export const investAnalyzeSchema = z.object({
  propertyName: safeString(200).min(1),
  city: safeString(100).min(1),
  state: safeString(100).min(1),
  starRating: z.number().int().min(1).max(7),
  roomCount: z.number().int().min(1).max(5000),
  landAreaAcres: z.number().positive().max(10000),
  investmentAmountCr: z.number().positive().max(100000),
  dealType: z.enum(['new_build', 'renovation', 'acquisition']),
  partnershipType: z.enum(['solo', 'partnership']),
  returnLevel: z.enum(['conservative', 'moderate', 'aggressive']),
  riskComfort: z.enum(['low', 'medium', 'high']),
  timelineYears: z.number().int().min(1).max(30),
});

export const agentChatSchema = z.object({
  agentId: safeString(50).min(1),
  message: safeString(10000).min(1),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: safeString(50000),
  })).max(50).optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type InvestAnalyzeInput = z.infer<typeof investAnalyzeSchema>;
export type AgentChatInput = z.infer<typeof agentChatSchema>;
