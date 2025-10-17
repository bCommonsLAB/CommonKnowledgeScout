// Zentrale Logger-Klasse: vereinheitlicht Logging über Console, FileLogger und Elastic APM
// - Kein Start des APM-Agents hier: Initialisierung erfolgt via NODE_OPTIONS Preload
// - Fällt robust auf Console zurück, wenn APM nicht verfügbar ist

import { FileLogger } from '@/lib/debug/logger'

interface LogFields { [key: string]: string | number | boolean | null | undefined }

interface LogOptions { labels?: LogFields }

function getApmLogger(): typeof import('@/lib/observability/apm-logger') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req = (0, eval)('require') as NodeRequire
    return req('./apm-logger')
  } catch {
    return null
  }
}

interface ApmApi {
  startApmTransaction: (name: string, type?: string) => { end?: () => void } | null
  getTraceIds: () => Record<string, unknown>
}

function getApmApi(): ApmApi | null {
  try {
    console.log('getApmApi: 1')
    if (typeof window !== 'undefined') return null
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    console.log('getApmApi: 2')
    const req = (0, eval)('require') as NodeRequire
    return req('./apm') as ApmApi
  } catch (error) {
    console.error('getApmApi: error', error)
    return null
  }
}

export class Logger {
  static info(component: string, message: string, fields?: LogFields): void {
    FileLogger.info(component, message, fields)
    try { console.info(`${component}: ${message}`, fields ?? {}) } catch {}
  }

  static warn(component: string, message: string, fields?: LogFields): void {
    FileLogger.warn(component, message, fields)
    try { console.warn(`${component}: ${message}`, fields ?? {}) } catch {}
  }

  static error(component: string, message: string, fields?: LogFields): void {
    FileLogger.error(component, message, fields)
    try { console.error(`${component}: ${message}`, fields ?? {}) } catch {}
    try {
      const apmLogger = getApmLogger()
      apmLogger?.captureError?.(new Error(message), fields)
    } catch {}
  }

  // Event-Logging als kurzer APM-Span plus strukturierte Logs
  static async event(component: string, name: string, fields?: LogFields): Promise<void> {
    console.log('event: component', component, 'name', name, 'fields', fields)
    const apmLogger = getApmLogger()
    if (apmLogger) {
      console.log('event: apmLogger found', apmLogger)
      await apmLogger.withStep?.(`${component}.${name}`, async () => { /* noop step */ })
    } else {
      // Fallback: kurzer Sync-Span nur wenn Agent da ist
      console.log('event: apmLogger not found')
      const apm = getApmApi()
      if (apm) {
        console.log('event: apm found', apm)
        const tx = apm.startApmTransaction?.(`${component}.${name}`, 'log')
        console.log('event: tx', tx)
        try {
          console.log('event: noop')
        } finally {
          try { tx?.end?.() } catch (error) { console.error('event: error ending transaction', error) }
          console.log('event: finally')
        }
      } else {
        console.log('event: apm not found in getApmApi')
      }
    }
    console.log('event: FileLogger.info')
    FileLogger.info(component, `event:${name}`, fields)
  }

  // Transaktion umschließen (z. B. Jobs, Worker, Pipelines)
  static startJob(name: string, type: string, labels?: LogFields): { end: () => void } {
    const apmLogger = getApmLogger()
    if (apmLogger) {
      const ctx = apmLogger.startJobTx(name, type, labels)
      return { end: () => { try { apmLogger.endJobTx(ctx) } catch {} } }
    }
    const apm = getApmApi()
    const tx = apm?.startApmTransaction?.(name, type)
    return { end: () => { try { tx?.end?.() } catch {} } }
  }

  // Trace-IDs bereitstellen (z. B. für Debug-Logs)
  static getTraceIds(): Record<string, unknown> {
    try { return getApmApi()?.getTraceIds?.() ?? {} } catch { return {} }
  }
}


