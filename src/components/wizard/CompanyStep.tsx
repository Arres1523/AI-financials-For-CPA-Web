"use client";
import React from "react";

import { useState, useEffect } from "react";
import type { Company, Workspace } from "@/domain/types";

type Props = {
  onComplete: (company: Company, workspace: Workspace) => void;
};

export default function CompanyStep({ onComplete }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [step, setStep] = useState<"search" | "new" | "select-year" | "select-workspace">("search");

  useEffect(() => { loadCompanies(); }, []);

  async function loadCompanies() {
    const res = await fetch("/api/companies");
    if (res.ok) setCompanies(await res.json());
  }

  async function selectCompany(c: Company) {
    setSelectedCompany(c);
    const res = await fetch(`/api/workspaces?companyId=${c.id}`);
    if (res.ok) {
      const ws: Workspace[] = await res.json();
      setWorkspaces(ws);
      if (ws.length > 0) setStep("select-workspace");
      else setStep("select-year");
    }
  }

  async function createCompany() {
    if (!newName.trim()) return;
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ legalName: newName.trim() }),
    });
    if (res.ok) {
      const c: Company = await res.json();
      await loadCompanies();
      setSelectedCompany(c);
      setStep("select-year");
    } else {
      const err = await res.json();
      if (res.status === 409 && err.id) {
        const c = companies.find((x) => x.id === err.id) ?? { id: err.id, legalName: newName.trim(), createdAt: "" };
        setSelectedCompany(c);
        setStep("select-year");
      } else {
        alert(err.error || "Error creating company");
      }
    }
  }

  async function createOrSelectWorkspace() {
    if (!selectedCompany) return;
    if (selectedWorkspace) {
      onComplete(selectedCompany, selectedWorkspace);
      return;
    }
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId: selectedCompany.id, taxYear }),
    });
    if (res.ok || res.status === 409) {
      const data = await res.json();
      const ws: Workspace = data.id ? { id: data.id, companyId: selectedCompany.id, taxYear, status: "in_progress", createdAt: "", updatedAt: "" } : data;
      onComplete(selectedCompany, ws);
    }
  }

  const filtered = companies.filter((c) => c.legalName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setStep("search"); setSelectedCompany(null); setSelectedWorkspace(null); }}
          className="rounded border border-line px-3 py-1.5 text-sm hover:bg-paper"
        >
          ← All companies
        </button>
        <h2 className="text-xl font-semibold">Company & Fiscal Year</h2>
      </div>

      {step === "search" && (
        <div className="space-y-4">
          <input
            className="w-full rounded border border-line px-4 py-2.5 text-sm"
            placeholder="Search existing companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCompany(c)}
                className="w-full rounded px-4 py-2.5 text-left text-sm hover:bg-paper border border-transparent hover:border-line"
              >
                {c.legalName}
              </button>
            ))}
            {filtered.length === 0 && search && (
              <p className="px-2 py-4 text-center text-sm text-slate-400">No existing companies match &quot;{search}&quot;</p>
            )}
          </div>
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-sm font-medium text-slate-600">Or create a new company</p>
            <div className="flex gap-3">
              <input
                className="flex-1 rounded border border-line px-4 py-2 text-sm"
                placeholder="Legal name of new company"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button onClick={createCompany} className="rounded bg-ink px-5 py-2 text-sm text-white hover:opacity-90">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "select-workspace" && selectedCompany && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Selected: <span className="font-semibold text-ink">{selectedCompany.legalName}</span>
          </p>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setSelectedWorkspace(ws);
                  setTaxYear(ws.taxYear);
                }}
                className={`w-full rounded border px-4 py-3 text-left text-sm ${
                  selectedWorkspace?.id === ws.id ? "border-ink bg-ink/5" : "border-line hover:bg-paper"
                }`}
              >
                <span className="font-medium">{ws.taxYear}</span>
                <span className={`ml-3 text-xs ${ws.status === "in_progress" ? "text-brass" : "text-sage"}`}>
                  {ws.status === "in_progress" ? "In progress" : "Completed"}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("select-year")} className="rounded border border-line px-4 py-2 text-sm hover:bg-paper">
              + New fiscal year
            </button>
            <button
              onClick={createOrSelectWorkspace}
              disabled={!selectedWorkspace}
              className="ml-auto rounded bg-ink px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === "select-year" && selectedCompany && (
        <div className="space-y-4">
          <p className="text-sm">
            Company: <span className="font-semibold">{selectedCompany.legalName}</span>
          </p>
          <label className="grid gap-1 text-sm">
            Fiscal year
            <input
              type="number"
              className="w-40 rounded border border-line px-4 py-2"
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
            />
          </label>
          <button onClick={createOrSelectWorkspace} className="rounded bg-ink px-5 py-2 text-sm text-white">
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
