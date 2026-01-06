"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import type { StorageProvider } from "@/lib/storage/types"

interface ReviewMarkdownStepProps {
  title?: string
  markdown: string
  onMarkdownChange: (next: string) => void
  isConfirmed: boolean
  onConfirmedChange: (next: boolean) => void
  isProcessing?: boolean
  processingProgress?: number
  processingMessage?: string
  /** Für korrekte Bild-Auflösung in MarkdownPreview (relative Links) */
  provider?: StorageProvider | null
  /** Folder-ID, relativ zu der Images/Links aufgelöst werden sollen */
  currentFolderId?: string
}

export function ReviewMarkdownStep({
  title,
  markdown,
  onMarkdownChange,
  isConfirmed,
  onConfirmedChange,
  isProcessing = false,
  processingProgress,
  processingMessage,
  provider = null,
  currentFolderId = 'root',
}: ReviewMarkdownStepProps) {
  const [showPreview, setShowPreview] = useState(false)

  const trimmed = useMemo(() => (markdown || "").trim(), [markdown])
  const hint = trimmed.length === 0
    ? "Noch kein Markdown vorhanden. Bitte gehe zurück und starte die OCR-Verarbeitung."
    : "Prüfe das OCR-Markdown. Korrigiere offensichtliche Fehler (Zeilenumbrüche, Trennstriche, Überschriften)."

  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="text-2xl font-semibold">{title || "Markdown prüfen"}</div>
        <div className="text-sm text-muted-foreground mt-1">{hint}</div>
      </div>

      {isProcessing && (
        <div className="border rounded-md p-4 bg-muted/30">
          <div className="text-sm font-medium">Metadaten/Template werden generiert…</div>
          <div className="text-xs text-muted-foreground mt-1">{processingMessage || 'Bitte warten…'}</div>
          <div className="mt-3">
            <Progress value={typeof processingProgress === 'number' ? Math.max(0, Math.min(100, processingProgress)) : 0} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="confirmMarkdown"
          checked={isConfirmed}
          onCheckedChange={(v) => onConfirmedChange(v === true)}
        />
        <label htmlFor="confirmMarkdown" className="text-sm">
          Ich habe das Markdown geprüft (mindestens grob).
        </label>

        <div className="ml-auto">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(v => !v)}>
            {showPreview ? "Editor" : "Vorschau"}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <div className="border rounded-md p-3 bg-background max-h-[65vh] overflow-auto">
          <MarkdownPreview content={trimmed} provider={provider} currentFolderId={currentFolderId} compact />
        </div>
      ) : (
        <Textarea
          value={markdown}
          onChange={(e) => onMarkdownChange(e.target.value)}
          className="min-h-[60vh] font-mono text-xs"
          placeholder="OCR-Markdown…"
        />
      )}
    </Card>
  )
}


