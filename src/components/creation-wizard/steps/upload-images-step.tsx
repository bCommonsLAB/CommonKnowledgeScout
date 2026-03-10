"use client"

import * as React from "react"
import { useRef, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, Loader2, Plus, X, FolderOpen } from "lucide-react"
import type { TemplateCreationImageField } from "@/lib/templates/template-types"
import { toast } from "sonner"
import { FolderMediaPickerDialog, type PickedMedia } from "../folder-media-picker-dialog"

interface UploadImagesStepProps {
  /** Liste der konfigurierten Bildfelder aus dem Template */
  imageFields: TemplateCreationImageField[]
  /** Aktuell ausgewählte Dateien pro Bildfeld-Key */
  selectedFiles: Record<string, File | null>
  /** Bereits hochgeladene URLs pro Bildfeld-Key (einzeln oder Array) */
  imageUrls?: Record<string, string | string[]>
  /** Upload-State: welche Bilder gerade hochgeladen werden */
  isUploadingImages?: Record<string, boolean>
  /** Library-ID für Upload */
  libraryId: string
  /** Quellverzeichnis-ID für den Medien-Picker (optional, wenn nicht vorhanden wird Button nicht angezeigt) */
  sourceFolderId?: string
  /** Callback wenn Dateien ausgewählt werden (triggert Upload) */
  onChangeSelectedFiles: (key: string, file: File | null) => void
  /** Callback wenn Upload abgeschlossen ist (einzelnes Bild) */
  onUploadComplete?: (key: string, url: string) => void
  /** Callback wenn ein Bild aus einem Array-Feld entfernt wird */
  onRemoveArrayImage?: (key: string, index: number) => void
}

/**
 * Step zum Hochladen von Bildern für konfigurierte Bildfelder.
 * Unterstützt einzelne Bilder (coverImageUrl) und Array-Felder (galleryImageUrls).
 * Bilder werden sofort nach Azure hochgeladen, damit sie im Preview angezeigt werden können.
 */
export function UploadImagesStep({
  imageFields,
  selectedFiles,
  imageUrls = {},
  isUploadingImages = {},
  libraryId,
  sourceFolderId,
  onChangeSelectedFiles,
  onUploadComplete,
  onRemoveArrayImage,
}: UploadImagesStepProps) {
  // State für den Medien-Picker-Dialog
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFieldKey, setPickerFieldKey] = useState<string | null>(null)
  const [pickerMultiple, setPickerMultiple] = useState(false)

  const uploadFile = async (key: string, file: File) => {
    onChangeSelectedFiles(key, file)

    try {
      const tempOwnerId = `temp_${Date.now()}`
      const scope = 'sessions'

      const formData = new FormData()
      formData.append('file', file)
      formData.append('key', key)
      formData.append('ownerId', tempOwnerId)
      formData.append('scope', scope)

      const response = await fetch('/api/creation/upload-image', {
        method: 'POST',
        headers: { 'X-Library-Id': libraryId },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      if (result.url && typeof result.url === 'string') {
        onUploadComplete?.(key, result.url)
        toast.success(`Bild hochgeladen`)
      }
    } catch (error) {
      toast.error(`Fehler beim Hochladen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      onChangeSelectedFiles(key, null)
    }
  }

  const handleFileChange = async (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (!file) {
      onChangeSelectedFiles(key, null)
      return
    }
    await uploadFile(key, file)
  }

  /** Öffnet den Verzeichnis-Picker für ein bestimmtes Feld */
  const openPicker = useCallback((fieldKey: string, isMultiple: boolean) => {
    setPickerFieldKey(fieldKey)
    setPickerMultiple(isMultiple)
    setPickerOpen(true)
  }, [])

  /**
   * Verarbeitet die Auswahl aus dem Verzeichnis-Picker:
   * Lädt jedes Bild via streaming-url herunter und lädt es dann via Upload-API hoch.
   */
  const handlePickerSelect = useCallback(async (items: PickedMedia[]) => {
    if (!pickerFieldKey || items.length === 0) return

    for (const item of items) {
      try {
        // Bild via streaming-url herunterladen
        const res = await fetch(item.previewUrl)
        if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`)
        const blob = await res.blob()
        const file = new File([blob], item.name, { type: blob.type || 'image/jpeg' })

        // Via bestehende Upload-Logik hochladen
        await uploadFile(pickerFieldKey, file)
      } catch (error) {
        toast.error(`Fehler bei "${item.name}": ${error instanceof Error ? error.message : 'Unbekannt'}`)
      }
    }
  }, [pickerFieldKey, uploadFile])

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Medien zuordnen</CardTitle>
          <CardDescription>
            Lade Bilder hoch oder wähle vorhandene Medien aus dem Verzeichnis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {imageFields.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Keine Bildfelder konfiguriert.
            </div>
          ) : (
            imageFields.map((field) =>
              field.multiple
                ? <MultiImageField
                    key={field.key}
                    field={field}
                    urls={imageUrls[field.key]}
                    isUploading={isUploadingImages[field.key] || false}
                    onUpload={(file) => uploadFile(field.key, file)}
                    onRemove={(index) => onRemoveArrayImage?.(field.key, index)}
                    hasFolderPicker={!!sourceFolderId}
                    onOpenPicker={() => openPicker(field.key, true)}
                  />
                : <SingleImageField
                    key={field.key}
                    field={field}
                    selectedFile={selectedFiles[field.key] || null}
                    imageUrl={typeof imageUrls[field.key] === 'string' ? imageUrls[field.key] as string : undefined}
                    isUploading={isUploadingImages[field.key] || false}
                    onFileChange={(e) => handleFileChange(field.key, e)}
                    onRemove={() => onChangeSelectedFiles(field.key, null)}
                    hasFolderPicker={!!sourceFolderId}
                    onOpenPicker={() => openPicker(field.key, false)}
                  />
            )
          )}
        </CardContent>
      </Card>

      {/* Wiederverwendbarer Picker-Dialog für alle Bildfelder */}
      {sourceFolderId && (
        <FolderMediaPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          libraryId={libraryId}
          folderId={sourceFolderId}
          multiple={pickerMultiple}
          onSelect={handlePickerSelect}
        />
      )}
    </>
  )
}

// ── Einzelbild-Feld (bisheriges Verhalten) ───────────────────────────────────

interface SingleImageFieldProps {
  field: TemplateCreationImageField
  selectedFile: File | null
  imageUrl?: string
  isUploading: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  /** Zeigt den "Aus Verzeichnis"-Button wenn ein Quellverzeichnis vorhanden ist */
  hasFolderPicker?: boolean
  onOpenPicker?: () => void
}

function SingleImageField({ field, selectedFile, imageUrl, isUploading, onFileChange, onRemove, hasFolderPicker, onOpenPicker }: SingleImageFieldProps) {
  const previewUrl = imageUrl || (selectedFile ? URL.createObjectURL(selectedFile) : null)

  return (
    <div className="space-y-2">
      <Label htmlFor={`image-${field.key}`}>
        {field.label || field.key}
      </Label>
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              id={`image-${field.key}`}
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="cursor-pointer"
              disabled={isUploading}
            />
            {hasFolderPicker && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenPicker}
                disabled={isUploading}
                className="gap-1.5 whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Aus Verzeichnis
              </Button>
            )}
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Wird hochgeladen...
                </span>
              ) : imageUrl ? (
                <span className="text-green-600 dark:text-green-400">&#10003; Hochgeladen</span>
              ) : (
                `Ausgewählt: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`
              )}
            </p>
          )}
        </div>

        {/* Preview oder Placeholder */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 border rounded overflow-hidden bg-muted flex items-center justify-center">
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- Preview nutzt (blob:) Object-URLs */
              <img src={previewUrl} alt={field.label || field.key} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {selectedFile && (
        <button type="button" onClick={onRemove} className="text-sm text-destructive hover:underline">
          Bild entfernen
        </button>
      )}
    </div>
  )
}

// ── Multi-Image-Feld (Array: Galerie, Autoren-Bilder etc.) ──────────────────

interface MultiImageFieldProps {
  field: TemplateCreationImageField
  urls: string | string[] | undefined
  isUploading: boolean
  onUpload: (file: File) => void
  onRemove: (index: number) => void
  /** Zeigt den "Aus Verzeichnis"-Button wenn ein Quellverzeichnis vorhanden ist */
  hasFolderPicker?: boolean
  onOpenPicker?: () => void
}

function MultiImageField({ field, urls, isUploading, onUpload, onRemove, hasFolderPicker, onOpenPicker }: MultiImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlArray = Array.isArray(urls) ? urls : (typeof urls === 'string' && urls ? [urls] : [])

  return (
    <div className="space-y-3">
      <Label>
        {field.label || field.key}
        {urlArray.length > 0 && (
          <span className="text-muted-foreground font-normal ml-2">({urlArray.length} Bilder)</span>
        )}
      </Label>

      {/* Grid der hochgeladenen Bilder */}
      {urlArray.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {urlArray.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative group">
              <div className="aspect-square border rounded overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- Galerie-Preview mit Azure-URLs */}
                <img src={url} alt={`${field.label || field.key} ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(idx)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Bild hinzufügen: Datei-Upload + Verzeichnis-Picker */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
          disabled={isUploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-1.5"
        >
          {isUploading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Wird hochgeladen...</>
          ) : (
            <><Plus className="w-3.5 h-3.5" /> Bild hinzufügen</>
          )}
        </Button>
        {hasFolderPicker && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenPicker}
            disabled={isUploading}
            className="gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Aus Verzeichnis
          </Button>
        )}
      </div>

      {urlArray.length === 0 && !isUploading && (
        <p className="text-sm text-muted-foreground">
          Noch keine Bilder hinzugefügt.
        </p>
      )}
    </div>
  )
}
