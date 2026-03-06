import { z } from 'zod';

export function registerFinanceTools(
  server: {
    registerTool(
      name: string,
      inputSchema: z.ZodType,
      handler: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
    ): void;
  },
  context: { db: any },
): void {
  const dealIdSchema = z.object({ dealId: z.string() });

  // ==================== DEBT TOOLS (5) ====================

  // Tool 1: optimize_ltv
  server.registerTool('optimize_ltv', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      ltvOptimization: {
        projectValue: {
          constructionCost: 50000000,
          landValue: 15000000,
          softCosts: 8000000,
          totalProjectCost: 73000000,
          estimatedCompletionValue: 95000000,
        },
        lenderOptions: {
          scheduledBanks: {
            lenderType: 'Scheduled Commercial Banks',
            maxLtv: 0.65,
            interestRate: '7.5-8.5%',
            tenor: '15 years',
            processingFee: 0.01,
          },
          nbfcSpecialist: {
            lenderType: 'NBFC (Hotel Specialist)',
            maxLtv: 0.8,
            interestRate: '9.0-10.5%',
            tenor: '12 years',
            processingFee: 0.015,
          },
        },
        recommendedScenarios: {
          conservative: {
            ltv: 0.60,
            debt: 57000000,
            equity: 38000000,
            interestRate: 0.077,
            annualInterest: 4389000,
            dscr: 1.5,
          },
          moderate: {
            ltv: 0.70,
            debt: 66500000,
            equity: 28500000,
            interestRate: 0.082,
            annualInterest: 5453000,
            dscr: 1.25,
          },
          aggressive: {
            ltv: 0.80,
            debt: 76000000,
            equity: 19000000,
            interestRate: 0.095,
            annualInterest: 7220000,
            dscr: 1.02,
          },
        },
        sources: ['Indian banking LTV guidelines', 'NBFC lending criteria', 'Debt structure optimization'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 2: model_debt_waterfall
  server.registerTool('model_debt_waterfall', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      debtWaterfall: {
        totalProjectRevenue: 12000000,
        priorityOfPayments: [
          {
            priority: 1,
            description: 'Operating expenses',
            allocation: 3600000,
            percentage: 0.3,
          },
          {
            priority: 2,
            description: 'Senior debt service',
            principal: 2000000,
            interest: 4000000,
            totalAllocation: 6000000,
            percentage: 0.5,
          },
          {
            priority: 3,
            description: 'Mezzanine debt service',
            principal: 500000,
            interest: 1200000,
            totalAllocation: 1700000,
            percentage: 0.142,
          },
          {
            priority: 4,
            description: 'Reserves (maintenance, debt service reserve)',
            allocation: 400000,
            percentage: 0.033,
          },
          {
            priority: 5,
            description: 'Equity distributions',
            allocation: 300000,
            percentage: 0.025,
          },
        ],
        seniorDebtTerms: {
          amount: 50000000,
          rate: 0.08,
          tenor: 15,
          annualService: 6000000,
        },
        mezzanineDebtTerms: {
          amount: 15000000,
          rate: 0.12,
          tenor: 10,
          annualService: 1700000,
        },
        equityContribution: 8000000,
        waterfallValidation: {
          seniorDscr: 2.0,
          mezzoDebtDscr: 1.5,
          equityMultiple: 1.8,
        },
        sources: ['Debt waterfall structure', 'Priority of payments analysis', 'Loan covenants'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 3: calc_refinance_scenarios
  server.registerTool('calc_refinance_scenarios', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      refinanceScenarios: {
        currentDebtProfile: {
          outstandingPrincipal: 50000000,
          currentRate: 0.082,
          remainingTenor: 10,
          monthlyPayment: 609000,
          annualDebtService: 7308000,
        },
        scenarios: {
          baseCase: {
            description: 'Current market rates',
            refinanceRate: 0.082,
            newTenor: 10,
            newMonthlyPayment: 609000,
            totalInterestPaid: 23080000,
            rateSavings: 0,
            breakEvenMonths: 0,
          },
          rateCutScenario: {
            description: 'RBI rate cut 100bps',
            refinanceRate: 0.072,
            newTenor: 10,
            newMonthlyPayment: 570000,
            totalInterestPaid: 20400000,
            rateSavings: 2680000,
            breakEvenMonths: 8,
          },
          rateHikeScenario: {
            description: 'RBI rate hike 200bps',
            refinanceRate: 0.102,
            newTenor: 10,
            newMonthlyPayment: 659000,
            totalInterestPaid: 26160000,
            additionalCost: 3080000,
            recommendation: 'Lock in current rates before hike',
          },
        },
        refinancingCosts: {
          processingFee: 500000,
          legalCosts: 250000,
          stampDuty: 100000,
          totalCosts: 850000,
        },
        sources: ['Current market lending rates', 'MIBOR/SOFR spread analysis', 'Refinancing cost benchmarks'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 4: check_covenant_compliance
  server.registerTool('check_covenant_compliance', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      covenantCompliance: {
        evaluationDate: '2026-03-06',
        covenants: [
          {
            covenantName: 'Debt Service Coverage Ratio (DSCR)',
            minimumRequired: 1.25,
            currentValue: 1.48,
            status: 'COMPLIANT',
            calculation: 'Net Operating Income / Annual Debt Service',
            noi: 9260000,
            annualDebtService: 6250000,
            buffer: 0.23,
          },
          {
            covenantName: 'Loan to Value (LTV)',
            maximumAllowed: 0.7,
            currentValue: 0.63,
            status: 'COMPLIANT',
            calculation: 'Outstanding Debt / Property Value',
            outstandingDebt: 59800000,
            propertyValue: 95000000,
            buffer: 0.07,
          },
          {
            covenantName: 'Interest Coverage Ratio',
            minimumRequired: 2.5,
            currentValue: 3.12,
            status: 'COMPLIANT',
            calculation: 'EBITDA / Interest Expense',
            ebitda: 12400000,
            interestExpense: 3980000,
            buffer: 0.62,
          },
          {
            covenantName: 'Occupancy Covenant',
            minimumRequired: 0.65,
            currentValue: 0.72,
            status: 'COMPLIANT',
            calculation: 'Rooms Occupied / Rooms Available',
            buffer: 0.07,
          },
          {
            covenantName: 'Capital Expenditure Limits',
            maximumAnnual: 2000000,
            currentYear: 1650000,
            status: 'COMPLIANT',
            remainingAllowance: 350000,
          },
        ],
        overallStatus: 'FULL COMPLIANCE',
        riskAssessment: 'Low risk - all covenants maintain healthy buffers',
        nextReviewDate: '2026-06-06',
        sources: ['Loan agreement covenants', 'Current financial statements', 'Operating metrics'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 5: calc_interest_swap
  server.registerTool('calc_interest_swap', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      interestSwapAnalysis: {
        currentLoanTerms: {
          outstanding: 50000000,
          type: 'Floating rate',
          baseRate: 'MIBOR 6M',
          spread: 0.035,
          effectiveRate: 0.087,
          annualCost: 4350000,
        },
        swapOportunity: {
          fixedRateQuote: 0.085,
          tenor: 10,
          notional: 50000000,
          upfrontCost: 200000,
          annualSavings: 100000,
        },
        scenarios: {
          currentFloating: {
            description: 'Stay with floating MIBOR + 3.5%',
            bestCase: { mibor: 0.04, effectiveRate: 0.075, annualCost: 3750000 },
            baseCase: { mibor: 0.055, effectiveRate: 0.09, annualCost: 4500000 },
            worstCase: { mibor: 0.08, effectiveRate: 0.115, annualCost: 5750000 },
          },
          fixedRate: {
            description: 'Swap to fixed 8.5%',
            bestCase: { rate: 0.085, effectiveRate: 0.085, annualCost: 4250000 },
            baseCase: { rate: 0.085, effectiveRate: 0.085, annualCost: 4250000 },
            worstCase: { rate: 0.085, effectiveRate: 0.085, annualCost: 4250000 },
          },
        },
        recommendation: 'Execute swap if MIBOR expected to rise beyond 4.5% in next 12 months',
        sources: ['Current MIBOR/SOFR levels', 'IRS market quotes', 'Interest rate outlook'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ==================== LP TOOLS (5) ====================

  // Tool 6: calc_distribution_waterfall
  server.registerTool('calc_distribution_waterfall', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      distributionWaterfall: {
        grossProceeds: 150000000,
        waterfallStructure: 'American waterfall with preferred return',
        preferredReturnRate: 0.09,
        gpCarryPercentage: 0.2,
        steps: [
          {
            step: 1,
            description: 'Return of capital to LPs',
            amount: 80000000,
            recipients: 'All LP units equally',
          },
          {
            step: 2,
            description: 'Preferred return (8% annual compounded)',
            amount: 45600000,
            recipients: 'All LP units based on contribution',
            calculation: 'Preferred return accrual from inception',
          },
          {
            step: 3,
            description: 'GP catch-up (bring GP to 20% of cumulative distributions)',
            amount: 8800000,
            recipients: 'General Partner',
            condition: 'Only if LP return >= preferred return',
          },
          {
            step: 4,
            description: 'Remaining proceeds (carried interest)',
            amount: 15600000,
            recipients: 'GP: 20% / LPs: 80%',
          },
        ],
        lpDistributions: {
          returnOfCapital: 80000000,
          preferredReturn: 45600000,
          carryAllocation: 12480000,
          totalLpReceives: 138080000,
          moicAchieved: 1.73,
        },
        gpReceipts: {
          catchUp: 8800000,
          carryPercentage: 20,
          carryAmount: 3120000,
          totalGpReceives: 11920000,
          moicAchieved: 1.49,
        },
        sources: ['LP fund documents', 'Waterfall agreement', 'Exit proceeds analysis'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 7: generate_lp_report
  server.registerTool('generate_lp_report', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      lpQuarterlyReport: {
        reportingPeriod: 'Q4 2025',
        fundName: 'Premium Hospitality Fund I',
        fundVintage: 2020,
        fundSize: 250000000,
        capitalRaised: 248500000,
        capitalCalled: 198400000,
        capitalCallPercentage: 0.797,
        performanceMetrics: {
          irr: 0.185,
          moic: 2.34,
          dpi: 0.65,
          rvpi: 1.52,
          tvpi: 2.17,
          inception: {
            startDate: '2020-01-01',
            daysElapsed: 2160,
          },
        },
        portfolioSnapshot: {
          numberOfAssets: 12,
          assetUnderManagement: 450000000,
          unrealizedGains: 98000000,
          distributions: 125000000,
        },
        quarterlyActivity: {
          distributions: 28500000,
          additionalCapitalCalls: 15000000,
          unrealizedValueChange: 12300000,
        },
        lpRanking: {
          rank1: { name: 'Investor A', commitment: 25000000, dpi: 0.68, rvpi: 1.55 },
          rank2: { name: 'Investor B', commitment: 20000000, dpi: 0.63, rvpi: 1.48 },
          rank3: { name: 'Investor C', commitment: 18000000, dpi: 0.64, rvpi: 1.51 },
        },
        sources: ['Fund accounting records', 'Asset valuations', 'LP reports'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 8: calc_capital_calls
  server.registerTool('calc_capital_calls', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      capitalCallSchedule: {
        fundCommitment: 250000000,
        expectedDrawdownPercentage: 0.85,
        expectedTotalDrawdown: 212500000,
        callScheduleByMilestone: [
          {
            callNumber: 1,
            milestone: 'Fund formation & first acquisition',
            percentage: 0.25,
            amount: 62500000,
            expectedDate: '2020-Q2',
            actualDate: '2020-03-15',
            status: 'COMPLETE',
          },
          {
            callNumber: 2,
            milestone: 'Second and third acquisitions',
            percentage: 0.3,
            amount: 75000000,
            expectedDate: '2020-Q4',
            actualDate: '2020-09-20',
            status: 'COMPLETE',
          },
          {
            callNumber: 3,
            milestone: 'Construction & development',
            percentage: 0.2,
            amount: 50000000,
            expectedDate: '2021-Q2',
            actualDate: '2021-04-10',
            status: 'COMPLETE',
          },
          {
            callNumber: 4,
            milestone: 'Development completion & pre-lease',
            percentage: 0.1,
            amount: 25000000,
            expectedDate: '2022-Q1',
            actualDate: '2022-01-15',
            status: 'COMPLETE',
          },
        ],
        futureCapitalNeeds: {
          capitalReserve: 10000000,
          expectedCalls: [
            {
              callNumber: 5,
              milestone: 'Debt refinancing & working capital',
              percentage: 0.1,
              amount: 25000000,
              expectedDate: '2025-Q2',
              status: 'PENDING',
            },
          ],
        },
        sources: ['Fund investment strategy', 'Asset development schedule', 'Capital requirements analysis'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 9: get_commitment_status
  server.registerTool('get_commitment_status', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      commitmentStatus: {
        fundName: 'Premium Hospitality Fund I',
        totalCommitment: 250000000,
        committed: {
          amount: 250000000,
          percentage: 1.0,
          numberOfLps: 45,
        },
        called: {
          amount: 198400000,
          percentage: 0.7936,
          callHistory: [
            { callDate: '2020-03-15', amount: 62500000, purpose: 'Initial funding' },
            { callDate: '2020-09-20', amount: 75000000, purpose: 'Portfolio additions' },
            { callDate: '2021-04-10', amount: 50000000, purpose: 'Development capex' },
            { callDate: '2022-01-15', amount: 10900000, purpose: 'Working capital' },
          ],
        },
        uncalled: {
          amount: 51600000,
          percentage: 0.2064,
          reservedForFutureNeeds: true,
          expectedCallDates: '2025-Q2 through 2026-Q1',
        },
        distributed: {
          amount: 125000000,
          percentage: 0.5,
          numberOfDistributions: 12,
          distributions: [
            { date: '2023-Q4', amount: 18500000, source: 'Asset sale 1' },
            { date: '2024-Q1', amount: 22300000, source: 'Asset refinancing' },
            { date: '2024-Q3', amount: 25600000, source: 'Asset sale 2' },
            { date: '2025-Q2', amount: 28400000, source: 'Asset sale 3' },
            { date: '2025-Q4', amount: 30200000, source: 'Asset sale 4' },
          ],
        },
        unreturned: {
          amount: 73400000,
          percentage: 0.2936,
          composition: {
            investedCapital: 65000000,
            unrealizedGains: 8400000,
          },
        },
        sources: ['LP commitment ledger', 'Capital call history', 'Distribution records'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 10: calc_nav
  server.registerTool('calc_nav', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      navCalculation: {
        fundName: 'Premium Hospitality Fund I',
        valuationDate: '2026-03-06',
        fundGrossBasis: {
          numberOfUnits: 10000000,
          grossAssets: 450000000,
          liabilities: 180000000,
          grossNav: 270000000,
          grossNavPerUnit: 27.0,
        },
        fundNetBasis: {
          grossNav: 270000000,
          accrualFees: {
            managementFee: 5200000,
            administrationFee: 1800000,
            totalFees: 7000000,
          },
          netAssets: 263000000,
          netNavPerUnit: 26.3,
        },
        assetBreakdown: {
          operatingAssets: {
            value: 280000000,
            navContribution: 0.62,
            numberOfProperties: 8,
          },
          developmentAssets: {
            value: 95000000,
            navContribution: 0.21,
            numberOfProperties: 2,
          },
          cash: {
            value: 45000000,
            navContribution: 0.1,
            reservedForCapitalCalls: 25000000,
          },
          otherAssets: {
            value: 30000000,
            navContribution: 0.07,
            composition: 'Receivables and investments',
          },
        },
        lpUnitValueBreakdown: {
          classAUnits: {
            numberOfUnits: 6000000,
            navPerUnit: 26.3,
            totalValue: 157800000,
            preferredReturn: 0.085,
          },
          classBUnits: {
            numberOfUnits: 4000000,
            navPerUnit: 26.3,
            totalValue: 105200000,
            preferredReturn: 0.08,
          },
        },
        sources: ['Fund asset valuations', 'Financial statements', 'Unit accounting records'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ==================== EXIT TOOLS (5) ====================

  // Tool 11: optimize_exit_timing
  server.registerTool('optimize_exit_timing', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      exitTimingOptimization: {
        acquisitionDate: '2020-06-15',
        assetAge: 5.75,
        exitWindow: {
          optimal: 'Year 5-7',
          rationale: 'Hotel assets typically achieve peak valuation multiples at mid-cycle exits',
        },
        scenarioAnalysis: {
          year3Exit: {
            holdingPeriod: 3,
            status: 'Early (Not recommended)',
            projectedValue: 85000000,
            projectedMoic: 1.28,
            rationale: 'Asset still ramping, value not maximized',
          },
          year5Exit: {
            holdingPeriod: 5,
            status: 'Optimal window',
            projectedValue: 115000000,
            projectedMoic: 1.73,
            rationale: 'Stabilized operations, strong cash flow, market demand high',
          },
          year7Exit: {
            holdingPeriod: 7,
            status: 'Optimal window',
            projectedValue: 135000000,
            projectedMoic: 2.03,
            rationale: 'Strong NOI growth, proven operator, premium valuation',
          },
          year10Exit: {
            holdingPeriod: 10,
            status: 'Extended hold',
            projectedValue: 150000000,
            projectedMoic: 2.26,
            rationale: 'Diminishing returns, capital better deployed elsewhere',
          },
        },
        marketConditionFactors: {
          interestRates: 'Rising rates = Sooner exit preferred',
          capitalAvailability: 'More capital = Favorable exit environment',
          priceAppreciation: 'Current outlook: Positive for next 2 years',
          buyerDemandForHotels: 'Strong institutional buyer interest through 2027',
        },
        recommendation: 'Target Year 5-7 exit; initiate marketing in Year 4.5',
        sources: ['Hotel asset cycle analysis', 'Market exit timing research', 'Buyer appetite data'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 12: forecast_cap_rate
  server.registerTool('forecast_cap_rate', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      capRateForecast: {
        currentMetrics: {
          noi: 12400000,
          propertyValue: 95000000,
          capRate: 0.1305,
        },
        baselineFactors: {
          location: 'Tier-1 city',
          marketAvgCapRate: 0.085,
          propertyQuality: '4-star',
        },
        scenarioForecasts: {
          scenario1Base: {
            description: 'Steady growth, stable rates',
            year1CapRate: 0.0950,
            year2CapRate: 0.0920,
            year3CapRate: 0.0890,
            year5CapRate: 0.0850,
            assumptions: 'GDP growth 6%, constant interest rates',
          },
          scenario2RateRise: {
            description: 'Interest rate hikes 300bps',
            year1CapRate: 0.1050,
            year2CapRate: 0.1100,
            year3CapRate: 0.1130,
            year5CapRate: 0.1150,
            assumptions: 'RBI tightens, cap rates widen 200-300bps',
          },
          scenario3RateCut: {
            description: 'Rate cuts 200bps, strong demand',
            year1CapRate: 0.0850,
            year2CapRate: 0.0800,
            year3CapRate: 0.0760,
            year5CapRate: 0.0720,
            assumptions: 'RBI easing, investor demand strong',
          },
        },
        exitValueProjection: {
          year5Scenarios: {
            conservative: { capRate: 0.095, exitNoi: 15000000, exitValue: 157894737 },
            base: { capRate: 0.085, exitNoi: 15000000, exitValue: 176470588 },
            optimistic: { capRate: 0.075, exitNoi: 15000000, exitValue: 200000000 },
          },
        },
        sources: ['Cap rate market data', 'Interest rate outlook', 'Hotel market forecasts'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 13: analyze_sale_comparables
  server.registerTool('analyze_sale_comparables', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      saleComparables: {
        searchCriteria: {
          location: 'Mumbai, Bangalore, Hyderabad metros',
          assetType: '4-5 star business hotels',
          saleDateRange: '2024-2026',
          numberOfComps: 8,
        },
        comparableTransactions: [
          {
            compNumber: 1,
            propertyName: 'Metro Business Hotel - Mumbai',
            saleDate: '2025-10-15',
            salePrice: 150000000,
            rooms: 120,
            pricePerRoom: 1250000,
            capRate: 0.082,
            noi: 12300000,
            yearsInOperation: 8,
          },
          {
            compNumber: 2,
            propertyName: 'Premium City Hotel - Bangalore',
            saleDate: '2025-08-20',
            salePrice: 95000000,
            rooms: 90,
            pricePerRoom: 1055556,
            capRate: 0.091,
            noi: 8645000,
            yearsInOperation: 6,
          },
          {
            compNumber: 3,
            propertyName: 'Gateway Plaza Hotel - Hyderabad',
            saleDate: '2025-06-10',
            salePrice: 110000000,
            rooms: 100,
            pricePerRoom: 1100000,
            capRate: 0.087,
            noi: 9570000,
            yearsInOperation: 5,
          },
          {
            compNumber: 4,
            propertyName: 'Central Business Hotel - Delhi',
            saleDate: '2025-04-05',
            salePrice: 125000000,
            rooms: 110,
            pricePerRoom: 1136364,
            capRate: 0.089,
            noi: 11125000,
            yearsInOperation: 7,
          },
        ],
        marketMetrics: {
          avgPricePerRoom: 1135480,
          rangePerRoom: '1055556 - 1250000',
          medianCapRate: 0.0885,
          capRateRange: '0.082 - 0.091',
        },
        subjectPropertyValuation: {
          rooms: 100,
          estimatedPricePerRoom: 1135480,
          estimatedMarketValue: 113548000,
          estimatedCapRate: 0.0885,
          valuation: {
            lowEstimate: 104000000,
            midEstimate: 113548000,
            highEstimate: 125000000,
          },
        },
        sources: ['Recent hotel sale transactions', 'Public property records', 'Market analysis databases'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 14: profile_buyers
  server.registerTool('profile_buyers', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      buyerProfile: {
        propertyTarget: {
          type: '4-star business hotel',
          location: 'Tier-1 Indian city',
          targetValue: '100-150M',
        },
        buyerTypeAnalysis: {
          institutional: {
            type: 'Global/National REITs & Funds',
            marketShare: 0.4,
            examples: ['ITC Hotels', 'Oberoi Hotels', 'Global hospitality REIT'],
            requiredReturn: '8-12% IRR',
            preferredStructure: 'Core asset, long-term hold',
            strengths: 'Operational expertise, capital access, acquisition track record',
            likelihood: 'Very High',
          },
          reit: {
            type: 'Specialized Hotel REITs',
            marketShare: 0.25,
            examples: ['Embassy Office Parks REIT (Hotels division)', 'Hospitality REITs'],
            requiredReturn: '7-10% yield',
            preferredStructure: 'Stabilized asset, triple-net lease',
            strengths: 'Capital efficient, dividend focus',
            likelihood: 'High',
          },
          familyOffice: {
            type: 'HNI / Family Offices',
            marketShare: 0.2,
            examples: ['Billionaire-backed PE funds', 'Family office allocations'],
            requiredReturn: '12-18% IRR',
            preferredStructure: 'Core-plus with upside',
            strengths: 'Patient capital, strategic interests',
            likelihood: 'Moderate',
          },
          developer: {
            type: 'Real Estate Developer/Operator',
            marketShare: 0.15,
            examples: ['Large Indian real estate groups'],
            requiredReturn: '15-25% IRR',
            preferredStructure: 'Repositioning opportunity',
            strengths: 'Synergies, operational control',
            likelihood: 'Moderate',
          },
        },
        marketingStrategy: {
          targetBuyers: 12,
          estimatedOffers: 6,
          competitiveProcess: 'Controlled auction',
          timeline: '4-6 months process',
        },
        sources: ['Institutional buyer databases', 'REIT transaction analysis', 'Market intelligence'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 15: calc_transaction_costs
  server.registerTool('calc_transaction_costs', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      transactionCostAnalysis: {
        assumedSalePrice: 120000000,
        costBreakdown: [
          {
            category: 'Brokerage Fee',
            rateRange: '0.01-0.02',
            midpointRate: 0.015,
            amount: 1800000,
            description: 'Real estate transaction broker commission',
          },
          {
            category: 'Legal Fees',
            rateRange: '0.005-0.01',
            midpointRate: 0.0075,
            amount: 900000,
            description: 'Seller legal counsel, due diligence, closing',
          },
          {
            category: 'Stamp Duty / Transfer Tax',
            rateRange: '0.05-0.07',
            midpointRate: 0.06,
            amount: 7200000,
            description: 'State stamp duty on property transfer',
          },
          {
            category: 'Registration Fees',
            amount: 350000,
            description: 'Property registration with revenue department',
          },
          {
            category: 'Inspection & Appraisal Costs',
            amount: 200000,
            description: 'Building inspection, environmental assessment',
          },
          {
            category: 'Tax Advisory & Cap Gains Planning',
            amount: 300000,
            description: 'Tax optimization for capital gains',
          },
          {
            category: 'Misc. Closing Costs',
            amount: 250000,
            description: 'Title insurance, utilities transfer, etc',
          },
        ],
        totalTransactionCosts: 11000000,
        costAsPercentageOfSale: 0.0917,
        netProceeds: 109000000,
        taxConsiderations: {
          capitalGains: {
            assumedBasisCost: 73000000,
            assumedSalePrice: 120000000,
            capitalGain: 47000000,
            capitalGainsTaxRate: 0.2,
            federalTaxLiability: 9400000,
            stateTaxEstimate: 2000000,
            totalTaxLiability: 11400000,
          },
          netProfit: {
            grossProceeds: 120000000,
            transactionCosts: -11000000,
            capitalGainsTax: -11400000,
            netProfit: 97600000,
          },
        },
        sources: ['Real estate transaction benchmarks', 'Tax code analysis', 'Broker fee surveys'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ==================== INSURANCE TOOLS (4) ====================

  // Tool 16: calc_property_insurance
  server.registerTool('calc_property_insurance', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      propertyInsuranceAnalysis: {
        insuredProperty: {
          type: '4-star business hotel',
          location: 'Tier-1 metro',
          reconstructionCost: 75000000,
          contentsValue: 8000000,
          totalInsurableValue: 83000000,
        },
        riskAssessment: {
          locationZone: 'Zone III (Moderate seismic)',
          floodRisk: 'Low',
          cycloneRisk: 'Moderate',
          crimeRate: 'Low',
          constructionType: 'RCC reinforced concrete',
          ageOfBuilding: 5,
          maintenanceCondition: 'Excellent',
        },
        premiumEstimates: {
          propertyDamage: {
            type: 'Building and structure',
            coverage: 75000000,
            ratePercentage: 0.005,
            annualPremium: 375000,
          },
          contentsInsurance: {
            type: 'Furniture, fixtures, equipment',
            coverage: 8000000,
            ratePercentage: 0.008,
            annualPremium: 64000,
          },
          earthquakeExtension: {
            type: 'Zone III coverage',
            coverage: 75000000,
            ratePercentage: 0.003,
            annualPremium: 225000,
          },
          floodInsurance: {
            type: 'Optional coverage',
            coverage: 75000000,
            ratePercentage: 0.001,
            annualPremium: 75000,
          },
          businessInterruption: {
            type: 'BI coverage for 12 months',
            coverage: 15000000,
            ratePercentage: 0.008,
            annualPremium: 120000,
          },
        },
        totalAnnualPremium: 859000,
        costAsPercentageOfValue: 0.01035,
        deductibles: {
          propertyDamage: 250000,
          earthquake: 500000,
          flood: 100000,
        },
        sources: ['Property insurance rate surveys', 'Risk zone data', 'Claims history analysis'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 17: analyze_liability_coverage
  server.registerTool('analyze_liability_coverage', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      liabilityCoverageAnalysis: {
        coverageTypes: [
          {
            coverageType: 'Public Liability',
            description: 'Guest and visitor injury claims, property damage by hotel operations',
            recommendedLimit: 10000000,
            annualPremium: 150000,
            deductible: 100000,
            status: 'REQUIRED by lenders',
          },
          {
            coverageType: 'Employer Liability',
            description: 'Worker injury claims, employment practices liability',
            recommendedLimit: 5000000,
            annualPremium: 80000,
            deductible: 50000,
            status: 'REQUIRED',
          },
          {
            coverageType: 'Professional Indemnity',
            description: 'Food & beverage safety, event management liability',
            recommendedLimit: 3000000,
            annualPremium: 60000,
            deductible: 50000,
            status: 'RECOMMENDED',
          },
          {
            coverageType: 'Directors & Officers Liability',
            description: 'Management and board liability',
            recommendedLimit: 5000000,
            annualPremium: 100000,
            deductible: 100000,
            status: 'OPTIONAL',
          },
          {
            coverageType: 'Cyber Liability',
            description: 'Data breach, PMS system failures, guest data',
            recommendedLimit: 2000000,
            annualPremium: 50000,
            deductible: 25000,
            status: 'EMERGING NEED',
          },
        ],
        requiredCoverageTotal: {
          aggregateLimit: 18000000,
          annualPremium: 290000,
        },
        claimsHistory: {
          last3Years: {
            publicLiabilityClaims: 2,
            averageClaimValue: 150000,
            employerLiabilityClaims: 1,
            lossRatio: 0.15,
          },
        },
        sources: ['Insurance industry standards', 'Loan covenants', 'Risk management best practices'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 18: model_business_interruption
  server.registerTool('model_business_interruption', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      businessInterruptionInsurance: {
        exposureAnalysis: {
          annualRevenue: 45000000,
          monthlyRevenue: 3750000,
          monthlyNoi: 1200000,
          fixedCosts: 1500000,
          variableCosts: 1200000,
        },
        coverageScenarios: {
          coverage6Months: {
            monthsCovered: 6,
            totalCoverageAmount: 7200000,
            annualPremium: 90000,
            costAsPercentage: 0.02,
            payoutPerDay: 40000,
            claimWaitingPeriod: 30,
          },
          coverage12Months: {
            monthsCovered: 12,
            totalCoverageAmount: 14400000,
            annualPremium: 150000,
            costAsPercentage: 0.033,
            payoutPerDay: 40000,
            claimWaitingPeriod: 30,
          },
        },
        triggeringEvents: {
          buildingDamage: 'Fire, earthquake, flood damage requiring closure',
          utilityInterruption: 'Loss of electricity, water supply, communications',
          pandemicShutdown: 'Government-mandated closure (COVID-like scenario)',
          supplierFailure: 'Key service supplier unable to deliver',
        },
        payoutStructure: {
          fixedCosts: 'Fully covered regardless of occupancy',
          variableCosts: 'Covered at X% during claim period',
          profitLoss: 'Not covered (business interruption BI only covers continuation costs)',
        },
        recommendedCoverage: '12 months, minimum ₹14.4 crores',
        sources: ['BI insurance industry standards', 'Revenue risk analysis', 'Claims case studies'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 19: assess_natural_hazards
  server.registerTool('assess_natural_hazards', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      naturalHazardAssessment: {
        propertyLocation: 'Mumbai',
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        seismicRisk: {
          zoneClassification: 'Zone III',
          zoneDescription: 'Moderate seismic activity',
          pga: '0.16-0.20g',
          designCapacity: 'IS 1893 Zone III',
          buildingVulnerability: 'Low (modern RCC construction)',
          insurancePremiumImpact: 'Moderate (0.3% surcharge)',
        },
        floodRisk: {
          riskLevel: 'Low',
          floodZoneDesignation: 'Non-flood zone',
          historicalIncidents: 'Rare',
          elevationFromWaterTable: '8-10 meters',
          rainfallExposure: 'Moderate monsoon (June-Sep)',
          drainageAssessment: 'Adequate municipal drainage',
          insurancePremiumImpact: 'Minimal (0.1% if included)',
        },
        cycloneRisk: {
          riskLevel: 'Moderate',
          historicalExposure: 'Bay of Bengal cyclones (Jun-Nov)',
          probabilityOfDamage: 'Low',
          windSpeedDesign: 'IS 875 Level 3 (160+ kmph)',
          buildingResistance: 'Adequate',
          roofingVulnerability: 'Properly anchored',
          insurancePremiumImpact: 'Low (typically included)',
        },
        weatherRelatedRisks: {
          heavyRainfall: { riskLevel: 'Moderate', occurrences: 'Monsoon concentrated' },
          heatWaves: { riskLevel: 'Low', occurrences: 'May-June' },
          thunderstorms: { riskLevel: 'Moderate', occurrences: 'Scattered' },
        },
        recommendedMeasures: [
          'Annual structural safety audit',
          'Elevator and lift emergency systems',
          'Backup power generation (minimum 48 hours)',
          'Water drainage maintenance',
          'Lightning protection systems',
          'Building envelope inspection (roofing, caulking)',
        ],
        overallRiskRating: 'MODERATE',
        insuranceRecommendation: 'Standard property + earthquake extension + optional flood',
        sources: ['Seismic hazard maps (USGS/ISM)', 'Flood risk databases', 'Climate data analysis'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ==================== PROPTECH TOOLS (5) ====================

  // Tool 20: compare_pms_systems
  server.registerTool('compare_pms_systems', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      pmsComparison: {
        propertySize: 100,
        evaluationDate: '2026-03-06',
        systems: [
          {
            vendor: 'Oracle Opera',
            marketShare: 'Enterprise leader',
            implementationCost: 500000,
            annualLicense: 120000,
            setupTime: '6-9 months',
            features: {
              guestManagement: true,
              housekeeping: true,
              financials: true,
              rms: 'Built-in',
              mobileApp: true,
              cloudBased: true,
            },
            bestFor: 'Large chains, multi-property operators',
            roi: 'High (3-5 year payback)',
          },
          {
            vendor: 'Hogan',
            marketShare: 'Indian market leader',
            implementationCost: 250000,
            annualLicense: 60000,
            setupTime: '3-4 months',
            features: {
              guestManagement: true,
              housekeeping: true,
              financials: true,
              rms: 'Integrated partner',
              mobileApp: true,
              cloudBased: true,
            },
            bestFor: 'Mid-market Indian hotels',
            roi: 'Excellent (2-3 year payback)',
          },
          {
            vendor: 'Protel (by IDeaS)',
            marketShare: 'Strong in Europe',
            implementationCost: 350000,
            annualLicense: 80000,
            setupTime: '4-5 months',
            features: {
              guestManagement: true,
              housekeeping: true,
              financials: true,
              rms: 'Integrated partnership',
              mobileApp: true,
              cloudBased: true,
            },
            bestFor: 'European and premium properties',
            roi: 'Good (3-4 year payback)',
          },
          {
            vendor: 'Mews',
            marketShare: 'Fast-growing cloud',
            implementationCost: 150000,
            annualLicense: 48000,
            setupTime: '2-3 months',
            features: {
              guestManagement: true,
              housekeeping: true,
              financials: true,
              rms: 'Partner integration',
              mobileApp: true,
              cloudBased: true,
            },
            bestFor: 'Tech-forward, boutique hotels',
            roi: 'Fast (2 year payback)',
          },
          {
            vendor: 'Cloudbeds',
            marketShare: 'Emerging budget option',
            implementationCost: 80000,
            annualLicense: 30000,
            setupTime: '1-2 months',
            features: {
              guestManagement: true,
              housekeeping: false,
              financials: 'Basic',
              rms: 'Partner integration',
              mobileApp: true,
              cloudBased: true,
            },
            bestFor: 'Budget hotels, small operators',
            roi: 'Excellent (1 year payback)',
          },
        ],
        recommendation: 'Hogan for best fit - Indian-focused, cost-effective, strong support',
        sources: ['PMS vendor comparison databases', 'Implementation cost surveys', 'User reviews'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 21: calc_iot_roi
  server.registerTool('calc_iot_roi', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      iotRoiAnalysis: {
        propertyBaseline: {
          annualEnergyBills: 2400000,
          maintenanceEmergencies: 80,
          maintenanceCosts: 400000,
          guestSatisfactionScore: 8.2,
        },
        iotInvestments: {
          smartHvac: {
            investmentCost: 450000,
            installationTime: '2 months',
            energySavings: '20-30%',
            projectedAnnualSavings: 600000,
            paybackPeriod: 0.75,
            guestComfortImprovement: true,
          },
          occupancySensors: {
            investmentCost: 150000,
            installationTime: '1.5 months',
            lightingEnergyReduction: '25-35%',
            automatedHousekeepingSignal: true,
            projectedAnnualSavings: 120000,
            paybackPeriod: 1.25,
          },
          keylessEntry: {
            investmentCost: 200000,
            installationTime: '1 month',
            securityImprovement: true,
            guestExperienceGain: 'Positive',
            lostKeyReplacement: 'Eliminated',
            projectedAnnualSavings: 40000,
            paybackPeriod: 5.0,
          },
          predictiveMaintenance: {
            investmentCost: 300000,
            installationTime: '2 months',
            emergencyReductionPercent: 0.5,
            projectedAnnualSavings: 200000,
            paybackPeriod: 1.5,
            unplannedDowntimeReduction: true,
          },
          guestRoomIoT: {
            investmentCost: 250000,
            installationTime: '1.5 months',
            features: ['Smart lighting', 'Smart AC', 'Room control via mobile'],
            guestSatisfactionGain: 0.5,
            projectedAnnualSavings: 80000,
            paybackPeriod: 3.125,
          },
        },
        totalIotInvestment: 1350000,
        totalProjectedAnnualSavings: 1040000,
        blendedPaybackPeriod: 1.3,
        year1Roi: 0.77,
        year3Roi: 2.31,
        year5Roi: 3.85,
        sources: ['IoT solution provider case studies', 'Energy savings benchmarks', 'Guest experience research'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 22: assess_smart_building
  server.registerTool('assess_smart_building', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      smartBuildingAssessment: {
        currentMaturityLevel: 'Level 2 (Basic automation)',
        readinessScore: 72,
        readinessComponents: {
          infrastructure: {
            networkCapacity: 0.8,
            cloudReadiness: 0.7,
            securityInfrastructure: 0.6,
            componentScore: 0.73,
          },
          systemsIntegration: {
            pmsIntegration: 0.7,
            hvacSmartCapability: 0.5,
            lightingSystemModernity: 0.6,
            componentScore: 0.6,
          },
          dataAndAnalytics: {
            dataCollectionCapability: 0.75,
            analyticsTools: 0.65,
            dashboardingCapability: 0.7,
            componentScore: 0.7,
          },
          staffReadiness: {
            itSupport: 0.8,
            operationalTraining: 0.6,
            changeManagement: 0.75,
            componentScore: 0.72,
          },
        },
        targetMaturityLevel: 'Level 4 (Intelligent, autonomous)',
        investmentRequired: 2500000,
        implementationPhases: {
          phase1Year1: {
            focus: 'Foundation (cloud, sensors, security)',
            investment: 800000,
            expectedSavings: 300000,
          },
          phase2Year2: {
            focus: 'Integration (PMS, HVAC, lighting)',
            investment: 900000,
            expectedSavings: 500000,
          },
          phase3Year3: {
            focus: 'Analytics and AI (predictive maintenance, optimization)',
            investment: 800000,
            expectedSavings: 400000,
          },
        },
        targetBenefits: {
          energyEfficiency: '25-30%',
          maintenanceCostReduction: '20-25%',
          guestSatisfactionGain: '0.8-1.2 points',
          operationalEfficiency: '15-20%',
          dataDrivenDecisions: 'Enabled',
        },
        sources: ['Smart building benchmarks', 'Building automation technology assessments', 'IoT maturity models'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 23: evaluate_rms
  server.registerTool('evaluate_rms', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      rmsEvaluation: {
        propertyProfile: {
          roomCount: 100,
          segmentComplexity: 'Moderate (Corporate, Leisure, Group)',
          distributionChannels: 6,
          averageOccupancy: 0.7,
          currentAdr: 4950,
          currentRevpar: 3465,
        },
        rmsSystems: [
          {
            vendor: 'IDeaS (Oracle)',
            marketShare: '#1 globally',
            annualCost: 80000,
            implementation: '3-4 months',
            features: {
              demandForecasting: 'Advanced ML',
              priceOptimization: 'Dynamic real-time',
              inventoryManagement: 'Granular',
              channelManagement: true,
              reporting: 'Advanced',
            },
            projectedRevparGain: '5-8%',
            projectedRevpar: 3640,
            roiYears: '2-3',
            bestFor: 'Premium, complex high-volume properties',
          },
          {
            vendor: 'Duetto',
            marketShare: 'Growing challenger',
            annualCost: 60000,
            implementation: '2-3 months',
            features: {
              demandForecasting: 'Good ML',
              priceOptimization: 'Dynamic',
              inventoryManagement: 'Good',
              channelManagement: true,
              reporting: 'Good',
            },
            projectedRevparGain: '4-6%',
            projectedRevpar: 3605,
            roiYears: '2-3',
            bestFor: 'Mid-market premium hotels',
          },
          {
            vendor: 'Atomize',
            marketShare: 'Emerging',
            annualCost: 40000,
            implementation: '1-2 months',
            features: {
              demandForecasting: 'Basic ML',
              priceOptimization: 'Automated',
              inventoryManagement: 'Basic',
              channelManagement: true,
              reporting: 'Standard',
            },
            projectedRevparGain: '2-4%',
            projectedRevpar: 3536,
            roiYears: '1-2',
            bestFor: 'Budget to mid-market hotels',
          },
        ],
        recommendation: 'Atomize for quick ROI, IDeaS for advanced optimization',
        sources: ['RMS vendor benchmarks', 'RevPAR impact studies', 'Implementation timelines'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 24: plan_tech_capex
  server.registerTool('plan_tech_capex', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      techCapexPlan: {
        planningHorizon: '5 years',
        year1: {
          year: 2026,
          initiatives: [
            { item: 'PMS upgrade (Hogan)', cost: 250000, priority: 'Critical' },
            { item: 'Network upgrade', cost: 150000, priority: 'High' },
            { item: 'Smart HVAC', cost: 450000, priority: 'High' },
          ],
          totalCapex: 850000,
          expectedReturn: 300000,
          roi: 0.35,
        },
        year2: {
          year: 2027,
          initiatives: [
            { item: 'RMS implementation (Atomize)', cost: 40000, priority: 'High' },
            { item: 'Occupancy sensors & lighting', cost: 150000, priority: 'High' },
            { item: 'Cybersecurity upgrade', cost: 100000, priority: 'High' },
            { item: 'Mobile app development', cost: 80000, priority: 'Medium' },
          ],
          totalCapex: 370000,
          expectedReturn: 200000,
          roi: 0.54,
        },
        year3: {
          year: 2028,
          initiatives: [
            { item: 'Guest room IoT', cost: 250000, priority: 'Medium' },
            { item: 'Predictive maintenance platform', cost: 150000, priority: 'High' },
            { item: 'Analytics dashboard', cost: 80000, priority: 'Medium' },
          ],
          totalCapex: 480000,
          expectedReturn: 300000,
          roi: 0.625,
        },
        year4: {
          year: 2029,
          initiatives: [
            { item: 'Property management dashboard upgrade', cost: 120000, priority: 'Medium' },
            { item: 'Sustainability monitoring systems', cost: 100000, priority: 'Medium' },
          ],
          totalCapex: 220000,
          expectedReturn: 150000,
          roi: 0.68,
        },
        year5: {
          year: 2030,
          initiatives: [
            { item: 'Emerging tech pilots (AR/VR)', cost: 100000, priority: 'Low' },
            { item: 'System refresh/maintenance', cost: 150000, priority: 'Medium' },
          ],
          totalCapex: 250000,
          expectedReturn: 100000,
          roi: 0.4,
        },
        summary: {
          totalPlan: 2170000,
          totalExpectedReturns: 1050000,
          blendedRoi: 0.48,
          paybackPeriod: 2.1,
          emergingTrends: 'AI/ML, IoT, sustainability monitoring',
        },
        sources: ['Technology roadmap best practices', 'Hotel tech investment benchmarks', 'Vendor roadmaps'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ==================== FORENSIC TOOLS (6) ====================

  // Tool 25: detect_anomalies
  server.registerTool('detect_anomalies', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      anomalyDetection: {
        analysisDate: '2026-03-06',
        metric: 'Monthly financial metrics (trailing 24 months)',
        metrics: [
          {
            metricName: 'Occupancy Rate (%)',
            mean: 72,
            stdDev: 5,
            threshold: 2.0,
            currentValue: 85,
            zScore: 2.6,
            flagged: true,
            interpretation: 'Unusually high occupancy - positive anomaly',
            investigation: 'Verify with booking data - possible data entry error or genuine peak',
          },
          {
            metricName: 'ADR (₹)',
            mean: 4950,
            stdDev: 250,
            threshold: 2.0,
            currentValue: 4200,
            zScore: -3.0,
            flagged: true,
            interpretation: 'Significantly lower ADR - negative anomaly',
            investigation: 'Investigate channel mix shift, promotional activity, or pricing errors',
          },
          {
            metricName: 'F&B Revenue (₹)',
            mean: 165000,
            stdDev: 15000,
            threshold: 2.0,
            currentValue: 125000,
            zScore: -2.67,
            flagged: true,
            interpretation: 'Lower F&B revenue than expected',
            investigation: 'Check staffing levels, menu pricing, restaurant hours, promotions',
          },
          {
            metricName: 'Labour Cost %',
            mean: 0.35,
            stdDev: 0.03,
            threshold: 2.0,
            currentValue: 0.45,
            zScore: 3.33,
            flagged: true,
            interpretation: 'Labour costs unusually high relative to revenue',
            investigation: 'Verify payroll records, overtime, staffing ratios',
          },
          {
            metricName: 'Utilities Cost %',
            mean: 0.08,
            stdDev: 0.01,
            threshold: 2.0,
            currentValue: 0.12,
            zScore: 4.0,
            flagged: true,
            interpretation: 'Utilities costs significantly above normal',
            investigation: 'Check HVAC maintenance, metering accuracy, unusual consumption',
          },
        ],
        anomalyCount: 5,
        severityLevel: 'Medium - warrants investigation',
        sources: ['Financial metrics database', 'Z-score statistical analysis', 'Baseline benchmarks'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 26: audit_reconciliation
  server.registerTool('audit_reconciliation', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      auditReconciliation: {
        auditDate: '2026-03-06',
        accountClassifications: [
          {
            glAccount: '4010 - Room Revenue',
            glBalance: 50000000,
            rmsBalance: 49950000,
            subledgerBalance: 50025000,
            variance: 25000,
            variancePercent: 0.0005,
            status: 'ACCEPTABLE',
            explanation: 'Timing difference - credit card settlements in transit',
          },
          {
            glAccount: '5200 - Payroll Expense',
            glBalance: 18500000,
            rmsBalance: null,
            payrollSystemBalance: 18500000,
            variance: 0,
            variancePercent: 0.0,
            status: 'RECONCILED',
            explanation: 'Perfect match with payroll system',
          },
          {
            glAccount: '5300 - F&B Cost of Goods Sold',
            glBalance: 12300000,
            poSystemBalance: 12150000,
            invoiceMatchBalance: 12300000,
            variance: 150000,
            variancePercent: 0.012,
            status: 'INVESTIGATE',
            explanation: 'Variance likely due to inventory adjustment',
          },
          {
            glAccount: '5400 - Utilities',
            glBalance: 3600000,
            meterReadingBalance: 3550000,
            variance: 50000,
            variancePercent: 0.014,
            status: 'INVESTIGATE',
            explanation: 'Estimate vs actual - pending final meter reading',
          },
          {
            glAccount: '1200 - Accounts Receivable',
            glBalance: 2500000,
            agingSchedule: 2485000,
            variance: 15000,
            variancePercent: 0.006,
            status: 'ACCEPTABLE',
            explanation: 'Uncollected corporate receivables - timing',
          },
        ],
        summaryMetrics: {
          totalGlAccounts: 185,
          accountsTested: 5,
          fullyReconciled: 3,
          varianceDetected: 2,
          totalVariance: 215000,
          varianceAsPercOfNetIncome: 0.023,
          overallStatus: 'MINOR DISCREPANCIES - Acceptable range',
        },
        sources: ['General ledger system', 'Subledger systems', 'Account reconciliation reports'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 27: check_expense_policy
  server.registerTool('check_expense_policy', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      expensePolicyAudit: {
        auditDate: '2026-03-06',
        policyFramework: 'Industry hotel expense benchmarks',
        categories: [
          {
            category: 'Payroll & Benefits',
            policyTarget: '35-38% of revenue',
            currentActual: '36.2%',
            variance: 1.2,
            status: 'COMPLIANT',
            notes: 'Within acceptable range',
          },
          {
            category: 'Cost of Goods Sold (F&B)',
            policyTarget: '30-35% of F&B revenue',
            currentActual: '32.5%',
            variance: -0.5,
            status: 'COMPLIANT',
            notes: 'Slightly better than target',
          },
          {
            category: 'Utilities',
            policyTarget: '7-9% of revenue',
            currentActual: '8.8%',
            variance: -0.2,
            status: 'COMPLIANT',
            notes: 'Higher than prior year - investigate consumption',
          },
          {
            category: 'Maintenance & Repairs',
            policyTarget: '4-6% of revenue',
            currentActual: '5.4%',
            variance: -0.4,
            status: 'COMPLIANT',
            notes: 'Increased due to planned refurbishment',
          },
          {
            category: 'Marketing & Advertising',
            policyTarget: '2-3% of revenue',
            currentActual: '2.8%',
            variance: -0.2,
            status: 'COMPLIANT',
            notes: 'Digital marketing push - tracking ROI',
          },
          {
            category: 'Administrative & General',
            policyTarget: '3-5% of revenue',
            currentActual: '4.2%',
            variance: -0.8,
            status: 'COMPLIANT',
            notes: 'Professional fees contributed to variance',
          },
          {
            category: 'Guest Supplies',
            policyTarget: '1-1.5% of revenue',
            currentActual: '1.8%',
            variance: 0.3,
            status: 'INVESTIGATE',
            notes: 'Slightly over target - review procurement',
          },
        ],
        detailedFindingsHighlight: {
          unusualExpense: 'International consulting fees (₹400K) in Jan/Feb - pre-approved',
          creditCardSpend: 'Verify delegation of authority for expenses >₹50K',
          travelExpenses: 'Review vs per diem policy - 3 non-compliant submissions identified',
        },
        overallStatus: 'MOSTLY COMPLIANT - Minor investigation recommended',
        sources: ['Hotel industry expense benchmarks', 'Company expense policy', 'Actuals vs budget analysis'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 28: analyze_revenue_quality
  server.registerTool('analyze_revenue_quality', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      revenueQualityAnalysis: {
        analysisDate: '2026-03-06',
        totalRevenue: 45000000,
        revenueStreams: [
          {
            stream: 'Room Revenue',
            amount: 32000000,
            percentage: 0.711,
            recognitionTiming: 'Point of occupancy',
            quality: 'HIGH',
            notes: 'Clean recognition, supported by PMS records',
          },
          {
            stream: 'F&B Revenue',
            amount: 9000000,
            percentage: 0.2,
            recognitionTiming: 'Point of service',
            quality: 'HIGH',
            deferredRevenue: 0,
            notes: 'POS system reconciliation complete',
          },
          {
            stream: 'Events & Conferences',
            amount: 2400000,
            percentage: 0.053,
            recognitionTiming: 'Over event period (sometimes multi-month)',
            quality: 'MEDIUM',
            deferredRevenue: 850000,
            notes: 'Advance deposits require careful timing',
          },
          {
            stream: 'Parking & Misc',
            amount: 1600000,
            percentage: 0.036,
            recognitionTiming: 'Point of service',
            quality: 'MEDIUM',
            deferredRevenue: 0,
            notes: 'Manual tracking - automate where possible',
          },
        ],
        accountingQuality: {
          recognitionPolicy: 'IFRS compliant',
          cutoffTesting: 'Sample of 10 transactions tested - 0 exceptions',
          accrualAccuracy: 'Within 2% tolerance',
          deferredRevenueTracking: 'Robust - monthly reconciliation',
        },
        redFlags: [],
        greenFlags: [
          'Revenue reconciles to PMS daily',
          'Channel revenue tracking granular',
          'Refund policy consistently applied',
          'Credit card processing review completed',
        ],
        overallQualityRating: 'HIGH',
        riskOfMisstatement: 'Low',
        sources: ['Revenue system reconciliation', 'IFRS revenue recognition standards', 'Audit testing'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 29: validate_cash_flow
  server.registerTool('validate_cash_flow', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      cashFlowValidation: {
        validationDate: '2026-03-06',
        reportedMetrics: {
          netIncome: 9300000,
          reportedCashFromOperations: 10200000,
          investingCashFlow: -1500000,
          financingCashFlow: -2100000,
          netCashChange: 6600000,
        },
        cashFlowAnalysis: {
          netIncomeToOcfQuality: {
            netIncome: 9300000,
            adjustments: {
              depreciation: 2500000,
              amortization: 300000,
              stockBasedComp: 100000,
              deferredTaxes: 200000,
              changInWorkingCapital: -2200000,
            },
            calculatedOcf: 10200000,
            reportedOcf: 10200000,
            variance: 0,
            status: 'VALIDATED',
          },
          workingCapitalQuality: {
            accountsReceivable: { change: 150000, normalized: 125000 },
            inventory: { change: 50000, normalized: 40000 },
            prepaidExpenses: { change: 100000, normalized: 100000 },
            accountsPayable: { change: -350000, normalized: -300000 },
            netWorkingCapChange: -2200000,
            quality: 'REASONABLE',
          },
          capitalExpenditureValidation: {
            reportedCapex: 1500000,
            invoiceSupport: 1480000,
            variance: 20000,
            status: 'SUPPORTED',
          },
          debtPaymentValidation: {
            principalPaid: 2100000,
            loanStatementSupport: 2100000,
            status: 'MATCHED',
          },
        },
        overallConclusion: 'Cash flow from operations appears reasonable and well-supported',
        qualityScore: 0.92,
        sources: ['Cash flow statement', 'Bank statements', 'Vendor invoices', 'Loan statements'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // Tool 30: score_fraud_risk
  server.registerTool('score_fraud_risk', dealIdSchema, async (args) => {
    const { dealId } = args as { dealId: string };

    const result = {
      dealId,
      fraudRiskAssessment: {
        assessmentDate: '2026-03-06',
        fraudTriangleAnalysis: {
          pressure: {
            score: 2,
            maxScore: 10,
            indicators: [
              { indicator: 'Cash flow tightness', value: 'Low' },
              { indicator: 'Debt covenant compliance', value: 'Comfortable' },
              { indicator: 'Incentive compensation targets', value: 'Achievable' },
              { indicator: 'Personal financial stress', value: 'Unknown (not assessed)' },
            ],
            assessment: 'Low financial pressure detected',
          },
          opportunity: {
            score: 3,
            maxScore: 10,
            indicators: [
              { indicator: 'Segregation of duties', value: 'Good' },
              { indicator: 'System access controls', value: 'Adequate' },
              { indicator: 'Reconciliation frequency', value: 'Daily/Weekly' },
              { indicator: 'Revenue concentration', value: 'Multiple channels' },
              { indicator: 'Cash handling', value: 'Minimal (mostly cards)' },
            ],
            assessment: 'Limited opportunity for undetected fraud',
          },
          rationalization: {
            score: 1,
            maxScore: 10,
            indicators: [
              { indicator: 'Code of conduct violations', value: 'None detected' },
              { indicator: 'Prior misconduct', value: 'Clean history' },
              { indicator: 'Ethics culture', value: 'Strong' },
              { indicator: 'Tone from top', value: 'Integrity-focused' },
            ],
            assessment: 'Strong ethical environment',
          },
        },
        compositeRiskScore: 2,
        riskRating: 'LOW',
        redFlags: [],
        greenFlags: [
          'Management has transparent communication',
          'Internal controls operating effectively',
          'Reconciliations completed timely and reviewed',
          'Whistleblower hotline established',
          'Annual ethics training completed',
        ],
        recommendations: [
          'Continue regular audit of high-risk transactions (cash, refunds)',
          'Annual ethics training reinforcement',
          'Enhanced cybersecurity monitoring',
        ],
        sources: ['Fraud triangle framework', 'Internal audit reports', 'COSO control assessment'],
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });
}
