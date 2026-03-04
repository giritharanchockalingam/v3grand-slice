// ─── Investment Committee Memo PDF Generator ────────────────────────
// Produces a board-ready IC Memo PDF from DealEvaluationInput + Output.
// Uses pdf-lib (MIT) for pure JS/TS PDF generation — no native deps.

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import type {
  DealEvaluationInput, DealEvaluationOutput, EvaluationVerdict,
  CapitalStructureOption, OperatingModelOption,
  ICScorecard,
} from '@v3grand/core';

// ── Constants ──
const PAGE_W = 595.28;   // A4 points
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Colors
const CLR = {
  brand:     rgb(0.11, 0.27, 0.53),   // deep navy
  brandLt:   rgb(0.85, 0.89, 0.95),   // light blue bg
  accent:    rgb(0.13, 0.59, 0.33),   // green
  accentLt:  rgb(0.88, 0.95, 0.90),
  warning:   rgb(0.85, 0.55, 0.08),
  danger:    rgb(0.78, 0.15, 0.15),
  text:      rgb(0.15, 0.15, 0.15),
  textLight: rgb(0.45, 0.45, 0.45),
  border:    rgb(0.80, 0.80, 0.80),
  white:     rgb(1, 1, 1),
  grey:      rgb(0.94, 0.94, 0.94),
};

// ── Formatting helpers ──
function pct(v: number): string { return `${(v * 100).toFixed(1)}%`; }
function crore(v: number): string {
  const cr = v / 1e7;
  return cr >= 0 ? `INR ${cr.toFixed(1)} Cr` : `(INR ${Math.abs(cr).toFixed(1)} Cr)`;
}
function bps(v: number): number { return Math.round(v * 10000); }

function verdictColor(v: EvaluationVerdict) {
  switch (v) {
    case 'APPROVE': return CLR.accent;
    case 'CONDITIONAL': return CLR.warning;
    case 'DEFER': return rgb(0.70, 0.40, 0.10);
    case 'REJECT': return CLR.danger;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════

export async function generateICMemoPDF(
  input: DealEvaluationInput,
  output: DealEvaluationOutput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`IC Memo — ${input.dealName}`);
  doc.setAuthor('V3 Grand Investment Portal');
  doc.setSubject(`Investment Committee Memorandum for ${input.dealName}`);
  doc.setCreationDate(new Date());

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const courier = await doc.embedFont(StandardFonts.Courier);

  const fonts = { regular: helvetica, bold: helveticaBold, mono: courier };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Helper: ensure space, add page if needed
  function ensureSpace(needed: number): PDFPage {
    if (y - needed < MARGIN + 30) {
      drawFooter(page, fonts, doc.getPageCount());
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    return page;
  }

  // ── Page 1: Cover & Executive Summary ──
  y = drawCover(page, fonts, input, output, y);
  y = drawExecutiveSummary(page, fonts, input, output, y, ensureSpace);
  drawFooter(page, fonts, 1);

  // ── Page 2+: Key Metrics ──
  page = doc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
  y = drawSectionHeader(page, fonts, 'KEY INVESTMENT METRICS', y);
  y = drawMetricsTable(page, fonts, input, output, y);
  y -= 20;
  page = ensureSpace(180);
  y = drawSectionHeader(page, fonts, 'WACC & HURDLE RATE', y);
  y = drawWACCSection(page, fonts, output, y);
  drawFooter(page, fonts, doc.getPageCount());

  // ── Scenario Analysis ──
  page = doc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
  y = drawSectionHeader(page, fonts, 'SCENARIO ANALYSIS', y);
  y = drawScenarioTable(page, fonts, output, y);
  y -= 15;
  page = ensureSpace(80);
  y = drawProbabilityWeighted(page, fonts, output, y);
  drawFooter(page, fonts, doc.getPageCount());

  // ── Capital Structure Comparison ──
  page = doc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
  y = drawSectionHeader(page, fonts, 'CAPITAL STRUCTURE COMPARISON', y);
  y = drawCapitalTable(page, fonts, output.capitalStructureComparison, y);
  y -= 20;

  // ── Operating Model Comparison ──
  page = ensureSpace(200);
  y = drawSectionHeader(page, fonts, 'OPERATING MODEL COMPARISON', y);
  y = drawOperatingModelTable(page, fonts, output.operatingModelComparison, y);
  drawFooter(page, fonts, doc.getPageCount());

  // ── Risk Assessment ──
  page = doc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
  y = drawSectionHeader(page, fonts, 'RISK ASSESSMENT', y);
  y = drawRiskSection(page, fonts, output, y);
  drawFooter(page, fonts, doc.getPageCount());

  // ── IC Scorecard ──
  page = doc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
  y = drawSectionHeader(page, fonts, 'INVESTMENT COMMITTEE SCORECARD', y);
  y = drawICScorecard(page, fonts, output.icScorecard, y);
  y -= 20;

  // ── Decision & Recommendation ──
  page = ensureSpace(200);
  y = drawSectionHeader(page, fonts, 'RECOMMENDATION', y);
  y = drawDecisionSection(page, fonts, output, y);
  drawFooter(page, fonts, doc.getPageCount());

  return doc.save();
}

// ═══════════════════════════════════════════════════════════════════════
// DRAWING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function drawCover(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  input: DealEvaluationInput, output: DealEvaluationOutput, y: number,
): number {
  // Brand bar at top
  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: CLR.brand });

  // Title block
  y -= 30;
  page.drawRectangle({ x: MARGIN, y: y - 65, width: CONTENT_W, height: 65, color: CLR.brand });
  page.drawText('INVESTMENT COMMITTEE MEMORANDUM', {
    x: MARGIN + 15, y: y - 25, size: 16, font: fonts.bold, color: CLR.white,
  });
  page.drawText(input.dealName.toUpperCase(), {
    x: MARGIN + 15, y: y - 50, size: 20, font: fonts.bold, color: CLR.white,
  });
  y -= 80;

  // Meta info
  y -= 5;
  const meta = [
    ['Location', `${input.location.city}, ${input.location.state}, ${input.location.country}`],
    ['Asset Class', input.assetClass.charAt(0).toUpperCase() + input.assetClass.slice(1)],
    ['Total Project Cost', crore(input.totalProjectCost)],
    ['Capital Structure', `${pct(input.equityPct)} Equity / ${pct(input.debtPct)} Debt`],
    ['Date', new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })],
  ];

  for (const [label, val] of meta) {
    y -= 16;
    page.drawText(`${label}:`, { x: MARGIN, y, size: 9, font: fonts.bold, color: CLR.textLight });
    page.drawText(String(val), { x: MARGIN + 120, y, size: 9, font: fonts.regular, color: CLR.text });
  }

  // Verdict badge
  y -= 35;
  const vColor = verdictColor(output.verdict);
  page.drawRectangle({ x: MARGIN, y: y - 28, width: 200, height: 28, color: vColor, borderColor: vColor, borderWidth: 0 });
  page.drawText(`RECOMMENDATION: ${output.verdict}`, {
    x: MARGIN + 10, y: y - 20, size: 12, font: fonts.bold, color: CLR.white,
  });

  // Confidence
  page.drawText(`Confidence: ${output.confidence}%`, {
    x: MARGIN + 220, y: y - 18, size: 10, font: fonts.regular, color: CLR.text,
  });
  y -= 35;

  return y;
}

function drawExecutiveSummary(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  input: DealEvaluationInput, output: DealEvaluationOutput, y: number,
  ensureSpace: (n: number) => PDFPage,
): number {
  y -= 10;
  page.drawText('EXECUTIVE SUMMARY', { x: MARGIN, y, size: 11, font: fonts.bold, color: CLR.brand });
  y -= 5;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1, color: CLR.brand });
  y -= 15;

  // Narrative
  const narrativeLines = wrapText(output.narrative, fonts.regular, 9, CONTENT_W - 10);
  for (const line of narrativeLines) {
    y -= 13;
    page.drawText(line, { x: MARGIN + 5, y, size: 9, font: fonts.regular, color: CLR.text });
  }
  y -= 10;

  // Key drivers
  page.drawText('Key Investment Drivers:', { x: MARGIN + 5, y, size: 9, font: fonts.bold, color: CLR.text });
  y -= 3;
  for (const driver of output.decisionDrivers.slice(0, 4)) {
    y -= 13;
    page.drawText(`  •  ${truncate(driver, 95)}`, { x: MARGIN + 5, y, size: 8.5, font: fonts.regular, color: CLR.text });
  }

  // Key risks
  y -= 15;
  page.drawText('Key Risks:', { x: MARGIN + 5, y, size: 9, font: fonts.bold, color: CLR.text });
  y -= 3;
  for (const risk of output.decisionRisks.slice(0, 4)) {
    y -= 13;
    page.drawText(`  •  ${truncate(risk, 95)}`, { x: MARGIN + 5, y, size: 8.5, font: fonts.regular, color: CLR.danger });
  }

  return y;
}

function drawSectionHeader(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont }, title: string, y: number): number {
  y -= 5;
  page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_W, height: 22, color: CLR.brand });
  page.drawText(title, { x: MARGIN + 8, y: y - 16, size: 10, font: fonts.bold, color: CLR.white });
  y -= 30;
  return y;
}

function drawMetricsTable(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  input: DealEvaluationInput, output: DealEvaluationOutput, y: number,
): number {
  const rows = [
    ['Metric', 'Value', 'Threshold', 'Status'],
    ['Equity IRR', pct(output.irr), `>${pct(output.wacc.hurdleRate)} hurdle`, output.irr >= output.wacc.hurdleRate ? 'PASS' : 'FAIL'],
    ['NPV', crore(output.npv), '>0', output.npv > 0 ? 'PASS' : 'FAIL'],
    ['Equity Multiple', `${output.equityMultiple.toFixed(2)}x`, '>2.0x', output.equityMultiple >= 2.0 ? 'PASS' : 'MARGINAL'],
    ['Avg DSCR', `${output.avgDSCR.toFixed(2)}x`, '>1.3x', output.avgDSCR >= 1.3 ? 'PASS' : 'FAIL'],
    ['Payback Period', `${output.paybackYears} years`, '<8 years', output.paybackYears <= 8 ? 'PASS' : 'FAIL'],
    ['EBITDA Margin (Stab.)', pct(output.ebitdaMarginStabilized), '>30%', output.ebitdaMarginStabilized >= 0.30 ? 'PASS' : 'MARGINAL'],
    ['Exit Value', crore(output.exitValue), '—', '—'],
    ['WACC', pct(output.wacc.wacc), '—', '—'],
    ['Hurdle Rate', pct(output.wacc.hurdleRate), `WACC + ${output.wacc.hurdleSpreadBps}bps`, '—'],
  ];

  const colWidths = [140, 120, 130, 80];
  return drawTable(page, fonts, rows, colWidths, y);
}

function drawWACCSection(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  output: DealEvaluationOutput, y: number,
): number {
  const w = output.wacc;
  const items = [
    `Cost of Equity (Ke) = Rf + Beta x ERP + CRP + SRP = ${pct(w.costOfEquity)}`,
    `After-Tax Cost of Debt (Kd) = ${pct(w.afterTaxCostOfDebt)}`,
    `WACC = We x Ke + Wd x Kd(1-t) = ${pct(w.wacc)}`,
    `Hurdle Rate = WACC + ${w.hurdleSpreadBps}bps = ${pct(w.hurdleRate)}`,
  ];

  page.drawRectangle({ x: MARGIN, y: y - items.length * 16 - 10, width: CONTENT_W, height: items.length * 16 + 10, color: CLR.brandLt });

  for (const item of items) {
    y -= 16;
    page.drawText(item, { x: MARGIN + 10, y, size: 9, font: fonts.regular, color: CLR.text });
  }
  y -= 10;
  return y;
}

function drawScenarioTable(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  output: DealEvaluationOutput, y: number,
): number {
  const s = output.scenarioResults;
  const rows = [
    ['Metric', 'Bear Case', 'Base Case', 'Bull Case'],
    ['Probability', pct(s.bear.probability), pct(s.base.probability), pct(s.bull.probability)],
    ['IRR', pct(s.bear.irr), pct(s.base.irr), pct(s.bull.irr)],
    ['NPV', crore(s.bear.npv), crore(s.base.npv), crore(s.bull.npv)],
    ['Equity Multiple', `${s.bear.equityMultiple.toFixed(2)}x`, `${s.base.equityMultiple.toFixed(2)}x`, `${s.bull.equityMultiple.toFixed(2)}x`],
    ['DSCR', `${s.bear.dscr.toFixed(2)}x`, `${s.base.dscr.toFixed(2)}x`, `${s.bull.dscr.toFixed(2)}x`],
    ['Payback', `${s.bear.paybackYears}y`, `${s.base.paybackYears}y`, `${s.bull.paybackYears}y`],
    ['EBITDA Margin', pct(s.bear.ebitdaMarginStabilized), pct(s.base.ebitdaMarginStabilized), pct(s.bull.ebitdaMarginStabilized)],
    ['Exit Value', crore(s.bear.exitValue), crore(s.base.exitValue), crore(s.bull.exitValue)],
    ['Verdict', s.bear.verdict, s.base.verdict, s.bull.verdict],
  ];
  const colWidths = [120, 115, 115, 115];
  return drawTable(page, fonts, rows, colWidths, y);
}

function drawProbabilityWeighted(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  output: DealEvaluationOutput, y: number,
): number {
  page.drawRectangle({ x: MARGIN, y: y - 45, width: CONTENT_W, height: 45, color: CLR.accentLt });
  y -= 18;
  page.drawText('PROBABILITY-WEIGHTED RETURNS', { x: MARGIN + 10, y, size: 9, font: fonts.bold, color: CLR.accent });
  y -= 16;
  page.drawText(`IRR: ${pct(output.probabilityWeightedIRR)}     NPV: ${crore(output.probabilityWeightedNPV)}`, {
    x: MARGIN + 10, y, size: 10, font: fonts.bold, color: CLR.text,
  });
  y -= 20;
  return y;
}

function drawCapitalTable(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  options: CapitalStructureOption[], y: number,
): number {
  const header = ['Structure', 'D/E Split', 'Rate', 'IRR', 'NPV', 'DSCR', 'Multiple'];
  const rows = [header];
  for (const o of options) {
    rows.push([
      o.label,
      `${pct(o.debtPct)} / ${pct(o.equityPct)}`,
      pct(o.interestRate),
      pct(o.irr),
      crore(o.npv),
      `${o.dscr.toFixed(2)}x`,
      `${o.equityMultiple.toFixed(2)}x`,
    ]);
  }
  const colWidths = [105, 70, 55, 55, 80, 55, 55];
  return drawTable(page, fonts, rows, colWidths, y);
}

function drawOperatingModelTable(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  options: OperatingModelOption[], y: number,
): number {
  const header = ['Model', 'Type', 'Mgmt Fee', 'Brand Fee', 'EBITDA Margin', 'IRR', 'Recommendation'];
  const rows = [header];
  for (const o of options) {
    rows.push([
      o.label.substring(0, 20),
      o.type,
      pct(o.baseMgmtFeePct),
      pct(o.brandFeePct),
      pct(o.ebitdaMargin),
      pct(o.irr),
      o.recommendation.substring(0, 30),
    ]);
  }
  const colWidths = [85, 60, 55, 55, 65, 50, 110];
  return drawTable(page, fonts, rows, colWidths, y);
}

function drawRiskSection(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  output: DealEvaluationOutput, y: number,
): number {
  const rm = output.riskMatrix;

  // Overall risk badge
  const ratingColor = rm.riskRating === 'LOW' ? CLR.accent
    : rm.riskRating === 'MODERATE' ? CLR.warning
    : rm.riskRating === 'HIGH' ? rgb(0.85, 0.40, 0.10)
    : CLR.danger;

  page.drawRectangle({ x: MARGIN, y: y - 30, width: 180, height: 25, color: ratingColor });
  page.drawText(`Overall Risk: ${rm.riskRating}  (Score: ${rm.overallRiskScore.toFixed(0)}/100)`, {
    x: MARGIN + 8, y: y - 22, size: 9, font: fonts.bold, color: CLR.white,
  });
  page.drawText(`Mitigation Impact: ${pct(rm.mitigationImpact)}`, {
    x: MARGIN + 200, y: y - 22, size: 9, font: fonts.regular, color: CLR.text,
  });
  y -= 40;

  // Top risks table
  if (rm.topRisks.length > 0) {
    const header = ['Risk', 'Category', 'L', 'I', 'Score', 'Mitigation'];
    const rows = [header];
    for (const r of rm.topRisks.slice(0, 8)) {
      rows.push([
        truncate(r.name, 25),
        r.category,
        String(r.likelihood),
        String(r.impact),
        String(r.score),
        truncate(r.mitigationStrategy, 30),
      ]);
    }
    const colWidths = [110, 70, 25, 25, 40, 205];
    y = drawTable(page, fonts, rows, colWidths, y);
  }

  return y;
}

function drawICScorecard(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  sc: ICScorecard, y: number,
): number {
  // Overall score
  page.drawRectangle({ x: MARGIN, y: y - 35, width: CONTENT_W, height: 35, color: CLR.brandLt });
  page.drawText(`Overall IC Score: ${sc.overallScore.toFixed(1)} / 10`, {
    x: MARGIN + 10, y: y - 14, size: 13, font: fonts.bold, color: CLR.brand,
  });
  page.drawText(`Recommendation: ${sc.recommendation}`, {
    x: MARGIN + 280, y: y - 14, size: 11, font: fonts.bold, color: verdictColor(sc.recommendation),
  });
  y -= 45;

  // Section scores
  const header = ['Section', 'Score', 'Weight', 'Weighted', 'Summary'];
  const rows = [header];
  for (const sec of sc.sections) {
    rows.push([
      sec.name,
      `${sec.score.toFixed(1)}/10`,
      pct(sec.weight),
      `${(sec.score * sec.weight).toFixed(1)}`,
      truncate(sec.summary, 40),
    ]);
  }
  const colWidths = [100, 50, 50, 55, 220];
  y = drawTable(page, fonts, rows, colWidths, y);

  // Conditions
  if (sc.conditions.length > 0) {
    y -= 12;
    page.drawText('Conditions for Approval:', { x: MARGIN, y, size: 9, font: fonts.bold, color: CLR.warning });
    for (const cond of sc.conditions) {
      y -= 13;
      page.drawText(`  ►  ${truncate(cond, 90)}`, { x: MARGIN + 5, y, size: 8.5, font: fonts.regular, color: CLR.text });
    }
  }

  // Next steps
  if (sc.nextSteps.length > 0) {
    y -= 15;
    page.drawText('Recommended Next Steps:', { x: MARGIN, y, size: 9, font: fonts.bold, color: CLR.brand });
    for (let i = 0; i < sc.nextSteps.length; i++) {
      y -= 13;
      page.drawText(`  ${i + 1}. ${truncate(sc.nextSteps[i], 90)}`, { x: MARGIN + 5, y, size: 8.5, font: fonts.regular, color: CLR.text });
    }
  }

  return y;
}

function drawDecisionSection(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  output: DealEvaluationOutput, y: number,
): number {
  // Verdict box
  const vColor = verdictColor(output.verdict);
  page.drawRectangle({ x: MARGIN, y: y - 60, width: CONTENT_W, height: 60, color: vColor, opacity: 0.08 });
  page.drawRectangle({ x: MARGIN, y: y - 60, width: 4, height: 60, color: vColor });

  page.drawText(`Decision: ${output.verdict}`, {
    x: MARGIN + 15, y: y - 18, size: 14, font: fonts.bold, color: vColor,
  });
  page.drawText(`Confidence: ${output.confidence}%  |  IC Score: ${output.icScorecard.overallScore.toFixed(1)}/10`, {
    x: MARGIN + 15, y: y - 35, size: 10, font: fonts.regular, color: CLR.text,
  });
  page.drawText(`Computed: ${output.computedAt}  |  Duration: ${output.durationMs}ms`, {
    x: MARGIN + 15, y: y - 50, size: 8, font: fonts.regular, color: CLR.textLight,
  });
  y -= 75;

  // Flip conditions
  if (output.flipConditions.length > 0) {
    page.drawText('What Would Change This Decision:', { x: MARGIN, y, size: 9, font: fonts.bold, color: CLR.text });
    for (const flip of output.flipConditions) {
      y -= 13;
      page.drawText(`  •  ${truncate(flip, 95)}`, { x: MARGIN + 5, y, size: 8.5, font: fonts.regular, color: CLR.text });
    }
  }

  // Disclaimer
  y -= 30;
  page.drawRectangle({ x: MARGIN, y: y - 35, width: CONTENT_W, height: 35, color: CLR.grey });
  y -= 12;
  page.drawText('DISCLAIMER: This memo is generated by the V3 Grand Investment Engine for advisory purposes only.', {
    x: MARGIN + 8, y, size: 7, font: fonts.regular, color: CLR.textLight,
  });
  y -= 10;
  page.drawText('It does not constitute investment advice. All figures should be independently verified before any investment decision.', {
    x: MARGIN + 8, y, size: 7, font: fonts.regular, color: CLR.textLight,
  });

  return y;
}

function drawFooter(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont }, pageNum: number): void {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 25, color: CLR.brand });
  page.drawText(`V3 Grand Investment Portal  |  Confidential  |  Page ${pageNum}`, {
    x: MARGIN, y: 8, size: 7, font: fonts.regular, color: CLR.white,
  });
  page.drawText(new Date().toLocaleDateString('en-IN'), {
    x: PAGE_W - MARGIN - 60, y: 8, size: 7, font: fonts.regular, color: CLR.white,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// TABLE RENDERER
// ═══════════════════════════════════════════════════════════════════════

function drawTable(
  page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont; mono: PDFFont },
  rows: string[][], colWidths: number[], y: number,
): number {
  const rowH = 16;
  const headerH = 18;
  const fontSize = 8;
  const headerFontSize = 8;
  const pad = 5;

  // Header row
  let x = MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - headerH, width: CONTENT_W, height: headerH, color: CLR.brand });
  for (let c = 0; c < rows[0].length; c++) {
    page.drawText(truncate(rows[0][c], Math.floor(colWidths[c] / 5)), {
      x: x + pad, y: y - headerH + 5, size: headerFontSize, font: fonts.bold, color: CLR.white,
    });
    x += colWidths[c];
  }
  y -= headerH;

  // Data rows
  for (let r = 1; r < rows.length; r++) {
    const bgColor = r % 2 === 0 ? CLR.grey : CLR.white;
    page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: bgColor });

    x = MARGIN;
    for (let c = 0; c < rows[r].length; c++) {
      let textColor = CLR.text;
      const val = rows[r][c];

      // Color code PASS/FAIL/APPROVE/REJECT etc
      if (val === 'PASS' || val === 'APPROVE') textColor = CLR.accent;
      else if (val === 'FAIL' || val === 'REJECT') textColor = CLR.danger;
      else if (val === 'MARGINAL' || val === 'CONDITIONAL') textColor = CLR.warning;
      else if (val === 'DEFER') textColor = rgb(0.70, 0.40, 0.10);

      page.drawText(truncate(val, Math.floor(colWidths[c] / 4.5)), {
        x: x + pad, y: y - rowH + 4, size: fontSize, font: c === 0 ? fonts.bold : fonts.regular, color: textColor,
      });
      x += colWidths[c];
    }
    y -= rowH;
  }

  // Bottom border
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: 1, color: CLR.border });
  return y;
}

// ═══════════════════════════════════════════════════════════════════════
// TEXT UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 1) + '…';
}
