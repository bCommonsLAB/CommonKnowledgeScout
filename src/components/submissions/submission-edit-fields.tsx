/**
 * @fileoverview Geteilte Editier-Felder einer Submission (ADR-0004, Welle III).
 *
 * @description
 * Prop-driven Darstellung der INHALTLICHEN Felder (B6) mit Confidence-Hervorhebung
 * (Muster diva-texture-card) + Markdown-Body. Reine Anzeige/Eingabe ohne eigene
 * Aktionen — der State liegt beim Aufrufer. Geteilt von der Reviewer-Abnahme
 * (`SubmissionReviewPanel`, W4) und der Contributor-Selbstkorrektur
 * (`SubmissionEditPanel`, III-4b), damit es nur EINE Editier-Darstellung gibt.
 *
 * @see docs/wizards/abnahme-inbox-plan.md (B6)
 * @module components/submissions
 */

'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CONFIDENCE_TONE_BADGE,
  confidencePercent,
  type ReviewField,
} from '@/lib/submissions/submission-review';

interface SubmissionEditFieldsProps {
  fields: ReviewField[];
  metadata: Record<string, unknown>;
  markdownBody: string;
  onFieldChange: (key: string, value: string) => void;
  onMarkdownChange: (value: string) => void;
}

/** Wandelt einen Feldwert in einen editierbaren String (generisch, text-first). */
function toInputValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

export function SubmissionEditFields({
  fields,
  metadata,
  markdownBody,
  onFieldChange,
  onMarkdownChange,
}: SubmissionEditFieldsProps) {
  return (
    <>
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
              onChange={(event) => onFieldChange(field.key, event.target.value)}
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
          onChange={(event) => onMarkdownChange(event.target.value)}
        />
      </div>
    </>
  );
}
