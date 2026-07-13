/**
 * @fileoverview Analyse + Reparatur: `lv_zustaendigkeit` von `;`-verketteten
 * Freitext-Strings auf ein Array kanonischer Zustaendigkeiten bringen.
 *
 * @description
 * Befund 2026-07-13 (606 Prod-Docs): das Feld traegt mehrere Zustaendigkeiten
 * als EINEN String ("A; B") — jede Kombination wird so ein eigener Facetten-
 * Wert (50+ Eintraege statt ~18 echten Zustaendigkeiten). Dazu Datenfehler:
 * abgeschnittene Namen, trailing ':'/';', Komma statt Semikolon beim
 * Bildungsdirektions-Trio, ein verklebter Einzelfall (User-Entscheid: dem
 * Umwelt-Ressort zuordnen, "Vorschlag Klimabuergerrat" steckt bereits in der
 * Facette vorschlag_quelle).
 *
 * Ziel-Modell (User-Entscheid 2026-07-13): `string[]` wie tags/authors —
 * der Filter zeigt kanonische Einzel-Zustaendigkeiten, Massnahmen mit
 * mehreren Ressorts zaehlen ueberall mit. NACH dem Lauf muss der Facetten-Typ
 * in den Library-Einstellungen auf `string[]` (Multi) umgestellt werden.
 *
 * Sicherheit (Muster normalize-lv-bewertung.ts):
 * - DEFAULT = ANALYSE (read-only). Schreiben nur mit `--apply`.
 * - `--db=<name>` und `--libraryId=<id>` sind PFLICHT.
 * - Backup der alten Werte nach `backups/lv-zustaendigkeit-<ts>.json`.
 * - UNBEKANNTE Teil-Strings stoppen das Schreiben des betroffenen Docs und
 *   werden gelistet (kein stilles Raten) — Mapping erweitern, erneut laufen.
 * - Idempotent: bereits kanonische Arrays werden unveraendert gelassen.
 *
 * GRENZE: patcht NUR MongoDB, nicht das Storage-Frontmatter der Quelldateien.
 *
 * @usage
 *   pnpm tsx scripts/normalize-lv-zustaendigkeit.ts --db=<name> --libraryId=<id>          # Analyse
 *   pnpm tsx scripts/normalize-lv-zustaendigkeit.ts --db=<name> --libraryId=<id> --apply  # Reparatur
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { MongoClient, type Document } from 'mongodb'
import * as fs from 'fs'
import * as path from 'path'

/** Kanonische Zustaendigkeiten (Anzeige- und Sortier-Reihenfolge). */
const CANONICAL: readonly string[] = [
  'Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Sport',
  'Ressort Infrastrukturen und Mobilität',
  'Ressort Landwirtschaft, Forstwirtschaft und Tourismus',
  'Ressort Italienische Kultur und Wirtschaftsentwicklung',
  'Ressort Gesundheitsvorsorge und Gesundheit',
  'Ressort Hochbau, Valorisierung des Vermögens, Grundbuch und Kataster',
  'Ressort Wohnbau, Sicherheit und Gewaltprävention',
  'Ressort Sozialer Zusammenhalt, Familie, Senioren, Genossenschaften und Ehrenamt',
  'Ressort Europa, Arbeit und Personal',
  'Ressort Innovation und Forschung, Museen, Denkmalpflege, Deutsche Kultur und Bildungsförderung',
  'Generaldirektion - Ressort Finanzen, Digitaler Wandel und Bürgernahe Verwaltung',
  'Generalsekretariat - Ressort Autonomie, Gemeinden, Institutionelle Angelegenheiten und Gesetzgebung',
  'Gemeinden',
  'Deutsche Bildungsdirektion',
  'Direktion Italienische Bildung',
  'Direktion Ladinische Bildung und Kultur',
  'Keine Zuständigkeit der Landesverwaltung',
  'Vorschlag unklar',
]
const CANONICAL_SET = new Set(CANONICAL)
const CANONICAL_ORDER = new Map(CANONICAL.map((v, i) => [v, i]))

const TRIO = ['Deutsche Bildungsdirektion', 'Direktion Italienische Bildung', 'Direktion Ladinische Bildung und Kultur']

/**
 * Beobachtete Nicht-kanonische Teil-Strings -> kanonische Werte (explizit,
 * kein Fuzzy-Matching). Quelle: Ist-Bestand 2026-07-13.
 */
const VARIANT_MAP: Record<string, string[]> = {
  // Komma- statt Semikolon-Trenner beim Bildungsdirektions-Trio
  'Deutsche Bildungsdirektion, Direktion Italienische Bildung, Direktion Ladinische Bildung und Kultur': TRIO,
  // dito, hinten abgeschnitten ("und Kultur" fehlt)
  'Deutsche Bildungsdirektion, Direktion Italienische Bildung, Direktion Ladinische Bildung': TRIO,
  // Einzelner abgeschnittener Trio-Teil
  'Direktion Ladinische Bildung': ['Direktion Ladinische Bildung und Kultur'],
  // Abgeschnittenes Sozial-Ressort ("Ehrenamt" fehlt)
  'Ressort Sozialer Zusammenhalt, Familie, Senioren, Genossenschaften und':
    ['Ressort Sozialer Zusammenhalt, Familie, Senioren, Genossenschaften und Ehrenamt'],
  // Verklebter Einzelfall (User-Entscheid 2026-07-13): Umwelt-Ressort;
  // "Vorschlag Klimabuergerrat" entfaellt (steckt in vorschlag_quelle).
  'Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Vorschlag Klimabürgerrat':
    ['Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Sport'],
}

/** Einen `;`-Teil normalisieren: trim, trailing ':'/';' weg, Spaces glaetten. */
function cleanPart(part: string): string {
  return part.replace(/\s+/g, ' ').trim().replace(/[;:]+$/, '').trim()
}

/** Rohwert (String ODER Array) -> kanonisches Array + unbekannte Teile. */
function normalizeValue(raw: unknown): { canonical: string[]; unknown: string[] } {
  const parts: string[] = []
  if (typeof raw === 'string') {
    parts.push(...raw.split(';'))
  } else if (Array.isArray(raw)) {
    for (const v of raw) if (typeof v === 'string') parts.push(...v.split(';'))
  }
  const out = new Set<string>()
  const unknown: string[] = []
  for (const rawPart of parts) {
    const part = cleanPart(rawPart)
    if (!part) continue
    if (CANONICAL_SET.has(part)) {
      out.add(part)
    } else if (VARIANT_MAP[part]) {
      for (const v of VARIANT_MAP[part]) out.add(v)
    } else {
      unknown.push(part)
    }
  }
  const canonical = [...out].sort((a, b) => (CANONICAL_ORDER.get(a) ?? 99) - (CANONICAL_ORDER.get(b) ?? 99))
  return { canonical, unknown }
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

async function main(): Promise<void> {
  const dbName = getArg('db')
  const libraryId = getArg('libraryId')
  const apply = process.argv.includes('--apply')
  if (!dbName || !libraryId) {
    console.error('Pflicht-Argumente fehlen: --db=<name> --libraryId=<id> [--apply]')
    process.exit(1)
  }
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI ist nicht gesetzt (.env)')

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const col = client.db(dbName).collection<Document>(`doc_meta__${libraryId}`)
    const rows = await col
      .find({ kind: 'meta', libraryId })
      .project({ _id: 1, fileId: 1, lv_zustaendigkeit: 1, 'docMetaJson.lv_zustaendigkeit': 1 })
      .toArray()

    const changes: Array<{ _id: unknown; fileId: string; old: unknown; neu: string[] }> = []
    const blocked: Array<{ fileId: string; old: unknown; unknown: string[] }> = []
    let alreadyCanonical = 0
    let withoutValue = 0

    for (const r of rows) {
      const raw = (r.docMetaJson as Document | undefined)?.lv_zustaendigkeit ?? r.lv_zustaendigkeit
      if (raw === undefined || raw === null || raw === '') { withoutValue++; continue }
      const { canonical, unknown } = normalizeValue(raw)
      if (unknown.length > 0) {
        blocked.push({ fileId: String(r.fileId), old: raw, unknown })
        continue
      }
      const isAlreadyArray = Array.isArray(raw)
        && raw.length === canonical.length
        && raw.every((v, i) => v === canonical[i])
      if (isAlreadyArray) { alreadyCanonical++; continue }
      changes.push({ _id: r._id, fileId: String(r.fileId), old: raw, neu: canonical })
    }

    console.log(`Docs gesamt: ${rows.length} | ohne Wert: ${withoutValue} | bereits kanonisch: ${alreadyCanonical}`)
    console.log(`Zu konvertieren: ${changes.length} | BLOCKIERT (unbekannte Teile): ${blocked.length}`)
    if (blocked.length > 0) {
      console.log('\nUnbekannte Teil-Strings (Mapping erweitern, dann erneut laufen):')
      const uniq = new Map<string, number>()
      for (const b of blocked) for (const u of b.unknown) uniq.set(u, (uniq.get(u) ?? 0) + 1)
      for (const [k, v] of uniq) console.log(`  ${JSON.stringify(k)} (${v}x)`)
    }

    // Ziel-Verteilung als Vorschau (Facetten-Sicht nach der Konvertierung).
    const preview = new Map<string, number>()
    for (const chg of changes) for (const v of chg.neu) preview.set(v, (preview.get(v) ?? 0) + 1)
    console.log('\nZiel-Verteilung (nur konvertierte Docs):')
    for (const v of CANONICAL) if (preview.has(v)) console.log(`  ${v}: ${preview.get(v)}`)

    if (!apply) {
      console.log('\nANALYSE-Modus (kein Schreiben). Reparatur mit --apply.')
      return
    }
    if (blocked.length > 0) {
      console.error('\nABBRUCH: unbekannte Teile vorhanden — kein Teil-Schreiben mit Luecken.')
      process.exit(1)
    }
    if (changes.length === 0) {
      console.log('Nichts zu tun.')
      return
    }

    const backupDir = path.join(process.cwd(), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const backupFile = path.join(backupDir, `lv-zustaendigkeit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(backupFile, JSON.stringify({ dbName, libraryId, changes }, null, 2), 'utf8')
    console.log(`Backup geschrieben: ${backupFile}`)

    let modified = 0
    for (const chg of changes) {
      const res = await col.updateOne(
        { _id: chg._id as never },
        { $set: { lv_zustaendigkeit: chg.neu, 'docMetaJson.lv_zustaendigkeit': chg.neu } },
      )
      modified += res.modifiedCount
    }
    console.log(`Fertig: ${modified} Docs konvertiert (String -> kanonisches Array).`)
    console.log('NAECHSTER SCHRITT: Facetten-Typ von lv_zustaendigkeit in den Library-Einstellungen auf string[] (Multi) stellen.')
  } finally {
    await client.close()
  }
}

main().catch((e) => {
  console.error('FEHLER:', e instanceof Error ? e.message : e)
  process.exit(1)
})
