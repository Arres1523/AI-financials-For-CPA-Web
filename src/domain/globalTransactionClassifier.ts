import type { Classification, ReportType } from "./types";

const GLOBAL_CATEGORY_MAP: Record<string, { finalCategory: string; reportType: ReportType }> = {
  "utilities & services": { finalCategory: "Utilities", reportType: "P&L" },
  utilities: { finalCategory: "Utilities", reportType: "P&L" },
  income: { finalCategory: "Other Income", reportType: "P&L" },
  "bank fees": { finalCategory: "Bank Fees", reportType: "P&L" },
  fees: { finalCategory: "Bank Fees", reportType: "P&L" },
  insurance: { finalCategory: "Insurance", reportType: "P&L" },
};

export function mapGlobalCategoryToClassification(
  category: string,
  confidence: number,
  transactionId: string
): Classification | null {
  if (confidence < 0.7) return null;

  const mapped = GLOBAL_CATEGORY_MAP[category.trim().toLowerCase()];
  if (!mapped) return null;

  const now = new Date().toISOString();
  return {
    id: `global-${transactionId}`,
    transactionId,
    finalCategory: mapped.finalCategory,
    reportType: mapped.reportType,
    confidence: confidence >= 0.9 ? "medium" : "low",
    ruleUsed: `Global classifier — ${category}`,
    reviewStatus: "pending",
    isManualCorrection: false,
    createdAt: now,
    updatedAt: now,
  };
}

type HuggingFaceCandidate = {
  label?: string;
  score?: number;
};

export function readTopHuggingFaceCandidate(payload: unknown): { category: string; confidence: number } | null {
  const candidates = Array.isArray(payload) && Array.isArray(payload[0])
    ? payload[0]
    : Array.isArray(payload)
      ? payload
      : [];

  const top = candidates
    .filter((item): item is HuggingFaceCandidate => !!item && typeof item === "object")
    .filter((item) => typeof item.label === "string" && typeof item.score === "number")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  if (!top?.label || typeof top.score !== "number") return null;
  return { category: top.label, confidence: top.score };
}

export async function classifyWithGlobalFinancialModel(text: string): Promise<{
  category: string;
  confidence: number;
} | null> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const modelUrl = process.env.GLOBAL_TRANSACTION_CLASSIFIER_URL
    || "https://api-inference.huggingface.co/models/mitulshah/global-financial-transaction-classifier";

  if (!token) return null;

  try {
    const res = await fetch(modelUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!res.ok) return null;
    return readTopHuggingFaceCandidate(await res.json());
  } catch {
    return null;
  }
}
