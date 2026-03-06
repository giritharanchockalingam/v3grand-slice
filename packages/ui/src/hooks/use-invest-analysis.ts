'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

/** Wizard input shape matching the API */
export interface InvestWizardInput {
  propertyName: string;
  city: string;
  state: string;
  starRating: number;
  roomCount: number;
  landAreaAcres: number;
  investmentAmountCr: number;
  dealType: 'new_build' | 'renovation' | 'acquisition';
  partnershipType: 'solo' | 'partnership';
  returnLevel: 'conservative' | 'moderate' | 'aggressive';
  riskComfort: 'low' | 'medium' | 'high';
  timelineYears: number;

  // Location (Google Maps)
  propertyAddress: string;
  latitude: number;
  longitude: number;
  distanceToAirportKm: number;
  nearestAirport: string;

  // Property Classification
  propertyType: 'luxury_resort' | 'business_hotel' | 'budget_hotel' | 'heritage' | 'boutique' | 'mixed_use';
  propertyAge?: number;
  constructionTimelineMonths?: number;
  currentOccupancyPct?: number;

  // Market Context
  cityTier: 'tier1' | 'tier2' | 'tier3';
  marketSegment: 'tourist' | 'business' | 'pilgrimage' | 'medical' | 'mixed';
  competingHotelsNearby?: number;

  // Financial Context
  existingDebtCr?: number;
  knownRevparInr?: number;

  // Demand Segmentation (from presentation)
  demandCorporatePct: number;    // % of demand from corporate
  demandMedicalPct: number;      // % from medical tourism
  demandLeisurePct: number;      // % from leisure/tourist
  demandMicePct: number;         // % from MICE (meetings/conferences)

  // Anchor Partnerships
  hasAnchorPartnership: boolean;
  anchorType?: 'medical' | 'corporate' | 'government' | 'mixed';
  anchorCommittedNightsPerMonth?: number;  // Guaranteed room nights/month from anchor MoUs

  // Brand Affiliation
  brandStrategy: 'independent' | 'franchise' | 'management_contract' | 'undecided';
  preferredBrand?: string;       // e.g. 'IHG', 'Marriott', 'Taj'

  // Partner Equity Structure (if partnership)
  leadInvestorPct?: number;      // Lead investor equity %
  partner2Pct?: number;          // Partner 2 equity %
  partner3Pct?: number;          // Partner 3 equity %
}

/** Single agent result */
export interface AgentResult {
  agentId: string;
  agentName: string;
  agentIcon: string;
  reply: string;
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: string;
    durationMs?: number;
  }>;
  durationMs: number;
  error?: string;
}

/** Complete analysis response */
export interface InvestAnalysisResponse {
  dealId: string;
  dealName: string;
  verdict: 'YES' | 'NO' | 'MAYBE';
  confidence: number;
  summary: string;
  keyMetrics: {
    expectedReturn: string;
    riskLevel: string;
    marketOutlook: string;
    timelineConfidence: string;
  };
  agentResults: AgentResult[];
  warnings: string[];
}

export type AnalysisStatus = 'idle' | 'analyzing' | 'complete' | 'error';

export function useInvestAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [result, setResult] = useState<InvestAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const analyze = useCallback(async (input: InvestWizardInput) => {
    setStatus('analyzing');
    setError(null);
    setResult(null);
    setElapsedSeconds(0);

    // Start elapsed time counter
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      // Use apiClient which auto-injects the auth token
      const data = await apiClient.post<InvestAnalysisResponse>('/invest/analyze', input);

      clearInterval(timer);
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

      setResult(data);
      setStatus('complete');
      return data;
    } catch (err) {
      clearInterval(timer);
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setElapsedSeconds(0);
  }, []);

  return { status, result, error, elapsedSeconds, analyze, reset };
}
