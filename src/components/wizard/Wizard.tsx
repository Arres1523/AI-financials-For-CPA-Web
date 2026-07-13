"use client";
import React from "react";

import { useState, useCallback } from "react";
import type { Company, Workspace, BankAccount, ReconciliationResult } from "@/domain/types";
import StepIndicator from "./StepIndicator";
import CompanyStep from "./CompanyStep";
import BankAccountsStep from "./BankAccountsStep";
import UploadStep from "./UploadStep";
import ReviewStep from "./ReviewStep";
import ReconciliationStep from "./ReconciliationStep";
import ResultsStep from "./ResultsStep";

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

export default function Wizard() {
  const [step, setStep] = useState<StepId>(1);
  const [company, setCompany] = useState<Company | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult[]>([]);

  const steps = [
    { id: 1 as StepId, label: "Company & Year" },
    { id: 2 as StepId, label: "Bank Accounts" },
    { id: 3 as StepId, label: "Upload Statements" },
    { id: 4 as StepId, label: "Review Exceptions" },
    { id: 5 as StepId, label: "Reconciliation" },
    { id: 6 as StepId, label: "Results & Export" },
  ];

  const stepStatus = useCallback((id: StepId) => {
    if (id === step) return "active" as const;
    const idx = steps.findIndex((s) => s.id === id);
    const curIdx = steps.findIndex((s) => s.id === step);
    if (idx < curIdx) return "completed" as const;
    return "pending" as const;
  }, [step, steps]);

  function goTo(s: StepId) {
    if (s < step) setStep(s);
  }

  function handleCompanyComplete(c: Company, ws: Workspace) {
    setCompany(c);
    setWorkspace(ws);
    setStep(2);
  }

  function handleAccountsComplete(accs: BankAccount[]) {
    setAccounts(accs);
    setStep(3);
  }

  function handleUploadComplete() {
    setStep(4);
  }

  function handleReviewComplete() {
    setStep(5);
  }

  function handleReconComplete(results: ReconciliationResult[]) {
    setReconciliation(results);
    setStep(6);
  }

  function handleNewWorkflow() {
    setStep(1);
    setCompany(null);
    setWorkspace(null);
    setAccounts([]);
    setReconciliation([]);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-sage">AI Financials for CPA Web</p>
        <h1 className="mt-1 text-2xl font-semibold">Annual Financial Workflow</h1>
      </div>

      <StepIndicator steps={steps.map((s) => ({ ...s, status: stepStatus(s.id) }))} />

      <div className="rounded border border-line bg-white p-6">
        {step === 1 && <CompanyStep onComplete={handleCompanyComplete} />}
        {step === 2 && company && <BankAccountsStep company={company} onComplete={handleAccountsComplete} />}
        {step === 3 && workspace && accounts.length > 0 && (
          <UploadStep workspace={workspace} accounts={accounts} onComplete={handleUploadComplete} />
        )}
        {step === 4 && workspace && (
          <ReviewStep workspace={workspace} onComplete={handleReviewComplete} onBack={() => setStep(3)} />
        )}
        {step === 5 && workspace && accounts.length > 0 && (
          <ReconciliationStep
            workspace={workspace}
            accounts={accounts}
            onComplete={handleReconComplete}
            onBack={() => setStep(4)}
          />
        )}
        {step === 6 && company && workspace && (
          <ResultsStep
            workspace={workspace}
            company={company}
            accounts={accounts}
            reconciliation={reconciliation}
            onNewWorkflow={handleNewWorkflow}
          />
        )}
      </div>
    </div>
  );
}
