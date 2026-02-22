/**
 * @fileoverview Shadow-Twin Freshness Hooks
 *
 * @description
 * Zwei Hooks für Freshness-Checks:
 *
 * 1. useShadowTwinFreshness (client-seitig, Atom-only)
 *    Schneller Check: Source-Datei vs. Twin updatedAt (aus Atom).
 *    Erkennt: source-newer, no-twin.
 *    Erkennt NICHT: storage-newer, mongo-newer (dafür API nötig).
 *
 * 2. useShadowTwinFreshnessApi (server-seitig, via Freshness-API)
 *    Vollständiger Check pro Artefakt: Source vs. Mongo vs. Storage-Datei.
 *    Erkennt alle Fälle: source-newer, storage-newer, mongo-newer, storage-missing.
 *    Wird im FilePreview und Debug-Panel verwendet.
 *
 * @module shadow-twin
 *
 * @usedIn
 * - src/components/library/file-preview.tsx (Banner)
 * - src/components/debug/debug-footer.tsx (Debug-Panel)
 */

import { useMemo, useState, useEffect, useCallback } from 'react'
import type { StorageItem } from '@/lib/storage/types'
import type { FrontendShadowTwinState } from '@/atoms/shadow-twin-atom'

// ─── Gemeinsame Typen ────────────────────────────────────────────────

/**
 * Mögliche Freshness-Zustände (Zusammenfassung über alle Artefakte).
 */
export type FreshnessStatus =
  | 'loading'
  | 'synced'
  | 'source-newer'    // Quelldatei neuer als MongoDB
  | 'storage-newer'   // Artefakt-Datei im Storage neuer als MongoDB
  | 'storage-missing' // Artefakt in MongoDB vorhanden, aber nicht im Storage
  | 'no-twin'         // Kein Shadow-Twin vorhanden

/** Freshness-Info pro Artefakt (client-seitiger Atom-Check) */
export interface ArtifactFreshnessInfo {
  kind: 'transcript' | 'transformation'
  name: string
  twinUpdatedAt: Date | null
  isStale: boolean
}

/** Freshness-Info pro Artefakt (API-basiert, vollständig) */
export interface ApiFreshnessArtifact {
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  fileName: string
  status: 'synced' | 'source-newer' | 'storage-newer' | 'mongo-newer' | 'storage-missing' | 'mongo-missing'
  mongo: { updatedAt: string; createdAt: string } | null
  storage: { modifiedAt: string; fileId: string } | null
}

/** Gesamt-Ergebnis (kompatibel für Banner + Debug-Panel) */
export interface FreshnessInfo {
  status: FreshnessStatus
  sourceModifiedAt: Date | null
  twinUpdatedAt: Date | null
  diffMs: number | null
  /** Per-Artefakt (Atom-basiert – nur source-vs-twin) */
  artifacts: ArtifactFreshnessInfo[]
  staleCount: number
  /** Per-Artefakt (API-basiert – vollständig inkl. storage) */
  apiArtifacts: ApiFreshnessArtifact[]
  /** Anzahl nicht-synchroner Artefakte aus der API */
  apiIssueCount: number
  /** Lädt die API gerade? */
  apiLoading: boolean
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────

function toDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d : null
  }
  return null
}

// ─── Hook 1: Atom-only (schnell, kein API-Call) ──────────────────────

/**
 * Schneller Freshness-Check aus Atom-Daten.
 * Erkennt nur source-newer und no-twin.
 */
export function useShadowTwinFreshness(
  file: StorageItem | null | undefined,
  shadowTwinState: FrontendShadowTwinState | undefined
): FreshnessInfo {
  return useMemo<FreshnessInfo>(() => {
    const empty: FreshnessInfo = {
      status: 'loading', sourceModifiedAt: null, twinUpdatedAt: null,
      diffMs: null, artifacts: [], staleCount: 0,
      apiArtifacts: [], apiIssueCount: 0, apiLoading: false,
    }

    if (!file) return empty
    if (!shadowTwinState) return empty

    const sourceModifiedAt = toDate(file.metadata.modifiedAt)
    const artifacts: ArtifactFreshnessInfo[] = []

    if (shadowTwinState.transformed) {
      const twinDate = toDate(shadowTwinState.transformed.metadata?.modifiedAt)
      const isStale = !!(sourceModifiedAt && twinDate && sourceModifiedAt.getTime() > twinDate.getTime())
      artifacts.push({
        kind: 'transformation',
        name: shadowTwinState.transformed.metadata?.name || '(unbekannt)',
        twinUpdatedAt: twinDate,
        isStale,
      })
    }

    if (Array.isArray(shadowTwinState.transcriptFiles)) {
      for (const t of shadowTwinState.transcriptFiles) {
        const twinDate = toDate(t?.metadata?.modifiedAt)
        const isStale = !!(sourceModifiedAt && twinDate && sourceModifiedAt.getTime() > twinDate.getTime())
        artifacts.push({
          kind: 'transcript',
          name: t?.metadata?.name || '(unbekannt)',
          twinUpdatedAt: twinDate,
          isStale,
        })
      }
    }

    if (artifacts.length === 0) {
      return { ...empty, status: 'no-twin', sourceModifiedAt }
    }

    const twinDates = artifacts.map((a) => a.twinUpdatedAt).filter((d): d is Date => d !== null)
    const latestTwinDate = twinDates.length > 0
      ? twinDates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b))
      : null

    const staleCount = artifacts.filter((a) => a.isStale).length
    const diffMs = sourceModifiedAt && latestTwinDate
      ? sourceModifiedAt.getTime() - latestTwinDate.getTime()
      : null
    const status: FreshnessStatus = staleCount > 0 ? 'source-newer' : 'synced'

    return { status, sourceModifiedAt, twinUpdatedAt: latestTwinDate, diffMs, artifacts, staleCount, apiArtifacts: [], apiIssueCount: 0, apiLoading: false }
  }, [file, shadowTwinState])
}

// ─── Hook 2: API-basiert (vollständig) ───────────────────────────────

/** API-Response Typ */
interface FreshnessApiResponse {
  sourceFile: { id: string; name: string; modifiedAt: string | null }
  documentUpdatedAt: string | null
  artifacts: ApiFreshnessArtifact[]
  config: { primaryStore: string; persistToFilesystem: boolean; allowFilesystemFallback: boolean }
}

/**
 * Vollständiger Freshness-Check via API.
 * Vergleicht pro Artefakt: Source vs. MongoDB vs. Storage-Datei.
 * Erkennt alle Fälle inkl. storage-newer.
 *
 * @param libraryId Aktive Library
 * @param file Die ausgewählte Datei
 * @param shadowTwinState Shadow-Twin State (für Atom-basierte Ergänzung)
 */
export function useShadowTwinFreshnessApi(
  libraryId: string | null | undefined,
  file: StorageItem | null | undefined,
  shadowTwinState: FrontendShadowTwinState | undefined,
): FreshnessInfo {
  // Atom-basierter Check als Basis
  const atomFreshness = useShadowTwinFreshness(file, shadowTwinState)

  const [apiArtifacts, setApiArtifacts] = useState<ApiFreshnessArtifact[]>([])
  const [apiLoading, setApiLoading] = useState(false)

  const fileId = file?.id
  const parentId = file?.parentId

  const loadFreshness = useCallback(async () => {
    if (!libraryId || !fileId) {
      setApiArtifacts([])
      return
    }
    setApiLoading(true)
    try {
      const res = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/freshness`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: fileId, parentId }),
        }
      )
      if (!res.ok) {
        setApiArtifacts([])
        return
      }
      const json = (await res.json()) as FreshnessApiResponse
      setApiArtifacts(json.artifacts || [])
    } catch {
      setApiArtifacts([])
    } finally {
      setApiLoading(false)
    }
  }, [libraryId, fileId, parentId])

  // API aufrufen bei Datei-Wechsel
  useEffect(() => {
    void loadFreshness()
  }, [loadFreshness])

  // Kombinierter Status: API-Daten haben Vorrang (vollständiger Vergleich)
  return useMemo<FreshnessInfo>(() => {
    const apiIssueCount = apiArtifacts.filter((a) => a.status !== 'synced').length

    // Wenn API geladen und Probleme gefunden → API-Status verwenden
    if (!apiLoading && apiArtifacts.length > 0 && apiIssueCount > 0) {
      // Bestimme den dominierenden Status (Priorität: source-newer > storage-newer > storage-missing)
      const hasSourceNewer = apiArtifacts.some((a) => a.status === 'source-newer')
      const hasStorageNewer = apiArtifacts.some((a) => a.status === 'storage-newer')
      const hasStorageMissing = apiArtifacts.some((a) => a.status === 'storage-missing')

      let status: FreshnessStatus = 'synced'
      if (hasSourceNewer) status = 'source-newer'
      else if (hasStorageNewer) status = 'storage-newer'
      else if (hasStorageMissing) status = 'storage-missing'

      return {
        ...atomFreshness,
        status,
        apiArtifacts,
        apiIssueCount,
        apiLoading,
      }
    }

    // Wenn API noch lädt → Atom-Status + apiLoading Flag
    // Wenn API geladen und alles synchron → Atom-Status bestätigt
    return {
      ...atomFreshness,
      apiArtifacts,
      apiIssueCount,
      apiLoading,
    }
  }, [atomFreshness, apiArtifacts, apiLoading])
}
