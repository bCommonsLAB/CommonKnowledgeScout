/**
 * @fileoverview Aufnahme-Journal im Browser (IndexedDB)
 *
 * @description
 * Haelt Mitschnitt und Transkript einer laufenden Aufnahme lokal fest, damit ein
 * Neuladen, ein Absturz oder ein versehentlich geschlossener Tab nichts vernichtet.
 * Gespeichert wird fortlaufend waehrend der Aufnahme, nicht erst am Ende.
 *
 * Bewusst ohne Zusatzpaket: IndexedDB reicht, und der Umfang ist klein.
 *
 * @module live-transcription
 *
 * @exports
 * - openRecordingStore: Oeffnet das Journal
 * - RecordingStore: Interface - Schreiben und Lesen einer Aufnahme
 *
 * @dependencies
 * - ./types: LiveSegment
 */

import type { LiveSegment } from './types'

const DATABASE_NAME = 'ks-live-transcription'
const DATABASE_VERSION = 1
const RECORDINGS = 'recordings'
const CHUNKS = 'chunks'

export interface StoredRecording {
  id: string
  startedAt: number
  updatedAt: number
  segments: LiveSegment[]
  /** Text, den der Nutzer bereits im Feld hatte, als die Aufnahme begann. */
  baseText: string
  finished: boolean
}

export interface RecordingStore {
  saveRecording: (recording: StoredRecording) => Promise<void>
  appendChunk: (recordingId: string, index: number, blob: Blob) => Promise<void>
  listRecordings: () => Promise<StoredRecording[]>
  readChunks: (recordingId: string) => Promise<Blob[]>
  deleteRecording: (recordingId: string) => Promise<void>
  close: () => void
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Zugriff fehlgeschlagen'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Dieser Browser bietet keine lokale Ablage (IndexedDB).'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(RECORDINGS)) {
        db.createObjectStore(RECORDINGS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CHUNKS)) {
        const store = db.createObjectStore(CHUNKS, { keyPath: ['recordingId', 'index'] })
        store.createIndex('recordingId', 'recordingId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Lokale Ablage nicht verfuegbar'))
  })
}

/** Oeffnet das Journal. Wirft, wenn der Browser keine lokale Ablage bietet. */
export async function openRecordingStore(): Promise<RecordingStore> {
  const db = await openDatabase()

  const write = async (storeName: string, value: unknown): Promise<void> => {
    const transaction = db.transaction(storeName, 'readwrite')
    await promisify(transaction.objectStore(storeName).put(value as never))
  }

  return {
    saveRecording: (recording) => write(RECORDINGS, recording),

    appendChunk: (recordingId, index, blob) => write(CHUNKS, { recordingId, index, blob }),

    listRecordings: async () => {
      const transaction = db.transaction(RECORDINGS, 'readonly')
      const all = await promisify<StoredRecording[]>(
        transaction.objectStore(RECORDINGS).getAll() as IDBRequest<StoredRecording[]>
      )
      return all.sort((left, right) => right.startedAt - left.startedAt)
    },

    readChunks: async (recordingId) => {
      const transaction = db.transaction(CHUNKS, 'readonly')
      const index = transaction.objectStore(CHUNKS).index('recordingId')
      const rows = await promisify<Array<{ index: number; blob: Blob }>>(
        index.getAll(recordingId) as IDBRequest<Array<{ index: number; blob: Blob }>>
      )
      return rows.sort((left, right) => left.index - right.index).map((row) => row.blob)
    },

    deleteRecording: async (recordingId) => {
      const transaction = db.transaction([RECORDINGS, CHUNKS], 'readwrite')
      transaction.objectStore(RECORDINGS).delete(recordingId)
      const index = transaction.objectStore(CHUNKS).index('recordingId')
      const keys = await promisify<IDBValidKey[]>(
        index.getAllKeys(recordingId) as IDBRequest<IDBValidKey[]>
      )
      const chunkStore = transaction.objectStore(CHUNKS)
      for (const key of keys) chunkStore.delete(key)
    },

    close: () => db.close(),
  }
}
