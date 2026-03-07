'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInvestAnalysis, type InvestWizardInput, type AnalysisStatus } from '@/hooks/use-invest-analysis';
import GoogleMapsLocationInput, { type LocationData } from '@/components/GoogleMapsLocationInput';

/* ─── Constants ─── */
const STEPS = [
  { id: 1, name: 'Property', title: 'Location & Property Details' },
  { id: 2, name: 'Investment', title: 'Investment & Financing' },
  { id: 3, name: 'Expectations', title: 'What are you hoping for?' },
  { id: 4, name: 'Review', title: 'Review & analyze' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Puducherry',
];

const AGENT_PHASES = [
  // Core Analysis
  { icon: '🌍', name: 'Market Analyst', desc: 'Studying market conditions...' },
  { icon: '📊', name: 'Deal Underwriter', desc: 'Running financial models...' },
  { icon: '🛡️', name: 'Risk Officer', desc: 'Assessing risks...' },
  { icon: '💰', name: 'Capital Advisor', desc: 'Optimizing allocation...' },
  // Compliance & Legal
  { icon: '🔒', name: 'Compliance Officer', desc: 'Verifying compliance...' },
  { icon: '⚖️', name: 'Legal Advisor', desc: 'Checking regulations...' },
  { icon: '🏛️', name: 'Tax Strategist', desc: 'Analyzing tax impact...' },
  { icon: '🔬', name: 'Forensic Auditor', desc: 'Validating financials...' },
  // Operations
  { icon: '🏗️', name: 'Construction Monitor', desc: 'Checking budget & timeline...' },
  { icon: '📈', name: 'Revenue Optimizer', desc: 'Maximizing revenue...' },
  { icon: '💡', name: 'PropTech Advisor', desc: 'Evaluating technology...' },
  { icon: '🛡️', name: 'Insurance Advisor', desc: 'Assessing coverage...' },
  // Strategy
  { icon: '🌱', name: 'ESG Analyst', desc: 'Evaluating sustainability...' },
  { icon: '🏦', name: 'Debt Advisor', desc: 'Structuring financing...' },
  { icon: '🤝', name: 'LP Relations', desc: 'Modeling distributions...' },
  { icon: '🎯', name: 'Exit Strategist', desc: 'Planning exit options...' },
];

const PROPERTY_TYPES = [
  { value: 'luxury_resort' as const, label: 'Luxury Resort', icon: '👑' },
  { value: 'business_hotel' as const, label: 'Business Hotel', icon: '💼' },
  { value: 'budget_hotel' as const, label: 'Budget Hotel', icon: '💰' },
  { value: 'heritage' as const, label: 'Heritage', icon: '🏛️' },
  { value: 'boutique' as const, label: 'Boutique', icon: '✨' },
  { value: 'mixed_use' as const, label: 'Mixed Use', icon: '🔄' },
];

const CITY_TIERS = [
  { value: 'tier1' as const, label: 'Tier 1 Metro', desc: 'Mumbai, Delhi, Bangalore...' },
  { value: 'tier2' as const, label: 'Tier 2 City', desc: 'Jaipur, Kochi, Udaipur...' },
  { value: 'tier3' as const, label: 'Tier 3 Emerging', desc: 'Smaller cities & towns' },
];

const MARKET_SEGMENTS = [
  { value: 'tourist' as const, label: 'Tourist Destination', icon: '🏖️' },
  { value: 'business' as const, label: 'Business Hub', icon: '💼' },
  { value: 'pilgrimage' as const, label: 'Pilgrimage', icon: '🙏' },
  { value: 'medical' as const, label: 'Medical Tourism', icon: '🏥' },
  { value: 'mixed' as const, label: 'Mixed / Multi-Segment', icon: '🌐' },
];

const BRAND_STRATEGIES = [
  { value: 'independent' as const, label: 'Independent', icon: '🏨', desc: 'Full control, no franchise fees' },
  { value: 'franchise' as const, label: 'Franchise', icon: '🏷️', desc: 'Brand name + distribution, 8-12% fee' },
  { value: 'management_contract' as const, label: 'Managed', icon: '🤝', desc: 'Operator runs it, ~3% base + 10% incentive' },
  { value: 'undecided' as const, label: 'Undecided', icon: '🤔', desc: 'Agents will analyze both options' },
];

const ANCHOR_TYPES = [
  { value: 'medical' as const, label: 'Medical / Hospital', icon: '🏥' },
  { value: 'corporate' as const, label: 'Corporate MoU', icon: '💼' },
  { value: 'government' as const, label: 'Government', icon: '🏛️' },
  { value: 'mixed' as const, label: 'Mixed Anchors', icon: '🌐' },
];

const DEFAULT_INPUT: InvestWizardInput = {
  propertyName: '',
  city: '',
  state: '',
  starRating: 4,
  roomCount: 100,
  landAreaAcres: 2,
  investmentAmountCr: 100,
  dealType: 'new_build',
  partnershipType: 'solo',
  returnLevel: 'moderate',
  riskComfort: 'medium',
  timelineYears: 5,
  // Location
  propertyAddress: '',
  latitude: 0,
  longitude: 0,
  distanceToAirportKm: 0,
  nearestAirport: '',
  // Property Classification
  propertyType: 'business_hotel',
  propertyAge: undefined,
  constructionTimelineMonths: undefined,
  currentOccupancyPct: undefined,
  // Market Context
  cityTier: 'tier1',
  marketSegment: 'business',
  competingHotelsNearby: undefined,
  // Financial
  existingDebtCr: undefined,
  knownRevparInr: undefined,
  // Demand Segmentation
  demandCorporatePct: 35,
  demandMedicalPct: 10,
  demandLeisurePct: 35,
  demandMicePct: 20,
  // Anchor Partnerships
  hasAnchorPartnership: false,
  anchorType: undefined,
  anchorCommittedNightsPerMonth: undefined,
  // Brand Affiliation
  brandStrategy: 'undecided',
  preferredBrand: undefined,
  // Partner Equity
  leadInvestorPct: undefined,
  partner2Pct: undefined,
  partner3Pct: undefined,
};

/* ─── Main Page ─── */
export default function InvestPage() {
  const router = useRouter();
  const { status, result, error, elapsedSeconds, analyze } = useInvestAnalysis();
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<InvestWizardInput>(DEFAULT_INPUT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Navigate to results when complete
  useEffect(() => {
    if (status === 'complete' && result) {
      sessionStorage.setItem('investResult', JSON.stringify(result));
      router.push(`/invest/results?dealId=${result.dealId}`);
    }
  }, [status, result, router]);

  const update = (changes: Partial<InvestWizardInput>) => {
    setInput((prev) => ({ ...prev, ...changes }));
    const clearedErrors = { ...errors };
    Object.keys(changes).forEach((k) => delete clearedErrors[k]);
    setErrors(clearedErrors);
  };

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 1) {
      if (!input.propertyName.trim()) newErrors.propertyName = 'Give your property a name';
      if (!input.propertyAddress.trim()) newErrors.propertyAddress = 'Enter the property address';
      if (input.latitude === 0 && input.longitude === 0 && input.propertyAddress.trim()) {
        // Allow manual address entry but warn
      }
      if (!input.city.trim()) newErrors.city = 'Which city is it in?';
      if (!input.state) newErrors.state = 'Select the state';
    }
    if (s === 2) {
      if (input.investmentAmountCr < 1) newErrors.investmentAmountCr = 'Investment must be at least ₹1 Crore';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleAnalyze = () => {
    if (validateStep(1) && validateStep(2)) {
      analyze(input);
    }
  };

  if (status === 'analyzing') {
    return <AnalyzingView elapsedSeconds={elapsedSeconds} />;
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-900 rounded-2xl border border-red-500/30 p-8 text-center">
          <div className="text-5xl mb-4">😟</div>
          <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
          <p className="text-surface-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Analyze Your Investment</h1>
          <p className="text-surface-400 text-sm sm:text-base">
            Our 16 AI CFO experts need precise details to deliver institutional-grade analysis
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-6 sm:mb-10 gap-0.5 sm:gap-1 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg transition-all text-xs sm:text-sm ${
                  s.id === step
                    ? 'bg-brand-500/20 text-brand-400 font-semibold'
                    : s.id < step
                      ? 'text-brand-400/70 hover:bg-surface-800 cursor-pointer'
                      : 'text-surface-500'
                }`}
              >
                <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                  s.id === step
                    ? 'border-brand-400 bg-brand-500/20 text-brand-400'
                    : s.id < step
                      ? 'border-brand-400/50 bg-brand-500/10 text-brand-400'
                      : 'border-surface-600 text-surface-500'
                }`}>
                  {s.id < step ? '✓' : s.id}
                </span>
                <span className="hidden sm:inline">{s.name}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 ${s.id < step ? 'bg-brand-400/50' : 'bg-surface-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-surface-900 rounded-2xl border border-surface-700 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white mb-1">{STEPS[step - 1].title}</h2>
          <p className="text-surface-400 text-sm mb-6">
            {step === 1 && 'Precise location and property classification powers all 16 AI agents'}
            {step === 2 && 'Investment size, deal structure, and financing details'}
            {step === 3 && 'What kind of returns and risk level you\'re comfortable with'}
            {step === 4 && 'Review everything before our 16 AI experts begin their analysis'}
          </p>

          {step === 1 && <Step1 input={input} errors={errors} update={update} />}
          {step === 2 && <Step2 input={input} errors={errors} update={update} />}
          {step === 3 && <Step3 input={input} update={update} />}
          {step === 4 && <Step4 input={input} />}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-surface-700">
            {step > 1 ? (
              <button
                onClick={prevStep}
                className="px-5 py-2.5 text-surface-300 hover:text-white hover:bg-surface-800 rounded-xl transition-colors"
              >
                Back
              </button>
            ) : <div />}
            {step < 4 ? (
              <button
                onClick={nextStep}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleAnalyze}
                className="px-8 py-3 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40"
              >
                Analyze My Investment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Components ─── */

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-red-400 text-xs mt-1">{error}</p>;
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 cursor-help">
      <span className="text-surface-500 text-xs">ⓘ</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-xs text-surface-300 w-52 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {text}
      </span>
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 pb-2 border-b border-surface-700/50">
      <h3 className="text-sm font-semibold text-brand-400 uppercase tracking-wider">{title}</h3>
      {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

interface StepProps {
  input: InvestWizardInput;
  errors?: Record<string, string>;
  update: (changes: Partial<InvestWizardInput>) => void;
}

/* ─── Step 1: Location & Property Details ─── */
function Step1({ input, errors = {}, update }: StepProps) {
  const handleLocationChange = (loc: LocationData) => {
    update({
      propertyAddress: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      city: loc.city || input.city,
      state: loc.state || input.state,
      distanceToAirportKm: loc.distanceToAirportKm,
      nearestAirport: loc.nearestAirport,
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Section A: Location ── */}
      <div>
        <SectionHeader title="Location" subtitle="Precise coordinates power market analysis, legal checks, and competitive research" />
        <div className="space-y-5">
          {/* Property Name */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Property Name
              <Tooltip text="A name for your hotel project, e.g. 'Sunrise Beach Resort'" />
            </label>
            <input
              type="text"
              value={input.propertyName}
              onChange={(e) => update({ propertyName: e.target.value })}
              placeholder="e.g. The Grand Oberoi Residences"
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
            />
            <FieldError error={errors.propertyName} />
          </div>

          {/* Google Maps Address */}
          <GoogleMapsLocationInput
            value={{
              address: input.propertyAddress,
              latitude: input.latitude,
              longitude: input.longitude,
              city: input.city,
              state: input.state,
              distanceToAirportKm: input.distanceToAirportKm,
              nearestAirport: input.nearestAirport,
            }}
            onChange={handleLocationChange}
            error={errors.propertyAddress}
          />

          {/* City + State (pre-filled from Google Maps, still editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                City
                {input.latitude !== 0 && <span className="text-xs text-surface-500 ml-1">(auto-filled)</span>}
              </label>
              <input
                type="text"
                value={input.city}
                onChange={(e) => update({ city: e.target.value })}
                placeholder="e.g. Goa, Jaipur, Udaipur"
                className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
              />
              <FieldError error={errors.city} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                State
                {input.latitude !== 0 && <span className="text-xs text-surface-500 ml-1">(auto-filled)</span>}
              </label>
              <select
                value={input.state}
                onChange={(e) => update({ state: e.target.value })}
                className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
              >
                <option value="">Select state...</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <FieldError error={errors.state} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section B: Property Details ── */}
      <div>
        <SectionHeader title="Property Details" subtitle="Classification and scale determine financial modeling parameters" />
        <div className="space-y-5">
          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Hotel Star Rating
              <Tooltip text="Higher stars mean more luxury. 5-star = premium resort, 3-star = budget business hotel, 7-star = ultra-luxury." />
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 4, 5, 7].map((star) => (
                <button
                  key={star}
                  onClick={() => update({ starRating: star })}
                  className={`py-2.5 sm:py-3 rounded-xl border-2 text-center text-sm sm:text-base font-medium transition-all ${
                    input.starRating === star
                      ? 'border-brand-400 bg-brand-500/10 text-brand-400'
                      : 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'
                  }`}
                >
                  <span className="sm:hidden">{star}★</span>
                  <span className="hidden sm:inline">{star === 7 ? '7★' : '★'.repeat(star)} {star}-Star</span>
                </button>
              ))}
            </div>
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Property Type
              <Tooltip text="The primary positioning of the hotel determines competitive set and revenue modeling." />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROPERTY_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => update({ propertyType: pt.value })}
                  className={`py-2.5 px-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                    input.propertyType === pt.value
                      ? 'border-brand-400 bg-brand-500/10 text-brand-400'
                      : 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'
                  }`}
                >
                  <span className="mr-1">{pt.icon}</span> {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Room Count + Land Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                Number of Rooms
                <Tooltip text="Total hotel rooms. 50-100 = small, 100-200 = mid-size, 200+ = large." />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="10"
                  value={input.roomCount}
                  onChange={(e) => update({ roomCount: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold w-14 text-right">{input.roomCount}</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>20</span><span>500 rooms</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                Land Area (acres)
                <Tooltip text="1 acre = size of a football field. Mid-size hotel needs 2-5 acres." />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={input.landAreaAcres}
                  onChange={(e) => update({ landAreaAcres: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold w-14 text-right">{input.landAreaAcres}</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>0.5</span><span>20 acres</span>
              </div>
            </div>
          </div>

          {/* Conditional: Property Age (acquisition/renovation) */}
          {(input.dealType === 'acquisition' || input.dealType === 'renovation') && (
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                Property Age (years)
                <Tooltip text="How old is the existing property? Older buildings may need more renovation budget." />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={input.propertyAge ?? 10}
                  onChange={(e) => update({ propertyAge: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold w-20 text-right">{input.propertyAge ?? 10} years</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>New</span><span>100 years</span>
              </div>
            </div>
          )}

          {/* Conditional: Construction Timeline (new build) */}
          {input.dealType === 'new_build' && (
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                Expected Construction Timeline (months)
                <Tooltip text="How long from groundbreaking to opening. Typical mid-size hotel: 24-36 months." />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="12"
                  max="60"
                  step="3"
                  value={input.constructionTimelineMonths ?? 30}
                  onChange={(e) => update({ constructionTimelineMonths: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold w-24 text-right">{input.constructionTimelineMonths ?? 30} months</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>12 months</span><span>60 months</span>
              </div>
            </div>
          )}

          {/* Conditional: Current Occupancy (existing property) */}
          {(input.dealType === 'acquisition' || input.dealType === 'renovation') && (
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                Current Occupancy Rate (%)
                <Tooltip text="Average room occupancy over the last 12 months. Indian hotel average is ~65%." />
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={input.currentOccupancyPct ?? 65}
                  onChange={(e) => update({ currentOccupancyPct: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold w-14 text-right">{input.currentOccupancyPct ?? 65}%</span>
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>0%</span><span>100%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section C: Market Context ── */}
      <div>
        <SectionHeader title="Market Context" subtitle="City classification and market segment guide competitive and regulatory analysis" />
        <div className="space-y-5">
          {/* City Tier */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              City Classification
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CITY_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => update({ cityTier: tier.value })}
                  className={`py-3 px-4 rounded-xl border-2 text-left transition-all ${
                    input.cityTier === tier.value
                      ? 'border-brand-400 bg-brand-500/10'
                      : 'border-surface-600 bg-surface-800 hover:border-surface-500'
                  }`}
                >
                  <div className={`text-sm font-medium ${input.cityTier === tier.value ? 'text-brand-400' : 'text-white'}`}>
                    {tier.label}
                  </div>
                  <div className="text-xs text-surface-500">{tier.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Market Segment */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Primary Market Segment
              <Tooltip text="The main demand driver for this location. Agents will research competitive dynamics for this segment." />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MARKET_SEGMENTS.map((seg) => (
                <button
                  key={seg.value}
                  onClick={() => update({ marketSegment: seg.value })}
                  className={`py-2.5 px-3 rounded-xl border-2 text-center text-sm font-medium transition-all ${
                    input.marketSegment === seg.value
                      ? 'border-brand-400 bg-brand-500/10 text-brand-400'
                      : 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'
                  }`}
                >
                  <span className="mr-1">{seg.icon}</span> {seg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional: Competing Hotels */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Competing Hotels Nearby
              <span className="text-xs text-surface-500 ml-1">(optional)</span>
              <Tooltip text="Approximate number of similar-category hotels within 5km. Leave blank and our agents will research." />
            </label>
            <input
              type="number"
              value={input.competingHotelsNearby ?? ''}
              onChange={(e) => update({ competingHotelsNearby: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Leave blank — agents will research this"
              min={0}
              max={500}
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Section D: Demand Segmentation ── */}
      <div>
        <SectionHeader title="Demand Segmentation" subtitle="How demand is split across guest types — must total 100%" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'demandCorporatePct' as const, label: 'Corporate', icon: '💼', value: input.demandCorporatePct },
              { key: 'demandMedicalPct' as const, label: 'Medical Tourism', icon: '🏥', value: input.demandMedicalPct },
              { key: 'demandLeisurePct' as const, label: 'Leisure / Tourist', icon: '🏖️', value: input.demandLeisurePct },
              { key: 'demandMicePct' as const, label: 'MICE / Events', icon: '🎪', value: input.demandMicePct },
            ].map((seg) => (
              <div key={seg.key}>
                <label className="block text-xs font-medium text-surface-300 mb-1">
                  <span className="mr-1">{seg.icon}</span> {seg.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={seg.value}
                    onChange={(e) => update({ [seg.key]: Number(e.target.value) })}
                    className="flex-1 accent-brand-400"
                  />
                  <span className="text-white font-semibold text-sm w-10 text-right">{seg.value}%</span>
                </div>
              </div>
            ))}
          </div>
          {/* Total indicator */}
          {(() => {
            const total = input.demandCorporatePct + input.demandMedicalPct + input.demandLeisurePct + input.demandMicePct;
            return (
              <div className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-block ${
                total === 100 ? 'text-green-400 bg-green-500/10' : 'text-amber-400 bg-amber-500/10'
              }`}>
                Total: {total}% {total !== 100 && `(should be 100%)`}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Investment & Financing ─── */
function Step2({ input, errors = {}, update }: StepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-5">
      {/* Investment Amount */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Total Investment Amount
          <Tooltip text="How much money in total you plan to put into this project, in Indian Crores (1 Crore = 10 Million)." />
        </label>
        <div className="flex items-center gap-4">
          <span className="text-surface-400 text-lg">₹</span>
          <input
            type="range"
            min="10"
            max="1000"
            step="10"
            value={input.investmentAmountCr}
            onChange={(e) => update({ investmentAmountCr: Number(e.target.value) })}
            className="flex-1 accent-brand-400"
          />
          <span className="text-white font-bold text-lg w-24 text-right">{input.investmentAmountCr} Cr</span>
        </div>
        <div className="flex justify-between text-xs text-surface-500 mt-1">
          <span>₹10 Crore</span><span>₹1000 Crore</span>
        </div>
        <FieldError error={errors.investmentAmountCr} />
      </div>

      {/* Deal Type */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          What kind of project is this?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'new_build' as const, label: 'Brand New Build', desc: 'Building from scratch on empty land', icon: '🏗️' },
            { value: 'renovation' as const, label: 'Renovation', desc: 'Upgrading an existing property', icon: '🔨' },
            { value: 'acquisition' as const, label: 'Buy Existing', desc: 'Purchasing a running hotel', icon: '🏨' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ dealType: opt.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                input.dealType === opt.value
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className={`font-medium mt-1 ${input.dealType === opt.value ? 'text-brand-400' : 'text-white'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Partnership */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Are you investing alone or with partners?
          <Tooltip text="Solo = you fund the whole thing. Partnership = you share costs (and profits) with others." />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'solo' as const, label: 'Solo Investment', desc: 'I\'m funding this myself', icon: '👤' },
            { value: 'partnership' as const, label: 'With Partners', desc: 'Sharing with others', icon: '👥' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ partnershipType: opt.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                input.partnershipType === opt.value
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className={`font-medium mt-1 ${input.partnershipType === opt.value ? 'text-brand-400' : 'text-white'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Partner Equity Split (if partnership) */}
      {input.partnershipType === 'partnership' && (
        <div className="bg-surface-800/30 border border-surface-700 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-surface-200">
            Partner Equity Split
            <Tooltip text="How ownership is divided. Common: 50/25/25 or 60/40. Must total 100%." />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Lead Investor (You)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={input.leadInvestorPct ?? 50}
                  onChange={(e) => update({ leadInvestorPct: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold text-sm w-10 text-right">{input.leadInvestorPct ?? 50}%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Partner 2</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={input.partner2Pct ?? 25}
                  onChange={(e) => update({ partner2Pct: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold text-sm w-10 text-right">{input.partner2Pct ?? 25}%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1">Partner 3</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={input.partner3Pct ?? 25}
                  onChange={(e) => update({ partner3Pct: Number(e.target.value) })}
                  className="flex-1 accent-brand-400"
                />
                <span className="text-white font-semibold text-sm w-10 text-right">{input.partner3Pct ?? 25}%</span>
              </div>
            </div>
          </div>
          {(() => {
            const total = (input.leadInvestorPct ?? 50) + (input.partner2Pct ?? 25) + (input.partner3Pct ?? 25);
            return (
              <div className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-block ${
                total === 100 ? 'text-green-400 bg-green-500/10' : 'text-amber-400 bg-amber-500/10'
              }`}>
                Total: {total}% {total !== 100 && `(should be 100%)`}
              </div>
            );
          })()}
        </div>
      )}

      {/* Timeline */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Investment timeline (years)
          <Tooltip text="How many years you plan to hold this investment before potentially selling or reviewing returns." />
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="3"
            max="15"
            step="1"
            value={input.timelineYears}
            onChange={(e) => update({ timelineYears: Number(e.target.value) })}
            className="flex-1 accent-brand-400"
          />
          <span className="text-white font-semibold w-20 text-right">{input.timelineYears} years</span>
        </div>
        <div className="flex justify-between text-xs text-surface-500 mt-1">
          <span>3 years</span><span>15 years</span>
        </div>
      </div>

      {/* ── Anchor Partnerships ── */}
      <div>
        <SectionHeader title="Anchor Partnerships" subtitle="Pre-committed demand from institutional partners dramatically reduces risk" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => update({ hasAnchorPartnership: true })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                input.hasAnchorPartnership
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-xl">🤝</span>
              <div className={`text-sm font-medium mt-1 ${input.hasAnchorPartnership ? 'text-brand-400' : 'text-white'}`}>
                Yes, have anchors
              </div>
              <div className="text-xs text-surface-400">Hospital MoUs, corporate contracts</div>
            </button>
            <button
              onClick={() => update({ hasAnchorPartnership: false, anchorType: undefined, anchorCommittedNightsPerMonth: undefined })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                !input.hasAnchorPartnership
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-xl">📊</span>
              <div className={`text-sm font-medium mt-1 ${!input.hasAnchorPartnership ? 'text-brand-400' : 'text-white'}`}>
                No anchors yet
              </div>
              <div className="text-xs text-surface-400">Agents will assess open-market demand</div>
            </button>
          </div>

          {input.hasAnchorPartnership && (
            <div className="bg-surface-800/30 border border-surface-700 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-200 mb-1.5">Anchor Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ANCHOR_TYPES.map((at) => (
                    <button
                      key={at.value}
                      onClick={() => update({ anchorType: at.value })}
                      className={`py-2 px-3 rounded-xl border-2 text-center text-xs font-medium transition-all ${
                        input.anchorType === at.value
                          ? 'border-brand-400 bg-brand-500/10 text-brand-400'
                          : 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'
                      }`}
                    >
                      <span className="mr-1">{at.icon}</span> {at.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-200 mb-1.5">
                  Committed Room-Nights / Month
                  <Tooltip text="How many guaranteed room-nights per month from anchor MoUs? e.g. 160 nights = ~5 rooms/night average." />
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={input.anchorCommittedNightsPerMonth ?? 0}
                    onChange={(e) => update({ anchorCommittedNightsPerMonth: Number(e.target.value) || undefined })}
                    className="flex-1 accent-brand-400"
                  />
                  <span className="text-white font-semibold w-20 text-right">{input.anchorCommittedNightsPerMonth ?? 0}/mo</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Brand Affiliation ── */}
      <div>
        <SectionHeader title="Brand Affiliation" subtitle="Independent vs franchise vs management contract — affects fees, occupancy, and exit value" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BRAND_STRATEGIES.map((bs) => (
            <button
              key={bs.value}
              onClick={() => update({ brandStrategy: bs.value, preferredBrand: bs.value === 'independent' ? undefined : input.preferredBrand })}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                input.brandStrategy === bs.value
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-xl">{bs.icon}</span>
              <div className={`text-sm font-medium mt-1 ${input.brandStrategy === bs.value ? 'text-brand-400' : 'text-white'}`}>
                {bs.label}
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{bs.desc}</div>
            </button>
          ))}
        </div>
        {(input.brandStrategy === 'franchise' || input.brandStrategy === 'management_contract') && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Preferred Brand
              <span className="text-xs text-surface-500 ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={input.preferredBrand ?? ''}
              onChange={(e) => update({ preferredBrand: e.target.value || undefined })}
              placeholder="e.g. IHG, Marriott, Taj, Wyndham"
              className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
            />
          </div>
        )}
      </div>

      {/* Conditional: Existing Debt (acquisitions) */}
      {input.dealType === 'acquisition' && (
        <div className="bg-surface-800/30 border border-surface-700 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-semibold text-surface-200">Acquisition Details</h4>
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-1.5">
              Existing Debt on Property (₹ Cr)
              <Tooltip text="Outstanding debt that you will assume or need to refinance as part of the acquisition." />
            </label>
            <div className="flex items-center gap-4">
              <span className="text-surface-400">₹</span>
              <input
                type="range"
                min="0"
                max="500"
                step="5"
                value={input.existingDebtCr ?? 0}
                onChange={(e) => update({ existingDebtCr: Number(e.target.value) || undefined })}
                className="flex-1 accent-brand-400"
              />
              <span className="text-white font-semibold w-20 text-right">{input.existingDebtCr ?? 0} Cr</span>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Optional Metrics */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
        >
          <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          {showAdvanced ? 'Hide' : 'Show'} advanced metrics
          <span className="text-xs text-surface-500 ml-1">(optional)</span>
        </button>
        {showAdvanced && (
          <div className="mt-3 bg-surface-800/30 border border-surface-700 rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-1.5">
                Known RevPAR (₹/night)
                <Tooltip text="Revenue Per Available Room — if you know this metric for the property or market, it significantly improves revenue modeling." />
              </label>
              <input
                type="number"
                value={input.knownRevparInr ?? ''}
                onChange={(e) => update({ knownRevparInr: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Leave blank if unknown — agents will estimate"
                min={0}
                max={200000}
                className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 3: Expectations ─── */
function Step3({ input, update }: Omit<StepProps, 'errors'>) {
  return (
    <div className="space-y-5">
      {/* Return Level */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          What kind of returns do you expect?
          <Tooltip text="Conservative = steady, lower returns. Moderate = balanced. Aggressive = higher returns but more risk." />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'conservative' as const, label: 'Conservative', desc: 'Steady and safe — about 14% yearly', icon: '🐢', color: 'text-green-400' },
            { value: 'moderate' as const, label: 'Moderate', desc: 'Balanced — about 18% yearly', icon: '⚖️', color: 'text-yellow-400' },
            { value: 'aggressive' as const, label: 'Aggressive', desc: 'High growth — about 22% yearly', icon: '🚀', color: 'text-red-400' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ returnLevel: opt.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                input.returnLevel === opt.value
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className={`font-medium mt-1 ${input.returnLevel === opt.value ? 'text-brand-400' : 'text-white'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Risk Comfort */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          How comfortable are you with risk?
          <Tooltip text="Low = you want minimal chance of losing money. High = you're okay with ups and downs if the payoff is bigger." />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: 'low' as const, label: 'Play it Safe', desc: 'I prefer security over high returns', icon: '🛡️' },
            { value: 'medium' as const, label: 'Balanced', desc: 'Some risk is fine if returns are good', icon: '⚖️' },
            { value: 'high' as const, label: 'Go for It', desc: 'I can handle volatility for bigger gains', icon: '🎯' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ riskComfort: opt.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                input.riskComfort === opt.value
                  ? 'border-brand-400 bg-brand-500/10'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-500'
              }`}
            >
              <span className="text-2xl">{opt.icon}</span>
              <div className={`font-medium mt-1 ${input.riskComfort === opt.value ? 'text-brand-400' : 'text-white'}`}>
                {opt.label}
              </div>
              <div className="text-xs text-surface-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-brand-500/5 border border-brand-400/20 rounded-xl p-4">
        <p className="text-sm text-surface-300">
          <span className="text-brand-400 font-medium">Don&apos;t worry about getting these exactly right.</span>{' '}
          Our AI team will analyze the numbers from every angle and tell you what&apos;s realistic for your property and location.
        </p>
      </div>
    </div>
  );
}

/* ─── Step 4: Review ─── */
function Step4({ input }: { input: InvestWizardInput }) {
  const propertyTypeLabel = PROPERTY_TYPES.find((p) => p.value === input.propertyType)?.label ?? input.propertyType;
  const cityTierLabel = CITY_TIERS.find((t) => t.value === input.cityTier)?.label ?? input.cityTier;
  const marketSegLabel = MARKET_SEGMENTS.find((s) => s.value === input.marketSegment)?.label ?? input.marketSegment;

  const brandLabel = BRAND_STRATEGIES.find((b) => b.value === input.brandStrategy)?.label ?? input.brandStrategy;

  const sections = [
    {
      title: 'Location & Property',
      icon: '🏨',
      items: [
        { label: 'Name', value: input.propertyName },
        { label: 'Address', value: input.propertyAddress || `${input.city}, ${input.state}` },
        ...(input.latitude !== 0 ? [{ label: 'Coordinates', value: `${input.latitude.toFixed(4)}°N, ${input.longitude.toFixed(4)}°E` }] : []),
        ...(input.nearestAirport ? [{ label: 'Nearest Airport', value: `${input.distanceToAirportKm} km — ${input.nearestAirport}` }] : []),
        { label: 'City / State', value: `${input.city}, ${input.state}` },
        { label: 'Star Rating', value: `${'★'.repeat(Math.min(input.starRating, 5))} ${input.starRating}-Star` },
        { label: 'Property Type', value: propertyTypeLabel },
        { label: 'Rooms / Land', value: `${input.roomCount} rooms · ${input.landAreaAcres} acres` },
        ...(input.propertyAge != null ? [{ label: 'Property Age', value: `${input.propertyAge} years` }] : []),
        ...(input.constructionTimelineMonths != null ? [{ label: 'Construction', value: `${input.constructionTimelineMonths} months` }] : []),
        ...(input.currentOccupancyPct != null ? [{ label: 'Current Occupancy', value: `${input.currentOccupancyPct}%` }] : []),
      ],
    },
    {
      title: 'Market & Demand',
      icon: '📊',
      items: [
        { label: 'City Tier', value: cityTierLabel },
        { label: 'Market Segment', value: marketSegLabel },
        ...(input.competingHotelsNearby != null ? [{ label: 'Competing Hotels', value: `~${input.competingHotelsNearby} within 5km` }] : []),
        { label: 'Demand Mix', value: `Corporate ${input.demandCorporatePct}% · Medical ${input.demandMedicalPct}% · Leisure ${input.demandLeisurePct}% · MICE ${input.demandMicePct}%` },
      ],
    },
    {
      title: 'Investment & Strategy',
      icon: '💰',
      items: [
        { label: 'Amount', value: `₹${input.investmentAmountCr} Crore` },
        { label: 'Project Type', value: input.dealType === 'new_build' ? 'New Build' : input.dealType === 'renovation' ? 'Renovation' : 'Acquisition' },
        { label: 'Structure', value: input.partnershipType === 'solo' ? 'Solo Investment' : 'Partnership' },
        ...(input.partnershipType === 'partnership' ? [{ label: 'Equity Split', value: `${input.leadInvestorPct ?? 50}/${input.partner2Pct ?? 25}/${input.partner3Pct ?? 25}` }] : []),
        { label: 'Timeline', value: `${input.timelineYears} years` },
        { label: 'Brand Strategy', value: `${brandLabel}${input.preferredBrand ? ` (${input.preferredBrand})` : ''}` },
        ...(input.hasAnchorPartnership ? [
          { label: 'Anchor Partners', value: `${ANCHOR_TYPES.find((a) => a.value === input.anchorType)?.label ?? 'Yes'} — ${input.anchorCommittedNightsPerMonth ?? 0} nights/mo` },
        ] : [{ label: 'Anchor Partners', value: 'None — open market' }]),
        ...(input.existingDebtCr ? [{ label: 'Existing Debt', value: `₹${input.existingDebtCr} Crore` }] : []),
        ...(input.knownRevparInr ? [{ label: 'Known RevPAR', value: `₹${input.knownRevparInr}/night` }] : []),
      ],
    },
    {
      title: 'Expectations',
      icon: '📈',
      items: [
        { label: 'Return Level', value: input.returnLevel.charAt(0).toUpperCase() + input.returnLevel.slice(1) },
        { label: 'Risk Comfort', value: input.riskComfort === 'low' ? 'Play it Safe' : input.riskComfort === 'high' ? 'Go for It' : 'Balanced' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <span>{section.icon}</span> {section.title}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {section.items.map((item) => (
              <div key={item.label}>
                <div className="text-xs text-surface-500">{item.label}</div>
                <div className="text-sm text-surface-200 font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* What happens next */}
      <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700">
        <h3 className="text-sm font-semibold text-white mb-3">What happens when you click &ldquo;Analyze&rdquo;</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AGENT_PHASES.map((agent) => (
            <div key={agent.name} className="flex items-start gap-2">
              <span className="text-lg">{agent.icon}</span>
              <div>
                <div className="text-xs font-medium text-surface-200">{agent.name}</div>
                <div className="text-xs text-surface-500">{agent.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-surface-500 mt-3">
          All 16 experts run simultaneously in batches of 4. Expect results in 2-4 minutes depending on data complexity.
        </p>
      </div>
    </div>
  );
}

/* ─── Analyzing View ─── */
function AnalyzingView({ elapsedSeconds }: { elapsedSeconds: number }) {
  const [activeAgents, setActiveAgents] = useState<number[]>([]);
  const [completedAgents, setCompletedAgents] = useState<number[]>([]);

  // Simulate batch activation: 4 agents every ~1.5s (matches BATCH_DELAY_MS in API)
  useEffect(() => {
    const activationTimers = AGENT_PHASES.map((_, i) =>
      setTimeout(() => setActiveAgents((prev) => [...prev, i]), 800 + i * 500)
    );
    return () => activationTimers.forEach(clearTimeout);
  }, []);

  // Simulate progressive completion based on elapsed time
  // Batch 1 (agents 0-3): ~30-60s, Batch 2 (4-7): ~40-80s, Batch 3 (8-11): ~50-90s, Batch 4 (12-15): ~60-120s
  useEffect(() => {
    const completionTimers = AGENT_PHASES.map((_, i) => {
      const batchIndex = Math.floor(i / 4);
      const baseDelay = 25000 + batchIndex * 15000 + (i % 4) * 5000 + Math.random() * 10000;
      return setTimeout(() => setCompletedAgents((prev) => [...prev, i]), baseDelay);
    });
    return () => completionTimers.forEach(clearTimeout);
  }, []);

  // Phase-based progress and messaging
  const PHASES = [
    { threshold: 0, label: 'Initializing IC Committee...', detail: 'Setting up 16 specialist agents' },
    { threshold: 10, label: 'Batch 1: Core Analysis', detail: 'Market Analyst, Deal Underwriter, Risk Officer, Capital Advisor' },
    { threshold: 30, label: 'Batch 2: Compliance & Legal', detail: 'Compliance, Legal, Tax, Forensic Auditor' },
    { threshold: 60, label: 'Batch 3: Operations', detail: 'Construction, Revenue, PropTech, Insurance' },
    { threshold: 90, label: 'Batch 4: Strategy & Exit', detail: 'ESG, Debt, LP Relations, Exit Strategist' },
    { threshold: 120, label: 'Synthesizing Final Verdict', detail: 'AI CFO reviewing all 16 agent reports...' },
    { threshold: 180, label: 'Deep Analysis in Progress', detail: 'Complex data pulls may take additional time...' },
    { threshold: 240, label: 'Almost There...', detail: 'Finalizing risk models and recommendations...' },
  ];

  const currentPhase = [...PHASES].reverse().find(p => elapsedSeconds >= p.threshold) || PHASES[0];

  // Progress bar: estimate 2-4 minutes, smooth progress
  const estimatedTotal = 180; // 3 minutes as midpoint
  const progressPct = Math.min(95, (elapsedSeconds / estimatedTotal) * 100);

  // Format elapsed time
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeDisplay = minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : `${seconds}s`;

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Timer + Phase */}
        <div className="text-center mb-8">
          <div className="relative w-28 h-28 mx-auto mb-6">
            {/* Background circle */}
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#progress-gradient)"
                strokeWidth="6"
                strokeDasharray={`${progressPct * 2.64} 264`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-brand-400">{timeDisplay}</span>
              <span className="text-[10px] text-surface-500 mt-0.5">elapsed</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Investment Committee at Work</h2>
          <p className="text-brand-400 font-medium text-sm mb-1">{currentPhase.label}</p>
          <p className="text-surface-500 text-xs">{currentPhase.detail}</p>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-8 px-4">
          <div className="flex justify-between text-xs text-surface-500 mb-1.5">
            <span>{completedAgents.length}/16 agents reporting</span>
            <span>~2-4 minutes total</span>
          </div>
          <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-400 transition-all duration-1000 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Agent Grid with Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8 px-2">
          {AGENT_PHASES.map((agent, i) => {
            const isActive = activeAgents.includes(i);
            const isCompleted = completedAgents.includes(i);
            return (
              <div
                key={agent.name}
                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-500 ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : isActive
                      ? 'bg-surface-800/80 border-brand-400/30'
                      : 'bg-surface-900/50 border-surface-800 opacity-30'
                }`}
              >
                <span className="text-lg flex-shrink-0">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white truncate">{agent.name}</div>
                  <div className="text-[10px] text-surface-500 truncate">{agent.desc}</div>
                </div>
                <div className="flex-shrink-0 w-4">
                  {isCompleted ? (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className="flex flex-col gap-0.5 items-center">
                      <span className="w-1 h-1 rounded-full bg-brand-400 animate-pulse" />
                      <span className="w-1 h-1 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1 h-1 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Tips */}
        <div className="text-center space-y-2">
          <p className="text-xs text-surface-500">
            Each agent performs real-time data pulls, financial modeling, and risk assessment.
          </p>
          <p className="text-xs text-surface-600">
            Please don&apos;t close this page — your IC committee is deliberating.
          </p>
          {elapsedSeconds > 180 && (
            <p className="text-xs text-amber-500/80 mt-2">
              Taking longer than usual — complex market data queries in progress. Hang tight!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
