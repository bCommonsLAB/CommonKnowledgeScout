// @vitest-environment jsdom
/**
 * Tests fuer das Abnahme-Panel (ADR-0004, W4): B6-Pflichtfelder + Confidence,
 * Freigabe-Sperre bei fehlendem Pflichtfeld, Edit/Approve/Reject-Callbacks.
 */

import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SubmissionReviewPanel } from '@/components/submissions/submission-review-panel';
import type { WizardSubmission } from '@/types/wizard-submission';

afterEach(cleanup);

function makeSubmission(over: Partial<WizardSubmission> = {}): WizardSubmission {
  return {
    id: 's1',
    libraryId: 'lib-1',
    status: 'pending',
    createdBy: 'anna@example.com',
    createdByRole: 'contributor',
    wizardId: 'w1',
    docType: 'testimonial',
    detailViewType: 'testimonial',
    metadata: {},
    markdownBody: '',
    binaryRefs: [],
    confidence: {},
    target: {},
    review: {},
    events: [],
    createdAt: '2026-06-02T10:00:00.000Z',
    updatedAt: '2026-06-02T10:00:00.000Z',
    version: 1,
    ...over,
  };
}

function setup(over: Partial<WizardSubmission> = {}) {
  const onSave = vi.fn();
  const onApprove = vi.fn();
  const onReject = vi.fn();
  const submission = makeSubmission({
    metadata: { title: 'T', author_name: '' },
    confidence: { title: 0.95 },
    markdownBody: '# Inhalt',
    ...over,
  });
  const utils = render(
    <SubmissionReviewPanel
      submission={submission}
      onSave={onSave}
      onApprove={onApprove}
      onReject={onReject}
    />,
  );
  return { onSave, onApprove, onReject, ...utils };
}

it('zeigt Pflichtfelder + Confidence und sperrt die Freigabe bei fehlendem Pflichtfeld', () => {
  const { container } = setup();
  expect((container.querySelector('#field-title') as HTMLInputElement).value).toBe('T');
  expect(screen.getByText('95%')).toBeTruthy();
  // testimonial-Pflichtfeld author_name ist leer -> fehlend
  expect(screen.getByText('Pflichtfeld fehlt')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Freigeben' }) as HTMLButtonElement).disabled).toBe(true);
});

it('Ausfuellen des Pflichtfelds gibt die Freigabe frei', () => {
  const { container } = setup();
  fireEvent.change(container.querySelector('#field-author_name') as HTMLInputElement, {
    target: { value: 'Anna' },
  });
  expect(screen.queryByText('Pflichtfeld fehlt')).toBeNull();
  expect((screen.getByRole('button', { name: 'Freigeben' }) as HTMLButtonElement).disabled).toBe(false);
});

it('Freigeben/Ablehnen/Speichern rufen die Callbacks (Ablehnung mit Notiz)', () => {
  const { container, onApprove, onReject, onSave } = setup({ metadata: { title: 'T', author_name: 'Anna' } });

  fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
  expect(onApprove).toHaveBeenCalledTimes(1);

  fireEvent.change(container.querySelector('#submission-reject-note') as HTMLTextAreaElement, {
    target: { value: 'Grund' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
  expect(onReject).toHaveBeenCalledWith('Grund');

  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(onSave).toHaveBeenCalledWith({ title: 'T', author_name: 'Anna' }, '# Inhalt');
});
