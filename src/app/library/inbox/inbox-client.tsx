/**
 * @fileoverview Wartekorb-Client: Liste + Abnahme der Inbox-Submissions (ADR-0004, Stufe B).
 *
 * @description
 * Lädt die Submissions der aktiven Library (`GET /api/submissions`), zeigt links
 * die Liste und rechts die Abnahme: die ECHTE Story-Detailansicht (Wiederverwendung
 * von `DetailViewRenderer` — wie Archiv/Galerie) plus Korrektur-Felder und
 * Freigeben/Ablehnen. Bewusst schlank — der Prüfer nimmt das Ergebnis ab, keine
 * Pipeline-Zwischenschritte. Library-Auflösung: `?libraryId=` (explizit) sonst die
 * aktive Library aus dem Jotai-Atom.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAtomValue } from 'jotai';
import { activeLibraryAtom, activeLibraryIdAtom } from '@/atoms/library-atom';
import { SubmissionInboxList } from '@/components/submissions/submission-inbox-list';
import { SubmissionReviewPanel } from '@/components/submissions/submission-review-panel';
import { DetailViewRenderer } from '@/components/library/detail-view-renderer';
import type { TemplatePreviewDetailViewType } from '@/lib/templates/template-types';
import type { WizardSubmission } from '@/types/wizard-submission';

// HTTP-Header für JSON-Requests an die Submission-Routen.
const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' };

async function readError(res: Response, label: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${label} fehlgeschlagen (HTTP ${res.status})`;
}

export function InboxClient() {
  const params = useSearchParams();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const libraryId = params.get('libraryId') || activeLibraryId;

  const [submissions, setSubmissions] = useState<WizardSubmission[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!libraryId) return;
    try {
      setError(null);
      const res = await fetch(`/api/submissions?libraryId=${encodeURIComponent(libraryId)}`, {
        headers: JSON_HEADERS,
      });
      if (!res.ok) throw new Error(await readError(res, 'Laden'));
      const data = (await res.json()) as { submissions: WizardSubmission[] };
      setSubmissions(data.submissions);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unbekannter Fehler');
    }
  }, [libraryId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async (action: () => Promise<Response>, label: string) => {
      try {
        setIsBusy(true);
        setError(null);
        const res = await action();
        if (!res.ok) throw new Error(await readError(res, label));
        await reload();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unbekannter Fehler');
      } finally {
        setIsBusy(false);
      }
    },
    [reload],
  );

  const selected = submissions.find((submission) => submission.id === selectedId);

  if (!libraryId) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Keine Library ausgewählt. Bitte zuerst im{' '}
        <Link href="/library" className="underline">
          Archiv
        </Link>{' '}
        eine Library öffnen.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-sm font-semibold">
          Wartekorb{activeLibrary?.label ? ` — ${activeLibrary.label}` : ''}
        </h1>
        <span className="text-xs text-muted-foreground">{submissions.length} Beiträge</span>
      </header>
      {error && (
        <p className="border-b border-border bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,360px)_1fr] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border">
          <SubmissionInboxList
            submissions={submissions}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="overflow-y-auto">
          {selected ? (
            <div className="flex flex-col gap-6 p-4">
              <section>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Vorschau</h2>
                <div className="overflow-hidden rounded-md border border-border">
                  <DetailViewRenderer
                    detailViewType={selected.detailViewType as TemplatePreviewDetailViewType}
                    metadata={selected.metadata}
                    markdown={selected.markdownBody}
                    libraryId={selected.libraryId}
                    hideEventTools
                    hideDebug
                  />
                </div>
              </section>
              <section>
                <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Abnahme &amp; Korrektur</h2>
                <SubmissionReviewPanel
                  key={selected.id}
                  submission={selected}
                  isBusy={isBusy}
                  onSave={(metadata, markdownBody) =>
                    void runAction(
                      () =>
                        fetch(`/api/submissions/${selected.id}`, {
                          method: 'PATCH',
                          headers: JSON_HEADERS,
                          body: JSON.stringify({ metadata, markdownBody }),
                        }),
                      'Speichern',
                    )
                  }
                  onApprove={() =>
                    void runAction(
                      () =>
                        fetch(`/api/submissions/${selected.id}/approve`, {
                          method: 'POST',
                          headers: JSON_HEADERS,
                          body: JSON.stringify({}),
                        }),
                      'Freigeben',
                    )
                  }
                  onReject={(note) =>
                    void runAction(
                      () =>
                        fetch(`/api/submissions/${selected.id}/reject`, {
                          method: 'POST',
                          headers: JSON_HEADERS,
                          body: JSON.stringify({ note }),
                        }),
                      'Ablehnen',
                    )
                  }
                />
              </section>
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Links einen Beitrag auswählen.</p>
          )}
        </main>
      </div>
    </div>
  );
}
