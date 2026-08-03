"use client"

import * as React from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"

interface WebsiteImageUploadProps {
  libraryId: string
  /** Wird mit der öffentlichen Blob-URL aufgerufen, sobald der Upload fertig ist. */
  onUploaded: (url: string) => void
  /** Button-Beschriftung (z. B. „Bild hochladen" / „Bild ändern"). */
  label: string
}

/**
 * Upload-Knopf für Website-Bilder: lädt die Datei über
 * POST /api/libraries/[id]/website-image direkt in den ÖFFENTLICH lesbaren
 * Azure-Blob (`<libraryId>/website/images/`) und meldet die fertige URL zurück.
 */
export function WebsiteImageUpload({ libraryId, onUploaded, label }: WebsiteImageUploadProps): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = React.useState(false)

  async function handleFile(file: File): Promise<void> {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}/website-image`, {
        method: "POST",
        body: formData,
      })
      const json: unknown = await res.json()
      const parsed = json as { url?: string; error?: string }
      if (!res.ok || typeof parsed.url !== "string") {
        throw new Error(parsed.error || `Upload fehlgeschlagen (HTTP ${res.status})`)
      }
      onUploaded(parsed.url)
      toast({
        title: "Bild hochgeladen",
        description: "Das Bild ist übernommen — bitte noch speichern.",
      })
    } catch (error) {
      toast({
        title: "Upload fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      // Gleiche Datei erneut wählbar machen
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    </>
  )
}

interface WebsiteImageFieldProps {
  libraryId: string
  /** Aktuelle Bild-URL aus dem Formular ('' = kein Bild). */
  value: string
  onChange: (url: string) => void
  /** Alt-Text der Vorschau, z. B. „Website-Logo". */
  imageAlt: string
}

/**
 * Zentrales Bild-Feld für die Public-Settings (Logo + Hintergrundbild):
 * zeigt eine VORSCHAU des Bildes statt der rohen URL — die URL erscheint nur
 * als Tooltip (title) und hinter „URL manuell bearbeiten" für Power-User.
 */
export function WebsiteImageField({ libraryId, value, onChange, imageAlt }: WebsiteImageFieldProps): React.ReactElement {
  const [showUrlInput, setShowUrlInput] = React.useState(false)

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* Vorschau; title = URL als Tooltip, Klick öffnet das Bild im neuen Tab */}
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            title={value}
            className="block shrink-0 overflow-hidden rounded-md border bg-muted/30 p-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={imageAlt} className="h-16 w-auto max-w-[12rem] object-contain" />
          </a>
          <div className="flex flex-wrap gap-2">
            <WebsiteImageUpload libraryId={libraryId} onUploaded={onChange} label="Bild ändern" />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              Entfernen
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <WebsiteImageUpload libraryId={libraryId} onUploaded={onChange} label="Bild hochladen" />
        </div>
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => setShowUrlInput((v) => !v)}
      >
        {showUrlInput ? "URL-Feld ausblenden" : "URL manuell bearbeiten"}
      </button>
      {showUrlInput && (
        <Input
          type="url"
          value={value}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
