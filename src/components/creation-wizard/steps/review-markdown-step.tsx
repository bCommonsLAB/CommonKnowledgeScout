"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { MarkdownPreview } from "@/components/library/markdown-preview"

interface ReviewMarkdownStepProps {
  title?: string
  markdown: string
  onMarkdownChange: (next: string) => void
  isConfirmed: boolean
  onConfirmedChange: (next: boolean) => void
}

export function ReviewMarkdownStep({
  title,
  markdown,
  onMarkdownChange,
  isConfirmed,
  onConfirmedChange,
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
          <MarkdownPreview content={trimmed} />
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


