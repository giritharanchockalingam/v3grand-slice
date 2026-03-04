// ─── Hotel Asset Plugin ─────────────────────────────────────────────
// Implements AssetPlugin for hotel / hospitality assets.
// Computes RevPAR-driven revenue, USALI-based opex, brand vs independent.

import type {
  AssetPlugin, HotelSectorInputs, ScenarioAssumptions,
  EvaluationYearProjection, OperatingModelOption, ICSection,
  SectorInputField, DealEvaluationInput,
} from '@v3grand/core';

export const hotelPlugin: AssetPlugin<HotelSectorInputs> = {
  assetClass: 'hotel',
  label: 'Hotel / Hospitality',

  validateInputs(inputs: HotelSectorInputs): string[] {
    const errors: string[] = [];
    if (!inputs.totalKeys || inputs.totalKeys < 1) errors.push('Total keys must be at least 1');
    if (!inputs.adrBase || inputs.adrBase <= 0) errors.push('Base ADR must be positive');
    if (!inputs.occupancyRamp || inputs.occupancyRamp.length === 0) errors.push('Occupancy ramp is required');
    if (inputs.revenueMix) {
      const total = inputs.revenueMix.rooms + inputs.revenueMix.fb + inputs.revenueMix.banquet + inputs.revenueMix.spa + inputs.revenueMix.other;
      if (Math.abs(total - 1.0) > 0.01) errors.push(`Revenue mix must sum to 100% (currently ${(total * 100).toFixed(0)}%)`);
    }
    return errors;
  },

  computeProjections(
    inputs: HotelSectorInputs,
    scenario: ScenarioAssumptions,
    years: number,
    inflationRate: number,
  ) {
    const revenue: number[] = [];
    const opex: number[] = [];
    const sectorMetrics: Record<string, number>[] = [];

    const STABILIZATION_YEAR = 5;
    const phase2Year = inputs.phase2TriggerYear || 4;
    const phase2Active = scenario.occupancyStabilized >= (inputs.phase2TriggerOccupancy || 0.70);

    for (let y = 0; y < years; y++) {
      const yr = y + 1;
      // Keys available
      const keys = inputs.totalKeys + (phase2Active && yr >= phase2Year ? (inputs.phase2Keys || 0) : 0);

      // Occupancy ramp, capped at scenario stabilized
      const rampOcc = inputs.occupancyRamp[yr] ?? inputs.occupancyRamp[inputs.occupancyRamp.length - 1] ?? scenario.occupancyStabilized;
      const occupancy = Math.min(rampOcc, scenario.occupancyStabilized);

      // ADR growth toward stabilized, then inflation
      let adr: number;
      if (yr <= STABILIZATION_YEAR) {
        const t = yr / STABILIZATION_YEAR;
        adr = inputs.adrBase + (scenario.adrStabilized - inputs.adrBase) * t;
      } else {
        adr = scenario.adrStabilized * Math.pow(1 + inflationRate, yr - STABILIZATION_YEAR);
      }

      const revpar = occupancy * adr;
      const roomRevenue = revpar * keys * 365;
      const totalRev = inputs.revenueMix.rooms > 0 ? roomRevenue / inputs.revenueMix.rooms : roomRevenue;

      // Operating expenses (USALI simplified)
      const deptCost = totalRev * (inputs.departmentalCostPct || 0.45);
      const undistCost = totalRev * (inputs.undistributedCostPct || 0.15);
      const gop = totalRev - deptCost - undistCost;

      // Management & brand fees
      const mgmtFee = totalRev * inputs.managementFeePct;
      const incentiveFee = gop > 0 ? gop * inputs.incentiveFeePct : 0;
      const ffneReserve = totalRev * inputs.ffAndEReservePct;
      const totalOpex = deptCost + undistCost + mgmtFee + incentiveFee + ffneReserve;

      revenue.push(Math.round(totalRev));
      opex.push(Math.round(totalOpex));
      sectorMetrics.push({
        occupancy,
        adr: Math.round(adr),
        revpar: Math.round(revpar),
        keys,
        roomRevenue: Math.round(roomRevenue),
        gop: Math.round(gop),
        gopMargin: totalRev > 0 ? gop / totalRev : 0,
        fbRevenue: Math.round(totalRev * inputs.revenueMix.fb),
        banquetRevenue: Math.round(totalRev * inputs.revenueMix.banquet),
      });
    }

    return { revenue, opex, sectorMetrics };
  },

  computeOperatingModels(
    inputs: HotelSectorInputs,
    baseRevenue: number[],
    baseOpex: number[],
    options: DealEvaluationInput['operatingModelOptions'],
  ): OperatingModelOption[] {
    // For each operating model option, compute adjusted revenue and fees
    return options.map(opt => {
      // Apply occupancy and ADR premiums
      const revMultiplier = (1 + (opt.occupancyPremium || 0)) * (1 + (opt.adrPremium || 0));
      const adjustedRevTotal = baseRevenue.reduce((s, r) => s + r * revMultiplier, 0);
      const adjustedOpexTotal = baseOpex.reduce((s, o) => s + o, 0);
      const avgRevPerYear = adjustedRevTotal / baseRevenue.length;

      // Fee stack
      const baseMgmt = avgRevPerYear * opt.baseMgmtFeePct;
      const incentive = (avgRevPerYear - adjustedOpexTotal / baseRevenue.length) * opt.incentiveFeePct;
      const brand = avgRevPerYear * inputs.revenueMix.rooms * (opt.brandFeePct || 0);
      const reservation = avgRevPerYear * inputs.revenueMix.rooms * (opt.reservationFeePct || 0);
      const totalFees = baseMgmt + incentive + brand + reservation;

      const netRevPct = avgRevPerYear > 0 ? (avgRevPerYear - totalFees) / avgRevPerYear : 0;
      const ebitda = (avgRevPerYear - adjustedOpexTotal / baseRevenue.length - totalFees);
      const ebitdaMargin = avgRevPerYear > 0 ? ebitda / avgRevPerYear : 0;
      const tenYearNOI = ebitda * baseRevenue.length;

      // Simplified IRR (rough estimate)
      const setupCost = opt.setupCostCr * 1e7;
      const cfs = [-setupCost, ...Array(baseRevenue.length).fill(ebitda)];
      let irr = 0;
      // Simple Newton-Raphson
      let rate = 0.10;
      for (let iter = 0; iter < 50; iter++) {
        let npv = 0, dnpv = 0;
        for (let t = 0; t < cfs.length; t++) {
          npv += cfs[t] / Math.pow(1 + rate, t);
          if (t > 0) dnpv -= t * cfs[t] / Math.pow(1 + rate, t + 1);
        }
        if (Math.abs(dnpv) < 1e-12) break;
        const newRate = rate - npv / dnpv;
        if (Math.abs(newRate - rate) < 1e-7) { rate = newRate; break; }
        rate = newRate;
      }
      irr = isFinite(rate) ? rate : 0;

      let recommendation = '';
      if (opt.type === 'brand') {
        recommendation = ebitdaMargin > 0.30 ? 'Strong brand premium justifies fee stack' : 'Brand fees erode margins — independent may be superior';
      } else if (opt.type === 'independent') {
        recommendation = ebitdaMargin > 0.35 ? 'High margins favor independent operation' : 'Consider brand for distribution support';
      } else {
        recommendation = 'Soft-brand offers middle ground between independence and distribution';
      }

      return {
        ...opt,
        netRevenuePctAfterFees: Math.round(netRevPct * 10000) / 10000,
        ebitdaMargin: Math.round(ebitdaMargin * 10000) / 10000,
        tenYearNOI: Math.round(tenYearNOI),
        irr: Math.round(irr * 10000) / 10000,
        recommendation,
      };
    });
  },

  getICSections(inputs: HotelSectorInputs, projections: EvaluationYearProjection[]): ICSection[] {
    const stabProj = projections[4] ?? projections[projections.length - 1];
    const metrics = stabProj?.sectorMetrics ?? {};

    // Market Opportunity section
    const compSetAvgRevpar = inputs.compSet.length > 0
      ? inputs.compSet.reduce((s, c) => s + c.revpar, 0) / inputs.compSet.length : 0;
    const ourRevpar = metrics['revpar'] ?? 0;
    const revparIndex = compSetAvgRevpar > 0 ? ourRevpar / compSetAvgRevpar : 1;

    const marketScore = Math.min(10, Math.max(1,
      (revparIndex >= 1.1 ? 4 : revparIndex >= 0.9 ? 2 : 0)
      + (inputs.anchorTenants.length >= 3 ? 3 : inputs.anchorTenants.length >= 1 ? 1 : 0)
      + ((metrics['occupancy'] ?? 0) >= 0.70 ? 3 : (metrics['occupancy'] ?? 0) >= 0.55 ? 1 : 0)
    ));

    const anchorMOUs = inputs.anchorTenants.reduce((s, a) => s + a.mouRooms, 0);

    return [{
      name: 'Market Opportunity',
      score: marketScore,
      weight: 0.20,
      summary: `${inputs.totalKeys} keys | RevPAR Index ${(revparIndex * 100).toFixed(0)}% | ${anchorMOUs} anchor rooms | ${inputs.compSet.length} comp set hotels`,
      flags: [
        ...(revparIndex < 0.85 ? ['RevPAR below comp set average'] : []),
        ...(inputs.anchorTenants.length < 2 ? ['Limited anchor tenant commitments'] : []),
      ],
    }];
  },

  getDefaultSensitivityAxes(inputs: HotelSectorInputs) {
    const baseOcc = inputs.occupancyStabilized || 0.70;
    const baseAdr = inputs.adrStabilized || 7000;
    return {
      rowParam: 'occupancyStabilized',
      rowLabel: 'Stabilized Occupancy',
      rowValues: [
        baseOcc - 0.15, baseOcc - 0.10, baseOcc - 0.05,
        baseOcc, baseOcc + 0.05, baseOcc + 0.10,
      ].map(v => Math.round(v * 100) / 100),
      colParam: 'adrStabilized',
      colLabel: 'Stabilized ADR (₹)',
      colValues: [
        baseAdr * 0.80, baseAdr * 0.90, baseAdr * 0.95,
        baseAdr, baseAdr * 1.05, baseAdr * 1.10,
      ].map(Math.round),
      unit: 'pct' as const,
    };
  },

  getInputSchema(): SectorInputField[] {
    return [
      // Property
      { key: 'totalKeys', label: 'Total Keys (Phase 1)', section: 'Property', type: 'number', min: 1, max: 1000, required: true, tooltip: 'Number of rooms in Phase 1' },
      { key: 'phase2Keys', label: 'Phase 2 Keys', section: 'Property', type: 'number', min: 0, max: 500, defaultValue: 0, tooltip: 'Additional rooms in Phase 2 expansion' },
      { key: 'starRating', label: 'Star Rating', section: 'Property', type: 'select', options: [{ label: '3 Star', value: '3' }, { label: '4 Star', value: '4' }, { label: '5 Star', value: '5' }], required: true },

      // Revenue
      { key: 'adrBase', label: 'Base ADR (₹)', section: 'Revenue Assumptions', type: 'currency', unit: '₹', min: 1000, max: 50000, required: true, tooltip: 'Year 1 blended Average Daily Rate' },
      { key: 'adrStabilized', label: 'Stabilized ADR (₹)', section: 'Revenue Assumptions', type: 'currency', unit: '₹', min: 1000, max: 50000, required: true },
      { key: 'adrGrowthRate', label: 'ADR Growth Rate', section: 'Revenue Assumptions', type: 'percentage', min: 0, max: 0.15, step: 0.005, defaultValue: 0.05 },
      { key: 'occupancyStabilized', label: 'Stabilized Occupancy', section: 'Revenue Assumptions', type: 'slider', min: 0.30, max: 0.95, step: 0.01, defaultValue: 0.72, tooltip: 'Expected occupancy at stabilization (Year 5)' },

      // Revenue Mix
      { key: 'revenueMix.rooms', label: 'Rooms Revenue %', section: 'Revenue Mix', type: 'percentage', defaultValue: 0.55 },
      { key: 'revenueMix.fb', label: 'F&B Revenue %', section: 'Revenue Mix', type: 'percentage', defaultValue: 0.25 },
      { key: 'revenueMix.banquet', label: 'Banquet Revenue %', section: 'Revenue Mix', type: 'percentage', defaultValue: 0.12 },
      { key: 'revenueMix.spa', label: 'Spa Revenue %', section: 'Revenue Mix', type: 'percentage', defaultValue: 0.03 },
      { key: 'revenueMix.other', label: 'Other Revenue %', section: 'Revenue Mix', type: 'percentage', defaultValue: 0.05 },

      // Operating
      { key: 'departmentalCostPct', label: 'Departmental Cost %', section: 'Operating Model', type: 'percentage', min: 0.20, max: 0.70, defaultValue: 0.45, tooltip: 'Total departmental operating costs as % of revenue (USALI)' },
      { key: 'undistributedCostPct', label: 'Undistributed Cost %', section: 'Operating Model', type: 'percentage', min: 0.05, max: 0.30, defaultValue: 0.15 },
      { key: 'managementFeePct', label: 'Management Fee %', section: 'Operating Model', type: 'percentage', min: 0, max: 0.10, step: 0.005, defaultValue: 0.03 },
      { key: 'incentiveFeePct', label: 'Incentive Fee %', section: 'Operating Model', type: 'percentage', min: 0, max: 0.15, step: 0.005, defaultValue: 0.10 },
      { key: 'ffAndEReservePct', label: 'FF&E Reserve %', section: 'Operating Model', type: 'percentage', min: 0, max: 0.08, step: 0.005, defaultValue: 0.04 },

      // Market
      { key: 'marketSupplyGrowthPct', label: 'Market Supply Growth %', section: 'Market', type: 'percentage', defaultValue: 0.03 },
      { key: 'marketDemandGrowthPct', label: 'Market Demand Growth %', section: 'Market', type: 'percentage', defaultValue: 0.06 },

      // Operating model
      { key: 'selectedOperatingModel', label: 'Operating Model', section: 'Operating Model', type: 'select', options: [{ label: 'Independent', value: 'independent' }, { label: 'Brand (Franchise)', value: 'brand' }, { label: 'Soft Brand', value: 'soft-brand' }], defaultValue: 'independent' },

      // Phase 2
      { key: 'phase2TriggerOccupancy', label: 'Phase 2 Trigger Occupancy', section: 'Expansion', type: 'slider', min: 0.50, max: 0.90, step: 0.01, defaultValue: 0.70, tooltip: 'Occupancy threshold to trigger Phase 2' },
      { key: 'phase2TriggerYear', label: 'Phase 2 Trigger Year', section: 'Expansion', type: 'number', min: 2, max: 10, defaultValue: 4 },
    ];
  },
};
