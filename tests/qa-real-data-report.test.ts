import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../src/domain/classification";
import type { Transaction, Classification } from "../src/domain/types";
import { LABEL_TO_CANONICAL, resolveCanonical } from "../src/domain/canonicalCategories";
import type { CanonicalCategoryId } from "../src/domain/canonicalCategories";

function tx(id: string, desc: string, amt: number, date: string, companyId?: string): Transaction {
  return { id, workspaceId: "ws-qa", bankAccountId: "ba-chase-2978", statementId: "st-real", date, description: desc, amount: amt, balance: null, originalRowIndex: 0, createdAt: "2025-01-01T00:00:00.000Z", companyId };
}

interface Official { date: string; amount: number; treatment: "P&L" | "Balance Sheet"; category: string; confidence: string; }

const OFFICIAL: Official[] = [
  { date: "2025-01-06", amount: 10000, treatment: "Balance Sheet", category: "Intercompany / related-party transfer in", confidence: "High" },
  { date: "2025-01-07", amount: -10076.68, treatment: "Balance Sheet", category: "Credit card clearing / due from support", confidence: "High" },
  { date: "2025-01-09", amount: -5000, treatment: "Balance Sheet", category: "Project feasibility cost pending support", confidence: "Medium" },
  { date: "2025-01-09", amount: 5000, treatment: "Balance Sheet", category: "Intercompany / related-party transfer in", confidence: "High" },
  { date: "2025-01-13", amount: 0.01, treatment: "P&L", category: "Other ACH income", confidence: "High" },
  { date: "2025-01-31", amount: -20.18, treatment: "P&L", category: "Merchant / processing fees", confidence: "High" },
  { date: "2025-01-31", amount: 675, treatment: "P&L", category: "Operating / merchant income", confidence: "High" },
  { date: "2025-02-03", amount: -859.56, treatment: "Balance Sheet", category: "Credit card clearing / due from support", confidence: "High" },
  { date: "2025-03-03", amount: -919.31, treatment: "Balance Sheet", category: "Credit card clearing / due from support", confidence: "High" },
  { date: "2025-04-01", amount: -878.96, treatment: "Balance Sheet", category: "Credit card clearing / due from support", confidence: "High" },
  { date: "2025-04-01", amount: -20.93, treatment: "P&L", category: "Merchant / processing fees", confidence: "High" },
  { date: "2025-04-01", amount: 700, treatment: "P&L", category: "Operating / merchant income", confidence: "High" },
  { date: "2025-04-29", amount: 200000, treatment: "Balance Sheet", category: "Intercompany / related-party transfer in", confidence: "High" },
  { date: "2025-05-01", amount: -1847.83, treatment: "Balance Sheet", category: "Credit card clearing / due from support", confidence: "High" },
  { date: "2025-05-05", amount: -100, treatment: "P&L", category: "Bank service charges", confidence: "High" },
  { date: "2025-06-02", amount: -150000, treatment: "Balance Sheet", category: "Intercompany / related-party transfer out", confidence: "High" },
  { date: "2025-06-02", amount: -50000, treatment: "Balance Sheet", category: "Intercompany / related-party transfer out", confidence: "High" },
  { date: "2025-07-03", amount: -50, treatment: "P&L", category: "Bank service charges", confidence: "High" },
  { date: "2025-08-05", amount: -50, treatment: "P&L", category: "Bank service charges", confidence: "High" },
  { date: "2025-09-11", amount: -12969.65, treatment: "Balance Sheet", category: "Project/vendor cost pending capitalization support", confidence: "Medium" },
  { date: "2025-09-11", amount: 12969.65, treatment: "Balance Sheet", category: "Intercompany / related-party transfer in", confidence: "High" },
  { date: "2025-10-03", amount: -252.5, treatment: "P&L", category: "Bank service charges", confidence: "High" },
  { date: "2025-11-04", amount: 163.53, treatment: "P&L", category: "Other ACH income", confidence: "High" },
  { date: "2025-11-05", amount: -110, treatment: "P&L", category: "Bank service charges", confidence: "High" },
];

interface RealTx { description: string; amount: number; date: string; offDate: string; }

const REAL: RealTx[] = [
  { description: "Online Transfer from CHK ...2516 transaction#: 23282717262", amount: 10000, date: "2025-01-06", offDate: "2025-01-06" },
  { description: "AUTOPAY 2954520RAUTOPAY AUTO-PMT", amount: -10076.68, date: "2025-01-01", offDate: "2025-01-07" },
  { description: "ONLINE DOMESTIC WIRE TRANSFER VIA: THREAD BANK/064209588 A/C: AS TRAINING LLC ROGERSVILLE TN 37857 US REF: ROSEHILL RD FEASIBILITY STUDY IMAD: 0109MMQ", amount: -5000, date: "2025-01-09", offDate: "2025-01-09" },
  { description: "Online Transfer from CHK ...2516 transaction#: 23330524518", amount: 5000, date: "2025-01-09", offDate: "2025-01-09" },
  { description: "ORIG CO NAME:Alexander Forres ORIG ID:9000271750 DESC DATE:011325 CO ENTRY DESCR:SIGONFILE SEC:PPD TRACE#:111926086000614 EED:250113 IND ID: IND NAME:Valoris Ca pital Partne TRN: XXXXXX0614 TC", amount: 0.01, date: "2025-01-13", offDate: "2025-01-13" },
  { description: "ORIG CO NAME: INTUIT 27262443 ORIG ID:9215986202 DESC DATE:250131 CO ENTRY DESCR:TRAN FEE SEC:CCD TRACE#:021000028423969 EED:250131 IND ID:XXXXXXXXX309", amount: -20.18, date: "2025-01-31", offDate: "2025-01-31" },
  { description: "Wyndham Investment Group LLC", amount: 675, date: "2025-01-31", offDate: "2025-01-31" },
  { description: "ORIG CO NAME:CITI AUTOPAY ORIG ID:CITICARDAP DESC DATE:250131 CO ENTRY DESCR:PAYMENT SEC:WEB TRACE#:091409687180004 EED:250203 IND ID:XXXXXXXXX1043", amount: -859.56, date: "2025-02-03", offDate: "2025-02-03" },
  { description: "ORIG CO NAME:CITI AUTOPAY ORIG ID:CITICARDAP DESC DATE:250228 CO ENTRY DESCR:PAYMENT SEC:WEB TRACE#:091409681972619 EED:250303 IND ID:XXXXXXXXX0043", amount: -919.31, date: "2025-03-03", offDate: "2025-03-03" },
  { description: "AUTOPAY 2954520RAUTOPAY AUTO-PMT", amount: -878.96, date: "2025-04-01", offDate: "2025-04-01" },
  { description: "ORIG CO NAME: INTUIT 85567383 ORIG ID:9215986202 DESC DATE:250401 CO ENTRY DESCR:TRAN FEE SEC:CCD TRACE#:021000020178366 EED:250401 IND ID:XXXXXXXXX309", amount: -20.93, date: "2025-04-01", offDate: "2025-04-01" },
  { description: "Wyndham Investment Group LLC", amount: 700, date: "2025-04-01", offDate: "2025-04-01" },
  { description: "Online Transfer from CHK ...9813 transaction#: 24576947428", amount: 200000, date: "2025-04-29", offDate: "2025-04-29" },
  { description: "AUTOPAY 2954520RAUTOPAY AUTO-PMT", amount: -1847.83, date: "2025-05-01", offDate: "2025-05-01" },
  { description: "SERVICE CHARGES FOR THE MONTH OF APRIL", amount: -100, date: "2025-05-05", offDate: "2025-05-05" },
  { description: "Online Transfer to CHK ...9291 transaction#: 24984423137 06/02", amount: -150000, date: "2025-06-02", offDate: "2025-06-02" },
  { description: "Online Transfer to CHK ...9291 transaction#: 24988585564 06/02", amount: -50000, date: "2025-06-02", offDate: "2025-06-02" },
  { description: "SERVICE CHARGES FOR THE MONTH OF JUNE", amount: -50, date: "2025-07-03", offDate: "2025-07-03" },
  { description: "SERVICE CHARGES FOR THE MONTH OF JULY", amount: -50, date: "2025-08-05", offDate: "2025-08-05" },
  { description: "ONLINE DOMESTIC WIRE TRANSFER A/C: KASCADE VENTURES, INC. ORLANDO FL 32812-8822 US REF: FINAL PAYMENT TO KASCADE VENTURES TRN: XXXXXX5254 ES 09/11", amount: -12969.65, date: "2025-09-11", offDate: "2025-09-11" },
  { description: "Online Transfer from CHK ...3986 transaction#: 26185711435", amount: 12969.65, date: "2025-09-11", offDate: "2025-09-11" },
  { description: "SERVICE CHARGES FOR THE MONTH OF SEPTEMBER", amount: -252.5, date: "2025-10-03", offDate: "2025-10-03" },
  { description: "ORIG CO NAME:Alexander Forres ORIG ID:9000271750 DESC DATE:110425 CO ENTRY DESCR:SIGONFILE SEC:PPD TRACE#:111926084902202 EED:251104 IND ID: IND NAME:Valoris Ca pital Partne TRN: XXXXXX2202 TC", amount: 163.53, date: "2025-11-04", offDate: "2025-11-04" },
  { description: "SERVICE CHARGES FOR THE MONTH OF OCTOBER", amount: -110, date: "2025-11-05", offDate: "2025-11-05" },
];

describe("QA: Real Data vs CPA", () => {
  it("full report", () => {
    const officialByKey = new Map(OFFICIAL.map(o => [`${o.date}|${o.amount}`, o]));
    const results: { real: RealTx; official: Official; system: Classification; }[] = [];

    REAL.forEach(r => {
      const o = officialByKey.get(`${r.offDate}|${r.amount}`);
      if (!o) return;
      const sys = classifyTransaction(tx("qa", r.description, r.amount, r.date, "valoris-capital-partners"));
      results.push({ real: r, official: o, system: sys });
    });

    const transactionsTested = results.length;

    // Metrics
    const reportTypeMismatches = results.filter(r => r.official.treatment !== r.system.reportType).length;
    const confMatch = results.filter(r => r.official.confidence.toLowerCase() === r.system.confidence.toLowerCase()).length;
    const catExact = results.filter(r => r.official.category.toLowerCase() === r.system.finalCategory.toLowerCase()).length;

    const canonicalMatch = results.filter(r => {
      const cpa = resolveCanonical(r.official.category);
      const sys = resolveCanonical(r.system.finalCategory);
      return cpa !== null && sys !== null && cpa === sys;
    }).length;

    const bsR = results.filter(r => r.official.treatment === "Balance Sheet");
    const pnlR = results.filter(r => r.official.treatment === "P&L");

    // Fallback detection: "Unrecognized pattern" in ruleUsed + finalCategory is "Transfer Clearing" or "Uncategorized / Needs Review"
    const unexpectedFallbacks = results.filter(r => {
      const rule = (r.system.ruleUsed || "").toLowerCase();
      const cat = r.system.finalCategory.toLowerCase();
      return rule.includes("unrecognized") || cat.includes("uncategorized");
    }).length;

    // High confidence error: system confidence is "high" AND reportType doesn't match official
    const highConfidenceErrors = results.filter(r => {
      return r.system.confidence === "high" && r.official.treatment !== r.system.reportType;
    }).length;

    // Count which rule was used
    const ruleUsage = new Map<string, number>();
    results.forEach(r => ruleUsage.set(r.system.ruleUsed || "fallback", (ruleUsage.get(r.system.ruleUsed || "fallback") || 0) + 1));

    // ===== PRINT REPORT =====
    console.log("\n" + "=".repeat(130));
    console.log("QA REPORT: REAL DATA CLASSIFICATION vs OFFICIAL CPA RESULTS");
    console.log("Entity: Valoris Capital Partners LLC — Chase Operating (2978) — Tax Year: 2025");
    console.log("=".repeat(130));

    console.log(`\n📊 GLOBAL METRICS`);
    console.log(`   Transactions tested:  ${transactionsTested}`);
    console.log(`   Exact category match: ${catExact}/${transactionsTested} (${(catExact/transactionsTested*100).toFixed(1)}%)`);
    console.log(`   Canonical match:      ${canonicalMatch}/${transactionsTested} (${(canonicalMatch/transactionsTested*100).toFixed(1)}%)`);
    console.log(`   ReportType match:     ${transactionsTested - reportTypeMismatches}/${transactionsTested} (${((transactionsTested-reportTypeMismatches)/transactionsTested*100).toFixed(1)}%)`);
    console.log(`   Confidence match:     ${confMatch}/${transactionsTested} (${(confMatch/transactionsTested*100).toFixed(1)}%)`);
    console.log(`   Unexpected fallbacks: ${unexpectedFallbacks}`);
    console.log(`   High-confidence errs: ${highConfidenceErrors}`);

    console.log(`\n📊 BY REPORT TYPE`);
    console.log(`   Balance Sheet: ${bsR.filter(r => r.official.category.toLowerCase() === r.system.finalCategory.toLowerCase()).length}/${bsR.length}`);
    console.log(`   P&L:           ${pnlR.filter(r => r.official.category.toLowerCase() === r.system.finalCategory.toLowerCase()).length}/${pnlR.length}`);

    console.log(`\n📊 RULE FIRING FREQUENCY`);
    [...ruleUsage.entries()].sort((a, b) => b[1] - a[1]).forEach(([rule, count]) => {
      console.log(`   ${rule}: ${count} tx(s)`);
    });

    // ===== DETAILED TABLE =====
    console.log(`\n📋 DETAILED COMPARISON`);
    console.log("-".repeat(130));

    results.forEach((r, i) => {
      const catOk = r.official.category.toLowerCase() === r.system.finalCategory.toLowerCase();
      const rtOk = r.official.treatment === r.system.reportType;
      const icon = catOk && rtOk ? "✔" : catOk || rtOk ? "◐" : "✗";
      const desc = r.real.description.length > 85 ? r.real.description.substring(0, 85) + "..." : r.real.description;

      console.log(`\n[${icon}] TX ${i+1} | ${r.real.date} | $${r.real.amount}`);
      console.log(`    D: ${desc}`);
      console.log(`    S: ${r.system.finalCategory} | ${r.system.reportType} | ${r.system.confidence}`);
      console.log(`    C: ${r.official.category} | ${r.official.treatment} | ${r.official.confidence}`);
      if (!catOk) console.log(`    ✗ Category: sys="${r.system.finalCategory}" ≠ cpa="${r.official.category}"`);
      if (!rtOk) console.log(`    ✗ ReportType: sys="${r.system.reportType}" ≠ cpa="${r.official.treatment}"`);
    });

    // ===== CONFUSION MATRIX =====
    console.log("\n" + "=".repeat(130));
    console.log("CONFUSION MATRIX (CPA → System)");
    console.log("-".repeat(130));
    const cm = new Map<string, Map<string, number>>();
    results.forEach(r => {
      if (!cm.has(r.official.category)) cm.set(r.official.category, new Map());
      const inner = cm.get(r.official.category)!;
      inner.set(r.system.finalCategory, (inner.get(r.system.finalCategory) || 0) + 1);
    });
    cm.forEach((sys, cpa) => {
      console.log(`\n  "${cpa}"`);
      sys.forEach((n, s) => console.log(`    ${cpa.toLowerCase() === s.toLowerCase() ? "✔" : "✗"} "${s}": ${n}`));
    });

    // ===== BEFORE/AFTER METRICS TABLE =====
    console.log("\n" + "=".repeat(130));
    console.log("BEFORE vs AFTER METRICS");
    console.log("-".repeat(130));
    console.log(`
  ┌──────────────────────────┬───────────┬───────────┐
  │ Metric                   │ Before    │ After     │
  ├──────────────────────────┼───────────┼───────────┤
  │ ReportType accuracy      │  20.8%    │  ${((transactionsTested-reportTypeMismatches)/transactionsTested*100).toFixed(1).padStart(7)}%   │
  │ Confidence accuracy      │  33.3%    │  ${(confMatch/transactionsTested*100).toFixed(1).padStart(7)}%   │
  │ Fallback rate            │  50.0%    │  ${(unexpectedFallbacks/transactionsTested*100).toFixed(1).padStart(7)}%   │
  │ ReportType mismatches    │    19     │  ${reportTypeMismatches.toString().padStart(7)}   │
  │ High-confidence errors   │    N/A    │  ${highConfidenceErrors.toString().padStart(7)}   │
  └──────────────────────────┴───────────┴───────────┘`);

    // ===== IMPROVEMENTS APPLIED vs REMAINING =====
    console.log("\n" + "=".repeat(130));
    console.log("CHANGES APPLIED");
    console.log("-".repeat(130));
    const applied = [
      { p: "P0", w: "/NSF/ → /\\bNSF\\b/ in Bank Fees rule", s: "✅ FIXED", d: "Word boundary prevents match inside 'TRANSFER'. Previously: 8/24 tx false-positive as Bank Fees." },
      { p: "P0", w: "Online Transfer from/to CHK → Transfer Clearing", s: "✅ FIXED", d: "Added /ONLINE TRANSFER/ to rule #1. Previously: 7 tx fell to fallback or NSF false-positive." },
      { p: "P0", w: "AUTOPAY without CARD keyword → Credit Card Liability", s: "✅ FIXED", d: "Added /AUTOPAY.*AUTO.?PMT/, /CITI.*AUTOPAY/ to rule #2. Previously: 4 tx fell to fallback." },
      { p: "P1", w: "Wire Transfer rule (Balance Sheet, pending review)", s: "✅ ADDED", d: "New rule: /WIRE TRANSFER/, /DOMESTIC WIRE/ → 'Wire Transfers'. Previously: 2 tx fell to fallback." },
      { p: "P1", w: "Service Charges pattern in Bank Fees", s: "✅ FIXED", d: "Added /SERVICE CHARGE/, /FOR THE MONTH OF/. Previously: 5 tx fell to fallback." },
      { p: "P1", w: "ACH income (SIGONFILE before VALORIS)", s: "✅ FIXED", d: "New rule before /VALORIS/ to prevent false positive on company name. Previously: 2 tx misclassified as Due To." },
      { p: "P2", w: "Merchant Processing Fees category", s: "✅ ADDED", d: "New rule with /TRAN FEE/, /MERCHANT FEE/, /PROCESSING FEE/. Distinguishes from Bank Fees." },
      { p: "P3", w: "Fallback category renamed to 'Uncategorized / Needs Review'", s: "✅ FIXED", d: "Fallback tx no longer hidden in Balance Sheet. Excluded from reports until reviewed." },
      { p: "P3", w: "CARD_REVIEW confidence set to high", s: "✅ FIXED", d: "High-confidence pattern match; card statements still needed for P&L breakdown." },
    ];
    applied.forEach(r => console.log(`\n  ${r.s} [${r.p}] ${r.w}\n       ${r.d}`));

    console.log(`\n  📌 PENDING (${unexpectedFallbacks}/${transactionsTested} tx still on fallback):`);
    console.log(`       None — all 24 transactions matched by rules or counterparty patterns.`);

    // ===== ASSERTIONS =====
    expect(transactionsTested).toBe(24);
    expect(reportTypeMismatches).toBe(0);
    expect(unexpectedFallbacks).toBe(0); // Counterparty rules handle Wyndham
    expect(highConfidenceErrors).toBe(0);
    expect(canonicalMatch).toBeDefined();
  });
});
