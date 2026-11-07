/**
 * Fehlertext der Template-Phase ohne structured_data: Die Ursache aus
 * `runTemplateTransform` (`error`, HTTP-Status) haengt am bekannten Satz.
 */

import { describe, expect, it } from 'vitest'
import { OHNE_STRUCTURED_DATA, fehlertextOhneStructuredData } from '@/lib/external-jobs/template-fehlertext'

describe('fehlertextOhneStructuredData', () => {
  it('haengt Ursache und HTTP-Status an den bekannten Satz', () => {
    const text = fehlertextOhneStructuredData({
      error: 'Composite-Kontext ungültig: Quellenübersicht meldet 7 Quelle(n), aber Source-Blöcke sind inkonsistent (open=<source file= 1, close=</source> 1).',
      status: 400,
      statusText: 'BAD REQUEST',
    })
    expect(text).toBe(
      `${OHNE_STRUCTURED_DATA} (HTTP 400 BAD REQUEST): Composite-Kontext ungültig: Quellenübersicht meldet 7 Quelle(n), aber Source-Blöcke sind inkonsistent (open=<source file= 1, close=</source> 1).`,
    )
  })

  it('kommt ohne Status aus', () => {
    expect(fehlertextOhneStructuredData({ error: 'Secretary: [llm_json] Expecting delimiter' })).toBe(
      `${OHNE_STRUCTURED_DATA}: Secretary: [llm_json] Expecting delimiter`,
    )
  })

  it('bleibt beim bekannten Satz, wenn keine Ursache mitkommt', () => {
    expect(fehlertextOhneStructuredData({})).toBe(OHNE_STRUCTURED_DATA)
    expect(fehlertextOhneStructuredData({ error: '   ', status: 502 })).toBe(`${OHNE_STRUCTURED_DATA} (HTTP 502)`)
  })
})
