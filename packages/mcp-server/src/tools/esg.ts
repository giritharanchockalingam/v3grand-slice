// ─── MCP Tools: ESG & Sustainability Analysis ──────────────────────────────
import { z } from 'zod';

/** ESG Scoring Weights (MSCI-style methodology) */
const ESG_WEIGHTS = {
  ENVIRONMENTAL: 0.4, // 40%
  SOCIAL: 0.3, // 30%
  GOVERNANCE: 0.3, // 30%
} as const;

/** ESG Component Scoring Ranges */
const ESG_SCORE_RANGES = {
  EXCELLENT: { min: 80, max: 100 },
  GOOD: { min: 60, max: 79 },
  AVERAGE: { min: 40, max: 59 },
  BELOW_AVERAGE: { min: 20, max: 39 },
  POOR: { min: 0, max: 19 },
} as const;

/** Carbon Emission Factors (India) */
const EMISSION_FACTORS = {
  DIESEL_GENERATOR: 3.06, // tCO2/kWh
  GRID_EMISSION_FACTOR_SOUTH: 0.62, // tCO2/kWh (Southern grid - cleaner)
  GRID_EMISSION_FACTOR_CENTRAL: 0.75, // tCO2/kWh (Central grid)
  GRID_EMISSION_FACTOR_NORTH: 0.71, // tCO2/kWh (Northern grid)
  LPG: 3.01, // tCO2/unit
  NATURAL_GAS: 2.04, // tCO2/unit
} as const;

/** Hotel Industry Benchmarks (India) */
const HOTEL_BENCHMARKS = {
  CO2_PER_ROOM_NIGHT: 40, // kg CO2/room-night average (India hotel industry)
  WATER_PER_OCCUPIED_ROOM: { min: 500, typical: 850, max: 1500 }, // liters/day
  ENERGY_PER_ROOM: { min: 30, typical: 50, max: 80 }, // kWh/room-night
  WASTE_PER_ROOM: { organic: 0.5, recyclable: 0.3, hazardous: 0.05 }, // kg/day
} as const;

/** Green Building Rating Systems */
const GREEN_BUILDING_RATINGS = {
  IGBC: {
    name: 'Indian Green Building Council',
    categories: ['Certified', 'Silver', 'Gold', 'Platinum'],
    pointRanges: {
      Certified: { min: 40, max: 49 },
      Silver: { min: 50, max: 59 },
      Gold: { min: 60, max: 79 },
      Platinum: { min: 80, max: 100 },
    },
    certificationCost: '₹2-5 lakhs',
    timeline: '6-12 months',
  },
  GRIHA: {
    name: 'Green Rating for Integrated Habitat Assessment',
    categories: ['One Star', 'Two Star', 'Three Star', 'Four Star', 'Five Star'],
    certificationCost: '₹1-3 lakhs',
    timeline: '6-9 months',
  },
} as const;

/** Register ESG tools on an MCP server. */
export function registerEsgTools(
  server: {
    registerTool(
      name: string,
      inputSchema: z.ZodType,
      handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
    ): void;
  },
  context: { db: any },
): void {
  server.registerTool(
    'calc_esg_score',
    z.object({ dealId: z.string().describe('Deal ID for ESG scoring') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        numberOfRooms: 150,
        constructionStage: 'operational',
      };

      // Environmental Score Components (40%)
      const environmentalComponents = {
        energyEfficiency: {
          metric: 'Energy Star Rating / EPC',
          actualConsumption: 48, // kWh/room-night
          benchmark: HOTEL_BENCHMARKS.ENERGY_PER_ROOM.typical,
          score: Math.min(100, (HOTEL_BENCHMARKS.ENERGY_PER_ROOM.typical / 48) * 100),
          details: 'LED lighting, efficient HVAC, renewable energy integration',
        },
        waterManagement: {
          metric: 'Water Usage per Room',
          actualConsumption: 750, // liters/occupied room/day
          benchmark: HOTEL_BENCHMARKS.WATER_PER_OCCUPIED_ROOM.typical,
          score: Math.min(100, (HOTEL_BENCHMARKS.WATER_PER_OCCUPIED_ROOM.typical / 750) * 100),
          details: 'Rainwater harvesting (30% of annual), STP reuse, low-flow fixtures',
        },
        wasteManagement: {
          metric: 'Waste Segregation & Recycling Rate',
          recyclingRate: 0.65, // 65% of waste recycled/composted
          score: 65,
          details: 'Organic waste composting, plastic recycling, hazardous waste management',
        },
        greenBuilding: {
          metric: 'Green Building Certification',
          certification: 'IGBC Gold',
          score: 75,
          details: 'Site selection, water efficiency, energy, materials, indoor environment',
        },
        biodiversity: {
          metric: 'Green Area & Biodiversity',
          greenAreaPercentage: 28, // % of plot
          nativeSpecies: true,
          score: 70,
          details: 'Native tree plantation, bird-friendly landscaping, pollinator zones',
        },
        environmentalScore: 0, // Will calculate
      };

      // Calculate environmental average
      const envScores = [
        environmentalComponents.energyEfficiency.score,
        environmentalComponents.waterManagement.score,
        environmentalComponents.wasteManagement.score,
        environmentalComponents.greenBuilding.score,
        environmentalComponents.biodiversity.score,
      ];
      environmentalComponents.environmentalScore = envScores.reduce((a, b) => a + b, 0) / envScores.length;

      // Social Score Components (30%)
      const socialComponents = {
        communityImpact: {
          metric: 'Local Employment & Community Investment',
          localEmployment: 0.75, // 75% of workforce from local community
          score: 75,
          details: 'Local hiring policy, skill development programs, community engagement',
        },
        laborPractices: {
          metric: 'Fair Wages & Working Conditions',
          minimumWage: true,
          unionRecognition: true,
          score: 80,
          details: 'Above minimum wage, health insurance, safety protocols, grievance mechanism',
        },
        accessibility: {
          metric: 'Accessibility for Persons with Disabilities',
          wheelchairAccessibleRooms: 12, // Out of 150
          score: 70,
          details: 'Accessible corridors, adapted rooms, braille signage, accessible facilities',
        },
        guestExperience: {
          metric: 'Guest Health & Safety Standards',
          foodSafetyCertification: true,
          hygieneStandards: 'Exceeds standards',
          score: 85,
          details: 'FSSAI compliance, hygiene protocols, guest satisfaction >4.5/5',
        },
        localSupplyChain: {
          metric: 'Local Procurement & Supplier Development',
          localProcurementPercentage: 0.55, // 55% of supplies from local suppliers
          score: 65,
          details: 'Artisan partnerships, local food sourcing, SME vendor support',
        },
        socialScore: 0, // Will calculate
      };

      // Calculate social average
      const socialScores = [
        socialComponents.communityImpact.score,
        socialComponents.laborPractices.score,
        socialComponents.accessibility.score,
        socialComponents.guestExperience.score,
        socialComponents.localSupplyChain.score,
      ];
      socialComponents.socialScore = socialScores.reduce((a, b) => a + b, 0) / socialScores.length;

      // Governance Score Components (30%)
      const governanceComponents = {
        transparency: {
          metric: 'Financial & ESG Transparency',
          esgreporting: 'Annual ESG report published',
          auditedFinancials: true,
          score: 80,
          details: 'Third-party audit, GRI standards compliance, stakeholder disclosure',
        },
        anticorruption: {
          metric: 'Anti-Corruption & Ethics Policy',
          codeOfConduct: true,
          thirdPartyAudit: true,
          score: 85,
          details: 'Zero tolerance policy, whistleblower protection, regular training',
        },
        dataPrivacy: {
          metric: 'Data Privacy & Cybersecurity',
          gdprCompliance: false, // Not EU-focused
          localDataProtection: true,
          score: 75,
          details: 'Guest data encryption, privacy policy, CCPA-like standards',
        },
        stakeholderEngagement: {
          metric: 'Board Diversity & Stakeholder Engagement',
          boardDiversityPercentage: 0.35, // 35% women/minorities
          stakeholderConsultation: true,
          score: 70,
          details: 'Diverse board, annual stakeholder meetings, feedback mechanism',
        },
        riskManagement: {
          metric: 'Business Continuity & Risk Management',
          crisisManagementPlan: true,
          insuranceCoverage: true,
          score: 80,
          details: 'Disaster recovery plan, business interruption insurance, supply chain resilience',
        },
        governanceScore: 0, // Will calculate
      };

      // Calculate governance average
      const govScores = [
        governanceComponents.transparency.score,
        governanceComponents.anticorruption.score,
        governanceComponents.dataPrivacy.score,
        governanceComponents.stakeholderEngagement.score,
        governanceComponents.riskManagement.score,
      ];
      governanceComponents.governanceScore = govScores.reduce((a, b) => a + b, 0) / govScores.length;

      // Calculate composite ESG score
      const compositeESGScore =
        environmentalComponents.environmentalScore * ESG_WEIGHTS.ENVIRONMENTAL +
        socialComponents.socialScore * ESG_WEIGHTS.SOCIAL +
        governanceComponents.governanceScore * ESG_WEIGHTS.GOVERNANCE;

      // Determine rating tier
      let ratingTier = 'POOR';
      for (const [tier, range] of Object.entries(ESG_SCORE_RANGES)) {
        if (compositeESGScore >= range.min && compositeESGScore <= range.max) {
          ratingTier = tier;
          break;
        }
      }

      const analysis = {
        dealId,
        projectName: dealData.projectName,
        compositeESGScore: Math.round(compositeESGScore * 10) / 10,
        ratingTier,
        componentScores: {
          environmental: Math.round(environmentalComponents.environmentalScore * 10) / 10,
          social: Math.round(socialComponents.socialScore * 10) / 10,
          governance: Math.round(governanceComponents.governanceScore * 10) / 10,
        },
        environmentalBreakdown: environmentalComponents,
        socialBreakdown: socialComponents,
        governanceBreakdown: governanceComponents,
        peerBenchmarking: {
          averageHotelESGScore: 62, // Industry average for Indian hospitality
          topQuartileScore: 80,
          projectRank: compositeESGScore > 62 ? 'Above Average' : 'Below Average',
          improvementPotential: Math.max(0, 100 - compositeESGScore),
        },
        improvementRecommendations: [
          {
            priority: 'HIGH',
            area: 'Renewable Energy',
            currentState: 'Solar PV 25% of peak load',
            target: '60% renewable energy mix',
            investmentRequired: '₹50-75 lakhs',
            potentialImpact: '+8-10 ESG points',
          },
          {
            priority: 'HIGH',
            area: 'Water Recycling',
            currentState: 'STP + limited reuse',
            target: 'Zero Liquid Discharge (ZLD)',
            investmentRequired: '₹30-40 lakhs',
            potentialImpact: '+6-8 ESG points',
          },
          {
            priority: 'MEDIUM',
            area: 'Local Procurement',
            currentState: '55% local sourcing',
            target: '75% local sourcing',
            investmentRequired: 'Minimal (supply chain optimization)',
            potentialImpact: '+5-7 ESG points',
          },
          {
            priority: 'MEDIUM',
            area: 'Waste Management',
            currentState: '65% recycling/composting',
            target: '85% waste diversion rate',
            investmentRequired: '₹15-20 lakhs',
            potentialImpact: '+4-6 ESG points',
          },
          {
            priority: 'LOW',
            area: 'Board Diversity',
            currentState: '35% diversity',
            target: '50% diversity in leadership',
            investmentRequired: 'Organizational restructuring',
            potentialImpact: '+3-5 ESG points',
          },
        ],
        sources: [
          'MSCI ESG Rating Methodology 2023',
          'Global Reporting Initiative (GRI) Standards',
          'SASB Materiality Map for Hotels & Lodging',
          'Indian Green Building Council (IGBC) Standards',
          'Ministry of Environmental Protection, India',
          'Indian Hotel Sustainability Benchmarks',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'calc_carbon_footprint',
    z.object({ dealId: z.string().describe('Deal ID for carbon footprint calculation') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        numberOfRooms: 150,
        occupancyRate: 0.75, // 75% average occupancy
        annualOperatingDays: 350,
        gridState: 'South', // Southern grid (cleaner)
        dieselGeneratorUsage: 0.05, // 5% of total power from DG
        solarInstallation: 0.25, // 25% from solar PV
      };

      // Calculate annual energy consumption
      const occupiedRoomDays = dealData.numberOfRooms * dealData.occupancyRate * dealData.annualOperatingDays;
      const energyConsumption = occupiedRoomDays * HOTEL_BENCHMARKS.ENERGY_PER_ROOM.typical; // kWh/year

      // Scope 1: Direct emissions (on-site fuel)
      const dieselGeneratorEmissions = (energyConsumption * dealData.dieselGeneratorUsage * EMISSION_FACTORS.DIESEL_GENERATOR) / 1000; // tCO2e
      const lpgCookingEmissions = 5; // Estimated 5 tCO2e from kitchen LPG (varies by menu)

      const scope1Total = dieselGeneratorEmissions + lpgCookingEmissions;

      // Scope 2: Indirect emissions (purchased electricity)
      const gridElectricityFactor =
        dealData.gridState === 'South'
          ? EMISSION_FACTORS.GRID_EMISSION_FACTOR_SOUTH
          : dealData.gridState === 'North'
            ? EMISSION_FACTORS.GRID_EMISSION_FACTOR_NORTH
            : EMISSION_FACTORS.GRID_EMISSION_FACTOR_CENTRAL;

      const gridElectricityEmissions = ((energyConsumption * (1 - dealData.dieselGeneratorUsage)) * gridElectricityFactor) / 1000; // tCO2e

      // Subtract solar (offset)
      const solarGenerationEmissions = -((energyConsumption * dealData.solarInstallation * gridElectricityFactor) / 1000); // Negative = offset

      const scope2Total = gridElectricityEmissions + solarGenerationEmissions;

      // Scope 3: Indirect emissions (supply chain, guest travel, waste)
      const guestArrivalDays = dealData.numberOfRooms * dealData.occupancyRate * dealData.annualOperatingDays;
      const guestTravelEmissions = guestArrivalDays * 0.1; // 0.1 tCO2e per guest arrival (avg domestic flight)
      const wasteDisposalEmissions = (occupiedRoomDays * HOTEL_BENCHMARKS.WASTE_PER_ROOM.organic * 0.001) / 1000; // tCO2e
      const waterTreatmentEmissions = (guestArrivalDays * 750 * 0.001) / 1000; // tCO2e (approx 0.001 tCO2 per kL water)
      const suppliesAndFoodEmissions = occupiedRoomDays * 0.05; // 0.05 tCO2e per occupied room (food, supplies)

      const scope3Total = guestTravelEmissions + wasteDisposalEmissions + waterTreatmentEmissions + suppliesAndFoodEmissions;

      // Total emissions
      const totalEmissions = scope1Total + scope2Total + scope3Total;

      // Per-room metrics
      const emissionsPerRoomNight = (totalEmissions * 1000) / occupiedRoomDays; // kg CO2/room-night
      const benchmarkEmissions = HOTEL_BENCHMARKS.CO2_PER_ROOM_NIGHT;
      const performanceVsBenchmark = ((benchmarkEmissions - emissionsPerRoomNight) / benchmarkEmissions) * 100;

      // Carbon intensity trend
      const scope2Baseline = gridElectricityEmissions / 1000; // Without solar
      const scope2WithSolar = scope2Total / 1000;
      const solarBenefit = scope2Baseline - scope2WithSolar;

      const analysis = {
        dealId,
        projectDetails: dealData,
        energyConsumption: {
          annualEnergyConsumption: Math.round(energyConsumption),
          energyUnit: 'kWh/year',
          perRoomPerNight: HOTEL_BENCHMARKS.ENERGY_PER_ROOM.typical,
        },
        scope1Emissions: {
          category: 'Direct On-Site Emissions',
          dieselGenerator: {
            source: 'Backup power generation',
            annualUsage: energyConsumption * dealData.dieselGeneratorUsage,
            emissionsFactor: EMISSION_FACTORS.DIESEL_GENERATOR,
            totalEmissions: dieselGeneratorEmissions,
            unit: 'tCO2e/year',
          },
          lpgCooking: {
            source: 'Kitchen fuel',
            annualUsage: '~5,000 kg/year',
            totalEmissions: lpgCookingEmissions,
            unit: 'tCO2e/year',
          },
          scope1Total,
          percentOfTotal: Math.round((scope1Total / totalEmissions) * 100),
        },
        scope2Emissions: {
          category: 'Purchased Electricity',
          gridElectricity: {
            source: `${dealData.gridState} India grid`,
            emissionFactor: gridElectricityFactor,
            totalEmissions: gridElectricityEmissions,
            unit: 'tCO2e/year',
          },
          solarOffset: {
            source: 'Renewable energy generation (on-site)',
            solarCapacity: '0.5 MW (estimated)',
            annualGeneration: energyConsumption * dealData.solarInstallation,
            offsetEmissions: solarGenerationEmissions,
            unit: 'tCO2e/year (negative = offset)',
          },
          scope2Total,
          percentOfTotal: Math.round((scope2Total / totalEmissions) * 100),
        },
        scope3Emissions: {
          category: 'Indirect Supply Chain & Other',
          guestTravel: {
            source: 'Domestic guest air travel (estimated)',
            totalEmissions: guestTravelEmissions,
          },
          foodAndSupplies: {
            source: 'Procurement & food supply chain',
            totalEmissions: suppliesAndFoodEmissions,
          },
          waste: {
            source: 'Waste disposal & treatment',
            totalEmissions: wasteDisposalEmissions,
          },
          water: {
            source: 'Water treatment & supply',
            totalEmissions: waterTreatmentEmissions,
          },
          scope3Total,
          percentOfTotal: Math.round((scope3Total / totalEmissions) * 100),
        },
        totalCarbonFootprint: {
          totalAnnualEmissions: Math.round(totalEmissions * 100) / 100,
          unit: 'tCO2e/year',
          perRoomPerNight: Math.round(emissionsPerRoomNight * 10) / 10,
          industryBenchmark: benchmarkEmissions,
          performanceVsBenchmark: performanceVsBenchmark > 0 ? `${performanceVsBenchmark.toFixed(1)}% BETTER` : `${Math.abs(performanceVsBenchmark).toFixed(1)}% WORSE`,
        },
        reductionOpportunities: [
          {
            initiative: 'Increase solar installation (25% to 50%)',
            potentialReduction: solarBenefit * 2,
            investmentRequired: '₹1.5-2 crore',
            paybackPeriod: '6-8 years',
            impact: 'Scope 2 reduction',
          },
          {
            initiative: 'Eliminate diesel generator (transition to grid only)',
            potentialReduction: dieselGeneratorEmissions,
            investmentRequired: 'Grid strengthening, no major CapEx',
            paybackPeriod: 'Immediate (operational savings)',
            impact: 'Scope 1 & 2 reduction',
          },
          {
            initiative: 'Energy efficiency (LED, HVAC optimization, building automation)',
            potentialReduction: energyConsumption * 0.15 * gridElectricityFactor, // 15% energy reduction
            investmentRequired: '₹80-100 lakhs',
            paybackPeriod: '4-6 years',
            impact: 'Scope 2 reduction',
          },
          {
            initiative: 'Scope 3 reduction: sustainable procurement, reduce single-use plastics',
            potentialReduction: suppliesAndFoodEmissions * 0.2,
            investmentRequired: 'Operational changes, minimal CapEx',
            paybackPeriod: 'Immediate',
            impact: 'Scope 3 reduction',
          },
          {
            initiative: 'Carbon offset through renewable energy credits (REC)',
            potentialReduction: 'Up to 100% offset potential',
            investmentRequired: '₹50-75 lakhs/year',
            paybackPeriod: 'N/A (annual cost)',
            impact: 'Net zero carbon pathway',
          },
        ],
        scienceBasedTargets: {
          net_zero_2050: 'Commitment to 1.5°C pathway',
          intermediateTarget_2030: 'Reduce emissions by 50% from 2024 baseline',
          requiredAnnualReduction: Math.round(totalEmissions * 0.03), // 3% CAGR
          unit: 'tCO2e/year reduction',
        },
        sources: [
          'GHG Protocol Corporate Accounting & Reporting Standard',
          'India Emissions Factor Report (CEIC)',
          'Central Electricity Authority (CEA) Emission Factors',
          'Ministry of Power Grid Emission Factors by State',
          'World Hotel Industry Carbon Benchmarks',
          'IPCC Fifth Assessment Report',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_green_building_rating',
    z.object({ dealId: z.string().describe('Deal ID for green building rating assessment') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        plotArea: 50000, // sqm
        builtUpArea: 80000, // sqm
        numberOfRooms: 150,
        location: 'Bengaluru',
      };

      // IGBC Scoring Assessment
      const igbcCategories = {
        siteSelection: {
          category: 'Site Selection & Planning (15 points max)',
          currentScore: 12,
          details: [
            'Location near public transport (metro: 1.5km away)',
            'Proximity to amenities & services',
            'No impact on flood zones / water bodies',
            'Contaminated site remediation (if applicable)',
          ],
        },
        waterEfficiency: {
          category: 'Water Efficiency (20 points max)',
          currentScore: 16,
          details: [
            'Rainwater harvesting: 30% of annual rainfall',
            'Low-flow fixtures: 40% reduction vs standard',
            'STP with reuse for non-potable applications',
            'Water metering & monitoring',
          ],
        },
        energyEfficiency: {
          category: 'Energy Efficiency (30 points max)',
          currentScore: 22,
          details: [
            'ECBC 2017 compliance (25% reduction vs baseline)',
            'Solar PV: 25% of peak load',
            'High-efficiency HVAC & chillers',
            'LED lighting throughout',
            'Building Management System (BMS)',
          ],
        },
        materials: {
          category: 'Materials & Resources (15 points max)',
          currentScore: 11,
          details: [
            'Locally sourced materials: 60% of total',
            'Recycled/reclaimed materials: 15%',
            'Rapidly renewable materials (bamboo flooring)',
            'Construction waste management: 75% diverted',
          ],
        },
        indoorEnvironment: {
          category: 'Indoor Environmental Quality (15 points max)',
          currentScore: 13,
          details: [
            'Natural ventilation in common areas',
            'CO2 monitoring (max 1000 ppm)',
            'Low-VOC paints & finishes',
            'Thermal comfort control (22-26°C)',
            'Acoustic performance (background noise <50dB)',
          ],
        },
        innovation: {
          category: 'Innovation & Additional Credits (5 points max)',
          currentScore: 4,
          details: [
            'Green building consultant engagement',
            'Advanced metering & submetering',
            'Potential net-zero energy pathway',
          ],
        },
      };

      const totalPoints = Object.values(igbcCategories).reduce((sum, cat) => sum + cat.currentScore, 0);
      const maxPoints = Object.values(igbcCategories).reduce((sum, cat) => sum + parseInt(cat.category.match(/\d+/) || ['0'])[0], 0);
      const percentageScore = (totalPoints / maxPoints) * 100;

      // Determine rating
      let rating = 'Not Rated';
      let ratingPoints = null;
      if (percentageScore >= GREEN_BUILDING_RATINGS.IGBC.pointRanges.Platinum.min) {
        rating = 'Platinum';
        ratingPoints = GREEN_BUILDING_RATINGS.IGBC.pointRanges.Platinum;
      } else if (percentageScore >= GREEN_BUILDING_RATINGS.IGBC.pointRanges.Gold.min) {
        rating = 'Gold';
        ratingPoints = GREEN_BUILDING_RATINGS.IGBC.pointRanges.Gold;
      } else if (percentageScore >= GREEN_BUILDING_RATINGS.IGBC.pointRanges.Silver.min) {
        rating = 'Silver';
        ratingPoints = GREEN_BUILDING_RATINGS.IGBC.pointRanges.Silver;
      } else if (percentageScore >= GREEN_BUILDING_RATINGS.IGBC.pointRanges.Certified.min) {
        rating = 'Certified';
        ratingPoints = GREEN_BUILDING_RATINGS.IGBC.pointRanges.Certified;
      }

      const analysis = {
        dealId,
        projectName: dealData.projectName,
        ratingSystem: 'Indian Green Building Council (IGBC) - New Buildings',
        estimatedRating: rating,
        currentScore: Math.round(percentageScore * 10) / 10,
        maxPossibleScore: 100,
        scorePercentage: `${Math.round(percentageScore)}%`,
        ratingRange: ratingPoints || null,
        igbcCategoryScores: igbcCategories,
        summary: {
          achievedPoints: totalPoints,
          maxPoints,
          gapToNextRating: rating !== 'Platinum' ? ratingPoints ? ratingPoints.min - percentageScore : 0 : 0,
        },
        currentGaps: [
          {
            category: 'Energy Efficiency',
            currentScore: 22,
            maxScore: 30,
            gap: 8,
            improvement: 'Increase solar to 40% of peak load, upgrade to 5-star ECBC compliance',
            investmentRequired: '₹50-75 lakhs',
          },
          {
            category: 'Materials & Resources',
            currentScore: 11,
            maxScore: 15,
            gap: 4,
            improvement: 'Source 80% materials locally, increase recycled content to 25%',
            investmentRequired: 'Minimal (supply chain optimization)',
          },
          {
            category: 'Innovation',
            currentScore: 4,
            maxScore: 5,
            gap: 1,
            improvement: 'Implement advanced grid-interactive building technology',
            investmentRequired: '₹10-20 lakhs',
          },
        ],
        certificationCost: '₹2-5 lakhs',
        certificationTimeline: '6-12 months (from design submission)',
        processTimeline: [
          '1. Preliminary Assessment (Design Stage): 1-2 months',
          '2. Detailed Application & Documentation: 2-4 months',
          '3. IGBC Review & Committee Assessment: 2-3 months',
          '4. On-site Verification & Inspection: 1 month',
          '5. Final Certification Award: 1 month',
        ],
        alternativeRatings: [
          {
            system: 'GRIHA (Green Rating for Integrated Habitat Assessment)',
            estimatedRating: '4 Stars (out of 5)',
            certificationCost: '₹1-3 lakhs',
            timeline: '6-9 months',
            advantages: 'Lower cost, GOI initiative, strong in water management',
          },
          {
            system: 'LEED v4.1 (International)',
            estimatedRating: 'Gold',
            certificationCost: '₹5-8 lakhs',
            timeline: '9-12 months',
            advantages: 'Global recognition, attracts international investors',
          },
          {
            system: 'BREEAM (International)',
            estimatedRating: 'Excellent',
            certificationCost: '₹4-7 lakhs',
            timeline: '8-10 months',
            advantages: 'Strong in operational performance, ESG favorable',
          },
        ],
        benefits: [
          'Premium pricing: 5-10% higher room rates post-certification',
          'Energy cost savings: 20-30% vs non-green hotels',
          'Water cost savings: 30-40% vs non-green hotels',
          'Enhanced brand value & market positioning',
          'Access to green financing (0.5-1% interest rate discount)',
          'Attracts ESG-focused institutional investors',
          'Government incentives: property tax rebates, exemptions',
          'Insurance premium reductions (5-8%)',
          'Recruitment advantage: attracts ESG-conscious talent',
        ],
        sources: [
          'Indian Green Building Council (IGBC) Rating System 2023',
          'IGBC New Buildings Certification Requirements',
          'Ministry of Power Energy Conservation Building Code (ECBC) 2017',
          'National Building Code (NBC) India 2016',
          'Bureau of Energy Efficiency (BEE) Guidelines',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_esg_funding_eligibility',
    z.object({ dealId: z.string().describe('Deal ID for ESG-linked financing assessment') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        projectCost: 500000000, // ₹50Cr
        financingRequired: 300000000, // ₹30Cr (60% LTV)
        numberOfRooms: 150,
        location: 'Bengaluru',
        esgRating: 72, // ESG score (out of 100)
        greenBuildingCert: 'IGBC Gold',
      };

      const eligibility = {
        dealId,
        projectDetails: dealData,
        eligiblePrograms: [
          {
            program: 'Green Bonds (SEBI Framework)',
            issuerType: 'Corporate, Infrastructure',
            minimumSize: '₹100 crores',
            yourEligibility: dealData.projectCost < 100000000 ? 'Not Eligible (Minimum size: ₹100Cr)' : 'Eligible',
            interestRateDiscount: '15-50 bps (0.15-0.50%)',
            features: [
              'Funds used exclusively for green projects',
              'Third-party verification required (Green Debenture Trustee)',
              'Annual impact reporting mandatory',
              'Listed on NSE/BSE green segment',
            ],
            benefits: [
              'Lower cost of capital',
              'ESG investor base access',
              'Sustainability-linked KPIs',
              'Marketing advantage',
            ],
            cost: '₹25-50 lakhs (issuance & verification)',
            timeline: '6-9 months (from approval to listing)',
          },
          {
            program: 'Sustainability-Linked Loans (SLL)',
            issuerType: 'Corporates, SPVs',
            minimumSize: 'No minimum (typically ₹25Cr+)',
            yourEligibility: dealData.financingRequired >= 25000000 ? 'Eligible' : 'Eligible (smaller deals possible)',
            interestRateDiscount: '25-50 bps (with KPI achievement)',
            features: [
              'Margin ratchet: Rate decreases if ESG KPIs are met',
              'KPIs: Energy efficiency, water usage, renewables target',
              'Semi-annual performance certification',
              'Penalty: Rate increase if KPIs missed',
            ],
            sampleKPIs: [
              'Energy consumption: <50 kWh/room-night',
              'Renewable energy: >=30% of consumption',
              'Water usage: <800 liters/occupied room/day',
              'ESG Score: >=70/100',
              'Green Building Certification: Gold or higher',
            ],
            benefits: [
              'Direct interest savings (0.25-0.50% per annum)',
              'Performance incentive for operations',
              'Flexible KPI setting (project-specific)',
              'Supports long-term ESG commitment',
            ],
            cost: 'Minimal (certification & monitoring)',
            timeline: '2-4 months (faster than green bonds)',
          },
          {
            program: 'IFC (International Finance Corporation) Green Building Finance',
            issuerType: 'Developers, SPVs',
            minimumSize: '₹50 crores',
            yourEligibility: dealData.projectCost >= 50000000 ? 'Likely Eligible' : 'Potentially Eligible (borderline)',
            interestRateDiscount: '0.5-1.5% (50-150 bps)',
            features: [
              'Direct lending or co-lending through local banks',
              'Green Building Certification required (LEED, IGBC)',
              'Energy audit & monitoring systems',
              'IFC Green Building Index framework',
            ],
            requirements: [
              'IGBC Gold / LEED Silver or higher',
              'Energy efficiency >=20% vs baseline',
              'Renewable energy integration plan',
              'Water management strategy',
            ],
            benefits: [
              'Significant interest rate discount (50-150 bps)',
              'Technical support from IFC experts',
              'Access to global best practices',
              'Enhanced credibility & ESG positioning',
            ],
            cost: '₹5-10 lakhs (documentation & assessment)',
            timeline: '4-8 months',
          },
          {
            program: 'NABARD Refinance (Sustainable & Climate-Resilient Development)',
            issuerType: 'Banks, MFIs, NBFCs',
            minimumSize: 'No minimum',
            yourEligibility: 'Eligible (through bank partner)',
            interestRateDiscount: '0.5-1.0% (at refinance level)',
            features: [
              'Bank borrowing from NABARD at concessional rates',
              'On-lending to green hospitality projects',
              'Partial Credit Guarantee Scheme (PCGS) available',
            ],
            requirements: [
              'Green certification (IGBC / GRIHA)',
              'Energy & water efficiency plan',
              'Waste management system',
            ],
            benefits: [
              'Lower cost of credit (pass-through to borrower)',
              'Government-backed refinance facility',
              'Partial guarantee reduces lender risk',
            ],
            cost: '₹2-5 lakhs',
            timeline: '2-3 months (through bank)',
          },
          {
            program: 'Asian Development Bank (ADB) / AIIB Green Projects',
            issuerType: 'Sovereigns, financial institutions',
            minimumSize: '₹100 crores+',
            yourEligibility: 'Not Eligible (SPV-level; requires sovereign/institution intermediation)',
            interestRateDiscount: 'Typically 0.25-0.75% (at sovereign level)',
            features: [
              'Concessional financing for sustainable projects',
              'Blended finance (grant + concessional debt)',
              'Technical assistance & knowledge',
            ],
            cost: 'N/A (accessed through government)',
            timeline: '12-18 months (sovereign level)',
          },
          {
            program: 'State Green Finance Funds (State-specific)',
            issuerType: 'Corporates, developers',
            minimumSize: 'Varies by state (typically ₹10-50Cr)',
            yourEligibility: dealData.location === 'Bengaluru' ? 'Check Karnataka Green Fund' : 'Check state-specific fund',
            interestRateDiscount: '1-2% (variable by state)',
            features: [
              'State government green financing window',
              'Dedicated fund for renewable, green building',
              'Concessional rates, flexible terms',
            ],
            benefits: [
              'Strong interest rate advantage (1-2%)',
              'State-level political support',
              'Align with state sustainability goals',
            ],
            cost: 'Minimal',
            timeline: '3-6 months',
          },
        ],
        recommendedStackingStrategy: {
          option1: 'Primary SLL + Partial Green Bond',
          option2: 'SLL + NABARD Refinance (through bank)',
          option3: 'IFC Green Building Finance + State Fund',
          recommendation: 'Option 1 (SLL + Green Bond) if >=₹100Cr; Option 2 if <₹100Cr',
        },
        esgPerformanceTargets: {
          energy: 'Achieve <45 kWh/room-night by Year 3',
          renewables: 'Increase solar to 40% by Year 2',
          water: 'Reduce to <700L/occupied room/day by Year 2',
          wasteManagement: 'Achieve 80% waste diversion by Year 1',
          esgScore: 'Improve to 80+ by Year 3',
        },
        projectedFundingCost: {
          scenario1_SLL_only: {
            baseRate: '8.5%',
            discount_with_KPIs: '0.5%',
            effectiveRate: '8.0%',
            annualInterest: dealData.financingRequired * 0.08,
            description: 'Conservative: without KPI achievement',
          },
          scenario2_SLL_with_KPIs: {
            baseRate: '8.5%',
            discount: '0.5%',
            effectiveRate: '8.0%',
            annualInterest: dealData.financingRequired * 0.08,
            description: 'With KPI achievement',
          },
          scenario3_Mix_SLL_GB: {
            sllPortfolio: dealData.financingRequired * 0.6,
            gbPortfolio: dealData.financingRequired * 0.4,
            sllRate: '8.0%',
            gbRate: '7.5%',
            effectiveRate: '7.8%',
            annualInterest: dealData.financingRequired * 0.078,
            description: 'Optimal: blended with Green Bond',
          },
        },
        annualSavings: {
          scenario1_conventional: dealData.financingRequired * 0.09, // 9% conventional rate
          scenario3_esg_optimized: dealData.financingRequired * 0.078, // 7.8% blended
          annualSavings: dealData.financingRequired * (0.09 - 0.078),
          savings_percentage: ((0.09 - 0.078) / 0.09) * 100,
        },
        requiredCertifications: [
          {
            cert: 'IGBC Gold / LEED Silver+',
            mandatory_for: 'IFC, Green Bonds',
            timeline: '6-12 months (pre-operations)',
            cost: '₹2-5 lakhs',
          },
          {
            cert: 'Energy Audit (BEE)',
            mandatory_for: 'All green programs',
            timeline: '1-2 months',
            cost: '₹1-3 lakhs',
          },
          {
            cert: 'Third-Party Verification (Green Bonds)',
            mandatory_for: 'Green Bonds only',
            timeline: '2-3 months',
            cost: '₹5-10 lakhs',
          },
        ],
        sources: [
          'SEBI Green Bond Framework 2023',
          'Loan Market Association (LMA) SLL Principles',
          'IFC Green Building Index & Financing Guidelines',
          'NABARD Green Finance Refinance Scheme',
          'RBI Guidelines on Lending to Green Sector',
          'ADB/AIIB Concessional Financing Programs',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(eligibility, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_water_usage_baseline',
    z.object({ dealId: z.string().describe('Deal ID for water usage assessment') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        projectName: 'Grand Hotel Resort',
        numberOfRooms: 150,
        starCategory: '4-Star',
        location: 'Bengaluru',
        occupancyRate: 0.75,
        operatingDays: 350,
      };

      // Water usage estimation
      const occupiedRoomDays = dealData.numberOfRooms * dealData.occupancyRate * dealData.operatingDays;
      const baseline = HOTEL_BENCHMARKS.WATER_PER_OCCUPIED_ROOM.typical; // 850 L/occupied room/day
      const estimatedDailyConsumption = dealData.numberOfRooms * dealData.occupancyRate * baseline; // Liters/day
      const annualConsumption = estimatedDailyConsumption * dealData.operatingDays; // Liters/year

      // Water segment breakdown (typical 4-star)
      const waterSegments = {
        roomsShowersBaths: 0.35, // 35%
        laundry: 0.2, // 20%
        kitchenAndCooking: 0.15, // 15%
        landscaping: 0.1, // 10%
        swimmingPool: 0.08, // 8%
        cleaningAndOthers: 0.12, // 12%
      };

      // Rainwater harvesting potential
      const roofArea = (dealData.numberOfRooms * 60) / 1000; // Approx 60 sqm per room = rough estimate (in hectares)
      const annualRainfall = 900; // mm in Bengaluru
      const rainwaterPotential = (roofArea * annualRainfall * 1000) / 1000; // Cubic meters/year = Liters/year
      const rainwaterHarvestingDesign = annualRainfall * 0.3; // Capture 30% as per design

      // STP and ETP capacity requirements
      const stpCapacityRequired = (estimatedDailyConsumption / 1000) * 1.2; // MLD (megaliter/day) with 20% margin
      const greyWaterReuse = estimatedDailyConsumption * 0.4; // 40% reusable as grey water (landscaping, toilet flushing)
      const blackWaterVolume = estimatedDailyConsumption * 0.3; // 30% requires treatment

      // Zero Liquid Discharge (ZLD) feasibility
      const zldFeasibility = {
        greyWaterRecycling: true,
        blackWaterTreatment: true,
        rainwaterCapture: true,
        recycledWaterUse: (estimatedDailyConsumption * 0.5).toFixed(0), // 50% of water needs can be recycled
        liquidZeroDischargePossible: true,
      };

      // Efficiency improvement potential
      const efficiencyTargets = {
        baseline: baseline,
        conservative_1yr: baseline * 0.9, // 10% reduction
        moderate_2yr: baseline * 0.8, // 20% reduction
        aggressive_3yr: baseline * 0.65, // 35% reduction
        benchmark_international_5star: 1500, // L/occupied room/day (higher due to luxury)
      };

      // Cost projections
      const waterTariff = 60; // ₹/kiloliter in Bengaluru
      const annualWaterCost = (annualConsumption / 1000) * waterTariff;
      const sewerageCost = annualWaterCost * 0.5; // Approx 50% of water cost
      const totalWaterCost = annualWaterCost + sewerageCost;

      const analysis = {
        dealId,
        projectDetails: dealData,
        waterUsageBaseline: {
          benchmarkPerOccupiedRoom: baseline,
          benchmarkRange: HOTEL_BENCHMARKS.WATER_PER_OCCUPIED_ROOM,
          estimatedDailyConsumption: Math.round(estimatedDailyConsumption),
          estimatedAnnualConsumption: Math.round(annualConsumption / 1000), // in kiloliters
          unit: 'Liters per occupied room per day',
        },
        waterSegmentBreakdown: {
          roomsShowersBaths: {
            percentage: 35,
            dailyVolume: Math.round(estimatedDailyConsumption * 0.35),
            reductionPotential: '15-25% (low-flow fixtures, shower timers)',
          },
          laundry: {
            percentage: 20,
            dailyVolume: Math.round(estimatedDailyConsumption * 0.2),
            reductionPotential: '20-30% (efficient laundry machines)',
          },
          kitchenAndCooking: {
            percentage: 15,
            dailyVolume: Math.round(estimatedDailyConsumption * 0.15),
            reductionPotential: '10-15% (pre-rinsing reduction)',
          },
          landscaping: {
            percentage: 10,
            dailyVolume: Math.round(estimatedDailyConsumption * 0.1),
            reductionPotential: '30-40% (drip irrigation, native plants)',
          },
          swimmingPool: {
            percentage: 8,
            dailyVolume: Math.round(estimatedDailyConsumption * 0.08),
            reductionPotential: 'Negligible (evaporation control only)',
          },
          cleaningAndOthers: {
            percentage: 12,
            dailyVolume: Math.round(estimatedDailyConsumption * 0.12),
            reductionPotential: '20-30% (efficient cleaning practices)',
          },
        },
        rainwaterHarvestingPotential: {
          roofCollectionArea: `~${dealData.numberOfRooms * 60} sqm`,
          annualRainfallBengaluru: `${annualRainfall} mm`,
          potentialAnnualCollection: Math.round(rainwaterPotential),
          designCaptureRate: '30% of annual rainfall',
          capturedAnnually: Math.round(rainwaterPotential * 0.3),
          percentageOfAnnualNeed: Math.round((rainwaterPotential * 0.3 / annualConsumption) * 100),
          uses: [
            'Toilet flushing (non-potable)',
            'Landscaping & garden irrigation',
            'Laundry supplementary supply',
            'Cleaning operations',
          ],
          investmentRequired: '₹15-25 lakhs',
          paybackPeriod: '4-6 years',
        },
        stpAndEtpRequirements: {
          stpCapacityRequired: Math.round(stpCapacityRequired * 100) / 100,
          unit: 'MLD (megaliter per day)',
          designParameter: '1.2x daily average demand',
          technology: 'Activated sludge process (ASP) or SBR (Sequencing Batch Reactor)',
          effluentQuality: {
            TSS: '<10 mg/L (Suspended Solids)',
            BOD: '<10 mg/L (Biochemical Oxygen Demand)',
            COD: '<50 mg/L (Chemical Oxygen Demand)',
            ph: '6.5-8.5',
            fecalColiform: '<10 CFU/100mL (for reuse)',
          },
          regulatoryCompliance: 'SPCB State Pollution Control Board standards',
          investmentRequired: '₹40-60 lakhs',
          operatingCost: '₹5-8 lakhs/year',
        },
        greyWaterReuse: {
          availableGreyWater: Math.round(estimatedDailyConsumption * 0.4),
          reuseApplications: [
            'Toilet flushing',
            'Landscape irrigation',
            'Cooling tower makeup',
            'Vehicle washing (with additional treatment)',
          ],
          treatmentMethod: 'Simple sand + carbon filtration',
          investmentRequired: '₹20-30 lakhs',
          annualSavings: Math.round((estimatedDailyConsumption * 0.4 * waterTariff * dealData.operatingDays) / 1000),
        },
        zeroLiquidDischarge: {
          feasibility: 'Technically & economically feasible',
          components: [
            'Rainwater harvesting system',
            'STP with tertiary treatment',
            'Greywater recycling',
            'Evaporative cooling towers (for brine concentration)',
            'Reverse osmosis (RO) for final polishing',
          ],
          tdsManagement: 'Brine discharge: 5-10% of treated volume (minimal)',
          investmentRequired: '₹80-120 lakhs',
          annualOperatingCost: '₹15-20 lakhs',
          waterIndependence: '70-80% of needs from recycled sources',
          zeroDischargeTarget: 'Achievable with brine management',
        },
        waterEfficiencyTargets: {
          baseline: {
            year: 'Current',
            consumption: baseline,
            annualCost: Math.round(totalWaterCost),
          },
          target1Year: {
            year: 'Year 1',
            consumption: Math.round(baseline * 0.9),
            reduction: '10%',
            investmentRequired: '₹20-30 lakhs (low-flow fixtures)',
            annualSavings: Math.round(totalWaterCost * 0.1),
          },
          target2Year: {
            year: 'Year 2',
            consumption: Math.round(baseline * 0.8),
            reduction: '20%',
            investmentRequired: '₹50-75 lakhs (efficient equipment + recycling)',
            annualSavings: Math.round(totalWaterCost * 0.2),
          },
          target3Year: {
            year: 'Year 3',
            consumption: Math.round(baseline * 0.65),
            reduction: '35%',
            investmentRequired: '₹120-150 lakhs (full ZLD implementation)',
            annualSavings: Math.round(totalWaterCost * 0.35),
          },
        },
        costProjections: {
          waterTariff,
          sewerageTariff: Math.round(waterTariff * 0.5),
          annualWaterCost: Math.round(annualWaterCost),
          annualSewerageCost: Math.round(sewerageCost),
          totalAnnualWaterCost: Math.round(totalWaterCost),
          projectedCostAvoidance_35pctReduction: Math.round(totalWaterCost * 0.35),
        },
        wasteWaterManagement: {
          blackWaterVolume: Math.round(estimatedDailyConsumption * 0.3),
          greyWaterVolume: Math.round(estimatedDailyConsumption * 0.4),
          rainwaterVolume: Math.round(estimatedDailyConsumption * 0.3),
          treatmentPath: 'STP -> Tertiary treatment -> Reuse / ZLD',
        },
        regulatoryRequirements: [
          'CRZ clearance (if coastal)',
          'Groundwater extraction license (if applicable)',
          'SPCB consent for STP operation',
          'Water audit and efficiency certification',
          'Annual water quality testing',
          'Discharge notification to SPCB',
        ],
        sources: [
          'Indian Hotel Sustainability Benchmarks (IHSB)',
          'Ministry of Water Resources Water Audit Guidelines',
          'SPCB Standards for STP Effluent Quality',
          'Central Pollution Control Board (CPCB) Guidelines',
          'Bureau of Energy Efficiency (BEE) Water Audit Code',
          'Indian Standard IS 12978:2009 (Recycled Water)',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );
}
