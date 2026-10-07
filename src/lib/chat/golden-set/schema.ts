/**
 * Golden-Set einer Library (Plan `story-status-modalitaet`, m0).
 *
 * Ein Golden-Set ist eine Liste von Fragen mit Erwartung als KRITERIEN, nicht
 * als Wortlaut: welche Dokumente die Antwort zitieren muss, welche
 * Facettenwerte sie nennen muss, ob Zuschreibung und Gruppierung Pflicht
 * sind. Das Set mit echten Kennungen liegt BEI DER LIBRARY, nicht im Repo;
 * hier stehen nur Schema, Prüfung und Läufer (`scripts/golden-set-run.ts`).
 *
 * Format (Plan §5): `erwarteteDokumente` sind flache Objekte, deren Schlüssel
 * `kennungFeld` das Dokument identifiziert (z. B. `massnahme_nr`) und deren
 * übrige Schlüssel Facetten-`metaKey`s mit dem erwarteten Wert sind.
 * Pure Zod-Quelle, keine Seiteneffekte.
 */

import * as z from 'zod'
import { findeFacetWert, type FacetWert } from '@/lib/chat/facet-werte'

/** Die drei Fragetypen aus Plan §5. */
export const GOLDEN_SET_FRAGETYPEN = ['direkt', 'themenfrage', 'unterstellung'] as const
export type GoldenSetFragetyp = (typeof GOLDEN_SET_FRAGETYPEN)[number]

const nichtLeer = z.string().trim().min(1)

export const goldenSetPflichtSchema = z.object({
  /** Facetten-metaKey → Werte, deren Label in der Antwort stehen muss. */
  werteGenannt: z.record(z.array(nichtLeer).min(1)).optional(),
  /** Statusaussagen müssen der Quelle zugeschrieben sein (Richter-Rubrik). */
  zuschreibung: z.boolean(),
  /** Bei gemischten Treffern muss die Antwort nach Status gliedern (Richter-Rubrik). */
  gruppierung: z.boolean(),
})

export const goldenSetFrageSchema = z.object({
  id: nichtLeer,
  frage: nichtLeer,
  typ: z.enum(GOLDEN_SET_FRAGETYPEN),
  erwarteteDokumente: z.array(z.record(nichtLeer)).min(1),
  pflicht: goldenSetPflichtSchema,
})

export const goldenSetSchema = z
  .object({
    /** Metadaten-Feld, das ein Dokument eindeutig benennt (z. B. `massnahme_nr`). */
    kennungFeld: nichtLeer,
    fragen: z.array(goldenSetFrageSchema).min(1),
  })
  .superRefine((set, ctx) => {
    const ids = new Set<string>()
    set.fragen.forEach((frage, fi) => {
      if (ids.has(frage.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fragen', fi, 'id'], message: `Frage-ID „${frage.id}" ist doppelt` })
      }
      ids.add(frage.id)
      frage.erwarteteDokumente.forEach((dok, di) => {
        if (!(set.kennungFeld in dok)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fragen', fi, 'erwarteteDokumente', di],
            message: `Erwartetes Dokument ohne Kennung „${set.kennungFeld}"`,
          })
        }
      })
    })
  })

export type GoldenSet = z.infer<typeof goldenSetSchema>
export type GoldenSetFrage = z.infer<typeof goldenSetFrageSchema>

/** Parst ein Golden-Set; wirft mit lesbarer Fehlerliste statt stillem Teil-Ergebnis. */
export function parseGoldenSet(input: unknown): GoldenSet {
  const parsed = goldenSetSchema.safeParse(input)
  if (parsed.success) return parsed.data
  const zeilen = parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
  throw new Error(`Golden-Set ungültig:\n${zeilen.join('\n')}`)
}

/** Minimale Sicht auf eine Facette, die die Set-Prüfung braucht. */
export interface GoldenSetFacette {
  metaKey: string
  werte?: FacetWert[]
}

/**
 * Prüft das Set gegen das Facetten-Schema der Library: jeder Facetten-Schlüssel
 * in `erwarteteDokumente` und `werteGenannt` muss eine konfigurierte Facette
 * sein; trägt die Facette ein Wörterbuch, muss der Wert darin stehen. Ein
 * Tippfehler im Set wäre sonst ein stilles „nie gefunden".
 */
export function pruefeGoldenSetGegenFacetten(set: GoldenSet, facetten: ReadonlyArray<GoldenSetFacette>): string[] {
  const byKey = new Map(facetten.map((f) => [f.metaKey, f]))
  const fehler: string[] = []
  const pruefeWert = (ort: string, metaKey: string, wert: string) => {
    const facette = byKey.get(metaKey)
    if (!facette) {
      fehler.push(`${ort}: „${metaKey}" ist keine Facette dieser Library`)
      return
    }
    if (facette.werte && facette.werte.length > 0 && !findeFacetWert(facette.werte, wert)) {
      fehler.push(`${ort}: Wert „${wert}" steht nicht im Wörterbuch von „${metaKey}"`)
    }
  }
  for (const frage of set.fragen) {
    frage.erwarteteDokumente.forEach((dok, di) => {
      for (const [key, wert] of Object.entries(dok)) {
        if (key === set.kennungFeld) continue
        pruefeWert(`Frage „${frage.id}", Dokument ${di + 1}`, key, wert)
      }
    })
    for (const [metaKey, werte] of Object.entries(frage.pflicht.werteGenannt ?? {})) {
      werte.forEach((wert) => pruefeWert(`Frage „${frage.id}", werteGenannt`, metaKey, wert))
    }
  }
  return fehler
}
