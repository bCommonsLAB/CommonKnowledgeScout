/**
 * Welle ST8b — das Standard-LLM-Modell kommt aus der Library-Konfiguration.
 *
 * `secretaryService.llmModel` gab es die ganze Zeit — direkt neben
 * `template`, aus dem `standardTemplate()` schon liest. Die Werkbank nutzt
 * es (`file-preview.tsx`), die Bruecke nicht: Sie gab GAR KEIN Modell mit
 * und fiel damit auf den Default eines fremden Dienstes zurueck. Genau der
 * stand am 28.08.2026 auf einer ungueltigen Modell-Id.
 *
 * Die Bruecke soll sich nicht anders verhalten als der Knopf.
 */
import { describe, expect, it } from 'vitest'
import { modellHinweis, standardLlmModell } from '@/lib/mcp/tools-erschliessen-shared'
import type { Library } from '@/types/library'

function library(llmModel?: string): Library {
  return { config: { secretaryService: { apiUrl: '', apiKey: '', llmModel } } } as unknown as Library
}

describe('standardLlmModell', () => {
  it('liest dasselbe Feld wie die Werkbank', () => {
    expect(standardLlmModell(library('google/gemini-2.5-flash'))).toBe('google/gemini-2.5-flash')
  })

  it('behandelt Leerraum und fehlende Konfiguration als „nicht gesetzt"', () => {
    expect(standardLlmModell(library('   '))).toBeUndefined()
    expect(standardLlmModell(library(undefined))).toBeUndefined()
    expect(standardLlmModell({} as Library)).toBeUndefined()
  })

  it('wirft NICHT — anders als standardTemplate', () => {
    // Bibliotheken ohne eigenes Modell laufen heute ueber den
    // Secretary-Default. Den abzuschneiden waere eine Verhaltensaenderung,
    // die niemand bestellt hat; sichtbar machen genuegt.
    expect(() => standardLlmModell(library(undefined))).not.toThrow()
  })
})

describe('modellHinweis', () => {
  it('nennt die Konfiguration als einzige Quelle — und dass sie nicht je Aufruf waehlbar ist', () => {
    // Owner-Entscheid 28.08.2026: Der Client waehlt die Vorlage, das Modell
    // gehoert dem Betreiber der Library. Eine Aufruf-Herkunft gibt es nicht.
    const hinweis = modellHinweis('google/gemini-2.5-flash')
    expect(hinweis).toMatch(/aus der Library-Konfiguration/)
    expect(hinweis).toMatch(/Nicht je Aufruf waehlbar/)
  })

  it('warnt ausdruecklich, wenn die Library kein Modell konfiguriert hat', () => {
    const hinweis = modellHinweis(undefined)
    expect(hinweis).toMatch(/KEIN LLM-Modell in der Library konfiguriert/)
    // Der Vorfall gehoert in die Meldung — sonst sucht der naechste wieder
    // bei den Vorlagen. Und die Zustaendigkeit auch: Betreiber, nicht Agent.
    expect(hinweis).toMatch(/28\.08\.2026/)
    expect(hinweis).toMatch(/NUR der Betreiber/)
  })
})
