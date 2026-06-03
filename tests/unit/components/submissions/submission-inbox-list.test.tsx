// @vitest-environment jsdom
/**
 * Tests fuer die Inbox-Liste (ADR-0004, W4): Titel/Fallback, Status-Label,
 * Auswahl-Callback.
 */

import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SubmissionInboxList } from '@/components/submissions/submission-inbox-list';
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

it('zeigt einen Leer-Hinweis bei leerer Liste', () => {
  render(<SubmissionInboxList submissions={[]} onSelect={() => {}} />);
  expect(screen.getByText('Keine Beitraege in der Inbox.')).toBeTruthy();
});

it('zeigt Titel (oder docType-Fallback) + Status-Label und ruft onSelect', () => {
  const onSelect = vi.fn();
  render(
    <SubmissionInboxList
      onSelect={onSelect}
      submissions={[
        makeSubmission({ id: 'a', metadata: { title: 'Mein Titel' } }),
        makeSubmission({ id: 'b', metadata: {}, status: 'ready' }),
      ]}
    />,
  );

  expect(screen.getByText('Mein Titel')).toBeTruthy();
  // Fallback auf docType, wenn kein Titel
  expect(screen.getByText('testimonial')).toBeTruthy();
  // Status-Labels (exhaustive Map)
  expect(screen.getByText('Offen')).toBeTruthy();
  expect(screen.getByText('Freigegeben')).toBeTruthy();

  fireEvent.click(screen.getByText('Mein Titel'));
  expect(onSelect).toHaveBeenCalledWith('a');
});
