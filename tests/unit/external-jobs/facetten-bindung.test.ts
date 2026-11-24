/**
 * @fileoverview Vorlage an das Facetten-Woerterbuch binden: Platzhalter einsetzen,
 * Werte nach der Transformation pruefen. Nichts still — weder leer lassen noch streichen.
 */

import { describe, it, expect } from 'vitest'
import {
  gebundeneFacetten, hatFacettenPlatzhalter, pruefeFacettenPlatzhalter, pruefeFacettenWerte, setzeFacettenPlatzhalter,
  type BindungsFacette,
} from '@/lib/external-jobs/facetten-bindung'
import { parseTemplate } from '@/lib/templates/template-parser'
import { befundeFuerJob } from '@/lib/mcp/job-befunde'
import { ereignisseAusTrace } from '@/lib/mcp/job-ereignisse'

const FACETTEN: BindungsFacette[] = [
  { metaKey: 'source_types', label: 'Quellenart', werte: [
    { wert: 'programme', label: 'Programm', bedeutung: 'Tagesordnung oder Rednerliste' },
    { wert: 'statement', label: 'Statement' },
  ] },
  { metaKey: 'status', werte: [{ wert: 'offen', label: 'offen' }, { wert: 'fertig', label: 'fertig' }] },
  { metaKey: 'ohne_woerterbuch' },
]

describe('Platzhalter', () => {
  it('setzt werte und legende einzeilig ein und nennt die gebundenen Felder', () => {
    const { content, gebunden } = setzeFacettenPlatzhalter('Erlaubt: <<werte:source_types>>.\nBedeutung: << legende : source_types >>\nStatus: <<werte:status>>', FACETTEN)
    expect(content).toBe('Erlaubt: programme, statement.\nBedeutung: programme = Programm (Tagesordnung oder Rednerliste); statement = Statement\nStatus: offen, fertig')
    expect(gebunden).toEqual(['source_types', 'status'])
  })

  it('laesst Text ohne Platzhalter und fremde spitze Klammern in Ruhe', () => {
    const text = 'a << b >> c, {{feld|Beschreibung}}'
    expect(hatFacettenPlatzhalter(text)).toBe(false)
    expect(setzeFacettenPlatzhalter(text, FACETTEN)).toEqual({ content: text, gebunden: [] })
  })

  it('meldet unbekannte Facette, fehlendes Woerterbuch und Schreibfehler — und wirft beim Einsetzen', () => {
    const text = '<<werte:gibt_es_nicht>> <<legende:ohne_woerterbuch>> <<werte source_types>>'
    expect(pruefeFacettenPlatzhalter(text, FACETTEN).map((f) => f.grund)).toEqual([
      'Facette „gibt_es_nicht" gibt es im Schema der Library nicht',
      'Facette „ohne_woerterbuch" hat kein Wörterbuch (werte)',
      'Erlaubt sind nur <<werte:<metaKey>>> und <<legende:<metaKey>>>',
    ])
    expect(() => setzeFacettenPlatzhalter(text, FACETTEN)).toThrow('nicht auflösbar')
    expect(gebundeneFacetten(text)).toEqual(['gibt_es_nicht', 'ohne_woerterbuch'])
  })

  it('lehnt ein Woerterbuch ab, das die Vorlage zerbrechen wuerde', () => {
    const kaputt: BindungsFacette[] = [{ metaKey: 'x', werte: [{ wert: 'a}', label: 'A' }] }]
    expect(pruefeFacettenPlatzhalter('<<werte:x>>', kaputt)[0].grund).toContain('zerbricht die Vorlage')
  })

  it('uebersteht den Vorlagen-Parser in einer Feldbeschreibung', () => {
    const vorlage = '---\nsource_types: {{source_types|Eine oder mehrere aus: <<werte:source_types>>}}\n---\n\n# {{title|Titel}}\n\n--- systemprompt\nNutze nur <<legende:source_types>>.'
    const { template, errors } = parseTemplate(vorlage, 'test')
    expect(errors).toEqual([])
    expect(template.metadata.fields.find((f) => f.key === 'source_types')?.description).toBe('Eine oder mehrere aus: <<werte:source_types>>')
    expect(template.systemprompt).toContain('<<legende:source_types>>')
  })
})

describe('pruefeFacettenWerte', () => {
  it('verwirft Werte ausserhalb des Woerterbuchs und meldet sie', () => {
    const meta = { title: 'T', source_types: ['programme', 'erfunden', 7], status: 'unklar', anderes: 'bleibt' }
    const { cleanedMeta, verworfen } = pruefeFacettenWerte(meta, ['source_types', 'status'], FACETTEN)
    expect(cleanedMeta).toEqual({ title: 'T', source_types: ['programme'], status: null, anderes: 'bleibt' })
    expect(verworfen).toEqual([{ feld: 'source_types', verworfen: ['erfunden', '7'] }, { feld: 'status', verworfen: ['unklar'] }])
    expect(meta.status).toBe('unklar')
  })

  it('laesst gueltige, fehlende und leere Felder unveraendert', () => {
    const meta = { source_types: ['statement', ' programme '], status: '' }
    const { cleanedMeta, verworfen } = pruefeFacettenWerte(meta, ['source_types', 'status'], FACETTEN)
    expect(cleanedMeta).toEqual(meta)
    expect(verworfen).toEqual([])
  })

  it('prueft nur gebundene Felder', () => {
    expect(pruefeFacettenWerte({ status: 'unklar' }, ['source_types'], FACETTEN).verworfen).toEqual([])
  })
})

describe('Befund in job_status', () => {
  const verworfen = [{ feld: 'source_types', verworfen: ['erfunden'] }]

  it('nennt verworfene Werte aus dem Trace', () => {
    const ereignisse = ereignisseAusTrace({ trace: { events: [{ name: 'facet_values_rejected', ts: '2026-01-01T00:00:00Z', attributes: { verworfen } }] } })
    expect(befundeFuerJob({ status: 'completed', steps: [], ereignisse })).toContain('Facette "source_types": 1 Wert(e) ausserhalb des Woerterbuchs verworfen (erfunden)')
  })

  it('findet sie auch nur im Log', () => {
    const ereignisse = ereignisseAusTrace({ logs: [{ timestamp: '2026-01-01T00:00:00Z', phase: 'facet_values_rejected', message: 'x', details: { verworfen } }] })
    expect(befundeFuerJob({ status: 'completed', steps: [], ereignisse })).toContain('Facette "source_types": 1 Wert(e) ausserhalb des Woerterbuchs verworfen (erfunden)')
  })
})
