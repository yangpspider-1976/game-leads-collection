"use client";

import Checkbox from "@mui/material/Checkbox";
import { BadgeCheck, Download, Power, PowerOff, Radio, Search, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { LoadingForm } from "@/components/loading-form";
import { showSnackbar } from "@/lib/snackbar-events";

export type RegisteredSourceRow = {
  id: string;
  name: string;
  region: string;
  language: string;
  sourceType: string;
  url: string;
  resolvedFeedUrl: string | null;
  active: boolean;
  verificationStatus: string;
  verificationError: string | null;
  consecutiveFailures: number;
  priority: number;
  reliability: string;
  notes: string | null;
  lastVerifiedAt: string;
  lastCrawledAt: string;
};

const checkboxSx = {
  color: "#667085",
  "&.Mui-checked": { color: "#0f766e" },
  "&.MuiCheckbox-indeterminate": { color: "#0f766e" }
};

export function RegisteredSourcesTable({ sources }: { sources: RegisteredSourceRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedSources = useMemo(() => sources.filter((source) => selectedSet.has(source.id)), [sources, selectedSet]);
  const allSelected = sources.length > 0 && selected.length === sources.length;

  function toggleSource(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : sources.map((source) => source.id));
  }

  async function importSources(file: File) {
    if (importing) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/sources/import", { method: "POST", body: form });
      const payload = (await response.json()) as {
        success?: boolean;
        created?: number;
        updated?: number;
        deleted?: number;
        skipped?: number;
        error?: string;
        automaticVerification?: { checked: number; activated: number; failed: number };
      };
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to import sources.");
      const created = payload.created ?? 0;
      const updated = payload.updated ?? 0;
      const deleted = payload.deleted ?? 0;
      const skipped = payload.skipped ?? 0;
      const verification = payload.automaticVerification;
      const verificationSummary = verification
        ? ` Auto-verified ${verification.checked}: ${verification.activated} activated, ${verification.failed} need review.`
        : "";
      showSnackbar(`Import complete: ${created} added, ${updated} updated, ${deleted} deleted${skipped ? `, ${skipped} skipped` : ""}.${verificationSummary}`);
      setPendingImportFile(null);
      router.refresh();
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : "Unable to import sources.", "error");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function cancelImport() {
    setPendingImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteSelectedSources() {
    if (selected.length === 0 || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/sources/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected })
      });
      const payload = (await response.json()) as { success?: boolean; deleted?: number; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to delete selected sources.");
      const deleted = payload.deleted ?? selected.length;
      showSnackbar(`Deleted ${deleted} source${deleted === 1 ? "" : "s"}.`);
      setSelected([]);
      setShowDeleteModal(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete selected sources.";
      setDeleteError(message);
      showSnackbar(message, "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="email-log-actions article-review-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setPendingImportFile(file);
          }}
        />
        <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload size={16} /> {importing ? "Importing..." : "Import XLSX"}
        </button>
        <a className="button secondary" href="/api/sources/export" download>
          <Download size={16} /> Download XLSX
        </a>
        <button className="button secondary" type="button" onClick={() => setShowDeleteModal(true)} disabled={selected.length === 0}>
          <Trash2 size={16} /> Delete
        </button>
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="sources-table">
            <thead>
              <tr>
                <th className="select-cell" onClick={() => sources.length > 0 && toggleAll()}>
                  <span className="checkbox-hit-area">
                    <Checkbox
                      aria-label="Select all registered sources"
                      checked={allSelected}
                      disabled={sources.length === 0}
                      indeterminate={selected.length > 0 && !allSelected}
                      size="small"
                      sx={checkboxSx}
                      onChange={(event) => event.stopPropagation()}
                      onClick={(event) => { event.stopPropagation(); toggleAll(); }}
                    />
                  </span>
                </th>
                <th>Source</th><th>Region</th><th>Language</th><th>Type</th><th>Status</th><th>Priority</th>
                <th>Reliability</th><th>Failures</th><th>Active</th><th>Last Verified</th><th>Last Crawl</th><th>Action</th>
              </tr>
              <tr className="table-subheader-row">
                <th className="table-subheader-cell" colSpan={13}>
                  {sources.length} source{sources.length === 1 ? "" : "s"} &bull; {selected.length} selected
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr className={selectedSet.has(source.id) ? "selected-row" : undefined} key={source.id}>
                  <td className="select-cell" onClick={() => toggleSource(source.id)}>
                    <span className="checkbox-hit-area">
                      <Checkbox aria-label={`Select ${source.name}`} checked={selectedSet.has(source.id)} size="small" sx={checkboxSx}
                        onChange={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleSource(source.id); }} />
                    </span>
                  </td>
                  <td className="source-main-cell">
                    <strong>{source.name}</strong>
                    <a className="truncate-link source-url" href={source.url} title={source.url} target="_blank">{source.url}</a>
                    {source.resolvedFeedUrl ? <a className="truncate-link source-url muted-link" href={source.resolvedFeedUrl} title={source.resolvedFeedUrl} target="_blank">Feed: {source.resolvedFeedUrl}</a> : null}
                    {source.notes ? <span className="source-note">{source.notes}</span> : null}
                  </td>
                  <td>{source.region}</td><td>{source.language}</td><td>{source.sourceType}</td>
                  <td title={source.verificationError ?? undefined}>
                    <span className={`badge status-${source.verificationStatus}`}>{source.verificationStatus}</span>
                    {source.verificationError ? <span className="cell-subtle error-text">{source.verificationError}</span> : null}
                  </td>
                  <td>{source.priority}</td><td>{source.reliability}</td><td>{source.consecutiveFailures}</td>
                  <td>{source.active ? "Yes" : "No"}</td><td>{source.lastVerifiedAt}</td><td>{source.lastCrawledAt}</td>
                  <td>
                    <div className="actions source-actions">
                      <LoadingForm action={`/api/sources/${source.id}/verify`} loadingLabel={`Verifying ${source.name}`}><button className="button secondary" type="submit"><BadgeCheck size={16} /> Verify</button></LoadingForm>
                      <LoadingForm action={`/api/sources/${source.id}/discover-rss`} loadingLabel={`Discovering RSS for ${source.name}`}><button className="button secondary" type="submit"><Search size={16} /> Discover RSS</button></LoadingForm>
                      <LoadingForm action={`/api/sources/${source.id}/crawl`} loadingLabel={`Crawling ${source.name}`}><button className="button secondary" type="submit"><Radio size={16} /> Crawl Now</button></LoadingForm>
                      <LoadingForm action={`/api/sources/${source.id}/toggle`} loadingLabel={`${source.active ? "Deactivating" : "Activating"} ${source.name}`}>
                        <button className="button secondary" type="submit">{source.active ? <PowerOff size={16} /> : <Power size={16} />}{source.active ? "Deactivate" : "Activate"}</button>
                      </LoadingForm>
                    </div>
                  </td>
                </tr>
              ))}
              {sources.length === 0 ? <tr><td colSpan={13}>No sources registered yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {pendingImportFile ? (
        <div className="modal-backdrop" role="presentation" onClick={() => (importing ? undefined : cancelImport())}>
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="source-import-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="source-import-title">Import sources</h2>
                <p className="inline-muted">Confirm importing {pendingImportFile.name}.</p>
              </div>
              <button className="icon-button" type="button" onClick={cancelImport} aria-label="Close import confirmation" disabled={importing}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>The workbook will replace the registered source list. Matching URLs will be updated and new URLs will be added.</p>
              <p className="notice warning">Any existing source not included in the workbook will be deleted. This also deletes its collected articles and related leads and outreach records.</p>
              <p>After import, RSS auto-discovery sources will automatically discover their feed, verify it, and activate only when verification succeeds. No crawl will run.</p>
            </div>
            <div className="modal-footer">
              <button className="button secondary" type="button" onClick={cancelImport} disabled={importing}>Cancel</button>
              <button className="button" type="button" onClick={() => void importSources(pendingImportFile)} disabled={importing}>
                <Upload size={16} /> {importing ? "Importing..." : "Import XLSX"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => (deleting ? undefined : setShowDeleteModal(false))}>
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="source-delete-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h2 id="source-delete-title">Delete sources</h2><p className="inline-muted">{selectedSources.length} selected source{selectedSources.length === 1 ? "" : "s"} will be removed permanently.</p></div>
              <button className="icon-button" type="button" onClick={() => setShowDeleteModal(false)} aria-label="Close delete confirmation" disabled={deleting}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>Deleting sources also removes their collected articles and any leads and outreach records created from those articles.</p>
              {deleteError ? <p className="notice warning">{deleteError}</p> : null}
            </div>
            <div className="modal-footer">
              <button className="button secondary" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
              <button className="button danger" type="button" onClick={deleteSelectedSources} disabled={deleting}><Trash2 size={16} /> {deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
