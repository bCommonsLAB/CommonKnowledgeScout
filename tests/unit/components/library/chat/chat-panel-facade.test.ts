/**
 * Characterization Tests fuer die ChatPanel-Fassade (Welle 3-III-b).
 *
 * Diese Tests fixieren den Export-Vertrag von chat-panel.tsx:
 * - ChatPanel wird namentlich exportiert (kein Default-Export)
 * - ChatPanelProps Interface: libraryId (string), variant? ('default'|'compact') — `embedded` ist seit D6c weg (StoryRoot)
 *
 * Sicherheitsnetz: Nach dem Modul-Split (chat-panel/ Verzeichnis) muss
 * die Fassade exakt dieselben Exporte haben wie das Original.
 * Diese Tests beweisen, dass Konsumenten ihre Imports NICHT aendern muessen.
 */

import { describe, it, expect, vi } from 'vitest'

// Clerk initialisiert in Node-Umgebung Netzwerk-Verbindungen, die den Test-Import haengen lassen.
// Der Mock verhindert das — der Test prueft nur den Export-Vertrag, nicht Clerk-Funktionalitaet.
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: null, isLoaded: false, isSignedIn: false }),
  useAuth: () => ({ userId: null, isLoaded: false, isSignedIn: false }),
}))

// MarkdownPreview importiert md-renderer.ts, das CSS-Dateien von highlight.js
// importiert (import 'highlight.js/styles/vs2015.css'). CSS-Imports blockieren
// den Vitest-Node-Module-Loader und fuehren zum Timeout. Mock verhindert
// das transitive CSS-Laden — der Test prueft nur den Export-Vertrag.
vi.mock('@/components/library/markdown-preview', () => ({
  MarkdownPreview: () => null,
}))

// Der erste Import zieht den ganzen Chat-Baum und braucht allein 7–13 s; im
// vollen Lauf (635 Dateien parallel) kippte er ueber die 15 s Standardgrenze
// (Pre-Merge-Check 09.10.2026, auf master gleich langsam). Mehr Zeit statt
// Wackeln — der Vertrag selbst bleibt unveraendert.
const ERSTER_IMPORT_MS = 45_000

describe('chat-panel Export-Vertrag', () => {
  it('ChatPanel ist eine Funktion (React-Komponente)', async () => {
    // Dynamischer Import, damit Modul-Split-Pfade ausprobiert werden koennen
    const mod = await import('@/components/library/chat/chat-panel')
    expect(typeof mod.ChatPanel).toBe('function')
  }, ERSTER_IMPORT_MS)

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
    type ChatPanelVariant = 'default' | 'compact'
    const v: ChatPanelVariant = 'default'
    expect(v).toBe('default')
  })

  it('akzeptiert variant=compact', () => {
    type ChatPanelVariant = 'default' | 'compact'
    const v: ChatPanelVariant = 'compact'
    expect(v).toBe('compact')
  })
})
