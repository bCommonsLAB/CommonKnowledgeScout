// @vitest-environment node
/**
 * Waechter fuer die External-Jobs-Ausnahme der Middleware (Befund 18.11.2026).
 *
 * Frueher war JEDER POST unter `/api/external/jobs/` anonym erreichbar (ausser
 * `/stream`) — damit auch `POST /api/external/jobs/worker`: Mit
 * `{"action":"stop"}` konnte jeder den Prod-Worker anhalten. Seitdem gilt eine
 * Positivliste (`isAnonymousExternalJobsRoute`): Secretary-Callback, Worker-Start
 * und internal/create. Alles andere braucht eine Clerk-Session.
 *
 * Teil 1 prueft die Regel Pfad fuer Pfad. Teil 2 faehrt die echte Middleware mit
 * gemocktem Clerk und zeigt, dass ein anonymer POST auf `/worker` in
 * `auth.protect()` landet, der Callback dagegen nicht.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { isAnonymousExternalJobsRoute } from '@/lib/external-jobs/anonymous-routes'

const JOB = '2abe2a40-6f1c-4d8e-9b7a-0c3d5e7f9a1b'
const BASE = '/api/external/jobs'

describe('isAnonymousExternalJobsRoute: Positivliste', () => {
  it('laesst den Secretary-Callback POST /:jobId durch', () => {
    expect(isAnonymousExternalJobsRoute('POST', `${BASE}/${JOB}`)).toBe(true)
  })

  it('laesst den Worker-Start POST /:jobId/start durch', () => {
    expect(isAnonymousExternalJobsRoute('POST', `${BASE}/${JOB}/start`)).toBe(true)
  })

  it('laesst internal/create durch (Route verlangt selbst X-Internal-Token)', () => {
    expect(isAnonymousExternalJobsRoute('POST', `${BASE}/internal/create`)).toBe(true)
  })

  it('akzeptiert die Job-Kennung auch in Grossbuchstaben', () => {
    expect(isAnonymousExternalJobsRoute('POST', `${BASE}/${JOB.toUpperCase()}`)).toBe(true)
  })
})

describe('isAnonymousExternalJobsRoute: alles andere braucht eine Session', () => {
  it('sperrt die Verwaltungsrouten neben /:jobId', () => {
    for (const route of ['worker', 'start-batch', 'retry-batch', 'batches', 'counters', 'stream']) {
      expect(isAnonymousExternalJobsRoute('POST', `${BASE}/${route}`), route).toBe(false)
    }
  })

  it('sperrt eine kuenftige statische Route, ohne dass sie jemand eintragen muss', () => {
    expect(isAnonymousExternalJobsRoute('POST', `${BASE}/reaper`)).toBe(false)
    expect(isAnonymousExternalJobsRoute('POST', `${BASE}/internal/cleanup`)).toBe(false)
  })

  it('sperrt andere Unterpfade eines Jobs', () => {
    for (const sub of ['markdown', 'trace', 'download-archive', 'stream', 'start/extra']) {
      expect(isAnonymousExternalJobsRoute('POST', `${BASE}/${JOB}/${sub}`), sub).toBe(false)
    }
  })

  it('sperrt GET und DELETE auch auf den offenen Pfaden', () => {
    for (const method of ['GET', 'DELETE', 'PUT', 'PATCH']) {
      expect(isAnonymousExternalJobsRoute(method, `${BASE}/${JOB}`), method).toBe(false)
      expect(isAnonymousExternalJobsRoute(method, `${BASE}/${JOB}/start`), method).toBe(false)
      expect(isAnonymousExternalJobsRoute(method, `${BASE}/internal/create`), method).toBe(false)
    }
  })

  it('sperrt Pfade, die nur aehnlich aussehen', () => {
    for (const path of [`${BASE}/`, `${BASE}/worker/`, `${BASE}/${JOB}/`, `${BASE}/${JOB}x`, `${BASE}/abc`, `/api/external/jobsx/${JOB}`]) {
      expect(isAnonymousExternalJobsRoute('POST', path), path).toBe(false)
    }
  })
})

// --- Teil 2: die echte Middleware mit gemocktem Clerk -----------------------

const h = vi.hoisted(() => ({ protect: vi.fn(), auth: vi.fn() }))

vi.mock('@clerk/nextjs/server', () => {
  type Handler = (auth: unknown, req: NextRequest) => Promise<unknown>
  return {
    clerkMiddleware: (handler: Handler) => handler,
    // Clerk-Muster wie '/docs(.*)' sind gueltige regulaere Ausdruecke.
    createRouteMatcher: (patterns: string[]) => (req: NextRequest) =>
      patterns.some((p) => new RegExp(`^${p}$`).test(req.nextUrl.pathname)),
  }
})

type MiddlewareFn = (auth: unknown, req: NextRequest) => Promise<unknown>

async function rufe(method: string, path: string): Promise<void> {
  const mod = (await import('@/middleware')) as unknown as { default: MiddlewareFn }
  const auth = Object.assign(h.auth, { protect: h.protect })
  await mod.default(auth, new NextRequest(`http://localhost${path}`, { method }))
}

describe('Middleware: External Jobs mit und ohne Session', () => {
  beforeEach(() => {
    h.auth.mockReset().mockResolvedValue({ userId: null })
    // Clerk maskiert anonyme Anfragen als 404 — hier als Fehler nachgebildet.
    h.protect.mockReset().mockRejectedValue(new Error('NEXT_HTTP_ERROR_FALLBACK;404'))
  })

  it('weist einen anonymen POST auf /worker ab', async () => {
    await expect(rufe('POST', `${BASE}/worker`)).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(h.protect).toHaveBeenCalledTimes(1)
  })

  it('weist auch start-batch und retry-batch anonym ab', async () => {
    await expect(rufe('POST', `${BASE}/start-batch`)).rejects.toThrow()
    await expect(rufe('POST', `${BASE}/retry-batch`)).rejects.toThrow()
    expect(h.protect).toHaveBeenCalledTimes(2)
  })

  it('laesst Secretary-Callback und Worker-Start ohne Session durch', async () => {
    await rufe('POST', `${BASE}/${JOB}`)
    await rufe('POST', `${BASE}/${JOB}/start`)
    expect(h.protect).not.toHaveBeenCalled()
  })

  it('angemeldet kommt der POST auf /worker durch', async () => {
    h.protect.mockReset().mockResolvedValue(undefined)
    await rufe('POST', `${BASE}/worker`)
    expect(h.protect).toHaveBeenCalledTimes(1)
  })
})
