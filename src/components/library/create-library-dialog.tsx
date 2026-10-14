"use client"

/**
 * CreateLibraryDialog — Einstieg aus Library-Switcher und Library-Formular.
 *
 * Seit C2 (Plan speicher-verbindungen-und-library-anlage) ein Name fuer den
 * Anlege-Wizard: der fruehere Dialog (Name + „Konfiguration klonen") ist
 * durch die Schritte des Wizards ersetzt, das Klonen durch die Wahl einer
 * Vorlage-Library im Schritt Grundlagen (ohne Zugangsdaten, eigener
 * Vektor-Index).
 */

import { CreateLibraryWizard } from "@/components/flows/create-library-wizard"

interface CreateLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback nach erfolgreicher Erstellung mit der neuen Library-ID */
  onCreated?: (libraryId: string) => void
}

export function CreateLibraryDialog({ open, onOpenChange, onCreated }: CreateLibraryDialogProps) {
  return <CreateLibraryWizard open={open} onOpenChange={onOpenChange} onCreated={onCreated} />
}
