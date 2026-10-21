/**
 * Welle K3 — web-source-Jobs (Playlist-Video, Playlist-Lesen): Builder-Form,
 * Optionen typgeprueft zurueck, Stapel-Zugehoerigkeit, kaputte Jobs fallen laut.
 */
import { describe, expect, it } from 'vitest'
import { buildSourceTranscribeJob } from '@/lib/external-jobs/enqueue-secretary-job'
import {
  buildPlaylistLesenJob, buildWebSourceJob, lesePlaylistLesenOptionen, leseWebSourceOptionen,
} from '@/lib/external-jobs/enqueue-web-source'
import type { ExternalJob } from '@/types/external-job'

const OPTIONEN = {
  url: 'https://www.youtube.com/watch?v=abc', folderId: 'ordner-7', wurzelId: 'wurzel', ordner: '07 Abend 7', dateiname: '07 Abend 7.md',
  targetLanguage: 'de', audioContext: { speakerMode: true }, llmModel: 'modell-x', medienEinbetten: true, position: 7, titel: 'Abend 7',
}
const BATCH = { batchId: 'batch-1', batchName: 'Playlist: Dialogreihe' }

function alsJob(job: Omit<ExternalJob, 'createdAt' | 'updatedAt'>): ExternalJob {
  return { ...job, createdAt: new Date(), updatedAt: new Date() } as ExternalJob
}

describe('buildWebSourceJob', () => {
  it('baut einen in-process-Job je Video mit batchId, Ordner als Quelle und den Optionen in der Correlation', () => {
    const job = buildWebSourceJob({ jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', optionen: OPTIONEN, batch: BATCH })
    expect(job).toMatchObject({ job_type: 'web-source', operation: 'erschliessen', worker: 'secretary', status: 'queued', steps: [{ name: 'web_source', status: 'pending' }] })
    expect(job.correlation).toMatchObject({ batchId: 'batch-1', batchName: 'Playlist: Dialogreihe' })
    expect(job.correlation.source).toMatchObject({ itemId: 'ordner-7', parentId: 'wurzel', name: '07 Abend 7/07 Abend 7.md', mediaType: 'web-source' })
    expect(leseWebSourceOptionen(alsJob(job))).toEqual(OPTIONEN)
  })

  it('wirft ohne url/folderId oder mit Dateiname ohne .md; kaputte Jobs fallen beim Lesen laut', () => {
    expect(() => buildWebSourceJob({ jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', optionen: { ...OPTIONEN, dateiname: 'x.txt' }, batch: BATCH })).toThrow(/dateiname auf \.md/)
    const kaputt = { correlation: { options: { url: 'https://x' } } } as unknown as ExternalJob
    expect(() => leseWebSourceOptionen(kaputt)).toThrow(/web-source-Job ohne folderId/)
  })
})

describe('buildPlaylistLesenJob', () => {
  it('baut den Lesejob mit Wurzel als Quelle; Optionen kommen typgeprueft zurueck', () => {
    const job = buildPlaylistLesenJob({ jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', optionen: { url: 'https://www.youtube.com/playlist?list=PL1', wurzelId: 'wurzel', titel: 'Dialogreihe' } })
    expect(job).toMatchObject({ job_type: 'web-source', operation: 'playlist-lesen', status: 'queued' })
    expect(job.correlation.source).toMatchObject({ itemId: 'wurzel', name: 'Playlist: Dialogreihe', mediaType: 'playlist' })
    expect(lesePlaylistLesenOptionen(alsJob(job))).toEqual({ url: 'https://www.youtube.com/playlist?list=PL1', wurzelId: 'wurzel', titel: 'Dialogreihe' })
    expect(() => lesePlaylistLesenOptionen({ correlation: { options: {} } } as unknown as ExternalJob)).toThrow(/playlist-lesen-Job ohne url/)
  })
})

describe('buildSourceTranscribeJob mit batch', () => {
  it('der Transkriptions-Job erbt batchId und batchName des Stapels; ohne batch bleibt die Correlation wie bisher', () => {
    const basis = { jobId: 'j', jobSecretHash: 'h', libraryId: 'lib', userEmail: 'o@x', source: { itemId: 'a', parentId: 'p', name: 'x - Audio.m4a' }, mediaType: 'audio' as const, ingest: false }
    const mit = buildSourceTranscribeJob({ ...basis, batch: BATCH })
    expect(mit.correlation).toMatchObject({ batchId: 'batch-1', batchName: 'Playlist: Dialogreihe' })
    const ohne = buildSourceTranscribeJob(basis)
    expect(ohne.correlation.batchId).toBeUndefined()
    expect(ohne.correlation.batchName).toBeUndefined()
  })
})
