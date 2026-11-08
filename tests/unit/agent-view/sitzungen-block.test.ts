/**
 * @fileoverview Unit-Tests: generischer Block-Ersetzer und Sitzungen-Block im BERICHT.md (S1).
 *
 * Der Rest des Berichts muss byteidentisch bleiben; ein handgeschriebener
 * Block „(nachgetragen …)" faellt nur mit Schalter — sonst Befund, kein Umbau.
 */

import { describe, it, expect } from 'vitest'
import { ersetzeBlock, indexMitBlock, BLOCK_START, BLOCK_END } from '@/lib/agent-view/erschliessung-block'
import { SITZUNGEN_BLOCK_END as END, SITZUNGEN_BLOCK_START as START } from '@/lib/agent-view/sichten/sitzungen-render'
import { alterSitzungenBlock, berichtMitSitzungenBlock } from '@/lib/agent-view/sitzungen-block'

const NEU = `${START}\n### Sitzungen mit Claude (erzeugt)\n\n- 2026-10-29 · Code · [[2026-10-29 Code X]] — x.\n${END}`
const KOPF = '---\nprojekt: 24.03 bcoop\n---\n\n# bcoop\n\nText davor.\n\n## Verweise\n\n- [[a]]\n\n'
const ALT = '### Sitzungen mit Claude (nachgetragen 05.11. und 08.11.2026)\n\n- Sitzung 2026-10-29: [[alt]] — alt. Beleg [[b]] (nachgetragen 05.11.)\n\n#### Unterpunkt im alten Block\n\n- noch alt\n\n'
const DANACH = '## Nächste Schritte\n\n- [ ] offen\n'

describe('ersetzeBlock (generisch)', () => {
  it('haengt ohne Marker an, ersetzt zwischen Markern, wirft bei Start ohne Ende — fuer beliebige Marker', () => {
    expect(ersetzeBlock('# T\n\n\n', '<!-- a -->', '<!-- /a -->', '<!-- a -->\nx\n<!-- /a -->')).toBe('# T\n\n<!-- a -->\nx\n<!-- /a -->\n')
    expect(ersetzeBlock('v\n<!-- a -->\nalt\n<!-- /a -->\nn', '<!-- a -->', '<!-- /a -->', '<!-- a -->\nneu\n<!-- /a -->')).toBe('v\n<!-- a -->\nneu\n<!-- /a -->\nn')
    expect(() => ersetzeBlock('<!-- a --> kaputt', '<!-- a -->', '<!-- /a -->', 'x')).toThrow(/Ende-Marker/)
    // Bestehender Aufrufer unveraendert
    expect(indexMitBlock('# I\n', `${BLOCK_START}\nn\n${BLOCK_END}`)).toBe(`# I\n\n${BLOCK_START}\nn\n${BLOCK_END}\n`)
  })
})

describe('alterSitzungenBlock', () => {
  it('findet beide Altbestands-Ueberschriften und endet an der naechsten Ueberschrift der Ebenen 1-3', () => {
    const text = KOPF + ALT + DANACH
    const alt = alterSitzungenBlock(text)
    expect(alt).toMatchObject({ start: KOPF.length, end: KOPF.length + ALT.length, ueberschrift: '### Sitzungen mit Claude (nachgetragen 05.11. und 08.11.2026)' })
    const amEnde = '### Sitzungen aus Claude Code (nachgetragen 05.11.)\n- a\n'
    expect(alterSitzungenBlock(amEnde)).toMatchObject({ start: 0, end: amEnde.length })
    expect(alterSitzungenBlock(KOPF + NEU)).toBeNull()
    expect(alterSitzungenBlock('### Sitzungen mit Claude (erzeugt)\n')).toBeNull()
  })
})

describe('berichtMitSitzungenBlock', () => {
  it('ohne alten Block: anhaengen bzw. Marker-Block erneuern', () => {
    expect(berichtMitSitzungenBlock(KOPF, NEU, false)).toEqual({ text: `${KOPF.replace(/\n+$/, '')}\n\n${NEU}\n`, alterBlock: 'keiner', alteUeberschrift: null })
    const mitMarker = `${KOPF}${START}\nalt\n${END}\n\n${DANACH}`
    expect(berichtMitSitzungenBlock(mitMarker, NEU, false).text).toBe(`${KOPF}${NEU}\n\n${DANACH}`)
  })

  it('alter Block OHNE Schalter: Text unveraendert, Status belassen (Befund)', () => {
    const text = KOPF + ALT + DANACH
    const r = berichtMitSitzungenBlock(text, NEU, false)
    expect(r.text).toBe(text)
    expect(r.alterBlock).toBe('belassen')
    expect(r.alteUeberschrift).toBe('### Sitzungen mit Claude (nachgetragen 05.11. und 08.11.2026)')
  })

  it('alter Block MIT Schalter: an Ort und Stelle ersetzt, davor und danach byteidentisch', () => {
    const r = berichtMitSitzungenBlock(KOPF + ALT + DANACH, NEU, true)
    expect(r.alterBlock).toBe('ersetzt')
    expect(r.text).toBe(`${KOPF}${NEU}\n\n${DANACH}`)
    expect(r.text.startsWith(KOPF)).toBe(true)
    expect(r.text.endsWith(DANACH)).toBe(true)
    expect(r.text).not.toContain('nachgetragen')
    expect(r.text).not.toContain('Unterpunkt im alten Block')
    // Alter Block am Dateiende
    expect(berichtMitSitzungenBlock(KOPF + ALT, NEU, true).text).toBe(`${KOPF}${NEU}\n`)
  })

  it('alter Block UND Marker: ohne Schalter nur Marker erneuern, mit Schalter alten Block entfernen', () => {
    const text = `${KOPF}${START}\nalt\n${END}\n\n${ALT}${DANACH}`
    const ohne = berichtMitSitzungenBlock(text, NEU, false)
    expect(ohne.alterBlock).toBe('belassen')
    expect(ohne.text).toBe(`${KOPF}${NEU}\n\n${ALT}${DANACH}`)
    const mit = berichtMitSitzungenBlock(text, NEU, true)
    expect(mit.alterBlock).toBe('ersetzt')
    expect(mit.text).toBe(`${KOPF}${NEU}\n\n${DANACH}`)
  })
})
