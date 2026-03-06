// ─── MCP Tools: Tax analysis (Indian tax regulations & calculations) ────────
import { z } from 'zod';

/** India GST Rate Slabs (as of FY2024-25) */
const GST_RATES = {
  MATERIALS: 0.18, // 18% on construction materials
  SERVICES: 0.12, // 12% on construction services
  ROOM_RENT_PREMIUM: 0.18, // 18% on room rent >₹7500
  ROOM_RENT_MID: 0.12, // 12% on room rent ₹1000-7500
  ROOM_RENT_BUDGET: 0.05, // 5% on room rent <₹1000
} as const;

/** Income Tax Act Depreciation Rates (WDV Method, FY2024-25) */
const DEPRECIATION_RATES = {
  BUILDING: 0.1, // 10% WDV
  FURNITURE_FIXTURES_EQUIPMENT: 0.15, // 15% WDV
  PLANT_MACHINERY: 0.15, // 15% WDV
  COMPUTERS: 0.4, // 40% WDV
} as const;

/** Income Tax Slabs for Corporate Entities (FY2024-25) */
const TAX_RATES = {
  CORPORATE: 0.2517, // 25% + surcharge + cess
  LLP: 0.3494, // 30% + surcharge + cess
  INDIVIDUAL: 0.3, // Up to 30% slab
} as const;

/** TDS Rates under Income Tax Act */
const TDS_RATES = {
  SECTION_194I: 0.1, // 10% on rent
  SECTION_194IA: 0.01, // 1% on property purchase
  SECTION_194C_LOW: 0.01, // 1% on contractor payments <₹50L
  SECTION_194C_HIGH: 0.02, // 2% on contractor payments >₹50L
  SECTION_194J: 0.1, // 10% on professional fees
} as const;

/** Section 80-IBA Eligible Project Thresholds */
const SECTION_80IBA = {
  METRO_CARPET_AREA_SQM: 60,
  NON_METRO_CARPET_AREA_SQM: 90,
  METRO_CITIES: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'],
  DEDUCTION_PERIOD_YEARS: 4,
} as const;

/** Register tax tools on an MCP server. */
export function registerTaxTools(
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
    'get_gst_analysis',
    z.object({ dealId: z.string().describe('Deal ID for GST analysis') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data fetch - in production would use context.db
      const dealData = {
        constructionBudget: 50000000, // ₹5Cr
        estimatedAnnualRoomRevenue: 15000000, // ₹1.5Cr
        roomRentDistribution: {
          premium: 0.4, // 40% premium rooms >₹7500
          mid: 0.35, // 35% mid-range ₹1000-7500
          budget: 0.25, // 25% budget <₹1000
        },
      };

      // Construction Phase GST
      const constructionMaterials = dealData.constructionBudget * 0.65; // 65% materials
      const constructionServices = dealData.constructionBudget * 0.35; // 35% services
      const constructionGST = constructionMaterials * GST_RATES.MATERIALS + constructionServices * GST_RATES.SERVICES;

      // Operational Phase GST (annual)
      const premiumRevenue = dealData.estimatedAnnualRoomRevenue * dealData.roomRentDistribution.premium;
      const midRevenue = dealData.estimatedAnnualRoomRevenue * dealData.roomRentDistribution.mid;
      const budgetRevenue = dealData.estimatedAnnualRoomRevenue * dealData.roomRentDistribution.budget;

      const operationalGST =
        premiumRevenue * GST_RATES.ROOM_RENT_PREMIUM +
        midRevenue * GST_RATES.ROOM_RENT_MID +
        budgetRevenue * GST_RATES.ROOM_RENT_BUDGET;

      // Input Tax Credit Eligibility
      const itcEligibility = {
        constructionMaterials: true,
        capitalGoods: true,
        services: true,
        restrictions: [
          'ITC denied on motor vehicles (except commercial)',
          'ITC denied on services not used for business',
          'ITC denied on hospitality',
        ],
      };

      const analysis = {
        dealId,
        constructionPhase: {
          materials: constructionMaterials,
          materialsGST: constructionMaterials * GST_RATES.MATERIALS,
          services: constructionServices,
          servicesGST: constructionServices * GST_RATES.SERVICES,
          totalConstruction: dealData.constructionBudget,
          totalConstructionGST: constructionGST,
        },
        operationalPhase: {
          annualRoomRevenue: dealData.estimatedAnnualRoomRevenue,
          premiumSegment: {
            revenue: premiumRevenue,
            rate: `${(GST_RATES.ROOM_RENT_PREMIUM * 100).toFixed(0)}%`,
            gst: premiumRevenue * GST_RATES.ROOM_RENT_PREMIUM,
          },
          midSegment: {
            revenue: midRevenue,
            rate: `${(GST_RATES.ROOM_RENT_MID * 100).toFixed(0)}%`,
            gst: midRevenue * GST_RATES.ROOM_RENT_MID,
          },
          budgetSegment: {
            revenue: budgetRevenue,
            rate: `${(GST_RATES.ROOM_RENT_BUDGET * 100).toFixed(0)}%`,
            gst: budgetRevenue * GST_RATES.ROOM_RENT_BUDGET,
          },
          totalAnnualGST: operationalGST,
        },
        inputTaxCredit: itcEligibility,
        estimatedAnnualGSTLiability: operationalGST,
        sources: [
          'CGST/SGST Acts, 2017 (GST Rates Schedule I & II)',
          'CBIC Circular 178/2022 (Hospitality GST Classification)',
          'RBI Guidelines on Construction & Operations',
          'Income Tax Act, 1961 (ITC Provisions u/s 17)',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'calc_depreciation_benefit',
    z.object({ dealId: z.string().describe('Deal ID for depreciation calculation') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        buildingCost: 35000000, // ₹3.5Cr
        ffeCost: 8000000, // ₹80L
        plantMachineryCost: 5000000, // ₹50L
        computersCost: 500000, // ₹5L
      };

      // Calculate 10-year depreciation schedule
      const years = 10;
      const schedule = [];
      const corporateTaxRate = 0.25; // 25% basic corporate tax

      let buildingValue = dealData.buildingCost;
      let ffeValue = dealData.ffeCost;
      let plantValue = dealData.plantMachineryCost;
      let computerValue = dealData.computersCost;

      let totalDepreciationBenefit = 0;

      for (let year = 1; year <= years; year++) {
        const buildingDepn = buildingValue * DEPRECIATION_RATES.BUILDING;
        const ffeDepn = ffeValue * DEPRECIATION_RATES.FURNITURE_FIXTURES_EQUIPMENT;
        const plantDepn = plantValue * DEPRECIATION_RATES.PLANT_MACHINERY;
        const computerDepn = computerValue * DEPRECIATION_RATES.COMPUTERS;

        const totalDepn = buildingDepn + ffeDepn + plantDepn + computerDepn;
        const taxShield = totalDepn * corporateTaxRate;

        schedule.push({
          year,
          building: {
            openingValue: buildingValue,
            depreciation: buildingDepn,
            closingValue: buildingValue - buildingDepn,
          },
          ffe: {
            openingValue: ffeValue,
            depreciation: ffeDepn,
            closingValue: ffeValue - ffeDepn,
          },
          plantMachinery: {
            openingValue: plantValue,
            depreciation: plantDepn,
            closingValue: plantValue - plantDepn,
          },
          computers: {
            openingValue: computerValue,
            depreciation: computerDepn,
            closingValue: computerValue - computerDepn,
          },
          totalDepreciation: totalDepn,
          taxShield: taxShield,
        });

        buildingValue -= buildingDepn;
        ffeValue -= ffeDepn;
        plantValue -= plantDepn;
        computerValue -= computerDepn;
        totalDepreciationBenefit += taxShield;
      }

      const analysis = {
        dealId,
        baseCosts: {
          building: dealData.buildingCost,
          ffEquipment: dealData.ffeCost,
          plantMachinery: dealData.plantMachineryCost,
          computers: dealData.computersCost,
          totalCapitalBudget:
            dealData.buildingCost +
            dealData.ffeCost +
            dealData.plantMachineryCost +
            dealData.computersCost,
        },
        depreciationRates: {
          building: `${(DEPRECIATION_RATES.BUILDING * 100).toFixed(0)}%`,
          ffEquipment: `${(DEPRECIATION_RATES.FURNITURE_FIXTURES_EQUIPMENT * 100).toFixed(0)}%`,
          plantMachinery: `${(DEPRECIATION_RATES.PLANT_MACHINERY * 100).toFixed(0)}%`,
          computers: `${(DEPRECIATION_RATES.COMPUTERS * 100).toFixed(0)}%`,
          method: 'Written Down Value (WDV)',
        },
        schedule,
        summary: {
          totalDepreciationBenefit,
          averageAnnualTaxShield: totalDepreciationBenefit / years,
          assumedCorporateTaxRate: `${(corporateTaxRate * 100).toFixed(2)}%`,
          effectiveTaxSavings: totalDepreciationBenefit,
        },
        sources: [
          'Income Tax Act, 1961 (Schedule II - Depreciation Rates)',
          'CBDT Circular 31/2019 (Depreciation Methodology)',
          'Rule 5, Schedule II ITA 1961',
          'Finance Act 2020 (Depreciation Amendments)',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_section_80iba',
    z.object({ dealId: z.string().describe('Deal ID for Section 80-IBA eligibility check') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        location: 'Bengaluru', // or 'Mumbai', 'Delhi', 'Pune', etc.
        carpetArea: 55, // sqm per unit
        projectApprovalAuthority: 'CREDAI Karnataka',
        projectApprovedYear: 2024,
        estimatedProjectCost: 100000000, // ₹10Cr
      };

      const isMetroCity = SECTION_80IBA.METRO_CITIES.includes(dealData.location);
      const carpetAreaLimit = isMetroCity
        ? SECTION_80IBA.METRO_CARPET_AREA_SQM
        : SECTION_80IBA.NON_METRO_CARPET_AREA_SQM;
      const carpetAreaEligible = dealData.carpetArea <= carpetAreaLimit;
      const costRequirement = dealData.estimatedProjectCost <= 5000000; // Max ₹50L per unit (guide)

      // Estimate deduction (40% of project cost over 4 years)
      const eligibleDeduction = dealData.estimatedProjectCost * 0.4;
      const annualDeduction = eligibleDeduction / SECTION_80IBA.DEDUCTION_PERIOD_YEARS;

      const analysis = {
        dealId,
        section: '80-IBA (Affordable Housing)',
        eligibility: {
          location: {
            city: dealData.location,
            isMetroCity,
            met: true,
          },
          carpetArea: {
            unitCarpetArea: dealData.carpetArea,
            limit: carpetAreaLimit,
            unitType: isMetroCity ? 'Metro (≤60 sqm)' : 'Non-Metro (≤90 sqm)',
            met: carpetAreaEligible,
          },
          projectApproval: {
            authority: dealData.projectApprovalAuthority,
            approvalYear: dealData.projectApprovedYear,
            met: true,
          },
          costCeiling: {
            estimatedCost: dealData.estimatedProjectCost,
            met: costRequirement,
          },
          overallEligible: carpetAreaEligible,
        },
        deductionDetails: {
          eligibleCost: dealData.estimatedProjectCost,
          deductionPercentage: '40%',
          totalEligibleDeduction: eligibleDeduction,
          deductionPeriod: SECTION_80IBA.DEDUCTION_PERIOD_YEARS,
          annualDeductionAllowed: annualDeduction,
          sunsetClause: 'Section 80-IBA ceases to apply for projects approved after 31-Mar-2024',
        },
        conditions: [
          'Carpet area ≤60 sqm in metros / ≤90 sqm in non-metros',
          'Project approved by CREDAI, state housing board, or competent authority',
          'Affordable housing category per relevant state regulations',
          'Deduction allowed to resident owner or developer entity',
          'Applicable for 4 assessment years from completion',
          'Sunset date: 31 March 2024 (transitional provisions may apply)',
        ],
        recommendation: carpetAreaEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE',
        sources: [
          'Income Tax Act, 1961 (Section 80-IBA)',
          'Finance Act 2016 & 2019 (Affordable Housing Provisions)',
          'CBDT Circular 42/2016 (80-IBA Guidelines)',
          'State Housing Board Guidelines (State-specific)',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'calc_tds_liability',
    z.object({ dealId: z.string().describe('Deal ID for TDS calculation') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal data
      const dealData = {
        annualRent: 2000000, // ₹20L
        propertyPurchaseAmount: 10000000, // ₹1Cr
        contractorPaymentsAnnual: 15000000, // ₹1.5Cr
        professionalFeesAnnual: 500000, // ₹5L
      };

      // Section 194-I: Rent 10%
      const tds194I = dealData.annualRent * TDS_RATES.SECTION_194I;

      // Section 194-IA: Property purchase 1%
      const tds194IA = dealData.propertyPurchaseAmount * TDS_RATES.SECTION_194IA;

      // Section 194-C: Contractor payments (assume >₹50L, so 2%)
      const tds194C = dealData.contractorPaymentsAnnual * TDS_RATES.SECTION_194C_HIGH;

      // Section 194-J: Professional fees 10%
      const tds194J = dealData.professionalFeesAnnual * TDS_RATES.SECTION_194J;

      const totalTDS = tds194I + tds194IA + tds194C + tds194J;

      const analysis = {
        dealId,
        sections: [
          {
            section: '194-I',
            description: 'TDS on Rent (Housing Properties)',
            applicableOn: dealData.annualRent,
            rate: `${(TDS_RATES.SECTION_194I * 100).toFixed(0)}%`,
            threshold: '₹50,000 per month / ₹50,000 per quarter',
            tdsAmount: tds194I,
            complianceNote: 'Deductible when rent paid or credited, whichever is earlier',
          },
          {
            section: '194-IA',
            description: 'TDS on Property Purchase',
            applicableOn: dealData.propertyPurchaseAmount,
            rate: `${(TDS_RATES.SECTION_194IA * 100).toFixed(2)}%`,
            threshold: '₹50,00,000 and above',
            tdsAmount: tds194IA,
            complianceNote: 'Deductible at the time of purchase completion',
          },
          {
            section: '194-C',
            description: 'TDS on Contract Payments (Construction/Services)',
            applicableOn: dealData.contractorPaymentsAnnual,
            rate: `${(TDS_RATES.SECTION_194C_HIGH * 100).toFixed(0)}% (>₹50L)`,
            threshold: '₹2,50,000 for individuals, ₹2,50,000 for others',
            tdsAmount: tds194C,
            complianceNote: 'Deductible when payment made or credited',
          },
          {
            section: '194-J',
            description: 'TDS on Professional Fees',
            applicableOn: dealData.professionalFeesAnnual,
            rate: `${(TDS_RATES.SECTION_194J * 100).toFixed(0)}%`,
            threshold: '₹30,000 in a financial year',
            tdsAmount: tds194J,
            complianceNote: 'Applies to fees for technical, architectural, legal services',
          },
        ],
        summary: {
          totalAnnualTDSOutflow: totalTDS,
          estimatedMonthlyTDS: totalTDS / 12,
          paymentSchedule: [
            '25th July (Apr-Jun quarter)',
            '25th October (Jul-Sep quarter)',
            '25th January (Oct-Dec quarter)',
            '25th March (Jan-Mar quarter)',
          ],
          requiredQuarterly: totalTDS / 4,
        },
        complianceRequirements: [
          'TDS to be deducted on each eligible payment',
          'Quarterly TDS deposits to be made with challan',
          'Form 24Q quarterly TDS statements to be filed',
          'Annual Form 27EQ reconciliation filing',
          'Recipient to receive Form 16A TDS certificate',
          'Penalties for non-compliance: 100-200% of TDS amount',
        ],
        sources: [
          'Income Tax Act, 1961 (Sections 194-I, 194-IA, 194-C, 194-J)',
          'Income Tax Rules, 1962 (Rules 37-47)',
          'CBDT Circulars on TDS Compliance',
          'Finance Act 2023 (Latest TDS Amendment)',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }],
      };
    },
  );

  server.registerTool(
    'get_entity_structure_comparison',
    z.object({ dealId: z.string().describe('Deal ID for entity structure comparison') }),
    async (args) => {
      const { dealId } = args as { dealId: string };

      // Simulated deal financials
      const dealData = {
        projectedAnnualEBITDA: 20000000, // ₹2Cr
        projectedAnnualProfit: 15000000, // ₹1.5Cr
        equityCapital: 100000000, // ₹10Cr
        debtCapital: 200000000, // ₹20Cr
      };

      const comparison = {
        dealId,
        entityStructures: [
          {
            structure: 'Private Limited SPV',
            taxRate: `${(TAX_RATES.CORPORATE * 100).toFixed(2)}%`,
            taxRate_breakdown: '25% basic + 7% surcharge + cess',
            matApplicability: 'Not applicable if turnover <₹40Cr',
            dividendTax: 'DDT of 20% on dividends paid',
            capGainsTax: '20% LTCG (indexed), 15% STCG on sale',
            foreignInvestment: 'Allowed up to 100% with RBI approval',
            sebiCompliance: 'Not required for SPV',
            advantages: [
              'Simple structure for single project',
              'Separates SPV liabilities from parent',
              'Tax losses can be carried forward',
              'Investor friendly for institutional capital',
            ],
            disadvantages: [
              'Higher corporate tax rate',
              'Regulatory compliance overhead',
              'MAT if turnover <₹40Cr',
              'Dividend distribution taxation',
            ],
            estimatedAnnualTax: dealData.projectedAnnualProfit * TAX_RATES.CORPORATE,
          },
          {
            structure: 'Limited Liability Partnership (LLP)',
            taxRate: `${(TAX_RATES.LLP * 100).toFixed(2)}%`,
            taxRate_breakdown: '30% basic + surcharge + cess',
            matApplicability: 'Applicable if turnover >₹40Cr',
            dividendTax: 'No separate dividend tax (pass-through)',
            capGainsTax: '20% LTCG, 30% STCG on sale',
            foreignInvestment: 'Limited to specific sectors, requires approval',
            sebiCompliance: 'Not required for LLP',
            advantages: [
              'Pass-through entity (avoid double taxation)',
              'Limited liability for partners',
              'Lower compliance burden vs company',
              'Flexible profit distribution',
            ],
            disadvantages: [
              'Higher tax rate than SPV',
              'Difficult to raise institutional capital',
              'Foreign investment restrictions',
              'Exit challenges for institutional investors',
            ],
            estimatedAnnualTax: dealData.projectedAnnualProfit * TAX_RATES.LLP,
          },
          {
            structure: 'Alternative Investment Fund (AIF) Category II',
            taxRate: '10% on distributed profits (fund level)',
            taxRate_breakdown: 'Lower rate than corporate SPV',
            matApplicability: 'Not applicable to AIF',
            dividendTax: 'No DDT; investor pays LTCG/STCG on exit',
            capGainsTax: '20% LTCG, 15% STCG on investor redemption',
            foreignInvestment: 'Allowed up to 100% with FIPB approval',
            sebiCompliance: 'Yes - SEBI AIF Regulations 2012; annual reporting',
            advantages: [
              'Lower fund-level taxation (10%)',
              'Attracts institutional & HNI investors',
              'Better exit for investors',
              'Global capital access',
            ],
            disadvantages: [
              'SEBI registration & compliance cost (₹25-50L startup)',
              'Annual audit & reporting overhead',
              'Minimum fund size (₹25Cr typical)',
              'Restricted to sophisticated investors',
            ],
            estimatedAnnualTax: dealData.projectedAnnualProfit * 0.1,
          },
          {
            structure: 'Real Estate Investment Trust (REIT)',
            taxRate: 'NIL at trust level (pass-through)',
            taxRate_breakdown: 'Investor pays LTCG/dividend tax',
            matApplicability: 'Not applicable to REIT',
            dividendTax: 'Investor pays 15% dividend distribution tax',
            capGainsTax: '20% LTCG, 15% STCG on investor redemption',
            foreignInvestment: 'Allowed, no FDI limit under REIT regulations',
            sebiCompliance: 'Yes - SEBI REIT Regulations 2014; quarterly reporting',
            advantages: [
              'Zero tax at trust level (distributions tax-exempt)',
              'Largest capital pool access (public markets)',
              'Highest liquidity via stock exchange',
              'Proven global model',
            ],
            disadvantages: [
              'Minimum ₹500Cr asset requirement',
              'Cannot do development (only leasing)',
              'High regulatory & governance cost',
              'Only for stabilized, cash-flowing assets',
            ],
            estimatedAnnualTax: 0, // Pass-through
          },
        ],
        recommendation: {
          forGrowthPhase: 'Private Limited SPV or AIF Cat II',
          forInstitutionalCapital: 'AIF Category II or REIT (if stabilized)',
          forTaxOptimization: 'AIF Cat II (10% fund-level rate)',
          forExitLiquidity: 'REIT (stock exchange, highest liquidity)',
        },
        sources: [
          'Income Tax Act, 1961 (Corporate & LLP Tax Rates)',
          'SEBI AIF Regulations 2012',
          'SEBI REIT Regulations 2014',
          'Finance Act 2023 (Latest Tax Amendments)',
          'RBI Foreign Investment Guidelines',
          'CBDT Circular on Pass-through Entities',
        ],
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(comparison, null, 2) }],
      };
    },
  );
}
