/**
 * @fileoverview Inbox-Liste offener Submissions (ADR-0004, W4).
 *
 * @description
 * Praesentationskomponente (prop-driven, kein Daten-Fetch): zeigt die
 * Submissions einer Library mit Titel/docType, Erfasser, Datum und Status-Badge.
 * Auswahl via `onSelect`. Wird lokal in die Archiv-Ansicht eingebunden; das
 * Laden uebernimmt `GET /api/submissions?libraryId=…`.
 *
 * @see docs/wizards/abnahme-inbox-plan.md (Baustein W4)
 */

'use client';

import { cn } from '@/lib/utils';
import { SubmissionStatusBadge } from '@/components/submissions/submission-status-badge';
import type { WizardSubmission } from '@/types/wizard-submission';

interface SubmissionInboxListProps {
  submissions: WizardSubmission[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

function submissionTitle(submission: WizardSubmission): string {
  const title = submission.metadata.title;
  return typeof title === 'string' && title.length > 0 ? title : submission.docType;
}

export function SubmissionInboxList({ submissions, selectedId, onSelect }: SubmissionInboxListProps) {
  if (submissions.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Keine Beitraege in der Inbox.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {submissions.map((submission) => (
        <li key={submission.id}>
          <button
            type="button"
            onClick={() => onSelect(submission.id)}
            aria-current={selectedId === submission.id}
            className={cn(
              'flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50',
              selectedId === submission.id && 'bg-muted',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{submissionTitle(submission)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {submission.createdBy} · {new Date(submission.createdAt).toLocaleDateString('de-DE')}
              </span>
            </span>
            <SubmissionStatusBadge status={submission.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
