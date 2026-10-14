"use client"

/**
 * Verbindungstest einer Library (Browser-Provider plus serverseitiger Test).
 * Aus use-storage-form.ts herausgeloest (Teil A, 200-Zeilen-Regel).
 */

import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { ClientLibrary } from "@/types/library"
import { StorageFactory } from "@/lib/storage/storage-factory"

export interface TestLogEntry {
  step: string
  status: 'success' | 'error' | 'info'
  message: string
  timestamp: string
  details?: Record<string, unknown>
}

export function useStorageTest(activeLibrary: ClientLibrary | undefined) {
  const [isTesting, setIsTesting] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testResults, setTestResults] = useState<TestLogEntry[]>([])

  const handleTest = useCallback(async () => {
    if (!activeLibrary) {
      toast.error("Fehler", { description: "Keine Bibliothek ausgewählt." })
      return
    }
    setIsTesting(true)
    setTestResults([])
    setTestDialogOpen(true)
    const logs: TestLogEntry[] = []
    const logStep = (step: string, status: TestLogEntry['status'], message: string, details?: TestLogEntry['details']) => {
      logs.push({ timestamp: new Date().toISOString(), step, status, message, details })
      setTestResults([...logs])
    }
    try {
      const provider = await StorageFactory.getInstance().getProvider(activeLibrary.id)
      logStep("Validierung", "info", "Validiere Storage-Provider Konfiguration...")
      const validationResult = await provider.validateConfiguration()
      if (!validationResult.isValid) {
        logStep("Validierung", "error", `Storage-Provider Konfiguration ungültig: ${validationResult.error}`)
        return
      }
      logStep("Validierung", "success", "Storage-Provider Konfiguration ist gültig.", { validationResult })

      try {
        const rootItems = await provider.listItemsById('root')
        logStep("Root-Verzeichnis", "success", `${rootItems.length} Elemente im Root gefunden.`)
        const testFolderName = `test-folder-${Math.random().toString(36).substring(7)}`
        const testFolder = await provider.createFolder('root', testFolderName)
        logStep("Testverzeichnis", "success", `Testverzeichnis "${testFolderName}" erstellt.`)
        const testFileName = `test-file-${Math.random().toString(36).substring(7)}.txt`
        const testFile = new File([new Blob(["Testdatei Knowledge Scout"], { type: 'text/plain' })], testFileName, { type: 'text/plain' })
        await provider.uploadFile(testFolder.id, testFile)
        logStep("Testdatei", "success", `Testdatei "${testFileName}" erstellt.`)
        await provider.deleteItem(testFolder.id)
        logStep("Aufräumen", "success", `Testverzeichnis gelöscht.`)

        logStep("API-Aufruf", "info", "Starte serverseitigen Storage-Test...")
        const resp = await fetch('/api/settings/storage-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ libraryId: activeLibrary.id }),
        })
        if (!resp.ok) {
          const msg = await resp.text()
          logStep("Server-Test", "error", `Server-Test fehlgeschlagen: ${resp.status}`, { body: msg.slice(0, 300) })
        } else {
          const data = await resp.json()
          for (const entry of (Array.isArray(data.logs) ? data.logs as TestLogEntry[] : [])) logs.push(entry)
          setTestResults([...logs])
          logStep("Server-Test", data.success ? "success" : "error", data.success ? "Server-Test abgeschlossen" : "Server-Test fehlgeschlagen")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('Nicht authentifiziert') || errorMessage.includes('AUTH_REQUIRED')) {
          logStep("Fehler", "error", "Zugriff verweigert: Provider ist nicht authentifiziert")
          logStep("Hinweis", "info", "Bitte unter Mein Konto → Speicher-Verbindungen bei Microsoft anmelden")
          return
        }
        const safeDetails = typeof error === 'object' && error !== null ? error as Record<string, unknown> : { error }
        logStep("Fehler", "error", `Test fehlgeschlagen: ${errorMessage}`, safeDetails)
      }
    } catch (error) {
      console.error('[StorageForm] Fehler beim Testen:', error)
      toast.error("Fehler", { description: error instanceof Error ? error.message : "Unbekannter Fehler beim Testen" })
    } finally {
      setIsTesting(false)
    }
  }, [activeLibrary])

  return { isTesting, testDialogOpen, setTestDialogOpen, testResults, handleTest }
}
