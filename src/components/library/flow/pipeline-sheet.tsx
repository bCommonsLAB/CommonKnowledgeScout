"use client"

import * as React from "react"
import { toast } from "sonner"
import { FileText, Sparkles, Upload, Check, ChevronDown, Settings } from "lucide-react"
import Link from "next/link"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

/**
 * Informationen ueber bereits vorhandene Artefakte.
 * Ermoeglicht intelligente Vorauswahl und Abhaengigkeits-Logik.
 */
export interface ExistingArtifacts {
  /** Transcript/Extraktion ist vorhanden */
  hasTranscript: boolean
  /** Transformierte Version ist vorhanden */
  hasTransformed: boolean
  /** Bereits indexiert/ingested */
  hasIngested: boolean
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "markdown" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
  /**
   * Optionale Default-Werte fuer die Pipeline-Schritte.
   * Wenn gesetzt, werden die Switches beim Oeffnen des Sheets entsprechend initialisiert.
   */
  defaultSteps?: {
    extract: boolean
    metadata: boolean
    ingest: boolean
  }
  /**
   * Optionale Default-Wert fuer "Erzwingen"-Switch.
   */
  defaultForce?: boolean
  /**
   * Informationen ueber bereits vorhandene Artefakte.
   * Ermoeglicht intelligente Vorauswahl und visuelle Hinweise.
   */
  existingArtifacts?: ExistingArtifacts
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  // Bei Markdown: Extract immer deaktiviert (Textquelle bereits vorhanden)
  const isMarkdown = props.kind === "markdown"
  
  // Artefakt-Status fuer intelligente UI-Logik
  const hasTranscript = props.existingArtifacts?.hasTranscript ?? false
  const hasTransformed = props.existingArtifacts?.hasTransformed ?? false
  const hasIngested = props.existingArtifacts?.hasIngested ?? false
  
  const [shouldExtract, setShouldExtract] = React.useState(false)
  const [shouldTransform, setShouldTransform] = React.useState(false)
  const [shouldIngest, setShouldIngest] = React.useState(false)
  const [shouldForce, setShouldForce] = React.useState(props.defaultForce ?? false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Beim Oeffnen des Sheets: Initialisiere basierend auf defaultSteps und existingArtifacts
  React.useEffect(() => {
    if (!props.isOpen) return
    
    // Reset beim Oeffnen
    const forceMode = props.defaultForce ?? false
    setShouldForce(forceMode)
    
    if (props.defaultSteps) {
      // defaultSteps respektieren
      // Wenn Force aktiv, dann auch vorhandene Artefakte ueberschreiben -> Step aktivieren
      // Sonst: nur aktivieren wenn Artefakt nicht vorhanden
      // Bei Markdown: Extract immer false
      if (isMarkdown) {
        setShouldExtract(false)
      } else {
        // Wenn Force aktiv oder Transcript nicht vorhanden -> aktivieren wenn in defaultSteps
        setShouldExtract(props.defaultSteps.extract && (forceMode || !hasTranscript))
      }
      // Wenn Force aktiv oder Transformed nicht vorhanden -> aktivieren wenn in defaultSteps
      setShouldTransform(props.defaultSteps.metadata && (forceMode || !hasTransformed))
      // Wenn Force aktiv oder Ingested nicht vorhanden -> aktivieren wenn in defaultSteps
      setShouldIngest(props.defaultSteps.ingest && (forceMode || !hasIngested))
    } else {
      // Keine defaultSteps: Alles aus
      setShouldExtract(false)
      setShouldTransform(false)
      setShouldIngest(false)
    }
  }, [props.isOpen, props.defaultSteps, props.defaultForce, isMarkdown, hasTranscript, hasTransformed, hasIngested])

  // Abhaengigkeits-Logik: Wenn Transformation gewaehlt und kein Transcript vorhanden -> Extract automatisch mit
  React.useEffect(() => {
    if (shouldTransform && !hasTranscript && !isMarkdown && !shouldExtract) {
      setShouldExtract(true)
    }
  }, [shouldTransform, hasTranscript, isMarkdown, shouldExtract])

  // Abhaengigkeits-Logik: Wenn Ingestion gewaehlt und kein Transform vorhanden -> Transform automatisch mit
  React.useEffect(() => {
    if (shouldIngest && !hasTransformed && !shouldTransform) {
      setShouldTransform(true)
    }
  }, [shouldIngest, hasTransformed, shouldTransform])

  // Wenn "Erzwingen" aktiviert wird, aktiviere alle Schritte die vorher vorhanden waren
  const handleForceChange = React.useCallback((checked: boolean) => {
    setShouldForce(checked)
    // Wenn Force aktiviert und defaultSteps vorhanden, setze entsprechend
    if (checked && props.defaultSteps) {
      if (!isMarkdown) setShouldExtract(props.defaultSteps.extract)
      setShouldTransform(props.defaultSteps.metadata)
      setShouldIngest(props.defaultSteps.ingest)
    }
  }, [props.defaultSteps, isMarkdown])

  // Automatisch erstes Template auswaehlen, wenn keines ausgewaehlt und Templates verfuegbar
  React.useEffect(() => {
    if (!props.templateName && props.templates.length > 0 && !props.isLoadingTemplates) {
      props.onTemplateNameChange(props.templates[0])
    }
  }, [props.templates, props.templateName, props.isLoadingTemplates, props.onTemplateNameChange])

  const templateSelectValue = props.templateName || (props.templates.length > 0 ? props.templates[0] : "__none__")
  
  // Berechne ob ein Schritt deaktiviert sein sollte (vorhanden und nicht erzwingen)
  const extractDisabled = isMarkdown || (hasTranscript && !shouldForce)
  const transformDisabled = hasTransformed && !shouldForce
  const ingestDisabled = hasIngested && !shouldForce
  
  // Button nur aktivieren wenn mindestens ein Schritt gewaehlt UND keine Ladeoperation laeuft
  const isTemplateLoading = shouldTransform && props.isLoadingTemplates
  const canStart = (shouldExtract || shouldTransform || shouldIngest) && !isTemplateLoading

  // Zaehle aktive Schritte
  const enabledCount = [shouldExtract, shouldTransform, shouldIngest].filter(Boolean).length
  const totalSteps = isMarkdown ? 2 : 3

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewaehlt", { description: "Bitte mindestens einen Schritt auswaehlen." })
      return
    }

    if (shouldTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswaehlen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    // Bei Markdown: extract immer "ignore" (Textquelle bereits vorhanden)
    const policies: PipelinePolicies = {
      extract: isMarkdown ? "ignore" : (shouldExtract ? active : "ignore"),
      metadata: shouldTransform ? active : "ignore",
      ingest: shouldIngest ? active : "ignore",
    }

    setIsSubmitting(true)
    try {
      await props.onStart({
        templateName: isNonEmptyString(props.templateName) ? props.templateName : undefined,
        targetLanguage: props.targetLanguage,
        policies,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [canStart, props, shouldExtract, shouldForce, shouldIngest, shouldTransform, isMarkdown])

  // Step-Definitionen fuer das Rendering
  const steps = [
    {
      id: 1,
      key: "extract",
      title: "Transkript erstellen",
      description: isMarkdown 
        ? "Textquelle vorhanden, Transkript wird uebersprungen." 
        : hasTranscript && !shouldForce
          ? "Bereits vorhanden (wird uebersprungen)."
          : "Erzeugt ein moeglichst originalgetreues Transkript aus der Quelle.",
      icon: <FileText className="size-5" />,
      enabled: shouldExtract,
      setEnabled: setShouldExtract,
      disabled: extractDisabled,
      hasExisting: hasTranscript && !isMarkdown,
      hidden: isMarkdown,
    },
    {
      id: 2,
      key: "transform",
      title: "Artefakte generieren",
      description: hasTransformed && !shouldForce
        ? "Bereits vorhanden. Aktiviere Ueberschreiben um neu zu erstellen."
        : "Erzeugt aus dem Transkript publizierbare Metadaten und Inhalte.",
      icon: <Sparkles className="size-5" />,
      enabled: shouldTransform,
      setEnabled: setShouldTransform,
      disabled: transformDisabled,
      hasOptions: true,
      hasExisting: hasTransformed,
    },
    {
      id: 3,
      key: "ingest",
      title: "Story publizieren",
      description: hasIngested && !shouldForce
        ? "Bereits vorhanden. Aktiviere Ueberschreiben um neu zu erstellen."
        : "Veroeffentlicht aus den Artefakten eine Story und indiziert Inhalte fuer RAG und Chat.",
      icon: <Upload className="size-5" />,
      enabled: shouldIngest,
      setEnabled: setShouldIngest,
      disabled: ingestDisabled,
      hasExisting: hasIngested,
    },
  ]

  // Filtere versteckte Schritte (z.B. Markdown hat keinen Extract-Schritt)
  const visibleSteps = steps.filter(s => !s.hidden)

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle className="text-xl">Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="text-primary font-medium truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4">
          {/* Steps Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Umsetzungsschritte</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {enabledCount} von {totalSteps} aktiv
            </span>
          </div>

          {/* Steps Container with Timeline */}
          <div>
            {/* Steps - Timeline-Linie ist relativ zu diesem Container */}
            <div className="relative space-y-3">
              {/* Timeline line - durchgehend, verbindet alle Kreise */}
              {visibleSteps.length > 1 && (
                <div 
                  className="absolute w-0.5 bg-border pointer-events-none"
                  style={{ 
                    left: '37px', // p-4 (16px) + halbe Kreisbreite (22px) - halbe Linienbreite (1px) = 37px
                    top: '38px', // p-4 (16px) + halber Kreis (22px) = Mitte erster Kreis
                    bottom: '54px' // p-4 (16px) + halber Kreis (22px) + extra Padding = Mitte letzter Kreis
                  }} 
                />
              )}
              {visibleSteps.map((step, index) => (
                <Collapsible key={step.key} defaultOpen={step.hasOptions && step.enabled}>
                  <div
                    className={cn(
                      "relative rounded-lg border transition-all duration-200",
                      step.enabled 
                        ? "bg-transparent border-border shadow-sm" 
                        : "bg-transparent border-transparent opacity-60",
                      step.disabled && "cursor-not-allowed"
                    )}
                  >
                    {/* Step Header */}
                    <div className="flex items-start gap-4 p-4">
                      {/* Step Number Circle - solider Hintergrund und Border damit Linie nicht durchscheint */}
                      <div
                        className={cn(
                          "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          step.enabled
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white dark:bg-zinc-900 text-muted-foreground border-gray-300 dark:border-zinc-600"
                        )}
                      >
                        <span className="text-sm font-bold">{isMarkdown ? index + 1 : step.id}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "transition-colors",
                            step.enabled ? "text-primary" : "text-muted-foreground"
                          )}>
                            {step.icon}
                          </span>
                          <h4 className={cn(
                            "font-semibold transition-colors",
                            step.enabled ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {step.title}
                          </h4>
                          {step.hasExisting && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <Check className="h-3 w-3" /> Vorhanden
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>

                      {/* Toggle */}
                      <div className="flex items-center gap-2 pt-1">
                        {step.hasOptions && step.enabled && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="size-8 p-0">
                              <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
                              <span className="sr-only">Optionen anzeigen</span>
                            </Button>
                          </CollapsibleTrigger>
                        )}
                        <Switch
                          checked={step.enabled}
                          onCheckedChange={(v) => !step.disabled && step.setEnabled(v)}
                          disabled={step.disabled}
                          aria-label={`${step.title} ${step.enabled ? "deaktivieren" : "aktivieren"}`}
                        />
                      </div>
                    </div>

                    {/* Collapsible Options for Transform step - kompaktes Layout, buendig mit Text */}
                    {step.hasOptions && (
                      <CollapsibleContent>
                        <div className={cn(
                          "pb-3 pt-0",
                          !step.enabled && "pointer-events-none"
                        )}>
                          {/* ml-[76px] = p-4 (16px) + Kreis (44px) + gap-4 (16px) = buendig mit Text */}
                          <div className="flex items-center gap-3 ml-[76px] pr-4">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="template" className="text-xs text-muted-foreground whitespace-nowrap">
                                Vorlage
                              </Label>
                              {props.isLoadingTemplates ? (
                                <Skeleton className="h-8 w-28" />
                              ) : (
                                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                                  <SelectTrigger id="template" className="h-8 w-32 text-xs">
                                    <SelectValue placeholder="Waehlen..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {props.templates.map((t) => (
                                      <SelectItem key={t} value={t} className="text-xs">
                                        {t}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {/* Link zu den Vorlagen-Einstellungen */}
                              <Link href="/templates" title="Vorlagen verwalten">
                                <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                              </Link>
                            </div>
                            {/* Abstand zwischen Vorlage und Sprache */}
                            <div className="w-4" />
                            <div className="flex items-center gap-2">
                              <Label htmlFor="language" className="text-xs text-muted-foreground whitespace-nowrap">
                                Sprache
                              </Label>
                              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                                <SelectTrigger id="language" className="h-8 w-24 text-xs">
                                  <SelectValue placeholder="de" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="de" className="text-xs">Deutsch</SelectItem>
                                  <SelectItem value="en" className="text-xs">English</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    )}
                  </div>
                </Collapsible>
              ))}
            </div>
          </div>

          {/* Force Overwrite Option */}
          <div className="mt-6 flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <Label htmlFor="force-overwrite" className="text-sm font-medium cursor-pointer">
                Bestehende Assets ueberschreiben
              </Label>
              <p className="text-xs text-muted-foreground">
                {shouldForce 
                  ? "Werden neu generiert (ueberschrieben)." 
                  : "Wenn vorhanden, diesen Schritt ueberspringen."}
              </p>
            </div>
            <Switch
              id="force-overwrite"
              checked={shouldForce}
              onCheckedChange={handleForceChange}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Schliessen
          </Button>
          <Button onClick={() => void start()} disabled={isSubmitting || !canStart}>
            <Check className="size-4 mr-2" />
            {isTemplateLoading ? "Lade..." : "Jetzt starten"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
