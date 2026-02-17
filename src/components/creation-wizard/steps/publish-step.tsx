"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"

interface PublishStepProps {
  title?: string
  description?: string
  /** Startet den Publish-Vorgang (Promotion + Shadow‑Twin Update + Ingestion) */
  onPublish: () => Promise<void>
  /** True, wenn Publish bereits läuft */
  isPublishing: boolean
  /** 0..100 */
  publishingProgress: number
  /** Kurzstatus */
  publishingMessage?: string
  /** True, wenn Publish abgeschlossen ist */
  isPublished: boolean
  /** Optional: Zur Library navigieren */
  onGoToLibrary?: () => void
  /** Optional: Label für den Zurück-Button */
  goToLibraryLabel?: string
  /** Optional: Zusätzliche Inhalte im Success-Block (z.B. kurze Statistiken) */
  children?: React.ReactNode
  /** Optional: Erfolgsmeldung (Standard: "Das Ergebnis wurde gespeichert und indiziert.") */
  successMessage?: string
}

/**
 * Publish-Step (PDF-HITL):
 * - Wird nach der Vorschau angezeigt.
 * - Publish wird beim Eintritt automatisch gestartet (damit "Vorschau → Weiter" die Aktion auslöst).
 * - Zeigt Progress und bestätigt Abschluss explizit.
 */
export function PublishStep({
  title = "Publizieren",
  description = "Jetzt werden PDF-Artefakte final gespeichert und für die Suche indiziert.",
  onPublish,
  isPublishing,
  publishingProgress,
  publishingMessage,
  isPublished,
  onGoToLibrary,
  goToLibraryLabel = "Zur Bibliothek",
  children,
  successMessage = "Das Ergebnis wurde gespeichert und indiziert.",
}: PublishStepProps) {
  const didStartRef = React.useRef(false)

  React.useEffect(() => {
    if (didStartRef.current) return
    didStartRef.current = true
    void onPublish()
  }, [onPublish])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPublished ? (
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Wizard abgeschlossen
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {successMessage}
            </div>
            {children ? <div className="mt-3">{children}</div> : null}
            {onGoToLibrary ? (
              <div className="mt-3">
                <Button type="button" onClick={onGoToLibrary}>
                  {goToLibraryLabel}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPublishing ? "Publizieren läuft…" : "Publizieren wird gestartet…"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {publishingMessage || "Bitte warten…"}
            </div>
            <div className="mt-3">
              <Progress value={Math.max(0, Math.min(100, publishingProgress))} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}



