"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Image as ImageIcon, Loader2 } from "lucide-react"
import type { TemplateCreationImageField } from "@/lib/templates/template-types"
import { toast } from "sonner"

interface UploadImagesStepProps {
  /** Liste der konfigurierten Bildfelder aus dem Template */
  imageFields: TemplateCreationImageField[]
  /** Aktuell ausgewählte Dateien pro Bildfeld-Key */
  selectedFiles: Record<string, File | null>
  /** Bereits hochgeladene URLs pro Bildfeld-Key */
  imageUrls?: Record<string, string>
  /** Upload-State: welche Bilder gerade hochgeladen werden */
  isUploadingImages?: Record<string, boolean>
  /** Library-ID für Upload */
  libraryId: string
  /** Callback wenn Dateien ausgewählt werden (triggert Upload) */
  onChangeSelectedFiles: (key: string, file: File | null) => void
  /** Callback wenn Upload abgeschlossen ist */
  onUploadComplete?: (key: string, url: string) => void
}

/**
 * Step zum Hochladen von Bildern für konfigurierte Bildfelder
 * Bilder werden sofort nach Azure hochgeladen, damit sie im Preview angezeigt werden können
 */
export function UploadImagesStep({
  imageFields,
  selectedFiles,
  imageUrls = {},
  isUploadingImages = {},
  libraryId,
  onChangeSelectedFiles,
  onUploadComplete,
}: UploadImagesStepProps) {
  const handleFileChange = async (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    
    if (!file) {
      onChangeSelectedFiles(key, null)
      return
    }

    // Datei sofort setzen (für lokale Preview)
    onChangeSelectedFiles(key, file)

    // Upload sofort starten
    try {
      // Verwende temporäre OwnerId (wird beim Speichern durch echte OwnerId ersetzt)
      const tempOwnerId = `temp_${Date.now()}`
      const scope = 'sessions' // Default, wird beim Speichern korrigiert falls nötig

      const formData = new FormData()
      formData.append('file', file)
      formData.append('key', key)
      formData.append('ownerId', tempOwnerId)
      formData.append('scope', scope)

      const response = await fetch('/api/creation/upload-image', {
        method: 'POST',
        headers: {
          'X-Library-Id': libraryId,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      if (result.url && typeof result.url === 'string') {
        onUploadComplete?.(key, result.url)
        toast.success(`Bild für ${key} hochgeladen`)
      }
    } catch (error) {
      toast.error(`Fehler beim Hochladen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      // Datei zurücksetzen bei Fehler
      onChangeSelectedFiles(key, null)
    }
  }

  const getPreviewUrl = (key: string, file: File | null): string | null => {
    // Bevorzuge hochgeladene URL, sonst lokale Preview
    if (imageUrls[key]) {
      return imageUrls[key]
    }
    if (file) {
      return URL.createObjectURL(file)
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bilder hochladen</CardTitle>
        <CardDescription>
          Wähle Bilder für die konfigurierten Felder aus. Die Bilder werden sofort nach Azure hochgeladen und können im Preview angezeigt werden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {imageFields.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Keine Bildfelder konfiguriert.
          </div>
        ) : (
          imageFields.map((field) => {
            const selectedFile = selectedFiles[field.key] || null
            const previewUrl = getPreviewUrl(field.key, selectedFile)
            const isUploading = isUploadingImages[field.key] || false

            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`image-${field.key}`}>
                  {field.label || field.key}
                </Label>
                <div className="flex items-start gap-4">
                  {/* File Input */}
                  <div className="flex-1">
                    <Input
                      id={`image-${field.key}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(field.key, e)}
                      className="cursor-pointer"
                      disabled={isUploading}
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {isUploading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Wird hochgeladen...
                          </span>
                        ) : imageUrls[field.key] ? (
                          <span className="text-green-600 dark:text-green-400">✓ Hochgeladen</span>
                        ) : (
                          `Ausgewählt: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`
                        )}
                      </p>
                    )}
                  </div>

                  {/* Preview */}
                  {previewUrl && (
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 border rounded overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={previewUrl}
                          alt={`Preview für ${field.label || field.key}`}
                          className="w-full h-full object-cover"
                          onLoad={() => {
                            // Cleanup wird beim Unmount gemacht
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Placeholder Icon wenn kein Bild */}
                  {!previewUrl && (
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 border rounded overflow-hidden bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => onChangeSelectedFiles(field.key, null)}
                    className="text-sm text-destructive hover:underline"
                  >
                    Bild entfernen
                  </button>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

