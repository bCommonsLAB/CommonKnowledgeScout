/**
 * @fileoverview Selbstkorrektur-Panel des Erfassers (ADR-0004 II, Welle III-4b).
 *
 * @description
 * Prop-driven Sicht, mit der ein Contributor das Analyse-Ergebnis seiner eigenen
 * Submission prueft und korrigiert (Metadaten + Body) und speichert — BEWUSST
 * OHNE Freigabe/Ablehnung (das bleibt dem Reviewer im Wartekorb, ADR-0004).
 * Teilt die Editier-Darstellung mit der Abnahme (`SubmissionEditFields`).
 *
 * Hinweis: Aufrufer setzt `key={submission.id}`, damit der lokale State beim
 * Wechsel der Submission zuruecksetzt.
 *
 * @see docs/wizards/contributor-pdf-upload-wizard.md (Stufe B: selbst pruefen & korrigieren)
 * @module components/submissions
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SubmissionEditFields } from '@/components/submissions/submission-edit-fields';
import { buildReviewFields } from '@/lib/submissions/submission-review';
import type { WizardSubmission } from '@/types/wizard-submission';

interface SubmissionEditPanelProps {
  submission: WizardSubmission;
  onSave: (metadata: Record<string, unknown>, markdownBody: string) => void;
  isBusy?: boolean;
}

export function SubmissionEditPanel({ submission, onSave, isBusy = false }: SubmissionEditPanelProps) {
  const [metadata, setMetadata] = useState<Record<string, unknown>>(submission.metadata);
  const [markdownBody, setMarkdownBody] = useState(submission.markdownBody);

  // Pflichtfelder/Confidence werden hervorgehoben (Hilfe beim Pruefen), sperren
  // aber nichts: der Erfasser speichert, die Freigabe-Sperre greift beim Reviewer.
  const fields = buildReviewFields(submission.detailViewType, metadata, submission.confidence);

  return (
    <div className="flex flex-col gap-4 p-4">
      <SubmissionEditFields
        fields={fields}
        metadata={metadata}
        markdownBody={markdownBody}
        onFieldChange={(key, value) => setMetadata((current) => ({ ...current, [key]: value }))}
        onMarkdownChange={setMarkdownBody}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={isBusy} onClick={() => onSave(metadata, markdownBody)}>
          Speichern
        </Button>
      </div>
    </div>
  );
}
