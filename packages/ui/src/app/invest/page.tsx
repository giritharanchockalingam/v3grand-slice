'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInvestAnalysis, type InvestWizardInput, type AnalysisStatus } from '@/hooks/use-invest-analysis';

/* ─── Constants ─── */
const STEPS = [
  { id: 1, name: 'Property', title: 'Tell us about your property' },
  { id: 2, name: 'Investment', title: 'Your investment details' },
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
  { icon: '🌍', name: 'Market Analyst', desc: 'Studying market conditions...' },
  { icon: '📊', name: 'Deal Underwriter', desc: 'Running financial models...' },
  { icon: '🏗️', name: 'Construction Monitor', desc: 'Checking budget & timeline...' },
  { icon: '🔒', name: 'Compliance Officer', desc: 'Verifying compliance...' },
  { icon: '🛡️', name: 'Risk Officer', desc: 'Assessing risks...' },
  { icon: '💰', name: 'Capital Advisor', desc: 'Optimizing allocation...' },
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
      // Store result in sessionStorage for the results page
      sessionStorage.setItem('investResult', JSON.stringify(result));
      router.push(`/invest/results?dealId=${result.dealId}`);
    }
  }, [status, result, router]);

  const update = (changes: Partial<InvestWizardInput>) => {
    setInput((prev) => ({ ...prev, ...changes }));
    // Clear errors for changed fields
    const clearedErrors = { ...errors };
    Object.keys(changes).forEach((k) => delete clearedErrors[k]);
    setErrors(clearedErrors);
  };

  const validateStep = (s: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (s === 1) {
      if (!input.propertyName.trim()) newErrors.propertyName = 'Give your property a name';
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

  // Show analyzing view
  if (status === 'analyzing') {
    return <AnalyzingView elapsedSeconds={elapsedSeconds} />;
  }

  // Show error state
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Analyze Your Investment</h1>
          <p className="text-surface-400">
            Answer a few simple questions and our team of AI experts will analyze everything for you
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-10 gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                  s.id === step
                    ? 'bg-brand-500/20 text-brand-400 font-semibold'
                    : s.id < step
                      ? 'text-brand-400/70 hover:bg-surface-800 cursor-pointer'
                      : 'text-surface-500'
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
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
                <div className={`w-8 h-0.5 mx-1 ${s.id < step ? 'bg-brand-400/50' : 'bg-surface-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-surface-900 rounded-2xl border border-surface-700 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white mb-1">{STEPS[step - 1].title}</h2>
          <p className="text-surface-400 text-sm mb-6">
            {step === 1 && 'Basic details about the hotel property you\'re considering'}
            {step === 2 && 'How much you plan to invest and the type of project'}
            {step === 3 && 'What kind of returns and risk level you\'re comfortable with'}
            {step === 4 && 'Make sure everything looks right before we start the analysis'}
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

/* ─── Step Components ─── */

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

interface StepProps {
  input: InvestWizardInput;
  errors?: Record<string, string>;
  update: (changes: Partial<InvestWizardInput>) => void;
}

function Step1({ input, errors = {}, update }: StepProps) {
  return (
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
          placeholder="e.g. My Dream Resort"
          className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
        />
        <FieldError error={errors.propertyName} />
      </div>

      {/* City + State */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1.5">City</label>
          <input
            type="text"
            value={input.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="e.g. Goa, Jaipur, Madurai"
            className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder:text-surface-500 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all"
          />
          <FieldError error={errors.city} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-200 mb-1.5">State</label>
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

      {/* Star Rating */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Hotel Star Rating
          <Tooltip text="Higher stars mean more luxury. 5-star = premium resort, 3-star = budget business hotel." />
        </label>
        <div className="flex gap-2">
          {[3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => update({ starRating: star })}
              className={`flex-1 py-3 rounded-xl border-2 text-center font-medium transition-all ${
                input.starRating === star
                  ? 'border-brand-400 bg-brand-500/10 text-brand-400'
                  : 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'
              }`}
            >
              {'★'.repeat(star)} {star}-Star
            </button>
          ))}
        </div>
      </div>

      {/* Room Count */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Number of Rooms
          <Tooltip text="Total hotel rooms. 50-100 is a small hotel, 100-200 is mid-size, 200+ is large." />
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="20"
            max="500"
            step="10"
            value={input.roomCount}
            onChange={(e) => update({ roomCount: Number(e.target.value) })}
            className="flex-1 accent-brand-400"
          />
          <span className="text-white font-semibold w-16 text-right">{input.roomCount}</span>
        </div>
        <div className="flex justify-between text-xs text-surface-500 mt-1">
          <span>20 rooms</span><span>500 rooms</span>
        </div>
      </div>

      {/* Land Area */}
      <div>
        <label className="block text-sm font-medium text-surface-200 mb-1.5">
          Land Area (acres)
          <Tooltip text="1 acre ≈ size of a football field. A typical mid-size hotel needs 2-5 acres." />
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0.5"
            max="20"
            step="0.5"
            value={input.landAreaAcres}
            onChange={(e) => update({ landAreaAcres: Number(e.target.value) })}
            className="flex-1 accent-brand-400"
          />
          <span className="text-white font-semibold w-16 text-right">{input.landAreaAcres}</span>
        </div>
        <div className="flex justify-between text-xs text-surface-500 mt-1">
          <span>0.5 acres</span><span>20 acres</span>
        </div>
      </div>
    </div>
  );
}

function Step2({ input, errors = {}, update }: StepProps) {
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
    </div>
  );
}

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

function Step4({ input }: { input: InvestWizardInput }) {
  const sections = [
    {
      title: 'Property',
      icon: '🏨',
      items: [
        { label: 'Name', value: input.propertyName },
        { label: 'Location', value: `${input.city}, ${input.state}` },
        { label: 'Rating', value: `${'★'.repeat(input.starRating)} ${input.starRating}-Star` },
        { label: 'Rooms', value: `${input.roomCount} rooms` },
        { label: 'Land', value: `${input.landAreaAcres} acres` },
      ],
    },
    {
      title: 'Investment',
      icon: '💰',
      items: [
        { label: 'Amount', value: `₹${input.investmentAmountCr} Crore` },
        { label: 'Project Type', value: input.dealType === 'new_build' ? 'New Build' : input.dealType === 'renovation' ? 'Renovation' : 'Acquisition' },
        { label: 'Structure', value: input.partnershipType === 'solo' ? 'Solo Investment' : 'Partnership' },
        { label: 'Timeline', value: `${input.timelineYears} years` },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          All 6 experts run simultaneously. Expect results in about 30-45 seconds.
        </p>
      </div>
    </div>
  );
}

/* ─── Analyzing View ─── */
function AnalyzingView({ elapsedSeconds }: { elapsedSeconds: number }) {
  const [activeAgents, setActiveAgents] = useState<number[]>([]);

  // Simulate agents activating progressively
  useEffect(() => {
    const timers = AGENT_PHASES.map((_, i) =>
      setTimeout(() => setActiveAgents((prev) => [...prev, i]), 500 + i * 400)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated spinner */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-surface-700" />
          <div className="absolute inset-0 rounded-full border-4 border-brand-400 border-t-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full border-4 border-brand-500/30 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-brand-400">{elapsedSeconds}s</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Our CFO Team is Working</h2>
        <p className="text-surface-400 mb-8">6 AI experts are analyzing your investment right now</p>

        {/* Agent progress cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {AGENT_PHASES.map((agent, i) => {
            const isActive = activeAgents.includes(i);
            return (
              <div
                key={agent.name}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
                  isActive
                    ? 'bg-surface-800/80 border-brand-400/30'
                    : 'bg-surface-900/50 border-surface-800 opacity-40'
                }`}
              >
                <span className="text-xl">{agent.icon}</span>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{agent.name}</div>
                  <div className="text-xs text-surface-400 truncate">{agent.desc}</div>
                </div>
                {isActive && (
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-surface-500">
          This usually takes 30-45 seconds. Please don&apos;t close this page.
        </p>
      </div>
    </div>
  );
}
