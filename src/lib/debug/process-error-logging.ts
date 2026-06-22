/**
 * @fileoverview Prozess-weites Fehler-Logging fuer Diagnose (Crash-Haertung 1b, Variante C).
 *
 * @description
 * Registriert idempotent Listener fuer `uncaughtExceptionMonitor` und
 * `unhandledRejection`, damit ein abstuerzender (Dev-)Server seine Ursache noch
 * ueber den `FileLogger` protokolliert, statt kommentarlos zu sterben (Symptom:
 * ERR_EMPTY_RESPONSE -> ERR_CONNECTION_REFUSED).
 *
 * Bewusst NICHT abgefangen: Ein echtes Heap-OOM (V8 Fatal Error) beendet den
 * Prozess hart und erreicht diese JS-Listener nicht — dagegen hilft nur der
 * Groessen-Guard (`capture-size-guard.ts`). Dieses Modul ergaenzt die Diagnose
 * fuer alle ANDEREN unbehandelten Fehler.
 *
 * `uncaughtExceptionMonitor` ist bewusst gewaehlt: er beobachtet nur und
 * veraendert Nodes Default-Verhalten (Stack ausgeben + beenden) NICHT — kein
 * stilles Weiterlaufen in einem undefinierten Zustand.
 *
 * @module lib/debug
 */

import { FileLogger } from '@/lib/debug/logger';

/**
 * Globales Flag (am Ziel-Objekt abgelegt). Robust gegen HMR/Mehrfach-Import: das
 * Flag lebt auf `process` selbst, nicht in modul-lokalem State.
 */
const REGISTERED_FLAG = Symbol.for('cks.processErrorLogging.registered');

/**
 * Registriert die Prozess-Fehler-Listener genau einmal pro Ziel (idempotent).
 * Das Ziel ist injizierbar (Tests reichen einen eigenen `EventEmitter`).
 */
export function registerProcessErrorLogging(target: NodeJS.EventEmitter = process): void {
  const flagged = target as unknown as Record<symbol, boolean | undefined>;
  if (flagged[REGISTERED_FLAG]) return;
  flagged[REGISTERED_FLAG] = true;

  target.on('uncaughtExceptionMonitor', (error: unknown) => {
    FileLogger.error('process-error-logging', 'uncaughtException – Prozess beendet sich gleich', error);
  });
  target.on('unhandledRejection', (reason: unknown) => {
    FileLogger.error('process-error-logging', 'unhandledRejection', reason);
  });
}
