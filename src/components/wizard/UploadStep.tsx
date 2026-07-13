"use client";
import React from "react";

import { useState, useRef } from "react";
import type { BankAccount, ColumnMapping, UploadPreview, ImportError, Workspace } from "@/domain/types";
import ColumnMapper from "./ColumnMapper";

type Props = {
  workspace: Workspace;
  accounts: BankAccount[];
  onComplete: () => void;
};

export default function UploadStep({ workspace, accounts, onComplete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<UploadPreview[]>([]);
  const [mappings, setMappings] = useState<Record<string, ColumnMapping>>({});
  const [selectedAccount, setSelectedAccount] = useState("");
  const [results, setResults] = useState<{ imported: number; errors: ImportError[]; statementId: string }[]>([]);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileBuffersRef = useRef<Map<string, ArrayBuffer>>(new Map());

  async function handleFileSelectWithBuffer(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setFileError("");

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        setFileError(`"${file.name}" is not an .xlsx file. Only .xlsx is accepted.`);
        continue;
      }

      const buffer = await file.arrayBuffer();
      fileBuffersRef.current.set(file.name, buffer);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const preview: UploadPreview = await res.json();
        setPreviews((prev) => [...prev, { ...preview, fileName: file.name }]);
      } else {
        const err = await res.json();
        setFileError(err.error || "Upload failed");
      }
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  function updateMapping(fileName: string, mapping: ColumnMapping) {
    setMappings((prev) => ({ ...prev, [fileName]: mapping }));
  }

  async function doImport(preview: UploadPreview) {
    if (!selectedAccount) { setFileError("Select a bank account"); return; }
    const mapping = mappings[preview.fileName] || preview.detectedMapping as ColumnMapping;
    if (!mapping.date || !mapping.description || (!mapping.amount && !(mapping.debit && mapping.credit))) {
      setFileError("Complete the column mapping first");
      return;
    }
    const buffer = fileBuffersRef.current.get(preview.fileName);
    if (!buffer) { setFileError("File buffer not found, please re-upload"); return; }

    setUploading(true);
    setFileError("");

    const formData = new FormData();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    formData.append("file", blob, preview.fileName);
    formData.append("workspaceId", workspace.id);
    formData.append("bankAccountId", selectedAccount);
    formData.append("taxYear", String(workspace.taxYear));
    formData.append("mapping", JSON.stringify(mapping));

    const res = await fetch("/api/import", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      setResults((prev) => [...prev, data]);
      setPreviews((prev) => prev.filter((p) => p.fileName !== preview.fileName));
    } else {
      const err = await res.json();
      setFileError(err.error || "Import failed");
    }
    setUploading(false);
  }

  const totalImported = results.reduce((s, r) => s + r.imported, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Upload Bank Statements</h2>

      <label className="grid gap-1 text-sm max-w-xs">
        Target bank account
        <select
          className="rounded border border-line px-3 py-2"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          <option value="">— Select account —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.accountName} ({a.bankName} ••••{a.lastFour})</option>
          ))}
        </select>
      </label>

      <div className="rounded border border-dashed border-line p-6 text-center">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          multiple
          onChange={handleFileSelectWithBuffer}
          className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:text-white hover:file:opacity-90"
        />
        <p className="mt-2 text-xs text-slate-400">Accepts .xlsx files only, multiple files allowed</p>
      </div>

      {fileError && <p className="text-sm text-red-600">{fileError}</p>}

      {previews.map((preview) => (
        <div key={preview.fileName} className="rounded border border-line p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{preview.fileName}</p>
              <p className="text-xs text-slate-500">
                {preview.sheetName && `Sheet: ${preview.sheetName} · `}
                {preview.totalRows} rows
                {preview.confidence === "high" ? " · Auto-detected ✓" : preview.confidence === "medium" ? " · Partial detection" : " · Needs mapping"}
              </p>
            </div>
            <button
              onClick={() => doImport(preview)}
              disabled={uploading}
              className="rounded bg-sage px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {uploading ? "Importing…" : "Import"}
            </button>
          </div>

          {preview.errors.length > 0 && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              {preview.errors.map((err: string, i: number) => <p key={i}>⚠ {err}</p>)}
            </div>
          )}

          {preview.sampleRows.length > 0 && (
            <div className="overflow-x-auto text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    {preview.columns.map((col: string) => (
                      <th key={col} className="px-2 py-1 text-left font-medium text-slate-600">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row: Record<string, string>, i: number) => (
                    <tr key={i} className="border-b border-line">
                      {preview.columns.map((col: string) => (
                        <td key={col} className="px-2 py-1">{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ColumnMapper
            columns={preview.columns}
            detected={preview.detectedMapping}
            onChange={(m) => updateMapping(preview.fileName, m)}
          />
        </div>
      ))}

      {results.length > 0 && (
        <div className="rounded border border-sage/30 bg-sage/5 p-4">
          <p className="text-sm font-medium text-sage">
            Imported {totalImported} transactions
          </p>
          {results.flatMap((r) => r.errors as ImportError[]).map((err: ImportError, i: number) => (
            <p key={i} className="text-xs text-brass mt-1">⚠ {err.message}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <button
          onClick={onComplete}
          disabled={results.length === 0}
          className="rounded bg-ink px-6 py-2.5 text-sm text-white disabled:opacity-40"
        >
          {results.length === 0 ? "Upload at least one statement" : "Continue to Review"}
        </button>
      </div>
    </div>
  );
}
