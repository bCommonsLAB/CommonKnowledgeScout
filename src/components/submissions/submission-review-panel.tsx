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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CONFIDENCE_TONE_BADGE,
  buildReviewFields,
  confidencePercent,
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

/** Wandelt einen Feldwert in einen editierbaren String (generisch, text-first). */
function toInputValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
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
      <div className="flex flex-col gap-3">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <Label htmlFor={`field-${field.key}`} className="flex items-center gap-2">
              <span>{field.key}</span>
              {field.isRequired && <span className="text-xs text-muted-foreground">Pflicht</span>}
              {field.confidence !== undefined && field.tone && (
                <Badge
                  className={cn('border-0', CONFIDENCE_TONE_BADGE[field.tone])}
                  title="Analyse-Sicherheit"
                >
                  {confidencePercent(field.confidence)}
                </Badge>
              )}
            </Label>
            <Input
              id={`field-${field.key}`}
              value={toInputValue(metadata[field.key])}
              aria-invalid={field.isMissing}
              className={cn(field.isMissing && 'border-rose-500')}
              onChange={(event) =>
                setMetadata((current) => ({ ...current, [field.key]: event.target.value }))
              }
            />
            {field.isMissing && <span className="text-xs text-rose-600">Pflichtfeld fehlt</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="submission-markdown">Inhalt</Label>
        <Textarea
          id="submission-markdown"
          rows={8}
          value={markdownBody}
          onChange={(event) => setMarkdownBody(event.target.value)}
        />
      </div>

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
