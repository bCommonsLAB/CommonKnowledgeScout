/**
 * Beschriftungen der Klimamassnahmen-Detailansicht: jede Sprache hat dieselben
 * Schluessel wie Deutsch. Fehlt einer, faellt `t()` still auf Deutsch zurueck —
 * genau das Mischbild, das hier behoben wurde (Befund 17.11.2026).
 */
import { describe, it, expect } from 'vitest'
import { VIEW_TYPE_REGISTRY } from '@ks/contracts'
import { STAKEHOLDER_KONSENT } from '@ks/module-explorer/gallery/lib/stakeholder-meta'
import de from '../../../packages/i18n/src/translations/de.json'
import en from '../../../packages/i18n/src/translations/en.json'
import it_ from '../../../packages/i18n/src/translations/it.json'
import fr from '../../../packages/i18n/src/translations/fr.json'
import es from '../../../packages/i18n/src/translations/es.json'

type Tree = { [key: string]: string | Tree }

/** Alle Blatt-Pfade eines verschachtelten Objekts, sortiert. */
function pfade(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj)
    .flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : pfade(v, `${prefix}${k}.`)))
    .sort()
}

const SPRACHEN: Record<string, Tree> = { en, it: it_, fr, es } as unknown as Record<string, Tree>
const DE = de as unknown as Tree

describe('climateDetail / climateRating in allen Sprachen', () => {
  for (const block of ['climateDetail', 'climateRating']) {
    const soll = pfade(DE[block] as Tree)
    for (const [sprache, json] of Object.entries(SPRACHEN)) {
      it(`${sprache}: ${block} hat dieselben Schluessel wie de`, () => {
        expect(pfade(json[block] as Tree)).toEqual(soll)
      })
    }
  }

  it('jede LV-Bewertung der Registry hat eine Beschriftung', () => {
    const werte = Object.keys(VIEW_TYPE_REGISTRY.climateAction.belegKarte?.status?.plaketten ?? {}).sort()
    expect(werte.length).toBeGreaterThan(0)
    const detail = DE.climateDetail as Tree
    expect(Object.keys(detail.bewertung as Tree).sort()).toEqual(werte)
  })

  it('jede Stakeholder-Gruppe hat eine Beschriftung', () => {
    const detail = DE.climateDetail as Tree
    expect(Object.keys(detail.stakeholder as Tree).sort()).toEqual(STAKEHOLDER_KONSENT.map((g) => g.key).sort())
  })
})
