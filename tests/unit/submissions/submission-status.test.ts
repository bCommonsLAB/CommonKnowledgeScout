/**
 * Tests fuer die reine Status-Maschine der Submissions (ADR-0004, W1):
 * Lebenszyklus, Reinheit der Uebergangsfunktion, explizite Fehler.
 */

import { describe, expect, it } from 'vitest';
import {
  INITIAL_STATUSES,
  InvalidSubmissionTransitionError,
  STATUS_TRANSITIONS,
  SUBMISSION_STATUSES,
  TERMINAL_STATUSES,
  assertTransition,
  buildStatusChangeEvent,
  canTransition,
  isInitialStatus,
  isSubmissionStatus,
  isTerminalStatus,
  transitionSubmission,
} from '@/lib/submissions/submission-status';
import type { WizardSubmission } from '@/types/wizard-submission';

function makeSubmission(overrides: Partial<WizardSubmission> = {}): WizardSubmission {
  return {
    id: 'sub-1',
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
    events: [{ type: 'created', toStatus: 'pending', actor: 'anna@example.com', at: 'T0' }],
    createdAt: 'T0',
    updatedAt: 'T0',
    version: 1,
    ...overrides,
  };
}

describe('Status-Konstanten + Graph', () => {
  it('enthaelt genau die 6 Status', () => {
    expect([...SUBMISSION_STATUSES].sort()).toEqual(
      ['draft', 'pending', 'published', 'publishing', 'ready', 'rejected'],
    );
  });

  it('initiale Status sind draft + pending, terminale published + rejected', () => {
    expect(isInitialStatus('draft')).toBe(true);
    expect(isInitialStatus('pending')).toBe(true);
    expect(isInitialStatus('ready')).toBe(false);
    expect([...INITIAL_STATUSES].sort()).toEqual(['draft', 'pending']);
    expect(isTerminalStatus('published')).toBe(true);
    expect(isTerminalStatus('rejected')).toBe(true);
    expect(isTerminalStatus('publishing')).toBe(false);
    expect([...TERMINAL_STATUSES].sort()).toEqual(['published', 'rejected']);
  });

  it('jeder Folge-Status im Graph ist selbst ein gueltiger Status (keine Tippfehler)', () => {
    const valid = new Set<string>(SUBMISSION_STATUSES);
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      expect(valid.has(from)).toBe(true);
      for (const to of targets) expect(valid.has(to)).toBe(true);
    }
  });

  it('terminale Status haben keine ausgehenden Uebergaenge', () => {
    expect(STATUS_TRANSITIONS.published).toEqual([]);
    expect(STATUS_TRANSITIONS.rejected).toEqual([]);
  });
});

describe('isSubmissionStatus (Type-Guard)', () => {
  it('akzeptiert gueltige, verwirft alles andere', () => {
    expect(isSubmissionStatus('ready')).toBe(true);
    expect(isSubmissionStatus('gibtsnicht')).toBe(false);
    expect(isSubmissionStatus(42)).toBe(false);
  });
});

describe('canTransition / assertTransition', () => {
  it('erlaubt die dokumentierten Vorwaerts-Uebergaenge', () => {
    expect(canTransition('draft', 'pending')).toBe(true);
    expect(canTransition('pending', 'ready')).toBe(true);
    expect(canTransition('ready', 'publishing')).toBe(true);
    expect(canTransition('publishing', 'published')).toBe(true);
  });

  it('erlaubt Ablehnung aus draft/pending/ready und den Job-Ruecksprung', () => {
    expect(canTransition('draft', 'rejected')).toBe(true);
    expect(canTransition('pending', 'rejected')).toBe(true);
    expect(canTransition('ready', 'rejected')).toBe(true);
    expect(canTransition('publishing', 'ready')).toBe(true);
  });

  it('verbietet Spruenge und Uebergaenge aus terminalen Status', () => {
    expect(canTransition('draft', 'ready')).toBe(false);
    expect(canTransition('pending', 'published')).toBe(false);
    expect(canTransition('published', 'pending')).toBe(false);
    expect(canTransition('rejected', 'pending')).toBe(false);
  });

  it('assertTransition wirft mit from/to bei ungueltigem Uebergang', () => {
    expect(() => assertTransition('pending', 'ready')).not.toThrow();
    try {
      assertTransition('published', 'pending');
      throw new Error('sollte werfen');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSubmissionTransitionError);
      const e = error as InvalidSubmissionTransitionError;
      expect(e.from).toBe('published');
      expect(e.to).toBe('pending');
    }
  });
});

describe('buildStatusChangeEvent', () => {
  it('baut den Event und nimmt note nur bei vorhandenem Wert auf', () => {
    const base = buildStatusChangeEvent('pending', { to: 'ready', actor: 'rev@x.de', at: 'T1' });
    expect(base).toEqual({
      type: 'status-changed',
      fromStatus: 'pending',
      toStatus: 'ready',
      actor: 'rev@x.de',
      at: 'T1',
    });
    expect(base).not.toHaveProperty('note');
    const withNote = buildStatusChangeEvent('ready', {
      to: 'rejected',
      actor: 'rev@x.de',
      at: 'T2',
      note: 'unvollstaendig',
    });
    expect(withNote.note).toBe('unvollstaendig');
  });
});

describe('transitionSubmission (rein)', () => {
  it('Freigabe pending->ready: Status, version, Event, updatedAt + review gesetzt', () => {
    const current = makeSubmission({ status: 'pending', version: 3 });
    const next = transitionSubmission(current, { to: 'ready', actor: 'Rev@X.de', at: 'T1' });
    expect(next.status).toBe('ready');
    expect(next.version).toBe(4);
    expect(next.updatedAt).toBe('T1');
    expect(next.events).toHaveLength(2);
    expect(next.events[1]).toMatchObject({ type: 'status-changed', fromStatus: 'pending', toStatus: 'ready' });
    expect(next.review).toEqual({ reviewedBy: 'Rev@X.de', reviewedAt: 'T1' });
  });

  it('mutiert die Eingabe nicht (reine Funktion)', () => {
    const current = makeSubmission({ status: 'pending', version: 1 });
    transitionSubmission(current, { to: 'ready', actor: 'rev', at: 'T1' });
    expect(current.status).toBe('pending');
    expect(current.version).toBe(1);
    expect(current.events).toHaveLength(1);
    expect(current.review).toEqual({});
  });

  it('draft->pending setzt KEIN review', () => {
    const next = transitionSubmission(makeSubmission({ status: 'draft' }), {
      to: 'pending',
      actor: 'anna@example.com',
      at: 'T1',
    });
    expect(next.status).toBe('pending');
    expect(next.review).toEqual({});
  });

  it('Job-Ruecksprung publishing->ready setzt KEIN review (keine Reviewer-Aktion)', () => {
    const current = makeSubmission({ status: 'publishing', review: { reviewedBy: 'old', reviewedAt: 'T0' } });
    const next = transitionSubmission(current, { to: 'ready', actor: 'promotion-job', at: 'T9' });
    expect(next.status).toBe('ready');
    // review bleibt unveraendert (kein Ueberschreiben durch den Job)
    expect(next.review).toEqual({ reviewedBy: 'old', reviewedAt: 'T0' });
  });

  it('Ablehnung setzt review inkl. note', () => {
    const next = transitionSubmission(makeSubmission({ status: 'ready' }), {
      to: 'rejected',
      actor: 'rev@x.de',
      at: 'T2',
      note: 'Quelle fehlt',
    });
    expect(next.status).toBe('rejected');
    expect(next.review).toEqual({ reviewedBy: 'rev@x.de', reviewedAt: 'T2', note: 'Quelle fehlt' });
  });

  it('wirft bei ungueltigem Uebergang (kein stiller Fallback)', () => {
    const current = makeSubmission({ status: 'published' });
    expect(() => transitionSubmission(current, { to: 'pending', actor: 'x', at: 'T1' })).toThrow(
      InvalidSubmissionTransitionError,
    );
  });
});
