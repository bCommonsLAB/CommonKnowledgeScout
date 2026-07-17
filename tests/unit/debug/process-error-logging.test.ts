/**
 * Tests fuer das Prozess-Fehler-Logging (Crash-Haertung 1b, Variante C):
 * registriert idempotent Diagnose-Listener und loggt unbehandelte Fehler ueber
 * den FileLogger. Ziel ist injizierbar (eigener EventEmitter statt `process`).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { registerProcessErrorLogging } from '@/lib/debug/process-error-logging';
import { FileLogger } from '@/lib/debug/logger';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('registerProcessErrorLogging', () => {
  it('registriert uncaughtExceptionMonitor + unhandledRejection genau einmal (idempotent)', () => {
    const target = new EventEmitter();
    registerProcessErrorLogging(target);
    registerProcessErrorLogging(target); // zweiter Aufruf -> kein zweiter Listener
    expect(target.listenerCount('uncaughtExceptionMonitor')).toBe(1);
    expect(target.listenerCount('unhandledRejection')).toBe(1);
  });

  it('loggt eine unhandledRejection ueber den FileLogger', () => {
    const spy = vi.spyOn(FileLogger, 'error').mockImplementation(() => ({}) as never);
    const target = new EventEmitter();
    registerProcessErrorLogging(target);

    target.emit('unhandledRejection', new Error('boom'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toContain('unhandledRejection');
  });
});
