"use client"

/**
 * @fileoverview Wiederverwendbarer Dialog zum Auswählen von Medien aus dem Quellverzeichnis.
 *
 * Wird im Creation Wizard (UploadImagesStep) verwendet, um vorhandene Bilder
 * aus dem Verzeichnis auszuwählen statt neue hochzuladen.
 * Nutzt die gleiche streaming-url Route wie der MediaTab im Transformationsdialog.
 */

import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Image as ImageIcon, Check, Loader2, FolderOpen } from 'lucide-react'
import { useStorage } from '@/contexts/storage-context'
import type { StorageItem } from '@/lib/storage/types'

/** Bildname + ID für die Rückgabe an den Consumer */
export interface PickedMedia {
  id: string
  name: string
  previewUrl: string
}

interface FolderMediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  /** Verzeichnis-ID, aus dem Medien geladen werden */
  folderId: string
  /** Erlaubt Mehrfachauswahl (für Array-Felder wie galleryImageUrls) */
  multiple?: boolean
  /** Callback mit den ausgewählten Medien (Dateien werden noch nicht hochgeladen) */
  onSelect: (items: PickedMedia[]) => void
}

/** Bild-Dateierweiterungen die im Picker angezeigt werden */
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'avif'])

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTENSIONS.has(ext)
}

/**
 * Dialog der alle Bild-Dateien aus einem Verzeichnis anzeigt.
 * Der Benutzer kann ein oder mehrere Bilder auswählen.
 * Die Vorschau nutzt die provider-agnostische streaming-url Route.
 */
export function FolderMediaPickerDialog({
  open,
  onOpenChange,
  libraryId,
  folderId,
  multiple = false,
  onSelect,
}: FolderMediaPickerDialogProps) {
  const { provider } = useStorage()
  const [items, setItems] = useState<StorageItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Dateien laden wenn Dialog geöffnet wird
  useEffect(() => {
    if (!open || !provider || !folderId) return
    let cancelled = false

    async function loadItems() {
      setIsLoading(true)
      try {
        const folderItems = await provider!.listItemsById(folderId)
        if (cancelled) return
        // Nur Bild-Dateien anzeigen
        const images = folderItems.filter(
          item => item.type === 'file' && isImageFile(item.metadata.name)
        )
        setItems(images)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadItems()
    return () => { cancelled = true }
  }, [open, provider, folderId])

  // Auswahl zurücksetzen wenn Dialog geschlossen wird
  useEffect(() => {
    if (!open) setSelected(new Set())
  }, [open])

  const toggleItem = useCallback((item: StorageItem) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        // Bei Einfachauswahl: vorherige Auswahl ersetzen
        if (!multiple) next.clear()
        next.add(item.id)
      }
      return next
    })
  }, [multiple])

  const handleConfirm = useCallback(() => {
    const picked: PickedMedia[] = items
      .filter(item => selected.has(item.id))
      .map(item => ({
        id: item.id,
        name: item.metadata.name,
        previewUrl: `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(item.id)}`,
      }))
    onSelect(picked)
    onOpenChange(false)
  }, [items, selected, libraryId, onSelect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Medien aus Verzeichnis
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? 'Wähle ein oder mehrere Bilder aus dem Verzeichnis aus.'
              : 'Wähle ein Bild aus dem Verzeichnis aus.'}
          </DialogDescription>
        </DialogHeader>

        {/* Grid mit Medien */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Lade Medien...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Keine Bilder im Verzeichnis gefunden.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {items.map(item => {
                const isSelected = selected.has(item.id)
                const previewUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(item.id)}`
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item)}
                    className={`
                      relative aspect-square rounded-lg overflow-hidden border-2 transition-all
                      hover:border-primary/50 hover:ring-1 hover:ring-primary/20
                      ${isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-muted'
                      }
                    `}
                    title={item.metadata.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Vorschau via streaming-url */}
                    <img
                      src={previewUrl}
                      alt={item.metadata.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Dateiname */}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                      {item.metadata.name}
                    </div>
                    {/* Auswahl-Badge */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            {selected.size === 0
              ? 'Auswählen'
              : selected.size === 1
                ? '1 Bild übernehmen'
                : `${selected.size} Bilder übernehmen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
