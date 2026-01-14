"use client"

import * as React from "react"
import { toast } from "sonner"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

export interface PipelinePolicies {
  extract: "ignore" | "do" | "force"
  metadata: "ignore" | "do" | "force"
  ingest: "ignore" | "do" | "force"
}

interface PipelineSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  sourceFileName: string
  kind: "pdf" | "audio" | "video" | "other"
  targetLanguage: string
  onTargetLanguageChange: (value: string) => void
  templateName: string
  onTemplateNameChange: (value: string) => void
  templates: string[]
  isLoadingTemplates: boolean
  onStart: (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => Promise<void>
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function PipelineSheet(props: PipelineSheetProps) {
  const [shouldExtract, setShouldExtract] = React.useState(true)
  const [shouldTransform, setShouldTransform] = React.useState(true)
  const [shouldIngest, setShouldIngest] = React.useState(true)
  const [shouldForce, setShouldForce] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Default: alle Schritte aktiv, aber beim Öffnen (auto-open) nicht unerwartet resetten.
  React.useEffect(() => {
    if (!props.isOpen) return
    // Wenn alle drei aus sind (z.B. nach Back/Forward), setze auf Default.
    if (!shouldExtract && !shouldTransform && !shouldIngest) {
      setShouldExtract(true)
      setShouldTransform(true)
      setShouldIngest(true)
    }
  }, [props.isOpen, shouldExtract, shouldTransform, shouldIngest])

  const step1Label = props.kind === "audio" || props.kind === "video" ? "Transkription" : "Extraktion"

  const templateSelectValue = props.templateName || "__none__"
  const canTransform = shouldTransform
  const canStart = shouldExtract || shouldTransform || shouldIngest

  const start = React.useCallback(async () => {
    if (!canStart) {
      toast.error("Keine Schritte ausgewählt", { description: "Bitte mindestens einen Schritt auswählen." })
      return
    }

    if (canTransform && !isNonEmptyString(props.templateName)) {
      toast.error("Template fehlt", { description: "Bitte ein Template auswählen, oder Transformation deaktivieren." })
      return
    }

    const active: "do" | "force" = shouldForce ? "force" : "do"
    const policies: PipelinePolicies = {
      extract: shouldExtract ? active : "ignore",
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
  }, [canStart, canTransform, props, shouldExtract, shouldForce, shouldIngest, shouldTransform])

  return (
    <Sheet open={props.isOpen} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Aufbereiten &amp; Publizieren</SheetTitle>
          <SheetDescription className="truncate">
            {props.sourceFileName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zielsprache</Label>
              <Select value={props.targetLanguage} onValueChange={props.onTargetLanguageChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="de" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">de</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Template (optional)</Label>
              {props.isLoadingTemplates ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={templateSelectValue} onValueChange={(v) => props.onTemplateNameChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Radix Select: value must not be empty string. Use sentinel for "no template". */}
                    <SelectItem value="__none__">—</SelectItem>
                    {props.templates.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="text-sm font-medium">Pipeline</div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={shouldExtract} onCheckedChange={(v) => setShouldExtract(v === true)} id="step-extract" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-extract">{step1Label}</Label>
                  <div className="text-xs text-muted-foreground">Erzeugt ein Transcript/Markdown aus der Quelle (Shadow‑Twin).</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldTransform} onCheckedChange={(v) => setShouldTransform(v === true)} id="step-transform" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-transform">Transformation</Label>
                  <div className="text-xs text-muted-foreground">Wendet ein Template an und erzeugt eine publizierbare Fassung.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox checked={shouldIngest} onCheckedChange={(v) => setShouldIngest(v === true)} id="step-ingest" />
                <div className="space-y-0.5">
                  <Label htmlFor="step-ingest">Ingestion</Label>
                  <div className="text-xs text-muted-foreground">Indexiert/aktualisiert Inhalte für RAG/Chat.</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-3 border-t pt-3">
              <Checkbox checked={shouldForce} onCheckedChange={(v) => setShouldForce(v === true)} id="step-force" />
              <div className="space-y-0.5">
                <Label htmlFor="step-force">Erzwingen</Label>
                <div className="text-xs text-muted-foreground">Ignoriert Cache/„already done“ und führt ausgewählte Schritte erneut aus.</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Schließen
            </Button>
            <Button onClick={() => void start()} disabled={isSubmitting}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}



