/**
 * @fileoverview Status-Badge fuer eine Wizard-Submission (ADR-0004, W4).
 * Exhaustive Label-/Farb-Maps ueber alle Status (kein stiller Fallback).
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SubmissionStatus } from '@/types/wizard-submission';

const STATUS_LABEL: Readonly<Record<SubmissionStatus, string>> = {
  draft: 'Entwurf',
  pending: 'Offen',
  ready: 'Freigegeben',
  publishing: 'Wird publiziert',
  published: 'Publiziert',
  rejected: 'Abgelehnt',
};

const STATUS_CLASS: Readonly<Record<SubmissionStatus, string>> = {
  draft: 'bg-slate-500/85 text-white',
  pending: 'bg-amber-500/85 text-white',
  ready: 'bg-emerald-600/85 text-white',
  publishing: 'bg-sky-500/85 text-white',
  published: 'bg-emerald-700/85 text-white',
  rejected: 'bg-rose-600/85 text-white',
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge className={cn('border-0', STATUS_CLASS[status])}>{STATUS_LABEL[status]}</Badge>;
}
