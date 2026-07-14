"use client";
import React from "react";

import { useState, useRef, useEffect } from "react";
import type { BankAccount, ColumnMapping, UploadPreview, ImportError, UploadedStatement, Workspace } from "@/domain/types";
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
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "partial" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  const fileBuffersRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const continueRef = useRef<HTMLDivElement>(null);
  const [persistedStatements, setPersistedStatements] = useState<UploadedStatement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(true);
  const [statementsError, setStatementsError] = useState("");

  function resetFileInput() {
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFileSelectWithBuffer(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setFileError("");
    setImportStatus("idle");

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        setFileError(`"${file.name}" is not an .xlsx file. Only .xlsx files are accepted.`);
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
        let msg = "Upload preview failed";
        try { const err = await res.json(); msg = err.error || msg; } catch {}
        setFileError(msg);
      }
    }

    resetFileInput();
  }

  function updateMapping(fileName: string, mapping: ColumnMapping) {
    setMappings((prev) => ({ ...prev, [fileName]: mapping }));
  }

  async function doImport(preview: UploadPreview) {
    if (!selectedAccount) { setFileError("Select a bank account first"); return; }

    const mapping = mappings[preview.fileName] || preview.detectedMapping as ColumnMapping;
    if (!mapping.date || !mapping.description || (!mapping.amount && !(mapping.debit && mapping.credit))) {
      setFileError("Complete the column mapping first (date, description, and amount are required)");
      return;
    }

    const buffer = fileBuffersRef.current.get(preview.fileName);
    if (!buffer) { setFileError("File buffer expired — please re-upload"); return; }

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
      setImportStatus(data.errors && data.errors.length > 0 ? "partial" : "success");
    } else {
      let msg = "Import failed";
      try {
        const err = await res.json();
        const errList: ImportError[] = err.errors || [];
        msg = errList.length > 0 ? errList.map((e: ImportError) => e.message).join("; ") : (err.error || `Server error (${res.status})`);
      } catch {}
      setFileError(msg);
      setImportStatus("error");
    }

    setUploading(false);
  }

  useEffect(() => {
    if (results.length > 0 && continueRef.current) {
      continueRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [results.length]);

  useEffect(() => {
    async function loadPersisted() {
      try {
        setStatementsLoading(true);
        const res = await fetch(`/api/statements?workspaceId=${workspace.id}`);
        if (res.ok) {
          const data: UploadedStatement[] = await res.json();
          setPersistedStatements(data);
        } else {
          setStatementsError("Failed to load previously imported statements");
        }
      } catch {
        setStatementsError("Failed to load previously imported statements");
      } finally {
        setStatementsLoading(false);
      }
    }
    loadPersisted();
  }, [workspace.id]);

  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  const totalPersistedImported = persistedStatements.reduce((s, p) => s + p.importedRows, 0);
  const canContinue = !statementsLoading && (results.length > 0 || persistedStatements.length > 0);

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

      {/* Loading persisted statements */}
      {statementsLoading && (
        <div className="rounded border border-line p-4 text-center text-sm text-slate-500">
          Loading previously imported statements…
        </div>
      )}

      {/* Statements fetch error */}
      {statementsError && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p className="font-medium">{statementsError}</p>
        </div>
      )}

      {/* Previously imported statements */}
      {persistedStatements.length > 0 && (
        <div className="rounded border border-sage/30 bg-sage/5 p-4">
          <p className="text-sm font-medium text-sage">Previously imported statements</p>
          <ul className="mt-2 space-y-1">
            {persistedStatements.map((s) => (
              <li key={s.id} className="text-sm text-slate-600">
                {s.fileName} — {s.importedRows} transaction{s.importedRows !== 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error banner */}
      {fileError && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p className="font-medium">⚠ {fileError}</p>
        </div>
      )}

      {/* Import status banners */}
      {importStatus === "success" && (
        <div className="rounded border border-sage/30 bg-sage/10 p-4 text-sm text-sage" role="status">
          <p className="font-medium">✓ Import successful — {totalImported} transactions loaded</p>
        </div>
      )}
      {importStatus === "partial" && (
        <div className="rounded border border-brass/30 bg-brass/10 p-4 text-sm text-brass" role="alert">
          <p className="font-medium">⚠ Imported with warnings — review details below</p>
        </div>
      )}
      {importStatus === "error" && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p className="font-medium">✕ Import failed — see error above and try again</p>
        </div>
      )}

      {/* Preview cards for each uploaded file */}
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
              disabled={uploading || previews.length === 0}
              className="rounded bg-sage px-5 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Importing…
                </span>
              ) : (
                "Import"
              )}
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

      {/* Cumulative import results */}
      {results.length > 0 && (
        <div className="rounded border border-sage/30 bg-sage/5 p-4">
          <p className="text-sm font-medium text-sage">
            ✓ Imported {totalImported} transaction{totalImported !== 1 ? "s" : ""} from {results.length} file{results.length !== 1 ? "s" : ""}
            {totalErrors > 0 && (
              <span className="text-brass"> — {totalErrors} warning{totalErrors !== 1 ? "s" : ""}</span>
            )}
          </p>
          {results.flatMap((r) => r.errors as ImportError[]).map((err: ImportError, i: number) => (
            <p key={i} className="text-xs text-brass mt-1">⚠ Row {err.row}: {err.message}</p>
          ))}
        </div>
      )}

      {/* Continue button */}
      <div ref={continueRef} className="flex justify-end border-t border-line pt-4">
        <button
          onClick={onComplete}
          disabled={!canContinue}
          className="rounded bg-ink px-8 py-3 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90"
        >
          {canContinue
            ? `Continue to Review (${totalImported + totalPersistedImported} transactions)`
            : "Upload and import at least one statement"}
        </button>
      </div>
    </div>
  );
}
