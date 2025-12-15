"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CreationFlowStepRef, CreationSource, TemplateDocument } from "@/lib/templates/template-types"
import { FileText, Mic, Link, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

interface BriefingStepProps {
  template: TemplateDocument
  steps: CreationFlowStepRef[]
  selectedMode?: 'interview' | 'form'
  onModeSelect: (mode: 'interview' | 'form') => void
  supportedSources: CreationSource[]
  selectedSource?: CreationSource
  onSourceSelect: (source: CreationSource) => void
}

/**
 * BriefingStep: Zeigt einen Spickzettel aller benötigten Felder
 * 
 * Ableitungslogik:
 * - Sammelt Felder aus `editDraft`-Steps
 * - Für jedes Feld: Label = Feldname, Hint = metadata.fields[].description
 * - Gruppiert nach Step-Titel (z.B. "Wichtige Felder", "Optionale Felder")
 */
export function BriefingStep({
  template,
  steps,
  selectedMode,
  onModeSelect,
  supportedSources,
  selectedSource,
  onSourceSelect,
}: BriefingStepProps) {
  function getFriendlySourceLabel(source: CreationSource): string {
    if (source.type === 'spoken') return "Interview (einmal erzählen)"
    if (source.type === 'url') return "Über eine Webseite auslesen"
    if (source.type === 'text') return "Text (tippen oder diktieren)"
    if (source.type === 'file') return "Datei hochladen"
    return source.label
  }

  function getFriendlySourceHelp(source: CreationSource): string {
    if (source.type === 'spoken') return "Du erzählst einfach frei. Wir schreiben die wichtigsten Infos für dich mit."
    if (source.type === 'url') return "Füge einen Link ein. Wir lesen die Infos von der Webseite aus."
    if (source.type === 'text') return "Tippe deinen Text ein oder diktiere ihn. Du siehst das Ergebnis, bevor es verarbeitet wird."
    if (source.type === 'file') return "Lade eine Datei hoch (z.B. Slides oder PDF)."
    return source.helpText || ""
  }

  const SOURCE_ICON: Record<CreationSource['type'], React.ComponentType<{ className?: string }>> = {
    spoken: Mic,
    url: Link,
    text: Mic, // Mikrofon-Icon für Text, da Diktieren jetzt Teil davon ist
    file: Upload,
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

  // Kompakte Ableitung: wir zeigen absichtlich nur die wichtigsten Felder,
  // weil die detailreichen Beschreibungen/Typen in der Begrüßung überfordern.
  // Heuristik: Nimm den ersten editDraft-Step mit fields als "wichtig".
  const firstEditDraftStep = steps.find(step => step.preset === 'editDraft' && (step.fields?.length || 0) > 0)
  const requiredFieldKeys = (firstEditDraftStep?.fields && firstEditDraftStep.fields.length > 0)
    ? firstEditDraftStep.fields
    : template.metadata.fields.slice(0, 8).map(f => f.key)

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
        {/* Startmethode (vereint Modus + Quelle) */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Wie möchtest du starten?</h3>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Formular (kein Source-Step nötig) */}
            <Card
              className={cn(
                "cursor-pointer transition-all hover:border-primary",
                selectedMode === 'form' && "border-primary bg-primary/5"
              )}
              onClick={() => onModeSelect('form')}
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
                    onModeSelect('interview')
                    onSourceSelect(source)
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

        {/* Kompakte Feldliste */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold">Wir benötigen diese wichtigsten Felder</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {requiredFieldsText}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Deine Quelle (Text, Link oder Datei) sollte diese Informationen in irgendeiner Form enthalten.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

