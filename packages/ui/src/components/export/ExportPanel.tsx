'use client';

import { useState } from 'react';

interface Props {
  dealName: string;
  deal: {
    id: string;
    name: string;
    assetClass: string;
    lifecyclePhase: string;
    currentMonth: number;
  };
  latestProforma?: {
    irr: number;
    npv: number;
    equityMultiple: number;
    paybackYear: number;
    avgDSCR?: number;
    years?: Array<{
      year: number;
      occupancy: number;
      adr: number;
      revpar: number;
      roomRevenue: number;
      totalRevenue: number;
      departmentalProfit: number;
      undistributedExpenses: number;
      gop: number;
      gopMargin: number;
      ebitda: number;
      ebitdaMargin: number;
      debtService: number;
      fcfe: number;
    }>;
  } | null;
  latestRecommendation?: {
    verdict: string;
    confidence: number;
    explanation?: string;
  } | null;
  latestMC?: {
    irrDistribution?: { p10: number; p50: number; p90: number };
    probNpvNegative?: number;
  } | null;
  latestFactor?: {
    compositeScore?: number;
    domainScores?: Record<string, { score: number }>;
    domains?: Record<string, { score: number }>;
  } | null;
}

function generateCSV(years: Array<any>): string {
  const headers = ['Year', 'Occupancy', 'ADR', 'RevPAR', 'Room Revenue', 'Total Revenue', 'GOP', 'GOP Margin', 'EBITDA', 'EBITDA Margin', 'Debt Service', 'FCFE'];
  const rows = years.map(y => [
    y.year, (y.occupancy * 100).toFixed(1) + '%', y.adr?.toFixed(0) ?? '', y.revpar?.toFixed(0) ?? '',
    y.roomRevenue?.toFixed(0) ?? '', y.totalRevenue?.toFixed(0) ?? '',
    y.gop?.toFixed(0) ?? '', ((y.gopMargin ?? 0) * 100).toFixed(1) + '%',
    y.ebitda?.toFixed(0) ?? '', ((y.ebitdaMargin ?? 0) * 100).toFixed(1) + '%',
    y.debtService?.toFixed(0) ?? '', y.fcfe?.toFixed(0) ?? '',
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function generatePrintReport(
  deal: Props['deal'],
  proforma: Props['latestProforma'],
  recommendation: Props['latestRecommendation'],
  mc: Props['latestMC'],
  factor: Props['latestFactor']
): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const cssStyles = `
    <style>
      @media print {
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        .page-break { page-break-after: always; }
        .no-print { display: none; }
      }
      body {
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.6;
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
        color: white;
        padding: 30px;
        border-radius: 8px;
        margin-bottom: 30px;
      }
      .header h1 {
        margin: 0 0 10px 0;
        font-size: 28px;
      }
      .header-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 15px;
        font-size: 14px;
      }
      .header-item {
        display: flex;
        flex-direction: column;
      }
      .header-item-label {
        opacity: 0.9;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .header-item-value {
        font-size: 16px;
        font-weight: bold;
        margin-top: 3px;
      }
      .section {
        margin-bottom: 30px;
      }
      .section-title {
        font-size: 18px;
        font-weight: bold;
        color: #0d9488;
        border-bottom: 2px solid #0d9488;
        padding-bottom: 10px;
        margin-bottom: 15px;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      .metric-card {
        background: #f0f9f8;
        border: 1px solid #ccede9;
        border-radius: 6px;
        padding: 15px;
        border-left: 4px solid #0d9488;
      }
      .metric-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 5px;
      }
      .metric-value {
        font-size: 22px;
        font-weight: bold;
        color: #0d9488;
      }
      .verdict-box {
        background: #f0f9f8;
        border-left: 4px solid #0d9488;
        padding: 15px;
        border-radius: 6px;
        margin: 15px 0;
      }
      .verdict-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .verdict-value {
        font-size: 18px;
        font-weight: bold;
        color: #0d9488;
        margin: 5px 0;
      }
      .verdict-confidence {
        font-size: 14px;
        color: #666;
        margin-top: 8px;
      }
      .explanation {
        font-size: 14px;
        color: #555;
        margin-top: 10px;
        line-height: 1.5;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
      }
      th {
        background: #f0f9f8;
        border: 1px solid #ccede9;
        padding: 12px;
        text-align: left;
        font-weight: bold;
        color: #0d9488;
        font-size: 13px;
      }
      td {
        border: 1px solid #e5e7eb;
        padding: 12px;
        font-size: 13px;
      }
      tr:nth-child(even) {
        background: #fafbfb;
      }
      .footer {
        margin-top: 30px;
        padding-top: 15px;
        border-top: 1px solid #e5e7eb;
        font-size: 12px;
        color: #999;
        text-align: center;
      }
      .domains-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-top: 10px;
      }
      .domain-item {
        background: #f9fafb;
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
      }
      .domain-name {
        color: #555;
        font-weight: 500;
      }
      .domain-score {
        color: #0d9488;
        font-weight: bold;
      }
    </style>
  `;

  const headerSection = `
    <div class="header">
      <h1>${deal.name}</h1>
      <div class="header-info">
        <div class="header-item">
          <span class="header-item-label">Asset Class</span>
          <span class="header-item-value">${deal.assetClass}</span>
        </div>
        <div class="header-item">
          <span class="header-item-label">Lifecycle Phase</span>
          <span class="header-item-value">${deal.lifecyclePhase}</span>
        </div>
        <div class="header-item">
          <span class="header-item-label">Current Month</span>
          <span class="header-item-value">Month ${deal.currentMonth}</span>
        </div>
        <div class="header-item">
          <span class="header-item-label">Report Generated</span>
          <span class="header-item-value">${currentDate}</span>
        </div>
      </div>
    </div>
  `;

  const metricsSection = proforma
    ? `
    <div class="section">
      <div class="section-title">Key Financial Metrics</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Internal Rate of Return</div>
          <div class="metric-value">${formatPercentage(proforma.irr)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Net Present Value</div>
          <div class="metric-value">${formatCurrency(proforma.npv)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Equity Multiple</div>
          <div class="metric-value">${proforma.equityMultiple.toFixed(2)}x</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Payback Year</div>
          <div class="metric-value">${proforma.paybackYear}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Average DSCR</div>
          <div class="metric-value">${(proforma.avgDSCR ?? 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  `
    : '';

  const recommendationSection = recommendation
    ? `
    <div class="section">
      <div class="section-title">Investment Recommendation</div>
      <div class="verdict-box">
        <div class="verdict-label">Recommendation</div>
        <div class="verdict-value">${recommendation.verdict}</div>
        <div class="verdict-confidence">
          Confidence: ${recommendation.confidence}%
        </div>
        ${
          recommendation.explanation
            ? `<div class="explanation">${recommendation.explanation}</div>`
            : ''
        }
      </div>
    </div>
  `
    : '';

  const mcSection = mc && mc.irrDistribution
    ? `
    <div class="section">
      <div class="section-title">Monte Carlo Analysis</div>
      <table>
        <tr>
          <th>Metric</th>
          <th>P10 (Pessimistic)</th>
          <th>P50 (Base Case)</th>
          <th>P90 (Optimistic)</th>
        </tr>
        <tr>
          <td>IRR Distribution</td>
          <td>${formatPercentage(mc.irrDistribution.p10)}</td>
          <td>${formatPercentage(mc.irrDistribution.p50)}</td>
          <td>${formatPercentage(mc.irrDistribution.p90)}</td>
        </tr>
        ${
          mc.probNpvNegative !== undefined
            ? `
          <tr>
            <td>Probability of Negative NPV</td>
            <td colspan="3">${formatPercentage(mc.probNpvNegative)}</td>
          </tr>
        `
            : ''
        }
      </table>
    </div>
  `
    : '';

  const factorSection = factor && factor.compositeScore !== undefined
    ? `
    <div class="section">
      <div class="section-title">Risk & Factor Analysis</div>
      <div class="metric-card" style="margin-bottom: 15px;">
        <div class="metric-label">Composite Score</div>
        <div class="metric-value">${factor.compositeScore.toFixed(2)}</div>
      </div>
      ${
        (factor.domainScores ?? factor.domains)
          ? `
        <div class="domains-grid">
          ${Object.entries(factor.domainScores ?? factor.domains ?? {})
            .map(
              ([name, data]) => `
            <div class="domain-item">
              <span class="domain-name">${name}</span>
              <span class="domain-score">${(data.score * 100).toFixed(0)}%</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }
    </div>
  `
    : '';

  const cashFlowSection = proforma && proforma.years && proforma.years.length > 0
    ? `
    <div class="section">
      <div class="section-title">10-Year Cash Flow Projection</div>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Occupancy</th>
            <th>ADR</th>
            <th>Total Revenue</th>
            <th>GOP</th>
            <th>EBITDA</th>
            <th>Debt Service</th>
            <th>FCFE</th>
          </tr>
        </thead>
        <tbody>
          ${proforma.years
            .map(
              (year: any) => `
            <tr>
              <td>${year.year}</td>
              <td>${((year.occupancy ?? 0) * 100).toFixed(1)}%</td>
              <td>${formatCurrency(year.adr ?? 0)}</td>
              <td>${formatCurrency(year.totalRevenue ?? 0)}</td>
              <td>${formatCurrency(year.gop ?? 0)}</td>
              <td>${formatCurrency(year.ebitda ?? 0)}</td>
              <td>${formatCurrency(year.debtService ?? 0)}</td>
              <td>${formatCurrency(year.fcfe ?? 0)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
    : '';

  const footerSection = `
    <div class="footer">
      <p>This report was generated by the V3 Grand Investment Portal.</p>
      <p>© ${new Date().getFullYear()} V3 Grand. All rights reserved.</p>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${deal.name} - Investment Report</title>
      ${cssStyles}
    </head>
    <body>
      ${headerSection}
      ${metricsSection}
      ${recommendationSection}
      ${mcSection}
      ${factorSection}
      ${cashFlowSection}
      ${footerSection}
    </body>
    </html>
  `;
}

export function ExportPanel({
  dealName,
  deal,
  latestProforma,
  latestRecommendation,
  latestMC,
  latestFactor,
}: Props) {
  const [loadingCSV, setLoadingCSV] = useState(false);
  const [loadingJSON, setLoadingJSON] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const handleExportCSV = async () => {
    setLoadingCSV(true);
    try {
      if (!latestProforma?.years || latestProforma.years.length === 0) {
        alert('No cash flow data available to export.');
        return;
      }

      const csv = generateCSV(latestProforma.years);
      const filename = `${deal.name.replace(/\s+/g, '_')}_CashFlow_${new Date().toISOString().split('T')[0]}.csv`;
      downloadFile(csv, filename, 'text/csv');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setLoadingCSV(false);
    }
  };

  const handleExportJSON = async () => {
    setLoadingJSON(true);
    try {
      const exportData = {
        deal,
        dealName,
        proforma: latestProforma,
        recommendation: latestRecommendation,
        monteCarloAnalysis: latestMC,
        riskFactors: latestFactor,
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(exportData, null, 2);
      const filename = `${deal.name.replace(/\s+/g, '_')}_Dashboard_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(json, filename, 'application/json');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON. Please try again.');
    } finally {
      setLoadingJSON(false);
    }
  };

  const handlePrintReport = () => {
    setLoadingPrint(true);
    try {
      const html = generatePrintReport(
        deal,
        latestProforma,
        latestRecommendation,
        latestMC,
        latestFactor
      );

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Failed to open print window. Please check your browser settings.');
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();

      // Trigger print dialog after content is loaded
      setTimeout(() => {
        printWindow.print();
        setLoadingPrint(false);
      }, 100);
    } catch (error) {
      console.error('Error generating print report:', error);
      alert('Failed to generate print report. Please try again.');
      setLoadingPrint(false);
    }
  };

  return (
    <div className="elevated-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export & Reports
        </h3>
      </div>

      <p className="text-sm text-surface-500">
        Download deal data or generate a comprehensive investment report for {dealName}.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          onClick={handleExportCSV}
          disabled={loadingCSV || !latestProforma?.years || latestProforma.years.length === 0}
          className="btn-primary"
        >
          {loadingCSV ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Export CSV
            </>
          )}
        </button>

        <button
          onClick={handleExportJSON}
          disabled={loadingJSON}
          className="btn-primary"
        >
          {loadingJSON ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M2 12h20" />
              </svg>
              Export JSON
            </>
          )}
        </button>

        <button
          onClick={handlePrintReport}
          disabled={loadingPrint}
          className="btn-primary"
        >
          {loadingPrint ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              </svg>
              Print Report
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-2xs text-surface-400 pt-2 border-t border-surface-100">
        <p><span className="font-semibold text-surface-500">CSV</span> — 10-year cash flow breakdown</p>
        <p><span className="font-semibold text-surface-500">JSON</span> — Full dashboard data export</p>
        <p><span className="font-semibold text-surface-500">Report</span> — Professional print-ready report</p>
      </div>
    </div>
  );
}
