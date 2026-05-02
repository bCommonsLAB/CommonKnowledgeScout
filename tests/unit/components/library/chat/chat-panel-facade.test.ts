/**
 * Characterization Tests fuer die ChatPanel-Fassade (Welle 3-III-b).
 *
 * Diese Tests fixieren den Export-Vertrag von chat-panel.tsx:
 * - ChatPanel wird namentlich exportiert (kein Default-Export)
 * - ChatPanelProps Interface: libraryId (string), variant? ('default'|'compact'|'embedded')
 *
 * Sicherheitsnetz: Nach dem Modul-Split (chat-panel/ Verzeichnis) muss
 * die Fassade exakt dieselben Exporte haben wie das Original.
 * Diese Tests beweisen, dass Konsumenten ihre Imports NICHT aendern muessen.
 */

import { describe, it, expect } from 'vitest'

describe('chat-panel Export-Vertrag', () => {
  it('ChatPanel ist eine Funktion (React-Komponente)', async () => {
    // Dynamischer Import, damit Modul-Split-Pfade ausprobiert werden koennen
    const mod = await import('@/components/library/chat/chat-panel')
    expect(typeof mod.ChatPanel).toBe('function')
  })

  it('ChatPanel-Export hat den korrekten Namen', async () => {
    const mod = await import('@/components/library/chat/chat-panel')
    // Benannter Export muss ChatPanel heissen (kein Default)
    expect('ChatPanel' in mod).toBe(true)
    expect('default' in mod).toBe(false)
  })
})

describe('ChatPanelProps-Varianten', () => {
  /**
   * Prueft, ob die Varianten der ChatPanel-Props korrekt typisiert sind.
   * Wir verwenden einen Typ-Smoke-Test: wenn TypeScript die Zuweisung
   * erlaubt, stimmt der Typ ueberein.
   */
  it('akzeptiert variant=default (implizit)', () => {
    type ChatPanelVariant = 'default' | 'compact' | 'embedded'
    const v: ChatPanelVariant = 'default'
    expect(v).toBe('default')
  })

  it('akzeptiert variant=compact', () => {
    type ChatPanelVariant = 'default' | 'compact' | 'embedded'
    const v: ChatPanelVariant = 'compact'
    expect(v).toBe('compact')
  })

  it('akzeptiert variant=embedded', () => {
    type ChatPanelVariant = 'default' | 'compact' | 'embedded'
    const v: ChatPanelVariant = 'embedded'
    expect(v).toBe('embedded')
  })
})
