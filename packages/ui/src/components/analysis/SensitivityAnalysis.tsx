'use client';

import React, { useState, useMemo } from 'react';

interface Props {
  baseIRR: number;
  baseNPV: number;
  baseEM: number;
  baseDSCR: number;
  baseADRGrowth: number;
  baseOccupancy: number;
  baseExitCapRate: number;
  baseWACC: number;
  targetIRR?: number;
  targetDSCR?: number;
}

interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

export function SensitivityAnalysis({
  baseIRR,
  baseNPV,
  baseEM,
  baseDSCR,
  baseADRGrowth,
  baseOccupancy,
  baseExitCapRate,
  baseWACC,
  targetIRR = 0.15,
  targetDSCR = 1.2,
}: Props) {
  // Slider states
  const [adrGrowth, setAdrGrowth] = useState(baseADRGrowth);
  const [occupancy, setOccupancy] = useState(baseOccupancy);
  const [exitCapRate, setExitCapRate] = useState(baseExitCapRate);
  const [wacc, setWACC] = useState(baseWACC);
  const [constructionCostOverrun, setConstructionCostOverrun] = useState(0);
  const [revenueRoomsMix, setRevenueRoomsMix] = useState(0.6);

  // Two-way sensitivity config
  const [sensitivityXAxis, setSensitivityXAxis] = useState('adrGrowth');
  const [sensitivityYAxis, setSensitivityYAxis] = useState('occupancy');

  const sliderConfigs: SliderConfig[] = [
    {
      key: 'adrGrowth',
      label: 'ADR Growth Rate',
      min: -0.05,
      max: 0.1,
      step: 0.005,
      format: (v) => `${(v * 100).toFixed(1)}%`,
    },
    {
      key: 'occupancy',
      label: 'Occupancy Rate (Stabilized)',
      min: 0.4,
      max: 0.95,
      step: 0.01,
      format: (v) => `${(v * 100).toFixed(0)}%`,
    },
    {
      key: 'exitCapRate',
      label: 'Exit Cap Rate',
      min: 0.04,
      max: 0.12,
      step: 0.0025,
      format: (v) => `${(v * 100).toFixed(2)}%`,
    },
    {
      key: 'wacc',
      label: 'WACC',
      min: 0.08,
      max: 0.2,
      step: 0.005,
      format: (v) => `${(v * 100).toFixed(1)}%`,
    },
    {
      key: 'constructionCostOverrun',
      label: 'Construction Cost Overrun',
      min: -0.1,
      max: 0.3,
      step: 0.01,
      format: (v) => `${(v * 100).toFixed(0)}%`,
    },
    {
      key: 'revenueRoomsMix',
      label: 'Revenue Mix (Rooms %)',
      min: 0.4,
      max: 0.8,
      step: 0.01,
      format: (v) => `${(v * 100).toFixed(0)}%`,
    },
  ];

  // Calculate deltas from base values
  const deltas = useMemo(() => {
    return {
      adrDelta: adrGrowth - baseADRGrowth,
      occDelta: occupancy - baseOccupancy,
      capRateDelta: exitCapRate - baseExitCapRate,
      waccDelta: wacc - baseWACC,
      costOverrunDelta: constructionCostOverrun,
      revenueMixDelta: revenueRoomsMix - 0.6,
    };
  }, [adrGrowth, occupancy, exitCapRate, wacc, constructionCostOverrun, revenueRoomsMix]);

  // Calculate projected metrics
  const projectedMetrics = useMemo(() => {
    const { adrDelta, occDelta, capRateDelta, waccDelta, costOverrunDelta } = deltas;

    // IRR approximation
    const projectedIRR = Math.max(
      0.01,
      baseIRR * (1 + adrDelta * 1.5 + occDelta * 2.0 - capRateDelta * 0.8 - waccDelta * 0.5 - costOverrunDelta * 0.3)
    );

    // NPV approximation
    const irrRatio = projectedIRR / baseIRR;
    const projectedNPV = baseNPV * irrRatio;

    // Equity Multiple
    const projectedEM = Math.max(1.0, baseEM * (1 + adrDelta * 1.2 + occDelta * 1.5));

    // DSCR
    const projectedDSCR = Math.max(
      0.8,
      baseDSCR * (1 + occDelta * 1.5 + adrDelta * 1.0 - costOverrunDelta * 0.5)
    );

    return {
      irr: projectedIRR,
      npv: projectedNPV,
      em: projectedEM,
      dscr: projectedDSCR,
    };
  }, [deltas, baseIRR, baseNPV, baseEM, baseDSCR]);

  // Determine verdict
  const verdict = useMemo(() => {
    const irrThreshold = targetIRR || 0.15;
    const dscrThreshold = targetDSCR || 1.2;

    const irrMet = projectedMetrics.irr >= irrThreshold;
    const dscrMet = projectedMetrics.dscr >= dscrThreshold;

    if (irrMet && dscrMet) {
      return { text: 'INVEST', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
    } else if (irrMet || dscrMet) {
      return { text: 'HOLD', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
    } else if (projectedMetrics.irr >= irrThreshold * 0.9) {
      return { text: 'DE-RISK', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
    } else {
      return { text: 'EXIT', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    }
  }, [projectedMetrics.irr, projectedMetrics.dscr, targetIRR, targetDSCR]);

  // Sensitivity analysis - tornado chart data
  const sensitivityData = useMemo(() => {
    const variation = 0.1; // ±10%
    const metrics = [];

    for (const config of sliderConfigs) {
      let baseValue: number;
      let deltaScale = 1;

      switch (config.key) {
        case 'adrGrowth':
          baseValue = baseADRGrowth;
          deltaScale = 1;
          break;
        case 'occupancy':
          baseValue = baseOccupancy;
          deltaScale = 1;
          break;
        case 'exitCapRate':
          baseValue = baseExitCapRate;
          deltaScale = 1;
          break;
        case 'wacc':
          baseValue = baseWACC;
          deltaScale = 1;
          break;
        case 'constructionCostOverrun':
          baseValue = 0;
          deltaScale = 1;
          break;
        case 'revenueRoomsMix':
          baseValue = 0.6;
          deltaScale = 1;
          break;
        default:
          baseValue = 0;
      }

      const upValue = baseValue + baseValue * variation * deltaScale;
      const downValue = Math.max(config.min, baseValue - baseValue * variation * deltaScale);

      // Calculate IRR at these values
      let upDelta = { adrDelta: 0, occDelta: 0, capRateDelta: 0, waccDelta: 0, costOverrunDelta: 0 };
      let downDelta = { adrDelta: 0, occDelta: 0, capRateDelta: 0, waccDelta: 0, costOverrunDelta: 0 };

      switch (config.key) {
        case 'adrGrowth':
          upDelta.adrDelta = upValue - baseADRGrowth;
          downDelta.adrDelta = downValue - baseADRGrowth;
          break;
        case 'occupancy':
          upDelta.occDelta = upValue - baseOccupancy;
          downDelta.occDelta = downValue - baseOccupancy;
          break;
        case 'exitCapRate':
          upDelta.capRateDelta = upValue - baseExitCapRate;
          downDelta.capRateDelta = downValue - baseExitCapRate;
          break;
        case 'wacc':
          upDelta.waccDelta = upValue - baseWACC;
          downDelta.waccDelta = downValue - baseWACC;
          break;
        case 'constructionCostOverrun':
          upDelta.costOverrunDelta = upValue;
          downDelta.costOverrunDelta = downValue;
          break;
      }

      const calcIRR = (delta: typeof upDelta) =>
        Math.max(
          0.01,
          baseIRR *
            (1 +
              delta.adrDelta * 1.5 +
              delta.occDelta * 2.0 -
              delta.capRateDelta * 0.8 -
              delta.waccDelta * 0.5 -
              delta.costOverrunDelta * 0.3)
        );

      const upIRR = calcIRR(upDelta);
      const downIRR = calcIRR(downDelta);
      const impact = Math.abs(upIRR - downIRR) / 2;

      metrics.push({
        name: config.label,
        upIRR,
        downIRR,
        impact,
        upside: (upIRR - baseIRR) / baseIRR,
        downside: (downIRR - baseIRR) / baseIRR,
      });
    }

    return metrics.sort((a, b) => b.impact - a.impact);
  }, [baseIRR, baseADRGrowth, baseOccupancy, baseExitCapRate, baseWACC]);

  // Two-way sensitivity matrix
  const twoWayMatrix = useMemo(() => {
    const xConfig = sliderConfigs.find((c) => c.key === sensitivityXAxis);
    const yConfig = sliderConfigs.find((c) => c.key === sensitivityYAxis);

    if (!xConfig || !yConfig) return null;

    const xValues = [];
    const yValues = [];
    const matrix: number[][] = [];

    // Generate 5 values for each axis
    for (let i = 0; i < 5; i++) {
      xValues.push(xConfig.min + ((xConfig.max - xConfig.min) / 4) * i);
      yValues.push(yConfig.min + ((yConfig.max - yConfig.min) / 4) * i);
    }

    for (const yVal of yValues) {
      const row: number[] = [];
      for (const xVal of xValues) {
        let delta = { adrDelta: 0, occDelta: 0, capRateDelta: 0, waccDelta: 0, costOverrunDelta: 0 };

        // Set X axis value
        switch (sensitivityXAxis) {
          case 'adrGrowth':
            delta.adrDelta = xVal - baseADRGrowth;
            break;
          case 'occupancy':
            delta.occDelta = xVal - baseOccupancy;
            break;
          case 'exitCapRate':
            delta.capRateDelta = xVal - baseExitCapRate;
            break;
          case 'wacc':
            delta.waccDelta = xVal - baseWACC;
            break;
          case 'constructionCostOverrun':
            delta.costOverrunDelta = xVal;
            break;
        }

        // Set Y axis value
        switch (sensitivityYAxis) {
          case 'adrGrowth':
            delta.adrDelta = yVal - baseADRGrowth;
            break;
          case 'occupancy':
            delta.occDelta = yVal - baseOccupancy;
            break;
          case 'exitCapRate':
            delta.capRateDelta = yVal - baseExitCapRate;
            break;
          case 'wacc':
            delta.waccDelta = yVal - baseWACC;
            break;
          case 'constructionCostOverrun':
            delta.costOverrunDelta = yVal;
            break;
        }

        const irr = Math.max(
          0.01,
          baseIRR *
            (1 +
              delta.adrDelta * 1.5 +
              delta.occDelta * 2.0 -
              delta.capRateDelta * 0.8 -
              delta.waccDelta * 0.5 -
              delta.costOverrunDelta * 0.3)
        );
        row.push(irr);
      }
      matrix.push(row);
    }

    const minIRR = Math.min(...matrix.flat());
    const maxIRR = Math.max(...matrix.flat());

    return {
      xValues,
      yValues,
      xLabel: xConfig.label,
      yLabel: yConfig.label,
      matrix,
      minIRR,
      maxIRR,
      xFormat: xConfig.format,
      yFormat: yConfig.format,
    };
  }, [sensitivityXAxis, sensitivityYAxis, baseIRR, baseADRGrowth, baseOccupancy, baseExitCapRate, baseWACC]);

  const getHeatmapColor = (value: number, min: number, max: number): string => {
    const normalized = (value - min) / (max - min);
    if (normalized < 0.33) {
      return `rgb(239, 68, 68)`;
    } else if (normalized < 0.66) {
      return `rgb(251, 191, 36)`;
    } else {
      return `rgb(34, 197, 94)`;
    }
  };

  return (
    <div className="w-full space-y-6 p-6 bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sensitivity Analysis</h1>
        <p className="text-gray-600">Interactive what-if analysis for V3 Grand investment scenario</p>
      </div>

      {/* Interactive Sliders Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-teal-500 rounded"></span>
          Input Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ADR Growth Rate */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {sliderConfigs[0].label}
            </label>
            <input
              type="range"
              min={sliderConfigs[0].min}
              max={sliderConfigs[0].max}
              step={sliderConfigs[0].step}
              value={adrGrowth}
              onChange={(e) => setAdrGrowth(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">-5%</span>
              <span className="text-sm font-semibold text-teal-600">{sliderConfigs[0].format(adrGrowth)}</span>
              <span className="text-xs text-gray-500">+10%</span>
            </div>
          </div>

          {/* Occupancy Rate */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {sliderConfigs[1].label}
            </label>
            <input
              type="range"
              min={sliderConfigs[1].min}
              max={sliderConfigs[1].max}
              step={sliderConfigs[1].step}
              value={occupancy}
              onChange={(e) => setOccupancy(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">40%</span>
              <span className="text-sm font-semibold text-teal-600">{sliderConfigs[1].format(occupancy)}</span>
              <span className="text-xs text-gray-500">95%</span>
            </div>
          </div>

          {/* Exit Cap Rate */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {sliderConfigs[2].label}
            </label>
            <input
              type="range"
              min={sliderConfigs[2].min}
              max={sliderConfigs[2].max}
              step={sliderConfigs[2].step}
              value={exitCapRate}
              onChange={(e) => setExitCapRate(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">4%</span>
              <span className="text-sm font-semibold text-teal-600">{sliderConfigs[2].format(exitCapRate)}</span>
              <span className="text-xs text-gray-500">12%</span>
            </div>
          </div>

          {/* WACC */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {sliderConfigs[3].label}
            </label>
            <input
              type="range"
              min={sliderConfigs[3].min}
              max={sliderConfigs[3].max}
              step={sliderConfigs[3].step}
              value={wacc}
              onChange={(e) => setWACC(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">8%</span>
              <span className="text-sm font-semibold text-teal-600">{sliderConfigs[3].format(wacc)}</span>
              <span className="text-xs text-gray-500">20%</span>
            </div>
          </div>

          {/* Construction Cost Overrun */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {sliderConfigs[4].label}
            </label>
            <input
              type="range"
              min={sliderConfigs[4].min}
              max={sliderConfigs[4].max}
              step={sliderConfigs[4].step}
              value={constructionCostOverrun}
              onChange={(e) => setConstructionCostOverrun(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">-10%</span>
              <span className="text-sm font-semibold text-teal-600">
                {sliderConfigs[4].format(constructionCostOverrun)}
              </span>
              <span className="text-xs text-gray-500">+30%</span>
            </div>
          </div>

          {/* Revenue Mix */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {sliderConfigs[5].label}
            </label>
            <input
              type="range"
              min={sliderConfigs[5].min}
              max={sliderConfigs[5].max}
              step={sliderConfigs[5].step}
              value={revenueRoomsMix}
              onChange={(e) => setRevenueRoomsMix(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-gray-500">40%</span>
              <span className="text-sm font-semibold text-teal-600">{sliderConfigs[5].format(revenueRoomsMix)}</span>
              <span className="text-xs text-gray-500">80%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Output Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* IRR Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Projected IRR</h3>
            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded">
              {projectedMetrics.irr >= targetIRR ? '✓' : '○'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{(projectedMetrics.irr * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-2">
            Base: {(baseIRR * 100).toFixed(1)}% | Target: {(targetIRR * 100).toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (projectedMetrics.irr / targetIRR) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* NPV Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Projected NPV</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${(projectedMetrics.npv / 1000000).toFixed(0)}M
          </p>
          <p className="text-xs text-gray-500 mt-2">Base: ${(baseNPV / 1000000).toFixed(0)}M</p>
          <div className="mt-2">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                projectedMetrics.npv >= baseNPV ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {projectedMetrics.npv >= baseNPV ? '+' : ''}{((projectedMetrics.npv - baseNPV) / baseNPV * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Equity Multiple Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Equity Multiple</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{projectedMetrics.em.toFixed(2)}x</p>
          <p className="text-xs text-gray-500 mt-2">Base: {baseEM.toFixed(2)}x</p>
          <div className="mt-2">
            <span
              className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                projectedMetrics.em >= baseEM ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {projectedMetrics.em >= baseEM ? '+' : ''}{((projectedMetrics.em - baseEM) / baseEM * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* DSCR Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Projected DSCR</h3>
            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded">
              {projectedMetrics.dscr >= targetDSCR ? '✓' : '○'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{projectedMetrics.dscr.toFixed(2)}x</p>
          <p className="text-xs text-gray-500 mt-2">
            Base: {baseDSCR.toFixed(2)}x | Target: {targetDSCR.toFixed(2)}x
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (projectedMetrics.dscr / targetDSCR) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Verdict Card */}
        <div
          className={`rounded-lg border p-4 shadow-sm ${verdict.bgColor} border-${verdict.borderColor}`}
          style={{
            backgroundColor:
              verdict.text === 'INVEST'
                ? '#f0fdf4'
                : verdict.text === 'HOLD'
                  ? '#fffbf0'
                  : verdict.text === 'DE-RISK'
                    ? '#fff7ed'
                    : '#fef2f2',
            borderColor:
              verdict.text === 'INVEST'
                ? '#dcfce7'
                : verdict.text === 'HOLD'
                  ? '#fed7aa'
                  : verdict.text === 'DE-RISK'
                    ? '#fddcbb'
                    : '#fecaca',
          }}
        >
          <h3 className="text-sm font-medium text-gray-600 mb-2">Verdict</h3>
          <p className={`text-2xl font-bold ${verdict.color}`}>{verdict.text}</p>
          <p className="text-xs text-gray-500 mt-2">
            IRR: {projectedMetrics.irr >= targetIRR ? '✓' : '✗'} | DSCR: {projectedMetrics.dscr >= targetDSCR ? '✓' : '✗'}
          </p>
        </div>
      </div>

      {/* Sensitivity Table - Tornado Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-teal-500 rounded"></span>
          Tornado Analysis (±10% Variation)
        </h2>

        <div className="space-y-4">
          {sensitivityData.map((item, idx) => {
            const upsidePercent = item.upside * 100;
            const downsidePercent = item.downside * 100;
            const maxPercent = Math.max(Math.abs(upsidePercent), Math.abs(downsidePercent));

            return (
              <div key={idx}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  <span className="text-xs font-semibold text-gray-600">
                    {item.downside > 0 ? '+' : ''}{(item.downside * 100).toFixed(1)}% to {item.upside > 0 ? '+' : ''}
                    {(item.upside * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Downside bar (red) */}
                  <div className="flex-1 flex justify-end">
                    <div
                      className="bg-red-500 rounded-r h-6 transition-all"
                      style={{
                        width: `${Math.abs(downsidePercent > 0 ? 0 : downsidePercent) / maxPercent * 100}%`,
                        maxWidth: '100%',
                      }}
                    ></div>
                  </div>

                  {/* Center label */}
                  <div className="w-12 text-center text-xs font-semibold text-gray-600">
                    {(item.impact * 100).toFixed(1)}%
                  </div>

                  {/* Upside bar (green) */}
                  <div className="flex-1 flex justify-start">
                    <div
                      className="bg-green-500 rounded-l h-6 transition-all"
                      style={{
                        width: `${Math.max(0, upsidePercent) / maxPercent * 100}%`,
                        maxWidth: '100%',
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-Way Sensitivity Matrix */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <span className="inline-block w-1 h-6 bg-teal-500 rounded"></span>
          Two-Way Sensitivity Matrix
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* X-Axis Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis Parameter</label>
            <select
              value={sensitivityXAxis}
              onChange={(e) => setSensitivityXAxis(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {sliderConfigs.slice(0, 5).map((config) => (
                <option key={config.key} value={config.key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Y-Axis Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis Parameter</label>
            <select
              value={sensitivityYAxis}
              onChange={(e) => setSensitivityYAxis(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {sliderConfigs.slice(0, 5).map((config) => (
                <option key={config.key} value={config.key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {twoWayMatrix && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-center py-2 px-2 font-semibold text-gray-700">
                    {twoWayMatrix.yLabel}
                  </th>
                  {twoWayMatrix.xValues.map((val, idx) => (
                    <th key={idx} className="text-center py-2 px-2 font-semibold text-gray-700 text-xs">
                      {twoWayMatrix.xFormat(val)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {twoWayMatrix.yValues.map((yVal, yIdx) => (
                  <tr key={yIdx}>
                    <td className="py-2 px-2 font-semibold text-gray-700 text-xs whitespace-nowrap">
                      {twoWayMatrix.yFormat(yVal)}
                    </td>
                    {twoWayMatrix.matrix[yIdx].map((cellValue, xIdx) => {
                      const bgColor = getHeatmapColor(cellValue, twoWayMatrix.minIRR, twoWayMatrix.maxIRR);
                      const textColor = cellValue > (twoWayMatrix.minIRR + twoWayMatrix.maxIRR) / 2 ? 'white' : 'gray-900';
                      return (
                        <td
                          key={xIdx}
                          className="py-2 px-2 text-center font-semibold text-xs whitespace-nowrap"
                          style={{
                            backgroundColor: bgColor,
                            color: textColor === 'white' ? 'white' : '#111827',
                          }}
                        >
                          {(cellValue * 100).toFixed(1)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(239, 68, 68)' }}></div>
                <span className="text-gray-600">Low IRR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(251, 191, 36)' }}></div>
                <span className="text-gray-600">Medium IRR</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(34, 197, 94)' }}></div>
                <span className="text-gray-600">High IRR</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Key Drivers (Impact Ranked)</h4>
            <ul className="space-y-2">
              {sensitivityData.slice(0, 3).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="font-semibold text-teal-600">{idx + 1}.</span>
                  <span>
                    <strong>{item.name}</strong> – {(item.impact * 100).toFixed(1)}% impact on IRR
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Current vs. Base Case</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex justify-between">
                <span>IRR Change:</span>
                <span className="font-semibold text-teal-600">
                  {((projectedMetrics.irr - baseIRR) / baseIRR * 100).toFixed(1)}%
                </span>
              </li>
              <li className="flex justify-between">
                <span>Equity Multiple Change:</span>
                <span className="font-semibold text-teal-600">
                  {((projectedMetrics.em - baseEM) / baseEM * 100).toFixed(1)}%
                </span>
              </li>
              <li className="flex justify-between">
                <span>DSCR vs. Target:</span>
                <span
                  className={`font-semibold ${
                    projectedMetrics.dscr >= targetDSCR ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {projectedMetrics.dscr >= targetDSCR ? '+' : ''}
                  {(projectedMetrics.dscr - targetDSCR).toFixed(2)}x
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
