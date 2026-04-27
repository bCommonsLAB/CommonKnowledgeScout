/**
 * @fileoverview Split-PDF-Pages-Button
 *
 * @description
 * Icon-Button im Library-Header. Sichtbar NUR, wenn aktuell eine PDF-Datei
 * selektiert ist. Klick -> POST `/api/library/[libraryId]/pdf/split-pages-to-images`,
 * legt die Phase-1-Seitenbilder als Kopien in einem Working-Verzeichnis neben
 * der PDF ab.
 *
 * Toast-Verhalten:
 *  - 200: "X von Y Seiten geschrieben" (mit Ordner-Name).
 *  - 422 + code='no_page_images': "Bitte Phase 1 Extraktion erneut laufen lassen".
 *  - Sonstige Fehler: generische Fehlermeldung.
 *
 * Nach erfolgreichem Aufruf wird `onCompleted` getriggert (typisch: refreshItems
 * im LibraryView), damit der neue Ordner sofort in der Liste erscheint.
 *
 * @module components/library
 *
 * @usedIn
 * - src/components/library/library-header.tsx
 */

'use client'

import * as React from 'react'
import { useAtomValue } from 'jotai'
// Hinweis: 'Images' (Plural) existiert in der aktuell installierten lucide-react
// Version nicht und sorgte fuer "element type undefined"-Renderfehler. Wir nutzen
// stattdessen 'ImageIcon' (offizieller Alias fuer das Image-Icon) - ist stabil
// und semantisch passend (eine Seite = ein Bild). Fuer den Plural-Eindruck reicht
// die Tooltip-Beschreibung "PDF-Seiten als Bilder ablegen".
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { activeLibraryIdAtom, selectedFileAtom } from '@/atoms/library-atom'
import { UILogger } from '@/lib/debug/logger'

interface SplitPdfPagesButtonProps {
  /** Wird nach erfolgreichem Lauf aufgerufen, damit die UI die neue Ordner-Liste laedt. */
  onCompleted?: () => void
}

/** Pruefung "ist es ein PDF" - basiert auf MIME-Type oder Datei-Endung. */
function isPdfFile(name: string | undefined, mimeType: string | undefined): boolean {
  if ((mimeType || '').toLowerCase() === 'application/pdf') return true
  return /\.pdf$/i.test(name || '')
}

export function SplitPdfPagesButton({ onCompleted }: SplitPdfPagesButtonProps) {
  const selectedFile = useAtomValue(selectedFileAtom)
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const [isRunning, setIsRunning] = React.useState(false)

  // Nur fuer PDF-Dateien sichtbar.
  const visible = React.useMemo(() => {
    if (!selectedFile || selectedFile.type !== 'file') return false
    return isPdfFile(selectedFile.metadata?.name, selectedFile.metadata?.mimeType)
  }, [selectedFile])

  const handleClick = React.useCallback(async () => {
    if (!selectedFile || !activeLibraryId) return
    setIsRunning(true)
    UILogger.info('SplitPdfPagesButton', 'Klick - Starte Aufruf', {
      sourceFileId: selectedFile.id,
      libraryId: activeLibraryId,
    })

    try {
      const response = await fetch(
        `/api/library/${encodeURIComponent(activeLibraryId)}/pdf/split-pages-to-images`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceFileId: selectedFile.id }),
        }
      )

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        code?: string
        folderName?: string
        created?: number
        skipped?: number
        pages?: number
      }

      if (response.status === 422 && data.code === 'no_page_images') {
        // Erwarteter Fehlerfall: alte PDFs ohne Page-Renderings.
        toast.error('Keine Seitenbilder gefunden', {
          description:
            'Bitte zuerst die Phase 1 Extraktion erneut laufen lassen, damit Seitenbilder gespeichert werden.',
        })
        return
      }

      if (!response.ok || !data.ok) {
        toast.error('PDF-Seiten konnten nicht abgelegt werden', {
          description: data.error || `Status ${response.status}`,
        })
        return
      }

      // Erfolg - klare Mengenangabe + Ordner-Name in der Beschreibung.
      const created = data.created ?? 0
      const total = data.pages ?? 0
      const skipped = data.skipped ?? 0
      const skippedHint = skipped > 0 ? ` (${skipped} bereits vorhanden uebersprungen)` : ''
      toast.success(`${created} von ${total} Seitenbildern abgelegt`, {
        description: `Ordner: ${data.folderName ?? '(unbekannt)'}${skippedHint}`,
      })
      onCompleted?.()
    } catch (error) {
      UILogger.error('SplitPdfPagesButton', 'Unerwarteter Fehler', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Unerwarteter Fehler', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      })
    } finally {
      setIsRunning(false)
    }
  }, [selectedFile, activeLibraryId, onCompleted])

  if (!visible) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isRunning}
      title="PDF-Seiten als Bilder ablegen"
      aria-label="PDF-Seiten als Bilder ablegen"
    >
      <ImageIcon className="h-4 w-4" />
    </Button>
  )
}
