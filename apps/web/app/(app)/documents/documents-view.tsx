'use client';

import { confirm, demo as demoCopy, documents as documentsCopy } from '@universityflow/content';
import type { ReportDraft } from '@universityflow/documents';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, cardListGap, EmptyState, FileButton, Notice, Page } from '@/components/ui';
import { ApiError, api, errorMessage, formatDate } from '@/lib/client/api';
import { ConfirmMarks } from './confirm-marks';

interface DocumentRow {
  id: string;
  status: 'uploaded' | 'extracted' | 'confirmed' | 'failed';
  createdAt: string;
}

type UploadResult = { documentId: string; draft: ReportDraft | null; sample: boolean };

/**
 * Straight to storage (S3, open finding 3): ask for a ticket, post the file to storage with it,
 * then ask the server to check what arrived and read it.
 */
async function uploadDirect(file: File): Promise<UploadResult> {
  const ticket = await api<{ uploadId: string; url: string; fields: Record<string, string> }>(
    '/api/documents/uploads',
    { method: 'POST', json: { contentType: file.type, size: file.size } },
  );
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append('file', file);
  const sent = await fetch(ticket.url, { method: 'POST', body: form }).catch(() => null);
  if (!sent?.ok) throw new ApiError(sent?.status ?? 0, 'upload', 'not-received');
  return api<UploadResult>(`/api/documents/uploads/${ticket.uploadId}`, { method: 'POST' });
}

/** Through our own server (local development). */
async function uploadThroughServer(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  return api<UploadResult>('/api/documents', { method: 'POST', body: form });
}

export function DocumentsView({
  documents: initial,
  direct,
  grade = null,
  demo = false,
}: {
  documents: DocumentRow[];
  /** Upload straight to storage rather than through our server. */
  direct: boolean;
  /** The grade the learner is in: the confirm form starts on that grade's report (G10-1). */
  grade?: number | null;
  /** Judge demo mode: SAMPLE reports only, and "Use a sample report" (docs/deploy/demo.md). */
  demo?: boolean;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    documentId: string | null;
    draft: ReportDraft | null;
    sample: boolean;
  } | null>(null);

  async function read(upload: () => Promise<UploadResult>) {
    setBusy(true);
    setError(null);
    try {
      const result = await upload();
      if (!result.draft) setError(documentsCopy.errors.unreadable);
      setDraft(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.detail === 'demo-sample-only'
          ? demoCopy.sampleOnly
          : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    await read(() => (direct ? uploadDirect(file) : uploadThroughServer(file)));
  }

  async function attachSample() {
    await read(() => api<UploadResult>('/api/demo/sample-report', { method: 'POST' }));
  }

  async function remove(id: string) {
    await api(`/api/documents/${id}`, { method: 'DELETE' });
    setDocuments((list) => list.filter((d) => d.id !== id));
  }

  if (draft) {
    return (
      <ConfirmMarks
        documentId={draft.documentId}
        draft={draft.draft}
        sample={draft.sample}
        grade={grade}
        onSaved={({ offersToCheck }) => {
          // Final results with offers held: the re-check of each offer is what matters now.
          router.push(offersToCheck > 0 ? '/offers' : '/results');
          router.refresh();
        }}
        onCancel={() => setDraft(null)}
      />
    );
  }

  return (
    <Page title={documentsCopy.title} lead={documentsCopy.lead}>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">{documentsCopy.uploadReport}</h2>
          <p>{documentsCopy.uploadLead}</p>
        </div>
        <FileButton
          className="self-start"
          label={busy ? documentsCopy.reading : documentsCopy.chooseFile}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
        {demo ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted">{demoCopy.useSampleReportLead}</p>
            <Button variant="secondary" disabled={busy} onClick={() => void attachSample()}>
              {demoCopy.useSampleReport}
            </Button>
          </div>
        ) : null}
        <div>
          <Button
            variant="quiet"
            onClick={() => setDraft({ documentId: null, draft: null, sample: false })}
          >
            {confirm.manualTitle}
          </Button>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </Card>
      {documents.length === 0 ? (
        <EmptyState>{documentsCopy.empty}</EmptyState>
      ) : (
        // Each document is a card, as every list on a page is (it was a borderless strip).
        <ul className={`flex flex-col ${cardListGap}`}>
          {documents.map((d) => (
            <Card as="li" key={d.id} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {formatDate(d.createdAt)} · {documentsCopy.statuses[d.status]}
              </span>
              <Button variant="quiet" onClick={() => remove(d.id)}>
                {documentsCopy.delete}
              </Button>
            </Card>
          ))}
        </ul>
      )}
    </Page>
  );
}
