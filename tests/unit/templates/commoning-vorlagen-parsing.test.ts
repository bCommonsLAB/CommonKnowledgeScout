import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'

/**
 * Die beiden Commoning-Vorlagen (Musterkarte, Methode) muessen fehlerfrei
 * parsen und die Felder tragen, die commoning-methods fuer das Manifest
 * liest (docs/app-concept/manifest-aus-knowledgescout-konzept.md, Abschnitt 6
 * im Partner-Repo). Kalibrierung 2026-09-18: beispiele als Array neben
 * beispiele_md, year als Zahl oder null, Ueberschriften ohne Doppelpunkt.
 */
function lade(name: string) {
  const content = readFileSync(join(process.cwd(), 'template-samples', `${name}.md`), 'utf-8')
  return parseTemplate(content, name)
}

describe('template-samples/commoning-musterkarte-de.md', () => {
  it('parst fehlerfrei mit book-Ansicht und docType commoning_musterkarte', () => {
    const { template, errors } = lade('commoning-musterkarte-de')
    expect(errors).toEqual([])
    expect(template.metadata.detailViewType).toBe('book')
    expect(template.metadata.rawFrontmatter).toContain('docType: commoning_musterkarte')
    expect(template.systemprompt).toContain('GENAU die Schlüssel des Antwortschemas')
  })

  it('traegt die Manifest-Felder und beide Beispiel-Felder', () => {
    const { template } = lade('commoning-musterkarte-de')
    const variables = template.metadata.fields.map(f => f.variable)
    for (const feld of [
      'title', 'slug', 'familie', 'form', 'karten_nummer', 'frage', 'haupttext',
      'beispiele_md', 'beispiele', 'bearbeitungsstatus', 'verwandte_musterkarten',
      'audio_url', 'audio_stream_url', 'attachments_url', 'coverImageUrl',
      'bild_vorderseite', 'bild_rueckseite', 'filename', 'path',
    ]) {
      expect(variables, feld).toContain(feld)
    }
  })
})

describe('template-samples/commoning-methode-de.md', () => {
  it('parst fehlerfrei mit book-Ansicht und docType commoning_methode', () => {
    const { template, errors } = lade('commoning-methode-de')
    expect(errors).toEqual([])
    expect(template.metadata.detailViewType).toBe('book')
    expect(template.metadata.rawFrontmatter).toContain('docType: commoning_methode')
    expect(template.systemprompt).toContain('ohne abschließenden Doppelpunkt')
    expect(template.systemprompt).toContain('Silbentrennung')
  })

  it('traegt die Manifest-Felder der Methode', () => {
    const { template } = lade('commoning-methode-de')
    const variables = template.metadata.fields.map(f => f.variable)
    for (const feld of [
      'title', 'slug', 'methoden_nummer', 'kurzbeschreibung', 'durchfuehrung_md',
      'bezug_mustersprache', 'passende_musterkarten', 'bearbeitungsstatus',
      'video_watch_url', 'video_url', 'video_beschreibung', 'attachments_url',
      'coverImageUrl', 'bild_seite_1', 'filename', 'path',
    ]) {
      expect(variables, feld).toContain(feld)
    }
  })
})
