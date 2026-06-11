// @vitest-environment jsdom
/**
 * Tests fuer das Contributor-Selbstkorrektur-Panel (ADR-0004 II, III-4b):
 * zeigt Felder + Confidence, speichert die Korrektur — und bietet BEWUSST
 * KEINE Freigabe/Ablehnung (das bleibt dem Reviewer im Wartekorb).
 */

import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SubmissionEditPanel } from '@/components/submissions/submission-edit-panel';
import type { WizardSubmission } from '@/types/wizard-submission';

afterEach(cleanup);

function makeSubmission(over: Partial<WizardSubmission> = {}): WizardSubmission {
  return {
    id: 's1',
    libraryId: 'lib-1',
    status: 'pending',
    createdBy: 'anna@example.com',
    createdByRole: 'contributor',
    wizardId: 'pdf-upload',
    docType: 'testimonial',
    detailViewType: 'testimonial',
    metadata: { title: 'T', author_name: 'Anna' },
    markdownBody: '# Inhalt',
    binaryRefs: [],
    confidence: { title: 0.95 },
    target: {},
    review: {},
    events: [],
    createdAt: '2026-06-11T10:00:00.000Z',
    updatedAt: '2026-06-11T10:00:00.000Z',
    version: 1,
    ...over,
  };
}

it('zeigt Felder + Confidence, aber KEINE Freigabe/Ablehnung', () => {
  const { container } = render(<SubmissionEditPanel submission={makeSubmission()} onSave={vi.fn()} />);
  expect((container.querySelector('#field-title') as HTMLInputElement).value).toBe('T');
  expect(screen.getByText('95%')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ablehnen' })).toBeNull();
});

it('Speichern reicht korrigierte Metadaten + Body durch', () => {
  const onSave = vi.fn();
  const { container } = render(<SubmissionEditPanel submission={makeSubmission()} onSave={onSave} />);
  fireEvent.change(container.querySelector('#field-title') as HTMLInputElement, {
    target: { value: 'Korrigiert' },
  });
  fireEvent.change(container.querySelector('#submission-markdown') as HTMLTextAreaElement, {
    target: { value: '# Neu' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  expect(onSave).toHaveBeenCalledWith({ title: 'Korrigiert', author_name: 'Anna' }, '# Neu');
});

it('hebt fehlende Pflichtfelder hervor, sperrt aber nichts (kein Freigabe-Gate)', () => {
  render(<SubmissionEditPanel submission={makeSubmission({ metadata: { title: 'T', author_name: '' } })} onSave={vi.fn()} />);
  expect(screen.getByText('Pflichtfeld fehlt')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(false);
});
