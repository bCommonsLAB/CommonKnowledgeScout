"use client"

/**
 * Erweitert · Wartung — Sprachbereinigung und Export/Import der
 * Konfiguration. Beides schreibt kein Config-Objekt ueber das Formular,
 * deshalb gibt es hier keinen Speichern-Knopf; die Pruef-Panels (Dokument-
 * Angaben, Speicher-Abgleich) rendert die Seite daneben.
 */

import { useState } from "react"
import { Card, CardContent } from '@ks/ui'
import { useActiveLibraryId, useLibraries } from '@ks/shell/react'
import { LanguageCleanupSection } from "../language-cleanup-section"
import { ImportExportSection } from "../import-export-section"
import { useShadowTwinMigration, type LangCleanupResult } from "../hooks/use-shadow-twin-migration"
import { useLibraryImportExport } from "./use-library-import-export"
import { NoLibrarySelected } from "./advanced-form-shell"

export function MaintenanceTools() {
  const libraries = useLibraries()
  const activeLibraryId = useActiveLibraryId()
  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)

  // Sprach-Bereinigung (State wie bisher in use-library-form.ts)
  const [isLangCleanupOpen, setIsLangCleanupOpen] = useState(false)
  const [langCleanupLang, setLangCleanupLang] = useState("")
  const [isLangAnalyzing, setIsLangAnalyzing] = useState(false)
  const [isLangDeleting, setIsLangDeleting] = useState(false)
  const [langCleanupResult, setLangCleanupResult] = useState<LangCleanupResult | null>(null)
  const { runLanguageCleanup } = useShadowTwinMigration({
    activeLibraryId,
    langCleanupLang,
    setIsLangAnalyzing,
    setIsLangDeleting,
    setLangCleanupResult,
  })

  const transfer = useLibraryImportExport()

  if (!activeLibrary) return <NoLibrarySelected />

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <LanguageCleanupSection
            activeLibraryId={activeLibraryId}
            isLangCleanupOpen={isLangCleanupOpen}
            setIsLangCleanupOpen={setIsLangCleanupOpen}
            langCleanupLang={langCleanupLang}
            setLangCleanupLang={setLangCleanupLang}
            isLangAnalyzing={isLangAnalyzing}
            isLangDeleting={isLangDeleting}
            langCleanupResult={langCleanupResult}
            setLangCleanupResult={setLangCleanupResult}
            runLanguageCleanup={runLanguageCleanup}
          />
        </CardContent>
      </Card>

      <ImportExportSection
        isNew={false}
        isLoading={transfer.isLoading}
        isImportDialogOpen={transfer.isImportDialogOpen}
        setIsImportDialogOpen={transfer.setIsImportDialogOpen}
        activeLibraryLabel={activeLibrary.label}
        handleExportLibrary={transfer.handleExportLibrary}
        handleImportLibrary={transfer.handleImportLibrary}
      />
    </div>
  )
}
