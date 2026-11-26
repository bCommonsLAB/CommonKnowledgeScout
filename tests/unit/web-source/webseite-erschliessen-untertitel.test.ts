/**
 * @fileoverview `webseiteErschliessen` mit `transkript: "untertitel"` (Handover 26.11.2026):
 * kein Medium, kein Transkriptions-Job, Untertitel als Quelldatei mit Transkript am Twin;
 * ohne brauchbare Spur ein Fehler — die Tonspur nur mit `rueckfall: true`.
 * Secretary, Twin-Schreiber, Cover und Job-Einreihung sind Attrappen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageProvider } from '@/lib/storage/types'

const m = vi.hoisted(() => ({
  holeUntertitelViaSecretary: vi.fn(), resolveMediaViaSecretary: vi.fn(), holeMedium: vi.fn(), holeCover: vi.fn(),
  persistShadowTwinToMongo: vi.fn(), enqueueSourceTranscribeJob: vi.fn(), ladeVideoCookies: vi.fn(),
}))

vi.mock('@/lib/web-source/untertitel', async (original) => ({ ...(await original<typeof import('@/lib/web-source/untertitel')>()), holeUntertitelViaSecretary: m.holeUntertitelViaSecretary }))
vi.mock('@/lib/web-source/media-resolve', () => ({ resolveMediaViaSecretary: m.resolveMediaViaSecretary }))
vi.mock('@/lib/web-source/medium-und-cover', () => ({ holeMedium: m.holeMedium, holeCover: m.holeCover }))
vi.mock('@/lib/shadow-twin/shadow-twin-mongo-writer', () => ({ persistShadowTwinToMongo: m.persistShadowTwinToMongo }))
vi.mock('@/lib/external-jobs/enqueue-secretary-job', () => ({ enqueueSourceTranscribeJob: m.enqueueSourceTranscribeJob }))
vi.mock('@/lib/video-login/video-login-service', () => ({ ladeVideoCookies: m.ladeVideoCookies }))

import type { Untertitel } from '@/lib/web-source/untertitel'
import { webseiteErschliessen } from '@/lib/web-source/webseite-erschliessen'

const VIDEO = 'https://www.youtube.com/watch?v=abc123def45'
const METADATA = { description: 'Side event on climate finance.', uploadDate: '2026-11-10', uploader: 'Konferenz', channel: 'Konferenz-Kanal', kapitel: [{ start: 0, ende: 60, titel: 'Opening remarks' }], tags: [], thumbnail: 'https://i.ytimg.com/x.jpg', webpageUrl: VIDEO }
const UNTERTITEL: Untertitel = {
  extractor: 'youtube', title: 'Klimafinanzierung im Gespraech', duration: 5120, sprache: 'en', art: 'automatisch', spur: 'en-orig', format: 'json3',
  text: '[00:00:01] good morning everyone', absaetze: 1,
  abdeckung: { beginn: 1.2, ende: 5104, anteil: 0.997, groessteLuecke: 12.4, groessteLueckeBei: 2310, zeilen: 2890, woerter: 11840 },
  metadata: METADATA,
}

interface Abgelegt { id: string; name: string; type: string; inhalt: string }

function attrappe(): { provider: StorageProvider; dateien: Abgelegt[]; geloescht: string[] } {
  const dateien: Abgelegt[] = []
  const geloescht: string[] = []
  const provider = {
    listItemsById: vi.fn(async () => []),
    uploadFile: vi.fn(async (parentId: string, file: File) => {
      const eintrag = { id: `id-${dateien.length + 1}`, name: file.name, type: file.type, inhalt: await file.text() }
      dateien.push(eintrag)
      return { id: eintrag.id, parentId, type: 'file', metadata: { name: file.name, size: file.size, modifiedAt: new Date(), mimeType: file.type } }
    }),
    deleteItem: vi.fn(async (id: string) => { geloescht.push(id) }),
  }
  return { provider: provider as unknown as StorageProvider, dateien, geloescht }
}

function eingabe(provider: StorageProvider, teil: Record<string, unknown> = {}) {
  return {
    libraryId: 'lib', userEmail: 'o@x', provider, url: VIDEO, folderId: 'ordner', dateiname: 'Side Event.md',
    targetLanguage: 'en', audioContext: {}, medienHolen: true, transkript: 'untertitel' as const, ...teil,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.ladeVideoCookies.mockResolvedValue('cookie-inhalt')
  m.holeCover.mockResolvedValue({ buffer: Buffer.from('bild'), ext: 'jpg', mimeType: 'image/jpeg' })
  m.holeUntertitelViaSecretary.mockResolvedValue(UNTERTITEL)
  m.persistShadowTwinToMongo.mockResolvedValue({ markdown: '', imageCount: 0, imageErrorsCount: 0 })
  m.enqueueSourceTranscribeJob.mockResolvedValue({ jobId: 'job-1' })
})

describe('webseiteErschliessen, transkript: untertitel', () => {
  it('laedt kein Medium, startet keinen Job und legt Untertitel, Cover, Sammeldatei und Twin-Transkript an', async () => {
    const { provider, dateien } = attrappe()
    const r = await webseiteErschliessen(eingabe(provider, { untertitelSprache: 'en' }))

    expect(m.holeUntertitelViaSecretary).toHaveBeenCalledWith(VIDEO, 'cookie-inhalt', 'en')
    expect(m.resolveMediaViaSecretary).not.toHaveBeenCalled()
    expect(m.holeMedium).not.toHaveBeenCalled()
    expect(m.enqueueSourceTranscribeJob).not.toHaveBeenCalled()
    expect(dateien.map((d) => d.name)).toEqual(['Side Event - Cover.jpg', 'Side Event - Untertitel.txt', 'Side Event.md'])

    const txt = dateien[1]
    expect(txt.type).toBe('text/plain')
    expect(txt.inhalt).toMatch(/^Untertitel: YouTube, automatisch erzeugt, Sprache en, abgerufen am \d{4}-\d{2}-\d{2}\nQuelle: /)
    const md = dateien[2].inhalt
    expect(md).toContain('title: "Klimafinanzierung im Gespraech"')
    expect(md).toContain('Side Event - Untertitel.txt')
    expect(md).toMatch(/_source_files:[^\n]*Side Event - Untertitel\.txt/)
    expect(md).toContain('## Transkript aus Untertiteln\n\n- Untertitel: [[Side Event - Untertitel.txt]] (YouTube, automatisch erzeugt, Sprache en, abgerufen am ')
    expect(md).not.toContain('- Audio')
    expect(md).toContain('video_url:')

    expect(m.persistShadowTwinToMongo).toHaveBeenCalledTimes(1)
    const twin = m.persistShadowTwinToMongo.mock.calls[0][0] as { sourceItem: { id: string }; artifactKey: unknown; markdown: string; generatedBy: string }
    expect(twin.sourceItem.id).toBe(txt.id)
    expect(twin.artifactKey).toEqual({ sourceId: txt.id, kind: 'transcript', targetLanguage: 'en' })
    expect(twin.generatedBy).toBe('knowledgescout/untertitel')
    expect(twin.markdown).toContain('transcript_origin: "subtitles"')
    expect(twin.markdown).toContain('[00:00:01] good morning everyone')

    expect(r.transkript).toMatchObject({ weg: 'untertitel', spur: 'en, automatisch', rueckfallGrund: null })
    expect(r.transkript.herkunft).toMatch(/^YouTube, automatisch erzeugt, Sprache en, abgerufen am /)
    expect(r.untertitel).toMatchObject({ sourceId: txt.id, name: 'Side Event - Untertitel.txt', woerter: 11840, abdeckungAnteil: 0.997 })
    expect(r.medium).toBeNull()
    expect(r.mediumGrund).toBe('transkript: untertitel — kein Medium geladen')
    expect(r.metadatenQuelle).toBe('ytdlp')
    expect(r.kapitel).toBe(1)
    expect(r.hinweise.some((h) => h.includes('automatisch erzeugten Untertiteln'))).toBe(true)
  })

  it('ohne brauchbare Spur und ohne rueckfall: Fehler mit Grund, nichts geschrieben', async () => {
    const { provider, dateien } = attrappe()
    m.holeUntertitelViaSecretary.mockRejectedValue(new Error('Secretary media/subtitles: [SUBTITLES_NOT_AVAILABLE] Das Video traegt keine Untertitel'))
    await expect(webseiteErschliessen(eingabe(provider))).rejects.toThrow(/Keine Untertitel: Secretary media\/subtitles: \[SUBTITLES_NOT_AVAILABLE\] Das Video traegt keine Untertitel — nichts geschrieben\. Mit rueckfall: true/)
    expect(dateien).toEqual([])
    expect(m.resolveMediaViaSecretary).not.toHaveBeenCalled()
  })

  it('mit rueckfall: die Tonspur wird transkribiert, der Grund steht in der Antwort', async () => {
    const { provider, dateien } = attrappe()
    m.holeUntertitelViaSecretary.mockRejectedValue(new Error('Secretary media/subtitles: [SUBTITLES_NOT_AVAILABLE] Das Video traegt keine Untertitel'))
    m.resolveMediaViaSecretary.mockResolvedValue({ extractor: 'youtube', title: 'Klimafinanzierung im Gespraech', metadata: METADATA, duration: 5120 })
    m.holeMedium.mockResolvedValue({ datei: { buffer: Buffer.from('ton'), mimeType: 'audio/mp4', ext: 'm4a' }, dauer: 5120, weg: 'secretary-download' })
    const r = await webseiteErschliessen(eingabe(provider, { rueckfall: true, audioContext: { speakerMode: false } }))
    expect(dateien.map((d) => d.name)).toEqual(['Side Event - Audio.m4a', 'Side Event - Cover.jpg', 'Side Event.md'])
    expect(m.enqueueSourceTranscribeJob).toHaveBeenCalledTimes(1)
    expect(m.persistShadowTwinToMongo).not.toHaveBeenCalled()
    expect(r.transkript).toEqual({ weg: 'tonspur', spur: null, herkunft: null, rueckfallGrund: 'Secretary media/subtitles: [SUBTITLES_NOT_AVAILABLE] Das Video traegt keine Untertitel' })
    expect(r.untertitel).toBeNull()
    expect(r.medium?.jobId).toBe('job-1')
  })

  it('scheitert das Schreiben am Twin, werden die hochgeladenen Dateien wieder entfernt', async () => {
    const { provider, dateien, geloescht } = attrappe()
    m.persistShadowTwinToMongo.mockRejectedValue(new Error('Mongo nicht erreichbar'))
    await expect(webseiteErschliessen(eingabe(provider))).rejects.toThrow(/Mongo nicht erreichbar — 3 schon hochgeladene Datei\(en\) wieder entfernt/)
    expect(geloescht.sort()).toEqual(dateien.map((d) => d.id).sort())
  })

  it('weist Widersprueche ab: Audio-Optionen ohne rueckfall, medienHolen: false', async () => {
    const { provider, dateien } = attrappe()
    await expect(webseiteErschliessen(eingabe(provider, { audioContext: { speakerMode: true } }))).rejects.toThrow(/gelten nur fuer die Transkription der Tonspur/)
    await expect(webseiteErschliessen(eingabe(provider, { medienHolen: false }))).rejects.toThrow(/widersprechen sich/)
    expect(m.holeUntertitelViaSecretary).not.toHaveBeenCalled()
    expect(dateien).toEqual([])
  })

  it('Vorgabe tonspur: der Untertitel-Weg wird nicht angefasst', async () => {
    const { provider } = attrappe()
    m.resolveMediaViaSecretary.mockResolvedValue({ extractor: 'youtube', title: 'Klimafinanzierung im Gespraech', metadata: METADATA, duration: 5120 })
    m.holeMedium.mockResolvedValue({ datei: { buffer: Buffer.from('ton'), mimeType: 'audio/mp4', ext: 'm4a' }, dauer: 5120, weg: 'secretary-download' })
    const r = await webseiteErschliessen(eingabe(provider, { transkript: undefined }))
    expect(m.holeUntertitelViaSecretary).not.toHaveBeenCalled()
    expect(r.transkript).toEqual({ weg: 'tonspur', spur: null, herkunft: null, rueckfallGrund: null })
  })
})
