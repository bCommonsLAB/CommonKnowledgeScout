/**
 * Beweis-Ziel D1 (Plan `story-dreiteilung-fragenchronik`, Paketierung): Im
 * Story-Modul geht jeder Request ueber die Instanz (`InstanceApi` aus
 * `@ks/api-client`), keiner ueber ein nacktes `fetch` — dieselbe Regel wie
 * im Explorer (`module-explorer/instanz-fetch.test.ts`), damit der Story-Modus
 * spaeter ohne zweiten Durchgang in `@ks/embed` laeuft.
 */

import { describe, it, expect } from 'vitest'
import { fetchFundstellen, nacktesFetchImPaket } from '../paket-fetch-schnitt'

const REPO_ROOT = process.cwd()
const PAKET = 'packages/module-story/src'

describe('Story-Modul spricht nur ueber die Instanz', () => {
  it('kein nacktes fetch im Paket', () => {
    const offenders = nacktesFetchImPaket(REPO_ROOT, PAKET)
    expect(
      offenders,
      `Nacktes fetch im Story-Modul:\n${offenders.join('\n')}\n` +
        'Requests laufen ueber die hereingereichte `instanz.fetch(…)`. Sonst verliert das Embed die Basis-URL.',
    ).toEqual([])
  })

  it('Gegenprobe: das Muster faengt nacktes fetch und laesst instanz.fetch durch', () => {
    expect(fetchFundstellen("const res = await fetch('/api/chat/lib/chats')")).toHaveLength(1)
    expect(fetchFundstellen('const res = await window.fetch(url)')).toHaveLength(1)
    expect(fetchFundstellen("const res = await instanz.fetch('/api/chat/lib/chats')")).toEqual([])
    expect(fetchFundstellen("// frueher: fetch('/api/…')")).toEqual([])
  })
})
