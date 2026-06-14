/**
 * Tests fuer die reine Fehler-Klassifikation der Publikation (ADR-0004 §E3, W5):
 * Token/Auth (Re-Auth) vs. Netz/Speicher (Backoff) vs. Konfig vs. unbekannt.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyPromotionError,
  PromotionTargetMissingError,
} from '@/lib/submissions/promotion-errors';
import { StorageError } from '@/lib/storage/types';

describe('classifyPromotionError', () => {
  it('AUTH_ERROR -> auth, Re-Auth noetig, retry-bar', () => {
    const failure = classifyPromotionError(new StorageError('Zugriff verweigert', 'AUTH_ERROR', 'onedrive'));
    expect(failure).toMatchObject({
      kind: 'auth',
      retryable: true,
      needsReauth: true,
      code: 'AUTH_ERROR',
    });
  });

  it('AUTH_REQUIRED -> auth (Token fehlt)', () => {
    expect(classifyPromotionError(new StorageError('Nicht authentifiziert', 'AUTH_REQUIRED')).kind).toBe('auth');
  });

  it.each(['NETWORK_ERROR', 'API_ERROR', 'RATE_LIMIT_ERROR', 'UNKNOWN_ERROR', 'NOT_FOUND'])(
    '%s -> storage (Backoff), kein Re-Auth, retry-bar',
    (code) => {
      const failure = classifyPromotionError(new StorageError('boom', code));
      expect(failure).toMatchObject({ kind: 'storage', retryable: true, needsReauth: false, code });
    },
  );

  it('PromotionTargetMissingError -> config, nicht retry-bar', () => {
    const failure = classifyPromotionError(new PromotionTargetMissingError('sub-1'));
    expect(failure).toMatchObject({ kind: 'config', retryable: false, needsReauth: false });
    expect(failure.message).toContain('sub-1');
  });

  it('unbekannter Fehler -> unknown, retry-bar (kein Hard-Fail)', () => {
    expect(classifyPromotionError(new Error('boom'))).toMatchObject({ kind: 'unknown', retryable: true });
    expect(classifyPromotionError('weird')).toMatchObject({ kind: 'unknown', retryable: true, needsReauth: false });
  });
});
