import { expect, test } from './fixtures'
import { Drehbuch, OWNER_EMAIL, TEST_PREFIX, assertAuthenticated, readEnvVar } from './helpers'

/**
 * Sicherheits-Spotchecks S1–S4 (+ Zusatzbefund Auth-Bypass).
 * S3 liest direkt in MongoDB (nur das Feld shadowTwin der TEST-Bibliothek).
 * Ergebnis: tmp/e2e-results/spotchecks.json
 */
test('Sicherheits-Spotchecks (S1–S4)', async ({ page, playwright }) => {
  test.setTimeout(300_000)
  const d = new Drehbuch('spotchecks', page)

  try {
    await d.step('S1', 'GET /api/libraries: Secrets maskiert (D5)', async () => {
      await page.goto('/')
      await assertAuthenticated(page)
      // Ein Retry gegen sporadische Hänger unter Last
      let body = ''
      for (let v = 1; v <= 2; v++) {
        try {
          const res = await page.request.get('/api/libraries', { timeout: 45_000 })
          body = await res.text()
          break
        } catch (e) {
          if (v === 2) throw e
          await page.waitForTimeout(2000)
        }
      }
      const probleme: string[] = []
      for (const feld of ['connectionString', 'clientSecret', 'appPassword']) {
        for (const m of body.match(new RegExp(`"${feld}":"([^"]+)"`, 'g')) ?? [])
          if (!m.includes('********')) probleme.push(m.slice(0, 48))
      }
      for (const m of body.match(/"apiKey":"([^"]{12,})"/g) ?? []) {
        if (!(m.includes('…') || /\*{4,}/.test(m) || /\.{6,}/.test(m))) probleme.push(`apiKey unmaskiert: ${m.slice(0, 28)}…`)
      }
      if (probleme.length) throw new Error(`Unmaskierte Secrets: ${probleme.join(' | ')}`)
      return `Response geprüft (${body.length} Zeichen) — Secret-Felder maskiert`
    })

    await d.step('S1b', 'Zusatzcheck: ?email=-Parameter darf Auth nicht umgehen', async () => {
      const anon = await playwright.request.newContext({ baseURL: 'http://localhost:3000' })
      let status = 0
      let count = -1
      try {
        const res = await anon.get(`/api/libraries?email=${encodeURIComponent(OWNER_EMAIL)}`, { timeout: 12_000 })
        status = res.status()
        if (res.ok()) {
          const json = (await res.json().catch(() => null)) as unknown
          count = Array.isArray(json) ? json.length : -1
        }
      } catch {
        // Timeout/Abbruch = kein anonymer Datenzugriff → in Ordnung
      } finally {
        await anon.dispose()
      }
      if (status === 200 && count > 0)
        throw new Error(`ANONYM lesbar: ?email=<adresse> liefert ${count} fremde Bibliotheken (umgeht auth())`)
      return `kein anonymer Zugriff (HTTP ${status || 'timeout'}, Einträge: ${count})`
    })

    d.manuell(
      'S2',
      'Masken-Guard: Verarbeitung speichern lässt echten API-Key unangetastet',
      'TEST-Bibliothek hat keinen Secretary-API-Key — aussagekräftig nur mit konfiguriertem Echt-Key (Bestands-Bibliothek wird bewusst nicht angefasst)',
    )

    await d.step('S3', 'MongoDB: shadowTwin der TEST-Bibliothek ist v2 + mongo', async () => {
      const { MongoClient } = await import('mongodb')
      const uri = readEnvVar('MONGODB_URI')
      const dbName = readEnvVar('MONGODB_DATABASE_NAME')
      const collName = readEnvVar('MONGODB_COLLECTION_NAME') || 'libraries'
      if (!uri || !dbName) throw new Error('MONGODB_URI / MONGODB_DATABASE_NAME nicht aus .env lesbar')
      // Datenmodell: ein Dokument pro User mit verschachteltem libraries[]-Array
      interface Lib { label?: string; name?: string; config?: { shadowTwin?: { mode?: string; primaryStore?: string } } }
      interface UserDoc { email?: string; libraries?: Lib[] }
      const client = new MongoClient(uri)
      try {
        await client.connect()
        const coll = client.db(dbName).collection<UserDoc>(collName)
        const docs = await coll.find({ libraries: { $exists: true } }).toArray()
        let found: Lib | undefined
        for (const doc of docs) {
          found = (doc.libraries ?? []).find(l => (l.label ?? l.name ?? '').startsWith(TEST_PREFIX))
          if (found) break
        }
        if (!found) throw new Error(`keine ${TEST_PREFIX}-Library in Collection ${collName} (${docs.length} User-Docs durchsucht)`)
        const st = found.config?.shadowTwin
        if (st?.mode !== 'v2' || st?.primaryStore !== 'mongo')
          throw new Error(`shadowTwin = ${JSON.stringify(st ?? null)} — erwartet { mode:"v2", primaryStore:"mongo" }`)
        return `Collection ${collName}: mode=v2, primaryStore=mongo`
      } finally {
        await client.close()
      }
    })

    await d.step('S4', 'Alte Bookmarks leiten auf die neuen Seiten um', async () => {
      const mapping: Array<[string, string]> = [
        ['storage', 'archive'],
        ['chat', 'story'],
        ['gallery', 'explore'],
      ]
      const ergebnisse: string[] = []
      for (const [alt, neu] of mapping) {
        await page.goto(`/settings/${alt}`, { waitUntil: 'domcontentloaded' })
        await page.waitForURL(`**/settings/${neu}**`, { timeout: 30_000 })
        ergebnisse.push(`${alt}→${neu}`)
      }
      return ergebnisse.join(', ')
    })
  } finally {
    d.save()
  }
})
