/**
 * `storyGate` — das Site-Gate des Story-Moduls (D1, Paketgeruest).
 *
 * Die Voll-App liefert `story` aus (FULL_APP_MODULES); ein Host ohne das
 * Modul bekommt 404. Die Mechanik selbst ist in `shell/site-gate.test.ts`
 * belegt, hier zaehlt nur die Modul-Kennung.
 */

import { describe, it, expect } from 'vitest'
import { storyGate, STORY_MODULE } from '@ks/module-story'
import { DEFAULT_SITE_CONFIG } from '@ks/shell'

function req(headers: Record<string, string>) {
  return { headers: { get: (name: string) => headers[name.toLowerCase()] ?? null } }
}

describe('storyGate', () => {
  it('traegt die Modul-Kennung "story", und die Voll-App liefert sie aus', () => {
    expect(STORY_MODULE).toBe('story')
    expect(DEFAULT_SITE_CONFIG.modules).toContain('story')
  })

  it('laesst die Default-Site durch', () => {
    expect(storyGate(req({ host: 'knowledgescout.org' }))).toBeNull()
    expect(storyGate(req({}))).toBeNull()
  })
})
