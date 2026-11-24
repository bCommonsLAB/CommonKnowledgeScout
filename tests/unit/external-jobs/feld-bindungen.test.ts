/**
 * @fileoverview Feld-Bindungen einer Vorlage: Obergrenzen durchsetzen, Zaehlfelder
 * berechnen. Was sich pruefen oder ausrechnen laesst, bleibt nicht dem Modell ueberlassen.
 */

import { describe, it, expect } from 'vitest'
import { leseFeldBindungen, quellenAusMaterial, vorlageFuerModell, wendeFeldBindungenAn, zeilenDesAbschnitts } from '@/lib/external-jobs/feld-bindungen'
import { parseTemplate } from '@/lib/templates/template-parser'

const VORLAGE = `---
themes: {{themes|At most <<max:3>> values, most important first, from: a, b, c, d}}
statement_count: {{statement_count|=zeilen("Speakers", "Statement:")}}
pdf_count: {{pdf_count|=quellen("* - Statement.pdf")}}
source_types: {{source_types|=quellenarten(statement: "* - Statement.*"; programme: "*Programme*"; webcast: "*.m4a")}}
---

## Summary
{{summary|<<maxWoerter:5>> words at most}}

--- systemprompt
Be precise.`

const MATERIAL = `---
_source_files: ["Programme.md","01 Fiji - Statement.pdf","02 Chad - Statement.pdf","Notes.txt"]
kind: composite-transcript
---

<source file="Programme.md" index="1">

# Segment

## **Speakers**
1. Fiji — Statement: yes
2. Chad — statement: yes
3. Peru

## Documents
- Statement: not counted

</source>
`

describe('leseFeldBindungen', () => {
  it('liest Grenzen und Berechnungen je Feld', () => {
    expect(leseFeldBindungen(VORLAGE)).toEqual([
      { feld: 'themes', max: 3 },
      { feld: 'statement_count', berechnet: { art: 'zeilen', abschnitt: 'Speakers', text: 'Statement:' } },
      { feld: 'pdf_count', berechnet: { art: 'quellen', muster: '* - Statement.pdf' } },
      { feld: 'source_types', berechnet: { art: 'quellenarten', paare: [{ wert: 'statement', muster: '* - Statement.*' }, { wert: 'programme', muster: '*Programme*' }, { wert: 'webcast', muster: '*.m4a' }] } },
      { feld: 'summary', maxWoerter: 5 },
    ])
    expect(leseFeldBindungen('---\ntitle: {{title|Titel}}\n---')).toEqual([])
  })

  it('wirft bei Schreibfehlern, statt still nichts zu binden', () => {
    expect(() => leseFeldBindungen('{{a|=zaehle("x")}}')).toThrow('keine bekannte Berechnung')
    expect(() => leseFeldBindungen('{{a|<<maximal:3>>}}')).toThrow('keine bekannte Obergrenze')
    expect(() => leseFeldBindungen('{{a|<<max:0>>}}')).toThrow('mindestens 1')
    expect(() => leseFeldBindungen('{{a|Text}}\n\nHoechstens <<max:3>> Themen.')).toThrow('ausserhalb einer Feldbeschreibung')
  })

  it('uebersteht den Vorlagen-Parser', () => {
    const { template, errors } = parseTemplate(VORLAGE, 'test')
    expect(errors).toEqual([])
    expect(template.metadata.fields.find((f) => f.key === 'statement_count')?.description).toBe('=zeilen("Speakers", "Statement:")')
  })
})

describe('vorlageFuerModell', () => {
  it('gibt dem Modell Zahlen statt Platzhalter und keine Rechenausdruecke', () => {
    const text = vorlageFuerModell(VORLAGE)
    expect(text).toContain('{{themes|At most 3 values, most important first, from: a, b, c, d}}')
    expect(text).toContain('{{statement_count|Computed by the server — return null.}}')
    expect(text).toContain('{{summary|5 words at most}}')
    expect(text).not.toContain('<<')
    expect(text).not.toContain('=zeilen')
  })
})

describe('wendeFeldBindungenAn', () => {
  const bindungen = leseFeldBindungen(VORLAGE)

  it('kuerzt Listen, meldet lange Texte und ersetzt, was das Modell gezaehlt hat', () => {
    const meta = { themes: ['a', 'b', 'c', 'd', 'a'], statement_count: 17, pdf_count: null, source_types: ['programme', 'statement', 'webcast'], summary: 'one two three four five six seven' }
    const r = wendeFeldBindungenAn(meta, bindungen, MATERIAL)
    expect(r.cleanedMeta).toEqual({ themes: ['a', 'b', 'c'], statement_count: 2, pdf_count: 2, source_types: ['statement', 'programme'], summary: meta.summary })
    expect(r.grenzen).toEqual([
      { feld: 'themes', art: 'max', erlaubt: 3, erhalten: 5, gekuerzt: true },
      { feld: 'summary', art: 'maxWoerter', erlaubt: 5, erhalten: 7, gekuerzt: false },
    ])
    expect(r.berechnet.find((b) => b.feld === 'statement_count')).toEqual({ feld: 'statement_count', wert: 2, modell: 17 })
    expect(r.nichtBerechenbar).toEqual([])
    expect(meta.themes).toHaveLength(5)
  })

  it('setzt null und nennt den Grund, wenn sich ein Feld nicht rechnen laesst', () => {
    const r = wendeFeldBindungenAn({ statement_count: 17, pdf_count: 3 }, bindungen, '# Nur Text\n\nohne Kopf')
    expect(r.cleanedMeta.statement_count).toBeNull()
    expect(r.cleanedMeta.pdf_count).toBeNull()
    expect(r.nichtBerechenbar.map((n) => n.grund)).toEqual([
      'Abschnitt „Speakers" gibt es im Material nicht',
      'Das Material nennt keine _source_files (keine Sammeldatei)',
      'Das Material nennt keine _source_files (keine Sammeldatei)',
    ])
  })

  it('laesst Felder innerhalb der Grenzen in Ruhe', () => {
    const r = wendeFeldBindungenAn({ themes: ['a'], summary: 'kurz' }, bindungen.filter((b) => !b.berechnet), MATERIAL)
    expect(r.grenzen).toEqual([])
    expect(r.cleanedMeta).toEqual({ themes: ['a'], summary: 'kurz' })
  })
})

describe('Material lesen', () => {
  it('findet Quellen und Abschnitt', () => {
    expect(quellenAusMaterial(MATERIAL)).toHaveLength(4)
    expect(zeilenDesAbschnitts(MATERIAL, 'speakers')?.filter((z) => z.trim()).length).toBe(3)
    expect(zeilenDesAbschnitts(MATERIAL, 'Gibt es nicht')).toBeNull()
  })
})

describe('Befund in job_status', () => {
  it('nennt Kuerzung, Wortgrenze und nicht rechenbare Felder — aus Trace wie aus Log', async () => {
    const { befundeFuerJob } = await import('@/lib/mcp/job-befunde')
    const { ereignisseAusTrace } = await import('@/lib/mcp/job-ereignisse')
    const details = {
      grenzen: [{ feld: 'themes', art: 'max', erlaubt: 6, erhalten: 16, gekuerzt: true }, { feld: 'summary', art: 'maxWoerter', erlaubt: 450, erhalten: 900, gekuerzt: false }],
      berechnet: [{ feld: 'statement_count', wert: 19, modell: 17 }],
      nichtBerechenbar: [{ feld: 'x', grund: 'Abschnitt „Speakers" gibt es im Material nicht' }],
    }
    const erwartet = [
      'Feld "themes": 16 Eintraege, erlaubt sind 6 — hinten gekuerzt',
      'Feld "summary": 900 Woerter, erlaubt sind 450 — nicht gekuerzt',
      'Feld "x": nicht berechenbar, bleibt leer (Abschnitt „Speakers" gibt es im Material nicht)',
    ]
    const ausTrace = ereignisseAusTrace({ trace: { events: [{ name: 'field_bindings_applied', ts: '2026-01-01T00:00:00Z', attributes: details }] } })
    expect(befundeFuerJob({ status: 'completed', steps: [], ereignisse: ausTrace })).toEqual(erwartet)
    const ausLog = ereignisseAusTrace({ logs: [{ timestamp: '2026-01-01T00:00:00Z', phase: 'field_bindings_applied', message: 'x', details }] })
    expect(befundeFuerJob({ status: 'completed', steps: [], ereignisse: ausLog })).toEqual(erwartet)
  })
})
