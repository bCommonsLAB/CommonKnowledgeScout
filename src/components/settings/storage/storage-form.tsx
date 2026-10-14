"use client"

/**
 * StorageForm — Archive · 1 Quelle (meSpace, Welle 3-IV-UX-3b).
 *
 * Orchestriert zwei Ansichten:
 * - StorageSummary (Standard): Read-only-Zusammenfassung mit
 *   abgesicherten Aktionen (F3, D1).
 * - StorageWizard: gefuehrte Einrichtung in 4 Schritten (F1) — aktiv bei
 *   unkonfigurierten Bibliotheken oder nach "Quelle ändern".
 *
 * Seit Teil A des Plans speicher-verbindungen-und-library-anlage laeuft die
 * OneDrive-Anmeldung an der Speicher-Verbindung (Mein Konto); der fruehere
 * Wizard-Resume nach dem OAuth-Redirect entfaellt.
 */

import { Suspense, useState } from "react"
import { Card, CardContent } from '@ks/ui'
import { useStorageForm } from "./hooks/use-storage-form"
import { StorageWizard } from "./storage-wizard"
import { StorageSummary } from "./storage-summary"

function StorageFormContent() {
  const hook = useStorageForm()
  const { activeLibrary, setTestDialogOpen } = hook
  const [wizardActive, setWizardActive] = useState(false)

  if (!activeLibrary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Keine Bibliothek ausgewählt. Bitte wählen Sie eine Bibliothek aus.</p>
        </CardContent>
      </Card>
    )
  }

  // Eingerichtet heisst: Pfad gesetzt und — bei nextcloud/onedrive — eine Verbindung gewaehlt.
  const brauchtVerbindung = activeLibrary.type === "nextcloud" || activeLibrary.type === "onedrive"
  const isConfigured = !!activeLibrary.path && (!brauchtVerbindung || !!activeLibrary.storageConnectionId)
  const showWizard = wizardActive || !isConfigured

  if (showWizard) {
    return (
      <StorageWizard
        hook={hook}
        canCancel={isConfigured}
        onFinished={() => {
          setWizardActive(false)
          // handleTest im Wizard setzt testDialogOpen — der Dialog der Summary
          // soll nach dem Wechsel nicht ungefragt aufgehen.
          setTestDialogOpen(false)
        }}
      />
    )
  }

  return <StorageSummary hook={hook} onChangeStorage={() => setWizardActive(true)} />
}

export function StorageForm() {
  return (
    <Suspense fallback={<div>Lade Storage-Einstellungen...</div>}>
      <StorageFormContent />
    </Suspense>
  )
}
