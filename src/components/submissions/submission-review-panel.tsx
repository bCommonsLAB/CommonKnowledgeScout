/**
 * @fileoverview Abnahme-Panel einer Submission (ADR-0004, W4).
 *
 * @description
 * Prop-driven Abnahme-Ansicht: zeigt die INHALTLICHEN Felder (B6) mit
 * Confidence-Hervorhebung (Muster diva-texture-card), markiert fehlende
 * Pflichtfelder, erlaubt Korrektur (Speichern) und Freigabe/Ablehnung. Generisch
 * ueber `detailViewType` - kein Domaenenwissen pro docType (ADR-0003 / O1).
 *
 * Hinweis: Der Aufrufer sollte `key={submission.id}` setzen, damit der lokale
 * Bearbeitungs-State beim Wechsel der Submission zuruecksetzt.
 *
 * @see docs/wizards/abnahme-inbox-plan.md (Baustein W4 + B6)
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmissionEditFields } from '@/components/submissions/submission-edit-fields';
import {
  buildReviewFields,
  hasMissingRequiredFields,
} from '@/lib/submissions/submission-review';
import type { WizardSubmission } from '@/types/wizard-submission';

interface SubmissionReviewPanelProps {
  submission: WizardSubmission;
  onSave: (metadata: Record<string, unknown>, markdownBody: string) => void;
  onApprove: () => void;
  onReject: (note: string) => void;
  isBusy?: boolean;
}

export function SubmissionReviewPanel({
  submission,
  onSave,
  onApprove,
  onReject,
  isBusy = false,
}: SubmissionReviewPanelProps) {
  const [metadata, setMetadata] = useState<Record<string, unknown>>(submission.metadata);
  const [markdownBody, setMarkdownBody] = useState(submission.markdownBody);
  const [note, setNote] = useState('');

  const fields = buildReviewFields(submission.detailViewType, metadata, submission.confidence);
  const blockedByRequired = hasMissingRequiredFields(fields);

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
        <Button
          disabled={isBusy || blockedByRequired}
          title={blockedByRequired ? 'Pflichtfelder fehlen' : undefined}
          onClick={onApprove}
        >
          Freigeben
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="submission-reject-note">Ablehnungsgrund</Label>
        <Textarea
          id="submission-reject-note"
          rows={2}
          value={note}
          placeholder="Optionaler Grund…"
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          variant="destructive"
          className="self-start"
          disabled={isBusy}
          onClick={() => onReject(note)}
        >
          Ablehnen
        </Button>
      </div>
    </div>
  );
}
