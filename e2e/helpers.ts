import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, type Locator, type Page } from '@playwright/test'

/** Gespeicherte Login-Session (gitignored, niemals committen) */
export const AUTH_FILE = 'tmp/e2e-auth.json'
/** Namens-Präfix der Test-Bibliotheken — Cleanup löscht alles damit */
export const TEST_PREFIX = 'TEST-Drehbuch'
export const LIB_BUECHER = 'TEST-Drehbuch Bücher'
export const LIB_CLOUD = 'TEST-Drehbuch Cloud'
export const OWNER_EMAIL = 'peter.aichner@crystal-design.com'
/** Quellordner mit der Echtdaten-PDF (siehe Drehbuch-Vorbereitung) */
export const SOURCE_DIR = `${process.cwd()}\\tmp\\testdrehbuch-quelle`

export type StepStatus = 'PASS' | 'FAIL' | 'MANUELL'
export interface StepResult {
  id: string
  titel: string
  status: StepStatus
  detail: string
}

/**
 * Protokolliert Drehbuch-Schritte als PASS/FAIL/MANUELL. Ein fehlgeschlagener
 * Schritt bricht den Lauf NICHT ab (Drehbuch-Abnahme sammelt alle Befunde);
 * bei FAIL entsteht ein Screenshot unter tmp/e2e-results/.
 */
export class Drehbuch {
  private results: StepResult[] = []

  constructor(private aktName: string, private page: Page) {}

  async step(id: string, titel: string, fn: () => Promise<string | void>): Promise<boolean> {
    try {
      const detail = await fn()
      const text = typeof detail === 'string' ? detail : 'ok'
      this.results.push({ id, titel, status: 'PASS', detail: text })
      // eslint-disable-next-line no-console
      console.log(`  PASS ${id}  ${titel} — ${text}`)
      return true
    } catch (error) {
      const msg = error instanceof Error
        ? error.message.replace(/\[\d+m/g, '').split('\n').slice(0, 4).join(' | ')
        : String(error)
      this.results.push({ id, titel, status: 'FAIL', detail: msg })
      mkdirSync('tmp/e2e-results', { recursive: true })
      await this.page
        .screenshot({ path: `tmp/e2e-results/${this.aktName}-${id.replace(/\W/g, '_')}-FAIL.png`, fullPage: true })
        .catch(() => undefined)
      // eslint-disable-next-line no-console
      console.log(`  FAIL ${id}  ${titel} — ${msg}`)
      return false
    }
  }

  manuell(id: string, titel: string, grund: string): void {
    this.results.push({ id, titel, status: 'MANUELL', detail: grund })
  }

  save(): void {
    mkdirSync('tmp/e2e-results', { recursive: true })
    writeFileSync(`tmp/e2e-results/${this.aktName}.json`, JSON.stringify(this.results, null, 2), 'utf8')
  }
}

/** Liest eine Variable direkt aus .env (Next lädt sie selbst — Tests laufen außerhalb) */
export function readEnvVar(name: string): string | undefined {
  try {
    const raw = readFileSync('.env', 'utf8')
    const line = raw.split(/\r?\n/).find(l => l.startsWith(`${name}=`))
    return line?.slice(name.length + 1).trim()
  } catch {
    return undefined
  }
}

interface ClientLibraryLike {
  id: string
  label?: string
  name?: string
  accessRole?: string
}

/** Holt die Bibliotheken des eingeloggten Owners über die API */
export async function getLibraries(page: Page): Promise<ClientLibraryLike[]> {
  // Langes Timeout: der erste AUTHENTIFIZIERTE Hit kompiliert die Route + macht
  // den MongoDB-Cold-Connect und kann so >20s (das Default-actionTimeout) dauern.
  // Zusätzlich bis zu 2 Versuche: der Dev-Server spitzt unter E2E-Last die
  // Antwortzeit gelegentlich über das Timeout — ein zweiter Versuch fängt den
  // transienten Spike ab (sonst kippen Folge-Schritte wie activateLibrary).
  let lastErr: unknown
  for (let versuch = 0; versuch < 2; versuch++) {
    try {
      const res = await page.request.get('/api/libraries', { timeout: 90_000 })
      if (!res.ok()) throw new Error(`GET /api/libraries → HTTP ${res.status()}`)
      const data = (await res.json()) as ClientLibraryLike[]
      if (!Array.isArray(data)) throw new Error('GET /api/libraries lieferte kein Array (nicht eingeloggt?)')
      return data
    } catch (error) {
      lastErr = error
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

const libName = (l: ClientLibraryLike): string => l.label ?? l.name ?? ''

/** Findet die ID einer Test-Bibliothek anhand des Namens (oder null) */
export async function findLibraryId(page: Page, name: string): Promise<string | null> {
  const libs = await getLibraries(page)
  return libs.find(l => libName(l) === name)?.id ?? null
}

/** Löscht alle TEST-Drehbuch-Bibliotheken über die API (Aufräumen vor dem Lauf) */
export async function cleanupTestLibraries(page: Page): Promise<string[]> {
  const libs = await getLibraries(page)
  const targets = libs.filter(l => libName(l).startsWith(TEST_PREFIX))
  for (const lib of targets) {
    const del = await page.request.delete(`/api/libraries?libraryId=${lib.id}`)
    if (!del.ok()) throw new Error(`DELETE ${lib.id} → HTTP ${del.status()}`)
  }
  return targets.map(libName)
}

/** Authentifiziert? GET /api/libraries == 200 mit Array. */
export async function assertAuthenticated(page: Page): Promise<void> {
  await getLibraries(page)
}

/**
 * Aktiviert eine Bibliothek deterministisch über localStorage (so wie der
 * LibrarySwitcher es speichert) statt über die UI. Setzt die ID per
 * addInitScript VOR dem Laden, navigiert, und prüft anschließend hart, dass
 * genau diese Bibliothek aktiv ist — sonst Abbruch (schützt echte Libraries
 * davor, versehentlich bearbeitet zu werden).
 */
export async function activateLibrary(page: Page, name: string): Promise<string> {
  const id = await findLibraryId(page, name)
  if (!id) throw new Error(`Bibliothek "${name}" existiert nicht — Akt 1 muss sie zuerst anlegen`)
  await page.addInitScript(libId => {
    try { window.localStorage.setItem('activeLibraryId', libId) } catch { /* ignore */ }
  }, id)
  await page.goto('/library')
  await dismissReauthDialog(page)
  // Guard: localStorage muss die Test-ID halten (storage-context behält gültige IDs)
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem('activeLibraryId')), { timeout: 30_000 })
    .toBe(id)
  return id
}

/**
 * Settings-Unterseite öffnen. Der Owner ist Creator → kein Gast-Redirect,
 * direkte URL genügt. waitUntil:'domcontentloaded' + Retry gegen sporadische
 * ERR_ABORTED bei Client-Navigationen.
 */
export async function gotoSettings(page: Page, sub: string): Promise<void> {
  const url = `/settings/${sub}`
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
      await dismissReauthDialog(page)
      if (page.url().includes(`/settings/${sub.split('?')[0]}`)) return
    } catch (error) {
      if (versuch === 3) throw error
      await page.waitForTimeout(1500)
    }
  }
  throw new Error(`Konnte ${url} nicht öffnen (aktuell: ${page.url()})`)
}

/** App-Seite öffnen und blockierenden Re-Auth-Dialog wegklicken */
export async function gotoApp(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await dismissReauthDialog(page)
}

/** Toast-/Erfolgsmeldung nach dem Speichern abwarten */
export async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByText(/gespeichert|erfolgreich|gesetzt/i).first()).toBeVisible({ timeout: 15_000 })
}

/**
 * Filtert einen Locator auf die SICHTBAREN Treffer. Die Settings-Seiten rendern
 * ihren Inhalt doppelt (mobile + Desktop-Layout); die erste Kopie ist im
 * Test-Viewport unsichtbar. Ohne diesen Filter trifft `.first()` die versteckte
 * Variante und Aktionen laufen in den Timeout (Befund WP-4).
 */
export function vis(loc: Locator): Locator {
  return loc.filter({ visible: true })
}

/**
 * Löst eine Speichern-Aktion aus und wartet auf die ERFOLGREICHE Library-
 * Mutation statt auf einen Toast. Die Settings-Speichern-Toasts laufen über das
 * nirgends gemountete shadcn-`use-toast` und sind damit unsichtbar (Befund WP-3/
 * WP-4) — der Netzwerk-Effekt ist das verlässliche Erfolgssignal. Abgedeckt:
 * Chat/Explore/Inhaltstyp (PATCH /api/libraries/:id), Verarbeitung
 * (POST /api/libraries), Veröffentlichung (PUT …/public), Einladung
 * (POST …/invites).
 */
export async function saveAndWait(
  page: Page,
  trigger: () => Promise<void>,
  timeout = 30_000,
): Promise<void> {
  const waitResp = page.waitForResponse(
    r =>
      /\/api\/libraries/.test(r.url()) &&
      ['POST', 'PATCH', 'PUT'].includes(r.request().method()) &&
      r.ok(),
    { timeout },
  )
  await trigger()
  await waitResp
}

/**
 * Schließt den globalen „Anmeldung erforderlich"-Re-Auth-Dialog, falls offen.
 * Dieser erscheint beim App-Start automatisch, sobald irgendeine OneDrive-
 * Bibliothek abgelaufene Tokens hat (z. B. „Onedrive Test"), und blockiert mit
 * einem Vollbild-Overlay JEDE Interaktion. „Später" gibt die UI frei.
 * (Befund dokumentiert — entspricht dem globalen Re-Auth-Verhalten aus 2.4.)
 */
export async function dismissReauthDialog(page: Page): Promise<boolean> {
  const dlg = page.getByRole('dialog').filter({ hasText: 'Anmeldung erforderlich' })
  for (let v = 0; v < 2; v++) {
    if (await dlg.first().isVisible().catch(() => false)) {
      await dlg.getByRole('button', { name: 'Später' }).click().catch(() => page.keyboard.press('Escape'))
      await dlg.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined)
      return true
    }
    await page.waitForTimeout(1200) // Dialog erscheint asynchron nach dem Token-Check
  }
  return false
}

/** App geladen + eingeloggt: Switcher sichtbar; blockierenden Re-Auth-Dialog wegklicken */
export async function waitForApp(page: Page): Promise<void> {
  await expect(page.getByLabel('Bibliothek auswählen')).toBeVisible({ timeout: 60_000 })
  await dismissReauthDialog(page)
}

/**
 * Legt eine Bibliothek über den Bibliotheks-Switcher an: „Neue Bibliothek
 * erstellen" → Dialog (Name) → „Erstellen". Bewusst NICHT über die
 * /settings-Übersicht — die ist in Automation wegen des Cold-Load-Redirects
 * (settings-client prüft isCreator gegen noch leere libraries) nicht stabil
 * erreichbar. Daher wird die Inhaltstyp-KARTE hier nicht ausgewählt; die neue
 * Bibliothek startet mit den Default-Werten (Befund zu 1.2 im Bericht).
 */
export async function createLibraryViaUi(page: Page, name: string): Promise<string> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForApp(page)
  await page.getByLabel('Bibliothek auswählen').click()
  await page.getByRole('option', { name: 'Neue Bibliothek erstellen' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.locator('#library-name').waitFor({ state: 'visible', timeout: 15_000 })
  await dlg.locator('#library-name').fill(name)
  await dlg.getByRole('button', { name: 'Erstellen' }).click()
  await expect.poll(() => findLibraryId(page, name), { timeout: 30_000 }).not.toBeNull()
  const id = await findLibraryId(page, name)
  if (!id) throw new Error(`Anlage von "${name}" nicht über die API bestätigt`)
  return id
}

/**
 * Legt eine Bibliothek über den NEUEN Anlage-Wizard an (A–E-Flow):
 * `/start` → „Neue Bibliothek" → `CreateLibraryWizard` (Name + Inhaltstyp-Karte)
 * → „Bibliothek erstellen". Anders als der Switcher-Dialog kann hier die
 * Inhaltstyp-Karte gewählt werden (Standard: „Bücher & Dokumente" = book).
 * Wir verlassen uns NICHT auf die Auto-Weiterleitung des Hooks, sondern
 * bestätigen die Anlage über die API.
 */
export async function createLibraryViaWizard(
  page: Page,
  name: string,
  contentType: RegExp = /Bücher & Dokumente/,
): Promise<string> {
  await page.goto('/start', { waitUntil: 'domcontentloaded' })
  await dismissReauthDialog(page)
  await vis(page.getByRole('button', { name: /Neue Bibliothek/i })).first().click({ timeout: 30_000 })
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Name').waitFor({ state: 'visible', timeout: 15_000 })
  await dlg.getByLabel('Name').fill(name)
  // Inhaltstyp-Karte (role=button) auswählen
  await dlg.locator('[role="button"]').filter({ hasText: contentType }).first().click()
  await dlg.getByRole('button', { name: 'Bibliothek erstellen' }).click()
  // 60s: der ERSTE POST /api/libraries kompiliert die Route + schreibt MongoDB
  // (kalt > 30s) — die Bibliothek erscheint im GET erst nach dem Commit.
  await expect.poll(() => findLibraryId(page, name), { timeout: 60_000 }).not.toBeNull()
  const id = await findLibraryId(page, name)
  if (!id) throw new Error(`Wizard-Anlage von "${name}" nicht über die API bestätigt`)
  return id
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend-Invarianten für den Inbox-/Submission-Flow (Welle II/III, WP-3)
//
// E2E prüft nicht nur die UX, sondern auch Backend-Fakten, die der Browser nicht
// zeigt: Submission-Status, Inbox-Blob-Pfad, providerScope des Analyse-Jobs.
// Direkt-Zugriff auf MongoDB wie in den Spotchecks (S3).
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal getypte Sicht auf ein wizard_submissions-Dokument. */
export interface SubmissionDocLike {
  _id?: unknown
  libraryId?: string
  status?: string
  createdBy?: string
  createdByRole?: string
  detailViewType?: string
  binaryRefs?: Array<{ url?: string; itemId?: string; contentType?: string }>
  createdAt?: string
  updatedAt?: string
}

/** Minimal getypte Sicht auf ein external_jobs-Dokument. */
export interface JobDocLike {
  jobId?: string
  providerScope?: string
  status?: string
  correlation?: { options?: { submissionId?: string } }
}

/** Öffnet eine MongoDB-Verbindung aus .env, führt `fn` aus, schließt sicher. */
export async function withMongo<T>(fn: (db: import('mongodb').Db) => Promise<T>): Promise<T> {
  const { MongoClient } = await import('mongodb')
  const uri = readEnvVar('MONGODB_URI')
  const dbName = readEnvVar('MONGODB_DATABASE_NAME')
  if (!uri || !dbName) throw new Error('MONGODB_URI / MONGODB_DATABASE_NAME nicht aus .env lesbar')
  const client = new MongoClient(uri)
  try {
    await client.connect()
    return await fn(client.db(dbName))
  } finally {
    await client.close()
  }
}

/** Neueste Submission einer Library (optional gefiltert auf einen Erfasser). */
export async function findLatestSubmission(
  libraryId: string,
  createdBy?: string,
): Promise<SubmissionDocLike | null> {
  return withMongo(async db => {
    const filter: Record<string, unknown> = { libraryId }
    if (createdBy) filter.createdBy = createdBy.toLowerCase()
    const docs = await db
      .collection<SubmissionDocLike>('wizard_submissions')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()
    return docs[0] ?? null
  })
}

/** Analyse-Job zu einer Submission (correlation.options.submissionId). */
export async function findAnalyzeJob(submissionId: string): Promise<JobDocLike | null> {
  return withMongo(async db => {
    const doc = await db
      .collection<JobDocLike>('external_jobs')
      .findOne({ 'correlation.options.submissionId': submissionId })
    return doc ?? null
  })
}

/** Invariante: Binärquelle liegt im Inbox-Bereich, nie im Ziel-Archiv (ADR-0004). */
export function assertInboxBinaryRef(sub: SubmissionDocLike): string {
  const ref = sub.binaryRefs?.[0]
  if (!ref) throw new Error('Submission hat keine binaryRefs')
  const where = ref.itemId ?? ref.url ?? ''
  if (!where.includes('/inbox/')) {
    throw new Error(`Binärquelle nicht im Inbox-Bereich: ${where.slice(0, 80)}`)
  }
  return where
}
