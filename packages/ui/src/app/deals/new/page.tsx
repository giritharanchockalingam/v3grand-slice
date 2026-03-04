'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { useAuth } from '../../../lib/auth-context';

// Type definitions
interface Location {
  city: string;
  state: string;
  country: string;
  lat?: number;
  lng?: number;
  distanceToAirportKm?: number;
}

interface LandArea {
  sqft: number;
  acres: number;
}

interface GrossBUA {
  phase1Sqft: number;
  phase2Sqft: number;
  totalSqft: number;
}

interface Keys {
  phase1: number;
  phase2: number;
  total: number;
}

interface RoomType {
  type: string;
  count: number;
  avgSize: number;
}

interface Property {
  location: Location;
  landArea: LandArea;
  grossBUA: GrossBUA;
  keys: Keys;
  roomTypes: RoomType[];
  amenities: string[];
  starRating: number;
}

interface RevenueMix {
  rooms: number;
  foodBeverage: number;
  banquet: number;
  other: number;
}

interface Segment {
  name: string;
  percentageOfRooms: number;
}

interface CompSet {
  name: string;
  adr: number;
  occupancy: number;
}

interface MarketAssumptions {
  adrBase: number;
  adrStabilized: number;
  adrGrowthRate: number;
  occupancyRamp: number[];
  revenueMix: RevenueMix;
  segments: Segment[];
  compSet: CompSet[];
  seasonality?: Record<string, number>;
}

interface FinancialAssumptions {
  wacc: number;
  riskFreeRate?: number;
  equityRatio: number;
  debtRatio: number;
  debtInterestRate: number;
  debtTenorYears: number;
  exitCapRate: number;
  exitMultiple?: number;
  taxRate: number;
  inflationRate: number;
  managementFeePct: number;
  incentiveFeePct: number;
  ffAndEReservePct?: number;
  workingCapitalDays?: number;
  targetIRR: number;
  targetEquityMultiple: number;
  targetDSCR: number;
}

interface ScenarioData {
  occupancyStabilized: number;
  adrStabilized: number;
  ebitdaMargin: number;
  mouRealizationPct?: number;
  phase2Trigger?: string;
}

interface DealFormData {
  name: string;
  assetClass: string;
  lifecyclePhase: string;
  property: Property;
  marketAssumptions: MarketAssumptions;
  financialAssumptions: FinancialAssumptions;
  scenarios: {
    bear: ScenarioData;
    base: ScenarioData;
    bull: ScenarioData;
  };
}

const STEPS = [
  { id: 1, name: 'Basic Info', title: 'Deal Information' },
  { id: 2, name: 'Property Details', title: 'Property Information' },
  { id: 3, name: 'Market Assumptions', title: 'Market Assumptions' },
  { id: 4, name: 'Financial Structure', title: 'Financial Assumptions' },
  { id: 5, name: 'Review & Create', title: 'Review & Submit' },
];

const INDIAN_CITIES = [
  { city: 'Madurai', state: 'Tamil Nadu', country: 'India' },
  { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  { city: 'Bangalore', state: 'Karnataka', country: 'India' },
  { city: 'Delhi', state: 'Delhi', country: 'India' },
  { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  { city: 'Hyderabad', state: 'Telangana', country: 'India' },
  { city: 'Pune', state: 'Maharashtra', country: 'India' },
];

const DEFAULT_AMENITIES = [
  'Free WiFi',
  'Gym',
  'Swimming Pool',
  'Restaurant',
  'Bar',
  'Parking',
  'Conference Rooms',
  'Room Service',
  'Spa',
];

export default function DealCreationWizard() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState<DealFormData>({
    name: '',
    assetClass: 'hotel',
    lifecyclePhase: 'pre-development',
    property: {
      location: {
        city: 'Madurai',
        state: 'Tamil Nadu',
        country: 'India',
        lat: 9.92,
        lng: 78.1198,
        distanceToAirportKm: 15,
      },
      landArea: {
        sqft: 50000,
        acres: 1.15,
      },
      grossBUA: {
        phase1Sqft: 100000,
        phase2Sqft: 0,
        totalSqft: 100000,
      },
      keys: {
        phase1: 80,
        phase2: 0,
        total: 80,
      },
      roomTypes: [
        { type: 'Single', count: 20, avgSize: 250 },
        { type: 'Double', count: 40, avgSize: 350 },
        { type: 'Suite', count: 20, avgSize: 600 },
      ],
      amenities: DEFAULT_AMENITIES,
      starRating: 3,
    },
    marketAssumptions: {
      adrBase: 4500,
      adrStabilized: 5500,
      adrGrowthRate: 0.08,
      occupancyRamp: [0.4, 0.5, 0.6, 0.65, 0.7, 0.72, 0.75, 0.75, 0.75, 0.75],
      revenueMix: {
        rooms: 0.65,
        foodBeverage: 0.25,
        banquet: 0.07,
        other: 0.03,
      },
      segments: [
        { name: 'Business', percentageOfRooms: 0.45 },
        { name: 'Leisure', percentageOfRooms: 0.35 },
        { name: 'Events', percentageOfRooms: 0.2 },
      ],
      compSet: [
        { name: 'Comp 1', adr: 4800, occupancy: 0.68 },
        { name: 'Comp 2', adr: 5200, occupancy: 0.72 },
      ],
    },
    financialAssumptions: {
      wacc: 0.12,
      riskFreeRate: 0.05,
      equityRatio: 0.4,
      debtRatio: 0.6,
      debtInterestRate: 0.085,
      debtTenorYears: 10,
      exitCapRate: 0.08,
      exitMultiple: 8.5,
      taxRate: 0.3,
      inflationRate: 0.06,
      managementFeePct: 0.02,
      incentiveFeePct: 0.2,
      ffAndEReservePct: 0.05,
      workingCapitalDays: 30,
      targetIRR: 0.18,
      targetEquityMultiple: 2.5,
      targetDSCR: 1.35,
    },
    scenarios: {
      bear: {
        occupancyStabilized: 0.65,
        adrStabilized: 4800,
        ebitdaMargin: 0.25,
        mouRealizationPct: 0.85,
      },
      base: {
        occupancyStabilized: 0.75,
        adrStabilized: 5500,
        ebitdaMargin: 0.35,
        mouRealizationPct: 1.0,
      },
      bull: {
        occupancyStabilized: 0.82,
        adrStabilized: 6500,
        ebitdaMargin: 0.42,
        mouRealizationPct: 1.15,
      },
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mutation for creating deal
  const createDealMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      const response = await api.post('/deals', data);
      return response;
    },
    onSuccess: (data: any) => {
      // Redirect to the new deal page
      router.push(`/deals/${data.id}`);
    },
    onError: (error) => {
      console.error('Error creating deal:', error);
      setErrors({ submit: 'Failed to create deal. Please try again.' });
    },
  });

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          newErrors.name = 'Deal name is required';
        }
        if (!formData.lifecyclePhase) {
          newErrors.lifecyclePhase = 'Lifecycle phase is required';
        }
        break;

      case 2:
        if (!formData.property.location.city) {
          newErrors.city = 'City is required';
        }
        if (!formData.property.location.state) {
          newErrors.state = 'State is required';
        }
        if (formData.property.keys.total <= 0) {
          newErrors.keys = 'Total keys must be greater than 0';
        }
        if (formData.property.starRating < 1 || formData.property.starRating > 5) {
          newErrors.starRating = 'Star rating must be between 1 and 5';
        }
        break;

      case 3:
        if (formData.marketAssumptions.adrBase <= 0) {
          newErrors.adrBase = 'Base ADR must be greater than 0';
        }
        if (formData.marketAssumptions.adrStabilized <= 0) {
          newErrors.adrStabilized = 'Stabilized ADR must be greater than 0';
        }
        if (formData.marketAssumptions.occupancyRamp.some((v) => v < 0 || v > 1)) {
          newErrors.occupancyRamp = 'Occupancy ramp values must be between 0 and 1';
        }
        break;

      case 4:
        if (formData.financialAssumptions.wacc < 0) {
          newErrors.wacc = 'WACC must be non-negative';
        }
        if (formData.financialAssumptions.equityRatio < 0 || formData.financialAssumptions.equityRatio > 1) {
          newErrors.equityRatio = 'Equity ratio must be between 0 and 1';
        }
        if (formData.financialAssumptions.debtRatio < 0 || formData.financialAssumptions.debtRatio > 1) {
          newErrors.debtRatio = 'Debt ratio must be between 0 and 1';
        }
        break;

      case 5:
        // Review step - no validation needed
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1);
        window.scrollTo(0, 0);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = () => {
    if (validateStep(5)) {
      createDealMutation.mutate(formData);
    }
  };

  // Update form data helpers
  const updateFormData = (updates: Partial<DealFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const updateProperty = (updates: Partial<Property>) => {
    setFormData((prev) => ({
      ...prev,
      property: { ...prev.property, ...updates },
    }));
  };

  const updateLocation = (updates: Partial<Location>) => {
    setFormData((prev) => ({
      ...prev,
      property: {
        ...prev.property,
        location: { ...prev.property.location, ...updates },
      },
    }));
  };

  const updateMarketAssumptions = (updates: Partial<MarketAssumptions>) => {
    setFormData((prev) => ({
      ...prev,
      marketAssumptions: { ...prev.marketAssumptions, ...updates },
    }));
  };

  const updateFinancialAssumptions = (updates: Partial<FinancialAssumptions>) => {
    setFormData((prev) => ({
      ...prev,
      financialAssumptions: { ...prev.financialAssumptions, ...updates },
    }));
  };

  const updateScenario = (scenario: 'bear' | 'base' | 'bull', updates: Partial<ScenarioData>) => {
    setFormData((prev) => ({
      ...prev,
      scenarios: {
        ...prev.scenarios,
        [scenario]: { ...prev.scenarios[scenario], ...updates },
      },
    }));
  };

  // Step 1: Basic Info
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deal Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="e.g., Madurai Heritage Hotel Investment"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Asset Class *
        </label>
        <select
          value={formData.assetClass}
          onChange={(e) => updateFormData({ assetClass: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="hotel">Hotel</option>
          <option value="hospitality">Hospitality</option>
          <option value="commercial">Commercial</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Lifecycle Phase *
        </label>
        <select
          value={formData.lifecyclePhase}
          onChange={(e) => updateFormData({ lifecyclePhase: e.target.value })}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            errors.lifecyclePhase ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="">Select a phase</option>
          <option value="pre-development">Pre-Development</option>
          <option value="development">Development</option>
          <option value="stabilized">Stabilized</option>
          <option value="value-add">Value-Add</option>
        </select>
        {errors.lifecyclePhase && (
          <p className="text-red-500 text-sm mt-1">{errors.lifecyclePhase}</p>
        )}
      </div>
    </div>
  );

  // Step 2: Property Details
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Location Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <select
              value={formData.property.location.city}
              onChange={(e) => {
                const selected = INDIAN_CITIES.find((c) => c.city === e.target.value);
                if (selected) {
                  updateLocation(selected);
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {INDIAN_CITIES.map((city) => (
                <option key={city.city} value={city.city}>
                  {city.city}
                </option>
              ))}
            </select>
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State *
            </label>
            <input
              type="text"
              value={formData.property.location.state}
              onChange={(e) => updateLocation({ state: e.target.value })}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            />
            {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              value={formData.property.location.country}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude
            </label>
            <input
              type="number"
              step="0.001"
              value={formData.property.location.lat || ''}
              onChange={(e) =>
                updateLocation({ lat: parseFloat(e.target.value) || undefined })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude
            </label>
            <input
              type="number"
              step="0.001"
              value={formData.property.location.lng || ''}
              onChange={(e) =>
                updateLocation({ lng: parseFloat(e.target.value) || undefined })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Land Area Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Land Area</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Land Area (Sq Ft)
            </label>
            <input
              type="number"
              value={formData.property.landArea.sqft}
              onChange={(e) =>
                updateProperty({
                  landArea: {
                    ...formData.property.landArea,
                    sqft: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Land Area (Acres)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.property.landArea.acres}
              onChange={(e) =>
                updateProperty({
                  landArea: {
                    ...formData.property.landArea,
                    acres: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Gross BUA Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Gross BUA (Sq Ft)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phase 1
            </label>
            <input
              type="number"
              value={formData.property.grossBUA.phase1Sqft}
              onChange={(e) =>
                updateProperty({
                  grossBUA: {
                    ...formData.property.grossBUA,
                    phase1Sqft: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phase 2
            </label>
            <input
              type="number"
              value={formData.property.grossBUA.phase2Sqft}
              onChange={(e) =>
                updateProperty({
                  grossBUA: {
                    ...formData.property.grossBUA,
                    phase2Sqft: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total
            </label>
            <input
              type="number"
              value={formData.property.grossBUA.totalSqft}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Keys Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Number of Keys</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phase 1 *
            </label>
            <input
              type="number"
              value={formData.property.keys.phase1}
              onChange={(e) =>
                updateProperty({
                  keys: {
                    ...formData.property.keys,
                    phase1: parseInt(e.target.value) || 0,
                  },
                })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.keys ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phase 2
            </label>
            <input
              type="number"
              value={formData.property.keys.phase2}
              onChange={(e) =>
                updateProperty({
                  keys: {
                    ...formData.property.keys,
                    phase2: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total
            </label>
            <input
              type="number"
              value={
                formData.property.keys.phase1 + formData.property.keys.phase2
              }
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            />
          </div>
        </div>
        {errors.keys && <p className="text-red-500 text-sm mt-1">{errors.keys}</p>}
      </div>

      {/* Star Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Star Rating *
        </label>
        <select
          value={formData.property.starRating}
          onChange={(e) =>
            updateProperty({ starRating: parseInt(e.target.value) || 1 })
          }
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            errors.starRating ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="1">1 Star</option>
          <option value="2">2 Stars</option>
          <option value="3">3 Stars</option>
          <option value="4">4 Stars</option>
          <option value="5">5 Stars</option>
        </select>
        {errors.starRating && (
          <p className="text-red-500 text-sm mt-1">{errors.starRating}</p>
        )}
      </div>

      {/* Room Types */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Room Types</h3>
        <div className="space-y-3">
          {formData.property.roomTypes.map((roomType, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <input
                  type="text"
                  value={roomType.type}
                  onChange={(e) => {
                    const updated = [...formData.property.roomTypes];
                    updated[idx].type = e.target.value;
                    updateProperty({ roomTypes: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Count
                </label>
                <input
                  type="number"
                  value={roomType.count}
                  onChange={(e) => {
                    const updated = [...formData.property.roomTypes];
                    updated[idx].count = parseInt(e.target.value) || 0;
                    updateProperty({ roomTypes: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avg Size (Sq Ft)
                </label>
                <input
                  type="number"
                  value={roomType.avgSize}
                  onChange={(e) => {
                    const updated = [...formData.property.roomTypes];
                    updated[idx].avgSize = parseFloat(e.target.value) || 0;
                    updateProperty({ roomTypes: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Amenities */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Amenities</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DEFAULT_AMENITIES.map((amenity) => (
            <label key={amenity} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.property.amenities.includes(amenity)}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateProperty({
                      amenities: [...formData.property.amenities, amenity],
                    });
                  } else {
                    updateProperty({
                      amenities: formData.property.amenities.filter(
                        (a) => a !== amenity
                      ),
                    });
                  }
                }}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">{amenity}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 3: Market Assumptions
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* ADR Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Daily Rate (ADR)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base ADR (INR) *
            </label>
            <input
              type="number"
              value={formData.marketAssumptions.adrBase}
              onChange={(e) =>
                updateMarketAssumptions({
                  adrBase: parseFloat(e.target.value) || 0,
                })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.adrBase ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.adrBase && (
              <p className="text-red-500 text-sm mt-1">{errors.adrBase}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stabilized ADR (INR) *
            </label>
            <input
              type="number"
              value={formData.marketAssumptions.adrStabilized}
              onChange={(e) =>
                updateMarketAssumptions({
                  adrStabilized: parseFloat(e.target.value) || 0,
                })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.adrStabilized ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.adrStabilized && (
              <p className="text-red-500 text-sm mt-1">{errors.adrStabilized}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ADR Growth Rate
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.marketAssumptions.adrGrowthRate}
              onChange={(e) =>
                updateMarketAssumptions({
                  adrGrowthRate: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Occupancy Ramp */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Occupancy Ramp (10 Years)
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {formData.marketAssumptions.occupancyRamp.map((value, idx) => (
            <div key={idx}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Year {idx + 1}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={value}
                onChange={(e) => {
                  const updated = [...formData.marketAssumptions.occupancyRamp];
                  updated[idx] = parseFloat(e.target.value) || 0;
                  updateMarketAssumptions({ occupancyRamp: updated });
                }}
                className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.occupancyRamp ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
          ))}
        </div>
        {errors.occupancyRamp && (
          <p className="text-red-500 text-sm mt-1">{errors.occupancyRamp}</p>
        )}
      </div>

      {/* Revenue Mix */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Mix</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rooms
            </label>
            <div className="flex items-center">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.marketAssumptions.revenueMix.rooms}
                onChange={(e) =>
                  updateMarketAssumptions({
                    revenueMix: {
                      ...formData.marketAssumptions.revenueMix,
                      rooms: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="ml-2 text-sm text-gray-600">
                {(formData.marketAssumptions.revenueMix.rooms * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              F&B
            </label>
            <div className="flex items-center">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.marketAssumptions.revenueMix.foodBeverage}
                onChange={(e) =>
                  updateMarketAssumptions({
                    revenueMix: {
                      ...formData.marketAssumptions.revenueMix,
                      foodBeverage: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="ml-2 text-sm text-gray-600">
                {(formData.marketAssumptions.revenueMix.foodBeverage * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Banquet
            </label>
            <div className="flex items-center">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.marketAssumptions.revenueMix.banquet}
                onChange={(e) =>
                  updateMarketAssumptions({
                    revenueMix: {
                      ...formData.marketAssumptions.revenueMix,
                      banquet: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="ml-2 text-sm text-gray-600">
                {(formData.marketAssumptions.revenueMix.banquet * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Other
            </label>
            <div className="flex items-center">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.marketAssumptions.revenueMix.other}
                onChange={(e) =>
                  updateMarketAssumptions({
                    revenueMix: {
                      ...formData.marketAssumptions.revenueMix,
                      other: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="ml-2 text-sm text-gray-600">
                {(formData.marketAssumptions.revenueMix.other * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Segments</h3>
        <div className="space-y-3">
          {formData.marketAssumptions.segments.map((segment, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Segment Name
                </label>
                <input
                  type="text"
                  value={segment.name}
                  onChange={(e) => {
                    const updated = [...formData.marketAssumptions.segments];
                    updated[idx].name = e.target.value;
                    updateMarketAssumptions({ segments: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  % of Rooms
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={segment.percentageOfRooms}
                  onChange={(e) => {
                    const updated = [...formData.marketAssumptions.segments];
                    updated[idx].percentageOfRooms = parseFloat(e.target.value) || 0;
                    updateMarketAssumptions({ segments: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comp Set */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comp Set</h3>
        <div className="space-y-3">
          {formData.marketAssumptions.compSet.map((comp, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Name
                </label>
                <input
                  type="text"
                  value={comp.name}
                  onChange={(e) => {
                    const updated = [...formData.marketAssumptions.compSet];
                    updated[idx].name = e.target.value;
                    updateMarketAssumptions({ compSet: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ADR (INR)
                </label>
                <input
                  type="number"
                  value={comp.adr}
                  onChange={(e) => {
                    const updated = [...formData.marketAssumptions.compSet];
                    updated[idx].adr = parseFloat(e.target.value) || 0;
                    updateMarketAssumptions({ compSet: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Occupancy
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={comp.occupancy}
                  onChange={(e) => {
                    const updated = [...formData.marketAssumptions.compSet];
                    updated[idx].occupancy = parseFloat(e.target.value) || 0;
                    updateMarketAssumptions({ compSet: updated });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 4: Financial Structure
  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Capital Structure */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Capital Structure</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WACC
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.financialAssumptions.wacc}
              onChange={(e) =>
                updateFinancialAssumptions({
                  wacc: parseFloat(e.target.value) || 0,
                })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.wacc ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.wacc && <p className="text-red-500 text-sm mt-1">{errors.wacc}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equity Ratio
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.financialAssumptions.equityRatio}
              onChange={(e) =>
                updateFinancialAssumptions({
                  equityRatio: parseFloat(e.target.value) || 0,
                })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.equityRatio ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.equityRatio && (
              <p className="text-red-500 text-sm mt-1">{errors.equityRatio}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Debt Ratio
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.financialAssumptions.debtRatio}
              onChange={(e) =>
                updateFinancialAssumptions({
                  debtRatio: parseFloat(e.target.value) || 0,
                })
              }
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.debtRatio ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.debtRatio && (
              <p className="text-red-500 text-sm mt-1">{errors.debtRatio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Debt Terms */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Debt Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interest Rate
            </label>
            <input
              type="number"
              step="0.001"
              value={formData.financialAssumptions.debtInterestRate}
              onChange={(e) =>
                updateFinancialAssumptions({
                  debtInterestRate: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Debt Tenor (Years)
            </label>
            <input
              type="number"
              value={formData.financialAssumptions.debtTenorYears}
              onChange={(e) =>
                updateFinancialAssumptions({
                  debtTenorYears: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Exit Assumptions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exit Assumptions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exit Cap Rate
            </label>
            <input
              type="number"
              step="0.001"
              value={formData.financialAssumptions.exitCapRate}
              onChange={(e) =>
                updateFinancialAssumptions({
                  exitCapRate: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exit Multiple (x)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.financialAssumptions.exitMultiple || ''}
              onChange={(e) =>
                updateFinancialAssumptions({
                  exitMultiple: parseFloat(e.target.value) || undefined,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Other Assumptions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Other Assumptions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Rate
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.financialAssumptions.taxRate}
              onChange={(e) =>
                updateFinancialAssumptions({
                  taxRate: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inflation Rate
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.financialAssumptions.inflationRate}
              onChange={(e) =>
                updateFinancialAssumptions({
                  inflationRate: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Management Fee (%)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={formData.financialAssumptions.managementFeePct}
              onChange={(e) =>
                updateFinancialAssumptions({
                  managementFeePct: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Incentive Fee (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.financialAssumptions.incentiveFeePct}
              onChange={(e) =>
                updateFinancialAssumptions({
                  incentiveFeePct: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Return Targets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Return Targets</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target IRR
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.financialAssumptions.targetIRR}
              onChange={(e) =>
                updateFinancialAssumptions({
                  targetIRR: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Equity Multiple
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.financialAssumptions.targetEquityMultiple}
              onChange={(e) =>
                updateFinancialAssumptions({
                  targetEquityMultiple: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target DSCR
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.financialAssumptions.targetDSCR}
              onChange={(e) =>
                updateFinancialAssumptions({
                  targetDSCR: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Step 5: Review & Create
  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
        <p className="text-teal-800">
          Please review all the information below before creating this deal.
        </p>
      </div>

      {/* Basic Info Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Deal Information</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700">Deal Name:</span>
            <span className="font-medium text-gray-900">{formData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Asset Class:</span>
            <span className="font-medium text-gray-900 capitalize">
              {formData.assetClass}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Lifecycle Phase:</span>
            <span className="font-medium text-gray-900 capitalize">
              {formData.lifecyclePhase}
            </span>
          </div>
        </div>
      </div>

      {/* Property Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Information</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700">Location:</span>
            <span className="font-medium text-gray-900">
              {formData.property.location.city}, {formData.property.location.state}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Total Keys:</span>
            <span className="font-medium text-gray-900">
              {formData.property.keys.total}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Gross BUA (Sq Ft):</span>
            <span className="font-medium text-gray-900">
              {formData.property.grossBUA.totalSqft.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Star Rating:</span>
            <span className="font-medium text-gray-900">
              {formData.property.starRating} Stars
            </span>
          </div>
        </div>
      </div>

      {/* Market Assumptions Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Assumptions</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700">Base ADR:</span>
            <span className="font-medium text-gray-900">
              INR {formData.marketAssumptions.adrBase.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Stabilized ADR:</span>
            <span className="font-medium text-gray-900">
              INR {formData.marketAssumptions.adrStabilized.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">ADR Growth Rate:</span>
            <span className="font-medium text-gray-900">
              {(formData.marketAssumptions.adrGrowthRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Revenue Mix (Rooms):</span>
            <span className="font-medium text-gray-900">
              {(formData.marketAssumptions.revenueMix.rooms * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Financial Assumptions Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Assumptions</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700">WACC:</span>
            <span className="font-medium text-gray-900">
              {(formData.financialAssumptions.wacc * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Equity / Debt:</span>
            <span className="font-medium text-gray-900">
              {(formData.financialAssumptions.equityRatio * 100).toFixed(0)}% /
              {(formData.financialAssumptions.debtRatio * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Target IRR:</span>
            <span className="font-medium text-gray-900">
              {(formData.financialAssumptions.targetIRR * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-700">Target Equity Multiple:</span>
            <span className="font-medium text-gray-900">
              {formData.financialAssumptions.targetEquityMultiple.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{errors.submit}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Deal</h1>
          <p className="text-gray-600">Complete all steps to create a new investment deal</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm transition-colors ${
                    step.id <= currentStep
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step.id <= currentStep ? '✓' : step.id}
                </div>
                <div className="hidden sm:block ml-2 min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      step.id <= currentStep ? 'text-teal-600' : 'text-gray-600'
                    }`}
                  >
                    {step.name}
                  </p>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step.id < currentStep ? 'bg-teal-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {STEPS[currentStep - 1].title}
          </h2>

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePreviousStep}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            Previous
          </button>

          <div className="text-sm text-gray-600">
            Step {currentStep} of {STEPS.length}
          </div>

          {currentStep < STEPS.length ? (
            <button
              onClick={handleNextStep}
              disabled={createDealMutation.isPending}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createDealMutation.isPending}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createDealMutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Deal'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
