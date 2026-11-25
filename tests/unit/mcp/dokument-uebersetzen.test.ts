/**
 * @fileoverview Plan einer Uebersetzung fuer `dokument_uebersetzen` (25.11.2026).
 *
 * Seiten der Website blieben einsprachig, weil nur der Knopf in der Galerie-Tabelle
 * Uebersetzungen ausloest. Das Werkzeug rechnet die Zielsprachen aus Auftrag oder Library —
 * und raet nichts: ohne Sprache des Dokuments oder ohne Zielsprache ein Fehler mit Klartext.
 */

import { describe, it, expect } from 'vitest'
import { planeUebersetzung } from '@/lib/mcp/dokument-uebersetzen'

describe('planeUebersetzung', () => {
  it('nimmt die Zielsprachen der Library und laesst die Quellsprache weg', () => {
    expect(planeUebersetzung({ language: 'en' }, ['de', 'en', 'it'], undefined)).toEqual({ quellsprache: 'en', zielsprachen: ['de', 'it'], herkunft: 'library' })
  })

  it('Zielsprachen aus dem Auftrag haben Vorrang, Dubletten fallen weg', () => {
    expect(planeUebersetzung({ language: 'en' }, ['it'], ['de', 'fr', 'de'])).toEqual({ quellsprache: 'en', zielsprachen: ['de', 'fr'], herkunft: 'auftrag' })
  })

  it('liest die Sprache auch aus sourceLanguage', () => {
    expect(planeUebersetzung({ sourceLanguage: 'de' }, ['en'], undefined).quellsprache).toBe('de')
  })

  it('ohne Sprache des Dokuments: Fehler, kein stiller Rueckfall auf Deutsch', () => {
    expect(() => planeUebersetzung({ title: 'x' }, ['en'], undefined)).toThrow(/keine Sprache/)
    expect(() => planeUebersetzung(undefined, ['en'], undefined)).toThrow(/keine Sprache/)
  })

  it('ohne Zielsprache: Fehler mit dem Weg zur Loesung', () => {
    expect(() => planeUebersetzung({ language: 'en' }, undefined, undefined)).toThrow(/Die Library hat keine eingestellt/)
    expect(() => planeUebersetzung({ language: 'en' }, [], undefined)).toThrow(/zielsprachen im Auftrag nennen/)
    expect(() => planeUebersetzung({ language: 'en' }, ['de'], ['en'])).toThrow(/ausser der Quellsprache/)
  })

  it('unbekannte Zielsprache wird abgewiesen', () => {
    expect(() => planeUebersetzung({ language: 'en' }, undefined, ['de', 'xx'])).toThrow(/Unbekannte Zielsprache: xx/)
  })
})
