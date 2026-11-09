/**
 * Benannte Regelsaetze (Owner 09.11.2026): Pruefung je Variante (Name,
 * Platzhalter), Wahl des Regeltexts fuer eine Anfrage (`?rules=<name>`,
 * unbekannt wirft, ohne Namen `antwortregeln`), Server-Schema und
 * Formular-Refinement mit denselben Regeln.
 */
import { describe, it, expect } from 'vitest'
import * as z from 'zod'
import { pruefeAntwortregelnVarianten, waehleAntwortregeln, type RegelFacette } from '@/lib/chat/antwortregeln'
import { pruefeAntwortregelnFormular, variantenAlsRecord } from '@/lib/chat/antwortregeln-formular'
import { chatConfigSchema } from '@/lib/chat/config'
import { streamAdresse } from '@ks/module-story/react'

const FACETS: RegelFacette[] = [{ metaKey: 'track', label: 'Track' }]

describe('pruefeAntwortregelnVarianten', () => {
  it('gueltige Varianten ergeben nichts; Name, leerer Text und Platzhalter sind je ein Fehler', () => {
    expect(pruefeAntwortregelnVarianten({ einladung: 'Ein Absatz je Talk nach {{facette:track}}.' }, FACETS)).toEqual([])
    expect(pruefeAntwortregelnVarianten(undefined, FACETS)).toEqual([])
    const f = pruefeAntwortregelnVarianten({ 'Gross Name': 'ok', leer: '   ', kaputt: '{{facette:nix}}' }, FACETS)
    expect(f.map((v) => v.name)).toEqual(['Gross Name', 'leer', 'kaputt'])
    expect(f[0].fehler[0].grund).toMatch(/klein/)
    expect(f[1].fehler[0].grund).toMatch(/ohne Text/)
    expect(f[2].fehler[0].grund).toMatch(/gibt es im Schema nicht/)
  })
})

describe('waehleAntwortregeln', () => {
  const cfg = { antwortregeln: 'Standard', antwortregelnVarianten: { einladung: 'Einladung' } }

  it('ohne Namen die Antwortregeln, mit Namen den Regelsatz; unbekannt wirft mit den vorhandenen Namen', () => {
    expect(waehleAntwortregeln(cfg, undefined)).toBe('Standard')
    expect(waehleAntwortregeln(cfg, '')).toBe('Standard')
    expect(waehleAntwortregeln(cfg, 'einladung')).toBe('Einladung')
    expect(() => waehleAntwortregeln(cfg, 'kurz')).toThrow(/„kurz".*vorhanden: einladung/)
    expect(() => waehleAntwortregeln({ antwortregeln: 'x' }, 'kurz')).toThrow(/keine benannten Regelsätze/)
  })

  it('der Story-Stream bekommt den Regelsatz nur als rules-Parameter, wenn er gesetzt ist', () => {
    const perspektive = { targetLanguage: 'de', character: [], accessPerspective: [], socialContext: 'general', genderInclusive: false, llmModel: 'm' } as unknown as Parameters<typeof streamAdresse>[1]['perspektive']
    expect(streamAdresse('lib', { perspektive, antwortLaenge: 'mittel', chatId: null, regelsatz: 'einladung' })).toContain('&rules=einladung')
    expect(streamAdresse('lib', { perspektive, antwortLaenge: 'mittel', chatId: null })).not.toContain('rules=')
  })
})

describe('chatConfigSchema mit antwortregelnVarianten', () => {
  it('nimmt gueltige Varianten an und weist Platzhalter-Fehler mit Pfad auf den Namen ab', () => {
    const basis = { gallery: { detailViewType: 'book', facets: [{ metaKey: 'track', label: 'Track', type: 'string' }] } }
    const ok = chatConfigSchema.safeParse({ ...basis, antwortregelnVarianten: { einladung: 'Nach {{facette:track}}.' } })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.antwortregelnVarianten).toEqual({ einladung: 'Nach {{facette:track}}.' })
    const kaputt = chatConfigSchema.safeParse({ ...basis, antwortregelnVarianten: { einladung: '{{legende:track}}' } })
    expect(kaputt.success).toBe(false)
    if (!kaputt.success) expect(kaputt.error.issues[0].path).toEqual(['antwortregelnVarianten', 'einladung'])
  })
})

describe('pruefeAntwortregelnFormular', () => {
  const schema = z.object({
    antwortregeln: z.string().optional(),
    antwortregelnVarianten: z.array(z.object({ name: z.string(), text: z.string() })).optional(),
    gallery: z.object({ facets: z.array(z.object({ metaKey: z.string(), label: z.string().optional() })) }).optional(),
  }).superRefine(pruefeAntwortregelnFormular)

  it('meldet doppelte Namen, leere Texte und Platzhalter am Listenfeld; Record fuers Speichern trimmt die Namen', () => {
    const r = schema.safeParse({ antwortregelnVarianten: [{ name: 'a', text: 'ok' }, { name: 'a ', text: ' ' }, { name: 'b', text: '{{facette:nix}}' }], gallery: { facets: FACETS } })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path.join('.'))).toEqual(['antwortregelnVarianten.1.name', 'antwortregelnVarianten.1.text', 'antwortregelnVarianten.2.text'])
    }
    expect(variantenAlsRecord([{ name: ' einladung ', text: 'T' }])).toEqual({ einladung: 'T' })
  })
})
