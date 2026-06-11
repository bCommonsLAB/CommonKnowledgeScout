"use client"

/**
 * StorageForm — Speicherort-Seite (meSpace, Welle 3-IV-UX-3b).
 *
 * Orchestriert zwei Ansichten:
 * - StorageSummary (Standard): Read-only-Zusammenfassung mit
 *   abgesicherten Aktionen (F3, D1, D2).
 * - StorageWizard: gefuehrte Einrichtung in 4 Schritten (F1) — aktiv
 *   bei unkonfigurierten Bibliotheken (kein Pfad), nach "Speicherort
 *   aendern" oder bei der Rueckkehr aus dem OneDrive-OAuth-Redirect
 *   (Resume ueber sessionStorage, siehe WIZARD_RESUME_KEY).
 */

import { Suspense, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useStorageForm } from "./hooks/use-storage-form"
import { StorageWizard, WIZARD_RESUME_KEY } from "./storage-wizard"
import { StorageSummary } from "./storage-summary"

function StorageFormContent() {
  const hook = useStorageForm()
  const { activeLibrary, setTestDialogOpen } = hook

  const [wizardActive, setWizardActive] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [resumeChecked, setResumeChecked] = useState(false)

  // OAuth-Rueckkehr: gespeicherten Wizard-Zustand wiederherstellen
  useEffect(() => {
    if (resumeChecked || !activeLibrary) return
    try {
      const raw = sessionStorage.getItem(WIZARD_RESUME_KEY)
      if (raw) {
        sessionStorage.removeItem(WIZARD_RESUME_KEY)
        const data = JSON.parse(raw) as { libraryId?: string; step?: number }
        if (data.libraryId === activeLibrary.id) {
          setWizardStep(typeof data.step === "number" ? data.step : 1)
          setWizardActive(true)
        }
      }
    } catch (error) {
      console.warn("[StorageForm] Wizard-Resume konnte nicht gelesen werden:", error)
    }
    setResumeChecked(true)
  }, [activeLibrary, resumeChecked])

  if (!activeLibrary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Keine Bibliothek ausgewählt. Bitte wählen Sie eine Bibliothek aus.</p>
        </CardContent>
      </Card>
    )
  }

  // Ohne Pfad ist die Bibliothek nicht eingerichtet → Wizard erzwingen
  const isConfigured = !!activeLibrary.path
  const showWizard = wizardActive || !isConfigured

  if (showWizard) {
    return (
      <StorageWizard
        hook={hook}
        initialStep={wizardStep}
        canCancel={isConfigured}
        onFinished={() => {
          setWizardActive(false)
          setWizardStep(1)
          // handleTest im Wizard setzt testDialogOpen — Dialog der Summary
          // soll nach dem Wechsel nicht ungefragt aufgehen.
          setTestDialogOpen(false)
        }}
      />
    )
  }

  return (
    <StorageSummary
      hook={hook}
      onChangeStorage={() => {
        setWizardStep(1)
        setWizardActive(true)
      }}
    />
  )
}

export function StorageForm() {
  return (
    <Suspense fallback={<div>Lade Storage-Einstellungen...</div>}>
      <StorageFormContent />
    </Suspense>
  )
}
