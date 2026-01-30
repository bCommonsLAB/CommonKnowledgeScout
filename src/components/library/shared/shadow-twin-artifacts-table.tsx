/**
 * @fileoverview Shadow-Twin Artifacts Table Component
 *
 * @description
 * Wiederverwendbare Komponente zur Anzeige aller Shadow-Twin-Artefakte (Markdown + Binary-Fragmente)
 * in einer gruppierten Tabellenansicht. Lädt Daten aus MongoDB.
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BinaryFragment {
  sourceId: string
  sourceName: string
  name: string
  kind: string
  url?: string
  hash?: string
  mimeType?: string
  size?: number
  createdAt: string
}

interface Artifact {
  sourceId: string
  sourceName: string
  artifactFileName: string
  kind: 'transcript' | 'transformation'
  targetLanguage: string
  templateName?: string
  mongoUpserted: boolean
  filesystemDeleted?: boolean
}

interface FileEntry {
  sourceId: string
  sourceName: string
  fileName: string
  kind: string
  mimeType?: string
  size?: number
  url?: string
  hash?: string
  mongoUpserted: boolean
  filesystemDeleted: boolean
  artifactKind?: 'transcript' | 'transformation'
  targetLanguage?: string
  templateName?: string
}

interface ShadowTwinArtifactsTableProps {
  libraryId: string
  sourceId: string
  /** Optional: Artefakte aus Migration-Report oder State (wenn vorhanden) */
  artifacts?: Artifact[]
  /** Optional: Cleanup-Status aus Migration-Report */
  filesystemDeleted?: boolean
  /** Optional: Zeige auch Artefakte aus MongoDB (Standard: true) */
  loadFromMongo?: boolean
}

/**
 * Wiederverwendbare Komponente zur Anzeige aller Shadow-Twin-Artefakte
 */
export function ShadowTwinArtifactsTable({
  libraryId,
  sourceId,
  artifacts = [],
  filesystemDeleted = false,
  loadFromMongo = true,
}: ShadowTwinArtifactsTableProps) {
  const [binaryFragments, setBinaryFragments] = useState<BinaryFragment[]>([])
  const [mongoArtifacts, setMongoArtifacts] = useState<Artifact[]>([])
  const [loadingFragments, setLoadingFragments] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lade binaryFragments und Artefakte aus MongoDB
  useEffect(() => {
    if (!libraryId || !sourceId || !loadFromMongo) {
      // Wenn loadFromMongo=false, verwende nur die übergebenen Artefakte
      setBinaryFragments([])
      setMongoArtifacts([])
      setLoadingFragments(false)
      return
    }

    let cancelled = false
    async function loadFragments() {
      setLoadingFragments(true)
      setError(null)
      try {
        const res = await fetch(`/api/library/${libraryId}/shadow-twins/binary-fragments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceIds: [sourceId] }),
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json?.error || `HTTP ${res.status}`)
        }

        const json = await res.json() as { fragments?: BinaryFragment[]; artifacts?: Artifact[] }
        if (cancelled) return

        setBinaryFragments(json.fragments || [])
        setMongoArtifacts(json.artifacts || [])
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        // Wenn MongoDB nicht aktiv ist, ist das kein Fehler - einfach keine Fragments anzeigen
        if (!msg.includes('Mongo ist nicht aktiv')) {
          console.warn('Fehler beim Laden der binaryFragments:', msg)
        }
      } finally {
        if (!cancelled) {
          setLoadingFragments(false)
        }
      }
    }

    void loadFragments()
    return () => {
      cancelled = true
    }
  }, [libraryId, sourceId, loadFromMongo])

  // Hilfsfunktion: Versucht sourceId als Base64 zu dekodieren, um den Pfad zu erhalten
  const tryDecodePath = (id: string): string => {
    if (!id || id === 'root' || id === 'undefined' || id === 'null') {
      return ''
    }
    // Prüfe, ob es wie Base64 aussieht
    if (!/^[A-Za-z0-9+/=]+$/.test(id) || id.length % 4 !== 0) {
      return ''
    }
    try {
      // Browser-seitige Base64-Dekodierung
      const decoded = atob(id)
      if (decoded && decoded.includes('/') && !decoded.includes('..')) {
        return decoded.replace(/\\/g, '/')
      }
    } catch {
      // Ignoriere Dekodierungsfehler
    }
    return ''
  }

  // Kombiniere Artefakte und binaryFragments zu einer flachen Liste von Dateien
  // Verwende MongoDB-Artefakte, falls vorhanden, sonst die übergebenen Artefakte
  const effectiveArtifacts = mongoArtifacts.length > 0 ? mongoArtifacts : artifacts
  const allFiles: FileEntry[] = []

  // Füge Artefakte hinzu (Markdown-Dateien)
  for (const artifact of effectiveArtifacts) {
    allFiles.push({
      sourceId: artifact.sourceId,
      sourceName: artifact.sourceName || 'Unbekannt',
      fileName: artifact.artifactFileName,
      kind: 'markdown',
      mimeType: 'text/markdown',
      mongoUpserted: artifact.mongoUpserted,
      filesystemDeleted: artifact.filesystemDeleted || filesystemDeleted,
      artifactKind: artifact.kind,
      targetLanguage: artifact.targetLanguage,
      templateName: artifact.templateName,
    })
  }

  // Füge binaryFragments hinzu (nur wenn nicht bereits als Artefakt vorhanden)
  // Erstelle Set von Artefakt-Dateinamen für schnellen Lookup
  const artifactFileNames = new Set(artifacts.map((a) => a.artifactFileName.toLowerCase()))

  for (const fragment of binaryFragments) {
    // Überspringe Markdown-Dateien, die bereits als Artefakte vorhanden sind
    if (fragment.kind === 'markdown' && artifactFileNames.has(fragment.name.toLowerCase())) {
      continue
    }

    allFiles.push({
      sourceId: fragment.sourceId,
      sourceName: fragment.sourceName,
      fileName: fragment.name,
      kind: fragment.kind,
      mimeType: fragment.mimeType,
      size: fragment.size,
      url: fragment.url,
      hash: fragment.hash,
      mongoUpserted: !!fragment.url, // Wenn URL vorhanden, wurde es erfolgreich hochgeladen
      filesystemDeleted,
    })
  }

  // Gruppiere Dateien nach sourceId (normalerweise sollte alles zur gleichen sourceId gehören)
  const grouped = allFiles.reduce((acc, file) => {
    const id = file.sourceId || 'unknown'
    if (!acc[id]) {
      const decodedPath = tryDecodePath(id)
      acc[id] = {
        sourceId: id,
        sourceName: file.sourceName || 'Unbekannt',
        path: decodedPath,
        files: [],
      }
    }
    acc[id].files.push(file)
    return acc
  }, {} as Record<string, { sourceId: string; sourceName: string; path: string; files: FileEntry[] }>)

  const groups = Object.values(grouped).sort((a, b) => {
    // Sortiere nach Pfad, dann nach sourceName
    if (a.path && b.path) {
      return a.path.localeCompare(b.path)
    }
    if (a.path) return -1
    if (b.path) return 1
    return a.sourceName.localeCompare(b.sourceName)
  })

  if (loadingFragments) {
    return <div className="text-xs text-muted-foreground">Lade Artefakte aus MongoDB...</div>
  }

  if (error && !error.includes('Mongo ist nicht aktiv')) {
    return (
      <div className="text-xs text-destructive">
        Fehler beim Laden der Artefakte: {error}
      </div>
    )
  }

  if (allFiles.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Keine Artefakte gefunden. {error?.includes('Mongo ist nicht aktiv') ? '(MongoDB nicht aktiv)' : ''}
      </div>
    )
  }

  return (
    <div className="mt-2 max-h-[45vh] overflow-y-auto rounded border w-full">
      <Accordion type="multiple" className="w-full">
        {groups.map((group) => {
          const displayPath = group.path || 'Unbekanntes Verzeichnis'
          const displayName = group.sourceName
          const fileCount = group.files.length

          return (
            <AccordionItem key={group.sourceId} value={group.sourceId} className="border-b">
              <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                    <span className="font-medium text-left truncate max-w-full" title={displayPath}>
                      {displayPath}
                    </span>
                    <span className="text-muted-foreground text-[11px] truncate max-w-full" title={displayName}>
                      {displayName}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-[11px] ml-2 shrink-0">
                    {fileCount} {fileCount === 1 ? 'Datei' : 'Dateien'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <div style={{ minWidth: '1000px' }}>
                    <table className="w-full text-xs" style={{ minWidth: '1000px' }}>
                      <thead className="sticky top-0 bg-muted/60">
                        <tr className="text-left">
                          <TooltipProvider>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  Dateiname
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Name der verarbeiteten Datei (Markdown-Artefakt oder Binary-Fragment).</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  Typ
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Art der Datei: &quot;markdown&quot; (Artefakt), &quot;image&quot;, &quot;audio&quot;, &quot;video&quot; oder &quot;binary&quot;.</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  Größe
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Dateigröße in KB.</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  Azure URL
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Azure Blob Storage URL (für Binary-Fragmente).</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  Hash
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">SHA-256 Hash (erste 16 Zeichen) für Deduplizierung.</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  Mongo
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Status der MongoDB-Speicherung: &quot;upserted&quot; = erfolgreich gespeichert/aktualisiert, &quot;nein&quot; = nicht gespeichert.</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-1 font-medium">
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  FS gelöscht
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Ob die Dateisystemkopie nach erfolgreicher MongoDB-Migration gelöscht wurde: &quot;ja&quot; = gelöscht, &quot;nein&quot; = noch vorhanden oder Cleanup deaktiviert.</p>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                          </TooltipProvider>
                        </tr>
                      </thead>
                      <tbody>
                        {group.files.map((file, idx) => (
                          <tr key={`${file.sourceId}-${file.fileName}-${idx}`} className="border-t align-top">
                            <td className="px-2 py-1 font-medium max-w-[300px] break-words">{file.fileName}</td>
                            <td className="px-2 py-1">
                              {file.artifactKind ? `${file.kind} (${file.artifactKind})` : file.kind}
                            </td>
                            <td className="px-2 py-1">
                              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : '-'}
                            </td>
                            <td className="px-2 py-1 max-w-[400px] break-all text-[10px]">
                              {file.url ? (
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {file.url.length > 50 ? `${file.url.substring(0, 50)}...` : file.url}
                                </a>
                              ) : '-'}
                            </td>
                            <td className="px-2 py-1 font-mono text-[10px]">{file.hash || '-'}</td>
                            <td className="px-2 py-1">{file.mongoUpserted ? 'upserted' : 'nein'}</td>
                            <td className="px-2 py-1">{file.filesystemDeleted ? 'ja' : 'nein'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
