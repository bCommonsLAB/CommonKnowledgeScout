"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { CreationSource } from "@/lib/templates/template-types"
import { Link, Upload, Plus, Loader2, FileText, Mic, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { DictationTextarea } from "@/components/shared/dictation-textarea"
import { SecretaryServiceError } from "@/lib/secretary/client"
import type { WizardSource } from "@/lib/creation/corpus"
import { buildSourceSummary } from "@/lib/creation/corpus"
import type { TemplateMetadataSchema } from "@/lib/templates/template-types"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import type { StorageProvider } from "@/lib/storage/types"
import { Progress } from "@/components/ui/progress"

interface CollectSourceStepProps {
  source?: CreationSource // Optional: Wenn nicht gesetzt, zeige Quelle-Auswahl
  mode?: 'interview' | 'form'
  // Legacy: onCollect (wird schrittweise durch onAddSource ersetzt)
  onCollect?: (content: string) => void
  onCollectStructured?: (result: { metadata: Record<string, unknown>; markdown?: string }) => void
  collectedInput?: string
  // Multi-Source: Neue Props
  sources?: WizardSource[]
  onAddSource?: (source: WizardSource) => void
  onRemoveSource?: (sourceId: string) => void
  isExtracting?: boolean
  processingProgress?: number
  processingMessage?: string
  templateId?: string
  libraryId?: string
  /**
   * Optional: Storage Provider (für External-Jobs Upload-First Flow).
   * Wenn nicht vorhanden, fällt der Step auf synchrone Calls zurück.
   */
  provider?: StorageProvider
  /**
   * Optional: Zielordner im Storage, in dem Wizard-Quellen abgelegt werden.
   * Default: "root".
   */
  targetFolderId?: string
  // Spickzettel: Benötigte Felder anzeigen
  templateMetadata?: TemplateMetadataSchema
  requiredFields?: string[]
  // Callback: Wird aufgerufen, wenn der Step verlassen wird, um noch nicht hinzugefügte Quellen zu erfassen
  onBeforeLeave?: () => WizardSource | null
  /**
   * Signalisiert dem Parent, ob "Weiter" im collectSource Step aktuell möglich ist.
   * Der "Weiter"-Button sitzt im Parent (`CreationWizard`) und muss dafür neu rendern.
   */
  onCanProceedChange?: (canProceed: boolean) => void
  // Quelle-Auswahl (wenn source nicht gesetzt)
  supportedSources?: CreationSource[]
  selectedSource?: CreationSource
  onSourceSelect?: (source: CreationSource) => void
  onModeSelect?: (mode: 'interview' | 'form') => void
  /**
   * Erlaubt dem Nutzer, die zuvor gewählte Quelle zu verwerfen
   * und zur Auswahlmaske zurückzukehren.
   */
  onResetSourceSelection?: () => void
  template?: { metadata: TemplateMetadataSchema }
  steps?: Array<{ preset: string; fields?: string[] }>
}

/**
 * Quelle-Auswahl-Ansicht (wird angezeigt, wenn keine Quelle ausgewählt ist)
 */
function CollectSourceSelectionView({
  supportedSources,
  selectedSource,
  onSourceSelect,
  onModeSelect,
  template,
  requiredFields,
  steps,
  existingSources = [],
  onRemoveSource,
  isProcessing = false,
  progress,
  message,
}: {
  supportedSources: CreationSource[]
  selectedSource?: CreationSource
  onSourceSelect?: (source: CreationSource) => void
  onModeSelect?: (mode: 'interview' | 'form') => void
  template?: { metadata: TemplateMetadataSchema }
  requiredFields?: string[]
  steps?: Array<{ preset: string; fields?: string[] }>
  existingSources?: WizardSource[]
  onRemoveSource?: (sourceId: string) => void
  isProcessing?: boolean
  progress?: number
  message?: string
}) {
  const [openSourceId, setOpenSourceId] = useState<string | null>(null)

  function toggleOpen(sourceId: string) {
    setOpenSourceId((prev) => (prev === sourceId ? null : sourceId))
  }

  function getFriendlySourceLabel(source: CreationSource): string {
    if (source.type === 'spoken') return "Interview (einmal erzählen)"
    if (source.type === 'url') return "Über eine Webseite auslesen"
    if (source.type === 'text') return "Text (tippen oder diktieren)"
    if (source.type === 'file') return "Datei hochladen"
    if (source.type === 'folder') return "Verzeichnis mit Artefakten"
    return source.label
  }

  function getFriendlySourceHelp(source: CreationSource): string {
    if (source.type === 'spoken') return "Du erzählst einfach frei. Wir schreiben die wichtigsten Infos für dich mit."
    if (source.type === 'url') return "Füge einen Link ein. Wir lesen die Infos von der Webseite aus."
    if (source.type === 'text') return "Tippe deinen Text ein oder diktiere ihn. Du siehst das Ergebnis, bevor es verarbeitet wird."
    if (source.type === 'file') return "Lade eine Datei hoch (z.B. Slides oder PDF)."
    if (source.type === 'folder') return "Audio, Video, PDF oder Office – alle bereits transkribiert"
    return source.helpText || ""
  }

  const SOURCE_ICON: Record<CreationSource['type'], React.ComponentType<{ className?: string }>> = {
    spoken: Mic,
    url: Link,
    text: Mic,
    file: Upload,
    folder: FolderOpen,
  }

  function toFieldLabel(key: string): string {
    const LABEL_MAP: Record<string, string> = {
      title: "Titel",
      summary: "Summary",
      date: "Datum",
      starttime: "Startzeit",
      endtime: "Endzeit",
      location: "Location",
      speakers: "Speakers",
    }
    return LABEL_MAP[key] || key
  }

  // Kompakte Ableitung: wir zeigen absichtlich nur die wichtigsten Felder
  const firstEditDraftStep = steps?.find(step => step.preset === 'editDraft' && (step.fields?.length || 0) > 0)
  const requiredFieldKeys = requiredFields && requiredFields.length > 0
    ? requiredFields
    : firstEditDraftStep?.fields && firstEditDraftStep.fields.length > 0
      ? firstEditDraftStep.fields
      : template?.metadata.fields.slice(0, 8).map(f => f.key) || []
  const requiredFieldsText = requiredFieldKeys.map(toFieldLabel).join(", ")

  return (
    <Card>
      <CardHeader>
        <CardTitle>So starten wir</CardTitle>
        <CardDescription>
          Wähle eine Methode. Du musst nichts Technisches wissen – einfach auswählen und loslegen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isProcessing ? (
          <div className="border rounded-md p-4 bg-muted/30">
            <div className="text-sm font-medium">KI extrahiert Event‑Details aus der Quelle…</div>
            <div className="text-xs text-muted-foreground mt-1">{message || 'Bitte warten…'}</div>
            <div className="mt-3">
              <Progress value={typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Hinweis: Diktat → Text passiert direkt im Eingabefeld. Hier geht es um die Extraktion der Formularfelder.
            </div>
          </div>
        ) : null}

        {/* Startmethode (vereint Modus + Quelle) */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Wie möchtest du starten?</h3>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Formular (kein Source-Step nötig) */}
            {supportedSources.length !== 1 || supportedSources[0]?.type !== 'file' ? (
            <Card
              className={cn(
                "cursor-pointer transition-all hover:border-primary",
              )}
              onClick={() => onModeSelect?.('form')}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Formular ausfüllen</CardTitle>
                    <CardDescription className="mt-1">
                      Du trägst die Infos direkt ein. Wenn du magst, kannst du einzelne Felder per Diktat füllen.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
            ) : null}

            {/* Quellen (führen in Interview/Extraktion) */}
            {supportedSources.map((source) => {
              const Icon = SOURCE_ICON[source.type]
              const isSelected = selectedSource?.id === source.id

              return (
                <Card
                  key={source.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary",
                    isSelected && "border-primary bg-primary/5"
                  )}
                  onClick={() => {
                    onModeSelect?.('interview')
                    onSourceSelect?.(source)
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        source.type === 'text' 
                          ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                          : source.type === 'url'
                            ? "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400"
                            : source.type === 'file'
                              ? "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400"
                              : "bg-muted text-foreground"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{getFriendlySourceLabel(source)}</CardTitle>
                        <CardDescription className="mt-1">
                          {getFriendlySourceHelp(source)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Bestehende Quellen anzeigen (wenn vorhanden) */}
        {existingSources.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Bereits hinzugefügte Quellen ({existingSources.length})</h3>
            <div className="space-y-2">
              {existingSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-start justify-between p-3 border rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium mb-1">
                      {source.kind === 'text' && '📝 Text'}
                      {source.kind === 'url' && '🔗 Webseite'}
                      {source.kind === 'file' && '📄 Datei'}
                    </div>
                    <div className="text-muted-foreground">
                      {buildSourceSummary(source)}
                    </div>

                    {/* Markdown-Vorschau für Datei-Quellen (prüfen/confirm) */}
                    {source.kind === 'file' && typeof source.extractedText === 'string' && source.extractedText.trim().length > 0 ? (
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleOpen(source.id)}
                        >
                          {openSourceId === source.id ? 'Vorschau ausblenden' : 'Markdown Vorschau anzeigen'}
                        </Button>
                        {openSourceId === source.id ? (
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-xs">
                            {source.extractedText.length > 4000 ? `${source.extractedText.slice(0, 4000)}\n\n…(gekürzt)` : source.extractedText}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {onRemoveSource && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onClick={() => onRemoveSource(source.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Du kannst weitere Quellen hinzufügen, indem du oben eine neue Quelle auswählst.
            </p>
          </div>
        )}

        {/* Kompakte Feldliste */}
        {requiredFieldsText && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold">Wir benötigen diese wichtigsten Felder</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {requiredFieldsText}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Deine Quelle (Text, Link oder Datei) sollte diese Informationen in irgendeiner Form enthalten.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CollectSingleFileSelectionView({
  isProcessing,
  progress,
  message,
  pendingFileName,
  onPickFile,
  onClearPending,
  isDisabled,
}: {
  isProcessing: boolean
  progress?: number
  message?: string
  pendingFileName?: string
  onPickFile: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClearPending: () => void
  isDisabled: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datei hochladen</CardTitle>
        <CardDescription>
          Wähle ein PDF. Verarbeitung startet erst nach Klick auf „Weiter“.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>PDF auswählen</Label>
          <Input
            type="file"
            onChange={onPickFile}
            className="mt-2"
            accept=".pdf"
            disabled={isDisabled}
          />
        </div>

        {pendingFileName ? (
          <div className="border rounded-md p-3 bg-muted/20 flex items-start justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">Ausgewählte Datei</div>
              <div className="text-muted-foreground break-all">{pendingFileName}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Klicke unten rechts auf &quot;Weiter&quot;, um OCR/Artefakte zu starten.
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearPending}
              disabled={isDisabled}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : null}

        {isProcessing ? (
          <div className="border rounded-md p-4 bg-muted/30">
            <div className="text-sm font-medium">KI extrahiert Event‑Details aus der Quelle…</div>
            <div className="text-xs text-muted-foreground mt-1">{message || 'Bitte warten…'}</div>
            <div className="mt-3">
              <Progress value={typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0} />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Hinweis: Diktat → Text passiert direkt im Eingabefeld. Hier geht es um die Extraktion der Formularfelder.
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function CollectSourceStep({
  source,
  onCollect,
  onCollectStructured,
  collectedInput,
  sources = [],
  onAddSource,
  isExtracting = false,
  processingProgress,
  processingMessage,
  templateId,
  libraryId,
  provider,
  targetFolderId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode: _mode,
  onRemoveSource,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  templateMetadata: _templateMetadata,
  requiredFields,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBeforeLeave: _onBeforeLeave,
  onCanProceedChange,
  supportedSources = [],
  selectedSource,
  onSourceSelect,
  onModeSelect,
  onResetSourceSelection,
  template,
  steps,
}: CollectSourceStepProps) {
  // Initialisiere Input-State: Verwende bestehende Text-Quelle, falls vorhanden
  // WICHTIG: Hooks müssen VOR jedem frühen Return aufgerufen werden!
  const existingTextSource = sources.find(s => s.kind === 'text')
  const initialInput = collectedInput || existingTextSource?.text || ""
  const [input, setInput] = useState(initialInput)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExtractingUrl, setIsExtractingUrl] = useState(false)
  const [pendingFileSource, setPendingFileSource] = useState<WizardSource | null>(null)
  
  // Synchronisiere Input-State mit bestehender Text-Quelle, wenn sich sources ändern
  useEffect(() => {
    const textSource = sources.find(s => s.kind === 'text')
    if (textSource && textSource.text && textSource.text !== input) {
      setInput(textSource.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]) // input absichtlich nicht in Dependencies, um Endlosschleife zu vermeiden
  const fileInputRef = useRef<HTMLInputElement>(null)

  // createSourceFromInput Funktion (wird später im useEffect verwendet)
  const createSourceFromInput = (): WizardSource | null => {
    if (!source) return null // Wenn keine Quelle ausgewählt, kann keine Quelle erstellt werden
    // Datei-Quelle: wird über handleFileSelect vorbereitet (Upload ins Storage)
    if (source.type === "file") return pendingFileSource
    if (!input.trim()) return null
    
    if (source.type === "url") {
      // URL-Quellen werden bereits automatisch hinzugefügt bei handleExtractFromWebsite
      return null
    }
    
    if (source.type === "spoken" || source.type === "text") {
      // Verwende die ID der bestehenden Text-Quelle, falls vorhanden
      const existingTextSource = sources.find(s => s.kind === 'text')
      return {
        id: existingTextSource?.id || `text-${Date.now()}`,
        kind: 'text',
        text: input.trim(),
        createdAt: existingTextSource?.createdAt || new Date(),
      }
    }
    
    return null
  }

  // Exponiere createSourceFromInput für den Wizard über window (temporär)
  // WICHTIG: Dieser Hook muss VOR jedem frühen Return sein!
  useEffect(() => {
    // Temporäre Lösung: Exponiere Funktion für Wizard über window-Objekt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__collectSourceStepBeforeLeave = createSourceFromInput
    return () => {
      // Temporäre Lösung: Entferne Funktion vom window-Objekt
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__collectSourceStepBeforeLeave
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, source?.type, pendingFileSource]) // pendingFileSource wichtig, damit "Weiter" nach Dateiauswahl aktiv wird

  // WICHTIG: Der "Weiter"-Button sitzt im Parent (`CreationWizard`).
  // Wenn sich nur lokaler Step-State (z.B. pendingFileSource oder input) ändert, muss der Parent gezielt neu rendern.
  useEffect(() => {
    if (!onCanProceedChange) return
    onCanProceedChange(createSourceFromInput() !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, source?.type, pendingFileSource, onCanProceedChange])

  const isSingleFileOnly = supportedSources.length === 1 && supportedSources[0]?.type === 'file'

  // JETZT können wir frühe Returns machen (nach allen Hooks)
  // Wenn keine Quelle ausgewählt ist, zeige Quelle-Auswahl
  if (!source && supportedSources.length > 0) {
    return <CollectSourceSelectionView 
      supportedSources={supportedSources}
      selectedSource={selectedSource}
      onSourceSelect={onSourceSelect}
      onModeSelect={onModeSelect}
      template={template}
      requiredFields={requiredFields}
      steps={steps}
      existingSources={sources}
      onRemoveSource={onRemoveSource}
      isProcessing={isExtracting}
      progress={processingProgress}
      message={processingMessage}
    />
  }
  
  // Wenn keine Quelle vorhanden ist, zeige Fehlermeldung
  if (!source) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Bitte zuerst eine Quelle auswählen.
      </div>
    )
  }

  // Single-File/PDF Mode: schlanke Oberfläche ohne Multi-Source-Overlays.
  if (isSingleFileOnly && source.type === 'file') {
    return (
      <CollectSingleFileSelectionView
        isProcessing={!!isExtracting}
        progress={processingProgress}
        message={processingMessage}
        pendingFileName={pendingFileSource?.fileName}
        onPickFile={handleFileSelect}
        onClearPending={() => {
          // Hinweis: Upload-Cleanup im Storage wäre möglich, aber ist optional.
          // Für Debugging/UX reicht das UI-Reset.
          setPendingFileSource(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
        isDisabled={!!isExtracting}
      />
    )
  }

  const handleSubmit = () => {
    if (input.trim()) {
      if (onCollect) {
        // Legacy: Fallback auf altes System
        onCollect(input.trim())
      }
    }
  }

  // handleAddTextSource wurde entfernt, da nicht verwendet
  // Text-Quellen werden jetzt über createSourceFromInput beim Verlassen des Steps hinzugefügt

  function isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString)
      return true
    } catch {
      return false
    }
  }

  async function handleExtractFromWebsite(): Promise<void> {
    setErrorMessage(null)
    const url = input.trim()
    if (!url) return
    if (!isValidUrl(url)) {
      setErrorMessage("Bitte gib einen gültigen Link ein.")
      return
    }
    if (!templateId || !libraryId) {
      setErrorMessage("Template-Konfiguration fehlt (templateId/libraryId).")
      return
    }

    setIsExtractingUrl(true)
    try {
      // UX: One-click. URL rein → Felder raus (Template wird serverseitig aus MongoDB geladen).
      const response = await fetch("/api/secretary/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          source_language: "de",
          target_language: "de",
          use_cache: false,
          templateId,
          libraryId,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const msg =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: { message?: unknown } }).error?.message ?? "Unbekannter Fehler")
            : `HTTP ${response.status}`
        throw new SecretaryServiceError(msg)
      }

      // Erwartetes Format: { status:'success', data: { structured_data, markdown? } }
      const dataObj =
        payload && typeof payload === "object" && "data" in payload
          ? (payload as { data?: unknown }).data
          : null

      const structured =
        dataObj && typeof dataObj === "object" && "structured_data" in dataObj
          ? (dataObj as { structured_data?: unknown }).structured_data
          : undefined

      const markdown =
        dataObj && typeof dataObj === "object"
          ? (dataObj as { markdown?: unknown; markdown_content?: unknown; markdownContent?: unknown }).markdown
          : undefined
      const markdownContent =
        dataObj && typeof dataObj === "object"
          ? (dataObj as { markdown_content?: unknown; markdownContent?: unknown }).markdown_content ?? (dataObj as { markdownContent?: unknown }).markdownContent
          : undefined

      if (!structured || typeof structured !== "object") {
        throw new SecretaryServiceError("Keine Felder gefunden. Bitte prüfe den Link oder das Template.")
      }

      // Multi-Source: Speichere URL-Quelle mit rawWebsiteText + Summary
      if (onAddSource) {
        // Extrahiere rawWebsiteText aus Response (prioritär data.text, sonst Fallback auf markdown)
        // WICHTIG: rawWebsiteText ist der Point-of-Truth für LLM-Verarbeitung
        const rawText = 
          (dataObj && typeof dataObj === "object" && "text" in dataObj && typeof dataObj.text === "string" && dataObj.text.trim())
            ? dataObj.text.trim()
            : (typeof markdown === "string" && markdown.trim() 
                ? markdown.trim() 
                : (typeof markdownContent === "string" && markdownContent.trim() 
                    ? markdownContent.trim() 
                    : ""))
        
        // Baue Summary aus structured_data (Key-Value-Format) für UI-Anzeige
        const summaryLines: string[] = []
        if (structured && typeof structured === "object") {
          for (const [key, value] of Object.entries(structured)) {
            if (value !== null && value !== undefined) {
              const valueStr = Array.isArray(value) 
                ? JSON.stringify(value)
                : String(value)
              // Kürze sehr lange Werte für bessere Lesbarkeit
              const displayValue = valueStr.length > 100 ? `${valueStr.slice(0, 100)}...` : valueStr
              summaryLines.push(`${key}: ${displayValue}`)
            }
          }
        }
        const summary = summaryLines.length > 0 
          ? summaryLines.join('\n')
          : (typeof markdown === "string" && markdown.trim() 
              ? markdown.slice(0, 200) + (markdown.length > 200 ? '...' : '') 
              : url)

        const urlSource: WizardSource = {
          id: `url-${Date.now()}`,
          kind: 'url',
          url,
          rawWebsiteText: rawText || summary, // Fallback: Summary als raw, wenn kein text vorhanden
          summary,
          createdAt: new Date(),
        }
        
        onAddSource(urlSource)
        setInput("") // Leere Eingabe nach Hinzufügen
        toast.success("Webseite wurde hinzugefügt")
      } else {
        // Legacy: Fallback auf altes System
        onCollect?.(url)
        onCollectStructured?.({
          metadata: structured as Record<string, unknown>,
          markdown: typeof markdown === "string" ? markdown : typeof markdownContent === "string" ? markdownContent : undefined,
        })
        toast.success("Webseite wurde ausgewertet")
      }
    } catch (e) {
      const msg =
        e instanceof SecretaryServiceError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Unbekannter Fehler"
      setErrorMessage(msg)
      toast.error("Webseite konnte nicht ausgelesen werden", { description: msg })
    } finally {
      setIsExtractingUrl(false)
    }
  }

  // WICHTIG: function (statt const) damit es vor dem Single-File Early-Return hoisted ist.
  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const lowerName = String(file.name || '').toLowerCase()
      const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf')

      // PDF im Wizard (HITL): Storage-first Upload, Verarbeitung startet erst bei "Weiter".
      if (isPdf) {
        setErrorMessage(null)
        if (!provider || !libraryId) {
          toast.error('PDF im Wizard benötigt Storage + Library', { description: 'Bitte im Archiv/Library starten oder sicherstellen, dass provider+libraryId verfügbar sind.' })
          return
        }

        // Upload ins Storage, damit External Jobs später per originalItemId laden können
        async function ensureWizardSourcesFolderId(): Promise<string> {
          if (!provider) throw new Error('Provider nicht verfügbar')
          const baseFolderId = (targetFolderId && targetFolderId.trim().length > 0) ? targetFolderId : "root"
          const folderName = ".wizard-sources"
          const items = await provider.listItemsById(baseFolderId)
          const existing = items.find((it) => it.type === 'folder' && it.metadata?.name === folderName)
          if (existing) return existing.id
          const created = await provider.createFolder(baseFolderId, folderName)
          return created.id
        }

        const wizardFolderId = await ensureWizardSourcesFolderId()
        const uploadName = `${Date.now()}-${file.name}`
        const uploaded = await provider.uploadFile(
          wizardFolderId,
          new File([file], uploadName, { type: file.type || 'application/pdf' })
        )

        // Bereite eine File-Quelle vor. Verarbeitung startet im Wizard erst bei "Weiter".
        const prepared: WizardSource = {
          id: `file-${uploaded.id}`,
          kind: 'file',
          fileName: uploaded.metadata?.name || uploadName,
          extractedText: '',
          summary: uploaded.metadata?.name || uploadName,
          createdAt: new Date(),
        }
        setPendingFileSource(prepared)
        toast.success('PDF bereit', { description: 'Klicke „Weiter“, um OCR/Artefakte zu starten.' })
        return
      }

      const text = await file.text()
      setInput(text)
      onCollect?.(text)
    } catch (error) {
      console.error("Fehler beim Lesen der Datei:", error)
    }
  }

  // transcribeAudio wird nur noch für Audio-Dateien verwendet (nicht für Diktat)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function transcribeAudio(file: File): Promise<void> {
    setErrorMessage(null)
    // Kein setIsTranscribing mehr nötig, da Diktat über DictationTextarea läuft
    try {
      /**
       * Variante A1 (Hybrid): Audio wird als External Job verarbeitet.
       * - Upload der Audio-Datei in einen Wizard-Quellen-Ordner
       * - Job enqueue (/api/secretary/process-audio/job)
       * - Warten via SSE auf completed
       * - Transcript (result.savedItemId) als WizardSource hinzufügen
       *
       * Fallback: Wenn provider/libraryId fehlen, nutzen wir die alte synchrone API.
       */
      if (provider && libraryId) {
        async function ensureWizardSourcesFolderId(): Promise<string> {
          if (!provider) throw new Error('Provider nicht verfügbar')
          const baseFolderId = (targetFolderId && targetFolderId.trim().length > 0) ? targetFolderId : "root"
          const folderName = ".wizard-sources"
          const items = await provider.listItemsById(baseFolderId)
          const existing = items.find((it) => it.type === 'folder' && it.metadata?.name === folderName)
          if (existing) return existing.id
          const created = await provider.createFolder(baseFolderId, folderName)
          return created.id
        }

        interface JobUpdateWire {
          type: 'job_update'
          jobId: string
          status: string
          message?: string
          result?: { savedItemId?: string }
        }

        async function waitForJobCompletion(args: { jobId: string; timeoutMs: number }): Promise<JobUpdateWire> {
          const { jobId, timeoutMs } = args
          return await new Promise<JobUpdateWire>((resolve, reject) => {
            let settled = false
            const es = new EventSource('/api/external/jobs/stream')
            const timeout = setTimeout(() => {
              if (settled) return
              settled = true
              try { es.close() } catch {}
              reject(new Error(`Timeout: Job ${jobId} wurde nicht rechtzeitig fertig.`))
            }, timeoutMs)

            function cleanup() {
              clearTimeout(timeout)
              try { es.close() } catch {}
            }

            es.addEventListener('job_update', (e: MessageEvent) => {
              try {
                const evt = JSON.parse(e.data) as JobUpdateWire
                if (!evt || evt.type !== 'job_update' || evt.jobId !== jobId) return
                if (evt.status === 'completed') {
                  if (settled) return
                  settled = true
                  cleanup()
                  resolve(evt)
                  return
                }
                if (evt.status === 'failed') {
                  if (settled) return
                  settled = true
                  cleanup()
                  reject(new Error(evt.message || 'Job fehlgeschlagen'))
                }
              } catch {
                // ignore parse errors
              }
            })

            es.addEventListener('error', () => {
              // Wir warten weiter bis Timeout; Dev-SSE kann kurz wackeln.
            })
          })
        }

        const wizardFolderId = await ensureWizardSourcesFolderId()
        const uploadName = `${Date.now()}-${file.name}`
        const uploadFile = new File([file], uploadName, { type: file.type || 'audio/*' })
        const uploaded = await provider.uploadFile(wizardFolderId, uploadFile)

        const enqueueRes = await fetch('/api/secretary/process-audio/job', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Library-Id': libraryId,
          },
          body: JSON.stringify({
            originalItemId: uploaded.id,
            parentId: wizardFolderId,
            fileName: uploaded.metadata?.name || uploadName,
            mimeType: uploaded.metadata?.mimeType || file.type || 'audio/*',
            targetLanguage: 'de',
            useCache: true,
            // Transcript-only: keine Template- oder Ingest-Phase
            policies: {
              extract: 'do',
              metadata: 'ignore',
              ingest: 'ignore',
            },
          }),
        })

        const enqueueJson = await enqueueRes.json().catch(() => ({} as Record<string, unknown>))
        if (!enqueueRes.ok) {
          const msg = typeof (enqueueJson as { error?: unknown }).error === 'string'
            ? (enqueueJson as { error: string }).error
            : `HTTP ${enqueueRes.status}`
          throw new Error(msg)
        }

        const jobId = typeof (enqueueJson as { job?: { id?: unknown } }).job?.id === 'string'
          ? (enqueueJson as { job: { id: string } }).job.id
          : ''
        if (!jobId) throw new Error('Job-ID fehlt in Response')

        toast.success('Job gestartet', { description: 'Audio wird im Hintergrund transkribiert…' })
        const completion = await waitForJobCompletion({ jobId, timeoutMs: 3 * 60_000 })
        const transcriptId = completion.result?.savedItemId
        if (!transcriptId) throw new Error('Job abgeschlossen, aber kein Transcript gespeichert (savedItemId fehlt).')

        const { blob } = await provider.getBinary(transcriptId)
        const transcriptText = await blob.text()
        const cleanText = transcriptText.trim()
        if (!cleanText) throw new Error('Transkription ist leer.')

        if (onAddSource) {
          const newSource: WizardSource = {
            id: `file-${transcriptId}`,
            kind: 'file',
            fileName: uploaded.metadata?.name || uploadName,
            extractedText: cleanText,
            summary: buildSourceSummary({ kind: 'text', id: `tmp-${transcriptId}`, text: cleanText, createdAt: new Date() }),
            createdAt: new Date(),
          }
          onAddSource(newSource)
          toast.success('Audio transkribiert', { description: 'Transcript wurde als Quelle hinzugefügt.' })
        } else {
          // Legacy-Fallback: Text in das Input-Feld schreiben
          setInput(cleanText)
          onCollect?.(cleanText)
          toast.success('Audio transkribiert')
        }

        return
      }

      const formData = new FormData()
      formData.append("file", file)
      // Wir transkribieren erst mal nur. Die Interpretation (Felder füllen) passiert in generateDraft.
      formData.append("source_language", "de")
      formData.append("target_language", "de")

      const res = await fetch("/api/secretary/process-audio", {
        method: "POST",
        body: formData,
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const errMsg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : `HTTP ${res.status}`
        throw new Error(errMsg)
      }

      // NOTE: Secretary AudioProcessor liefert die Transkription unter data.transcription.text
      // (und optional weitere Felder wie transformation_result).
      const transcriptionText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { transcription?: { text?: unknown } } }).data?.transcription?.text
          : undefined

      // Fallbacks (ältere/alternative Response-Formate)
      const outputText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { output_text?: unknown } }).data?.output_text
          : undefined
      const originalText =
        data && typeof data === "object" && "data" in data
          ? (data as { data?: { original_text?: unknown } }).data?.original_text
          : undefined

      const text =
        typeof transcriptionText === "string"
          ? transcriptionText
          : typeof outputText === "string"
            ? outputText
            : typeof originalText === "string"
              ? originalText
              : ""

      if (!text.trim()) {
        throw new Error("Keine Transkription erhalten.")
      }

      // Füge den neuen Text zum bestehenden Text hinzu (nicht ersetzen)
      setInput((prev) => {
        const existingText = prev.trim()
        const newText = text.trim()
        if (existingText && newText) {
          return `${existingText}\n\n${newText}`
        }
        return newText || existingText
      })
      // Legacy: Fallback auf altes System
      if (onCollect) {
        onCollect(text)
      }
      toast.success("Audio wurde transkribiert")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler"
      setErrorMessage(msg)
      toast.error("Audio konnte nicht verarbeitet werden", { description: msg })
    }
    // Kein finally-Block mehr nötig, da kein setIsTranscribing
  }

  // handleAudioFileSelect wurde entfernt, da nicht verwendet
  // Audio-Dateien werden direkt über transcribeAudio verarbeitet
  // Diktat-Logik wurde durch generische DictationTextarea ersetzt
  // createSourceFromInput wurde bereits oben definiert (vor dem frühen Return)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-2xl sm:text-3xl">
            {source.type === "url" 
              ? "Link einfügen" 
              : source.type === "spoken" || source.type === "text" 
                ? "Erzähl mir von der Veranstaltung" 
                : "Datei hochladen"}
            </CardTitle>
            {/* Quelle wechseln: erlaubt neue Auswahl ohne Umweg über "Zurück" */}
            {onResetSourceSelection ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  // UI-Reset: Eingaben löschen, Quelle im Parent zurücksetzen
                  setInput("")
                  setPendingFileSource(null)
                  onResetSourceSelection()
                }}
              >
                Quelle wechseln
              </Button>
            ) : null}
          </div>
          <CardDescription className="text-lg mt-2">
            {source.type === "url"
              ? "Füge den Link zur Event-Seite ein"
              : source.type === "spoken" || source.type === "text"
                ? "Tippe oder diktiere alle wichtigen Infos"
                : source.helpText || "Lade eine Datei hoch"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Unified Text-Quelle: tippen oder diktieren - vereinfacht */}
        {(source.type === "spoken" || source.type === "text") && (
          <div className="space-y-6">
            <DictationTextarea
              label="Erzähl mir von der Veranstaltung"
              value={input}
              onChange={setInput}
              rows={8}
              placeholder="z.B.: Am 15. Januar findet ein Workshop zum Thema KI statt. Der Eintritt ist frei..."
              disabled={isExtracting}
              showOscilloscope={true}
              className="[&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:text-lg [&_textarea]:border-2 [&_textarea]:focus:border-blue-500"
            />

            {/* Status-Meldungen */}
            {errorMessage && (
              <p className="text-sm text-destructive text-center">
                {errorMessage}
              </p>
            )}
          </div>
        )}

        {source.type === "url" && (
          <div className="space-y-6">
            <Input
              type="url"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://beispiel.de/veranstaltung"
              className="w-full text-xl border-2 focus:border-blue-500 h-14 px-5"
              disabled={isExtracting || isExtractingUrl}
            />
            <Button
              onClick={() => void handleExtractFromWebsite()}
              disabled={!input.trim() || isExtractingUrl || isExtracting}
              size="lg"
              className="w-full h-14 text-lg font-semibold"
            >
              {isExtractingUrl ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Link className="w-5 h-5 mr-2" />
                  Weiter
                </>
              )}
            </Button>
            {errorMessage && (
              <p className="text-sm text-destructive text-center">
                {errorMessage}
              </p>
            )}
          </div>
        )}


        {source.type === "file" && (
          <div className="space-y-4">
            <div>
              <Label>Datei auswählen</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="mt-2"
                accept=".md,.txt,.pdf"
                disabled={isExtracting}
              />
            </div>
            {input && (
              <div className="mt-4">
                <Label>Dateiinhalt (Vorschau)</Label>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={10}
                  className="mt-2"
                  disabled={isExtracting}
                />
              </div>
            )}
            {input && onAddSource && (
              <Button 
                onClick={() => {
                  const fileSource: WizardSource = {
                    id: `file-${Date.now()}`,
                    kind: 'file',
                    fileName: fileInputRef.current?.files?.[0]?.name || 'unbekannt',
                    extractedText: input.trim(),
                    summary: input.length > 200 ? `${input.slice(0, 200)}...` : input,
                    createdAt: new Date(),
                  }
                  onAddSource(fileSource)
                  setInput("")
                  toast.success("Datei-Quelle hinzugefügt")
                }}
                disabled={isExtracting || !input.trim()}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Datei-Quelle hinzufügen
              </Button>
            )}
            {input && !onAddSource && (
              <Button onClick={handleSubmit} className="w-full" disabled={isExtracting}>
                <Upload className="w-4 h-4 mr-2" />
                Datei verwenden
              </Button>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}



