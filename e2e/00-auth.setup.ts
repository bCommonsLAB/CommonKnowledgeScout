import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { AUTH_FILE } from './helpers'

/**
 * Einmaliger Owner-Login. Anmelde-Indikator ist NICHT ein beliebiger Combobox
 * (den gibt es auch öffentlich), sondern `GET /api/libraries == 200` mit
 * JSON-Array — das gelingt nur authentifiziert. Ist tmp/e2e-auth.json schon
 * gültig, läuft das Setup unsichtbar durch; sonst bleibt das (sichtbare,
 * echte Chrome-)Fenster offen, bis die Anmeldung steht (max. 4 Min).
 */
test('Login-Session bereitstellen', async ({ browser }) => {
  test.setTimeout(300_000)
  const context = await browser.newContext({
    storageState: existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  })
  const page = await context.newPage()
  await setupClerkTestingToken({ page })

  // Resilient gegen den teuren ERSTEN authentifizierten Hit: /api/libraries
  // kompiliert die Route + verbindet MongoDB und kann so >20s brauchen. Langes
  // Per-Request-Timeout + catch->false, damit ein transienter Timeout das
  // Login-Polling NICHT abbricht (sonst wird die Session nie gespeichert).
  const isAuthed = async (): Promise<boolean> => {
    try {
      const res = await page.request.get('/api/libraries', { timeout: 90_000 })
      if (res.status() !== 200) return false
      const body = await res.json().catch(() => null)
      return Array.isArray(body)
    } catch {
      return false
    }
  }

  await page.goto('/')
  await page.waitForTimeout(3000)

  if (!(await isAuthed())) {
    // Anmeldeseite öffnen und auf erfolgreichen Login warten
    await page.goto('/sign-in').catch(() => undefined)
    console.log('\n>>> Bitte im geöffneten Chrome-Fenster als Owner anmelden (Google) — der Test wartet (max. 4 Min). <<<\n')
    await expect
      .poll(isAuthed, { timeout: 240_000, intervals: [3000] })
      .toBe(true)
  }

  // Vollständige Session (inkl. Clerk __client) sichern
  await context.storageState({ path: AUTH_FILE })

  // Gegenprobe: __client wurde erfasst — sonst scheitern die headless-Läufe
  const saved = JSON.parse((await import('node:fs')).readFileSync(AUTH_FILE, 'utf8'))
  const hasClient = saved.cookies.some((c: { name: string }) => c.name === '__client')
  console.log(`Session gespeichert — __client erfasst: ${hasClient}`)

  await context.close()
})
