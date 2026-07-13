"use client";
import React from "react";

import { useState, useEffect } from "react";
import type { BankAccount, Company } from "@/domain/types";

type Props = {
  company: Company;
  onComplete: (accounts: BankAccount[]) => void;
};

export default function BankAccountsStep({ company, onComplete }: Props) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ accountName: "", bankName: "", lastFour: "", accountType: "Checking" });

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    const res = await fetch(`/api/accounts?companyId=${company.id}`);
    if (res.ok) setAccounts(await res.json());
  }

  async function saveAccount() {
    if (!form.accountName || !form.bankName || form.lastFour.length !== 4) return;
    if (editId) {
      await fetch(`/api/accounts/${editId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, companyId: company.id }),
      });
    } else {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, companyId: company.id }),
      });
    }
    setForm({ accountName: "", bankName: "", lastFour: "", accountType: "Checking" });
    setShowForm(false);
    setEditId(null);
    await loadAccounts();
  }

  function startEdit(a: BankAccount) {
    setForm({ accountName: a.accountName, bankName: a.bankName, lastFour: a.lastFour, accountType: a.accountType });
    setEditId(a.id);
    setShowForm(true);
  }

  async function deleteAccount(id: string) {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    await loadAccounts();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Bank Accounts</h2>
      <p className="text-sm text-slate-600">
        Add the bank accounts for <span className="font-semibold text-ink">{company.legalName}</span>
      </p>

      <div className="space-y-2">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-line px-4 py-3">
            <div>
              <p className="font-medium">{a.accountName}</p>
              <p className="text-xs text-slate-500">
                {a.bankName} •••• {a.lastFour} · {a.accountType}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startEdit(a)} className="text-xs text-sage underline">Edit</button>
              <button onClick={() => deleteAccount(a.id)} className="text-xs text-red-600 underline">Remove</button>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="rounded border border-line bg-paper p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              Account name
              <input className="rounded border border-line px-3 py-2" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              Bank name
              <input className="rounded border border-line px-3 py-2" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              Last 4 digits
              <input className="rounded border border-line px-3 py-2" maxLength={4} value={form.lastFour} onChange={(e) => setForm({ ...form, lastFour: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
            </label>
            <label className="grid gap-1 text-sm">
              Account type
              <select className="rounded border border-line px-3 py-2" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                <option>Checking</option>
                <option>Savings</option>
                <option>Credit Card</option>
                <option>Money Market</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={saveAccount} className="rounded bg-ink px-4 py-2 text-sm text-white">
              {editId ? "Save changes" : "Add account"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded border border-line px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="rounded border border-dashed border-line px-4 py-2 text-sm text-sage hover:bg-paper">
          + Add bank account
        </button>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <button
          onClick={() => onComplete(accounts)}
          disabled={accounts.length === 0}
          className="rounded bg-ink px-6 py-2.5 text-sm text-white disabled:opacity-40"
        >
          {accounts.length === 0 ? "Add at least one account" : "Continue"}
        </button>
      </div>
    </div>
  );
}
