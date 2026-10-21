/**
 * Cowork-Test 21.10.2026: YouTube wies den Secretary bei allen 32 Videos ab
 * („Sign in to confirm you’re not a bot"). Die Deutung muss zur Cookie-Datei
 * fuehren und vor einem nutzlosen Neustart warnen.
 */
import { describe, expect, it } from 'vitest'
import { deuteFehler } from '@/lib/mcp/fehler-deutung'

describe('deuteFehler — youtube_anmeldung', () => {
  it('erkennt die Bot-Abweisung in der Secretary-Meldung; Wiederholen ohne Cookies zwecklos', () => {
    for (const meldung of [
      'Secretary media/resolve: [MEDIA_NOT_RESOLVABLE] Kein Medium aufloesbar: ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication.',
      "Sign in to confirm you're not a bot",
      'The provided YouTube account cookies are no longer valid',
    ]) {
      const d = deuteFehler([meldung])
      expect(d?.art, meldung).toBe('youtube_anmeldung')
      expect(d?.wiederholenSinnvoll).toBe(false)
      expect(d?.empfehlung).toContain('YTDLP_COOKIES_FILE')
    }
  })

  it('bleibt eng: ein gewoehnlicher Secretary-Abbruch ist keine Anmeldung', () => {
    expect(deuteFehler(['Request timed out'])?.art).toBe('secretary_abbruch')
    expect(deuteFehler(['Playlist ist leer'])).toBeNull()
  })
})
