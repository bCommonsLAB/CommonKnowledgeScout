"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Wand2 } from "lucide-react"
import { toast } from "sonner"

interface GenerateDraftStepProps {
  templateId: string
  libraryId: string
  input: string
  onGenerate: (draft: { metadata: Record<string, unknown>; markdown: string }) => void
  generatedDraft?: { metadata: Record<string, unknown>; markdown: string }
  /** Optional: Telemetrie für Wizard-Session */
  onGenerateStarted?: () => void
  onGenerateFailed?: (error: unknown) => void
  /** Optional: Auto-Weiter nach erfolgreicher Generierung */
  autoAdvance?: boolean
  /** Optional: Callback für Weiter-Schritt */
  onAdvance?: () => void
  /** Optional: Ergebnis-Preview anzeigen (default: true) */
  showResultPreview?: boolean
}

export function GenerateDraftStep({
  templateId,
  libraryId,
  input,
  onGenerate,
  generatedDraft,
  onGenerateStarted,
  onGenerateFailed,
  autoAdvance = false,
  onAdvance,
  showResultPreview = true,
}: GenerateDraftStepProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const didAutoStartRef = useRef(false)
  const didAutoAdvanceRef = useRef(false)

  const handleGenerate = async () => {
    try {
      setIsGenerating(true)
      onGenerateStarted?.()

      // Rufe Secretary Service auf
      const formData = new FormData()
      formData.append("text", input)
      formData.append("template", templateId)
      formData.append("target_language", "de")

      const response = await fetch("/api/secretary/process-text", {
        method: "POST",
        headers: {
          "X-Library-Id": libraryId,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      // Parse die Antwort (strukturierte Daten + Markdown)
      // Die API gibt data.data zurück, also ist result bereits das data-Objekt
      const metadata = result.structured_data || {}
      const markdown = result.markdown || ""

      onGenerate({ metadata, markdown })
      toast.success("Entwurf erfolgreich generiert!")
    } catch (error) {
      toast.error(`Fehler beim Generieren: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`)
      onGenerateFailed?.(error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Auto-Start (wie beim Publish-Step): sobald wir einen Input haben.
  useEffect(() => {
    if (didAutoStartRef.current) return
    if (generatedDraft) return
    if (!input || !input.trim()) return
    didAutoStartRef.current = true
    void handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedDraft, input])

  useEffect(() => {
    if (!autoAdvance) return
    if (!generatedDraft) return
    if (didAutoAdvanceRef.current) return
    didAutoAdvanceRef.current = true
    onAdvance?.()
  }, [autoAdvance, generatedDraft, onAdvance])

  if (generatedDraft && showResultPreview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Entwurf generiert</CardTitle>
          <CardDescription>
            Der Entwurf wurde erfolgreich erstellt. Sie können ihn im nächsten Schritt überprüfen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Metadaten</h3>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-64">
              {JSON.stringify(generatedDraft.metadata, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Markdown-Vorschau</h3>
            <div className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-64">
              {generatedDraft.markdown || "(Kein Markdown-Inhalt)"}
            </div>
          </div>
          <Button onClick={handleGenerate} variant="outline" className="w-full">
            Neu generieren
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!showResultPreview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{generatedDraft ? "Entwurf bereit" : "Entwurf wird erstellt"}</CardTitle>
          <CardDescription>
            {generatedDraft
              ? "Wir wechseln automatisch zum nächsten Schritt."
              : "Bitte kurz warten – der Entwurf wird im Hintergrund erzeugt."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !input.trim() || !!generatedDraft}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Entwurf generieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entwurf generieren</CardTitle>
        <CardDescription>
          Der eingegebene Text wird nun mit dem Template verarbeitet und strukturierte Daten werden erstellt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm text-muted-foreground mb-2">Eingabe:</p>
            <p className="text-sm">{input.substring(0, 200)}{input.length > 200 ? "..." : ""}</p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !input.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Entwurf generieren
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

