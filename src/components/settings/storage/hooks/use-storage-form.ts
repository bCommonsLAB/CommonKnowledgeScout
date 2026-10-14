"use client"

/**
 * useStorageForm — zentraler Hook fuer Archive · 1 Quelle.
 *
 * Seit Teil A des Plans speicher-verbindungen-und-library-anlage traegt die
 * Library keine Zugangsdaten mehr: sie zeigt auf eine Speicher-Verbindung des
 * Kontos (`storageConnectionId`) plus Verzeichnis (`path`). Anmelden, Testen
 * und Pflegen der Zugaenge passiert unter Mein Konto → Speicher-Verbindungen;
 * hier bleibt Verbindung waehlen, Verzeichnis waehlen, Test.
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useEffect, useCallback } from "react"
import { useActiveLibraryId, useLibraries, useSetLibraries } from '@ks/shell/react'
import { toast } from "sonner"
import { StorageProviderType, type ClientLibrary } from "@/types/library"
import type { StorageConnectionSummary } from "@/types/storage-connection"
import { StorageFactory } from "@/lib/storage/storage-factory"
import { useAccountConnections } from "./use-account-connections"
import { useStorageTest, type TestLogEntry } from "./use-storage-test"

export type { TestLogEntry }

/** Im Settings-Formular waehlbare Storage-Typen ('inbox' ist intern, ADR-0004 II). */
const STORAGE_FORM_STORAGE_TYPES = ["local", "onedrive", "gdrive", "nextcloud"] as const

/** Mappt StorageProviderType auf den Form-Enum; 'inbox' ist kein User-Typ. */
function toStorageFormStorageType(type: StorageProviderType): (typeof STORAGE_FORM_STORAGE_TYPES)[number] {
  if (type !== "local" && type !== "onedrive" && type !== "gdrive" && type !== "nextcloud") {
    throw new Error(`Ungueltiger Bibliothekstyp fuer Storage-Settings: "${type}"`)
  }
  return type
}

export const storageFormSchema = z.object({
  // 'gdrive' ist Legacy (nie funktionsfaehig, UI bietet es nicht mehr an, F4)
  type: z.enum(STORAGE_FORM_STORAGE_TYPES, { required_error: "Bitte wählen Sie einen Speichertyp." }),
  path: z.string({ required_error: "Bitte geben Sie einen Speicherpfad ein." }),
  /** Speicher-Verbindung des Kontos; Pflicht bei nextcloud und onedrive. */
  storageConnectionId: z.string().optional(),
})

export type StorageFormValues = z.infer<typeof storageFormSchema>

export interface UseStorageFormResult {
  form: ReturnType<typeof useForm<StorageFormValues>>
  activeLibrary: ClientLibrary | undefined
  currentType: StorageProviderType | undefined
  isLoading: boolean
  isTesting: boolean
  testDialogOpen: boolean
  setTestDialogOpen: (v: boolean) => void
  testResults: TestLogEntry[]
  /** Verbindungen des Kontos (null = laedt) und die der Library zugeordnete. */
  connections: StorageConnectionSummary[] | null
  connectionsError: string | null
  activeConnection: StorageConnectionSummary | null
  tokenStatus: { isAuthenticated: boolean; isExpired: boolean; loading: boolean }
  onSubmit: (data: StorageFormValues) => Promise<void>
  handleTest: () => Promise<void>
}

function readStorageForm(library: ClientLibrary): StorageFormValues {
  return {
    type: toStorageFormStorageType(library.type),
    path: library.path || "",
    storageConnectionId: library.storageConnectionId ?? "",
  }
}

export function useStorageForm(): UseStorageFormResult {
  const libraries = useLibraries()
  const setLibraries = useSetLibraries()
  const [isLoading, setIsLoading] = useState(false)
  const activeLibraryId = useActiveLibraryId()
  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)
  const { connections, connectionsError } = useAccountConnections()
  const test = useStorageTest(activeLibrary)

  const form = useForm<StorageFormValues>({
    resolver: zodResolver(storageFormSchema),
    defaultValues: { type: 'local', path: '', storageConnectionId: '' },
  })

  const currentType = form.watch("type") || (activeLibrary?.type as StorageProviderType | undefined)
  const watchedConnectionId = form.watch("storageConnectionId")

  useEffect(() => {
    if (activeLibrary) form.reset(readStorageForm(activeLibrary))
  }, [activeLibrary, form])

  const activeConnection =
    connections?.find((c) => c.id === (watchedConnectionId || activeLibrary?.storageConnectionId)) ?? null
  // OneDrive: angemeldet ist, wer an der Verbindung ein Refresh-Token hat; der
  // Provider erneuert Access-Tokens selbst, „abgelaufen" gibt es hier nicht mehr.
  const tokenStatus = {
    isAuthenticated: activeConnection?.onedrive?.loggedIn === true,
    isExpired: false,
    loading: connections === null,
  }

  /** Typ, Verbindung und Verzeichnis speichern (nur eigene Felder, PATCH). */
  const onSubmit = useCallback(async (data: StorageFormValues) => {
    if (!activeLibrary) {
      toast.error("Fehler", { description: "Keine Bibliothek ausgewählt." })
      return
    }
    const braucht = data.type === 'nextcloud' || data.type === 'onedrive'
    const connectionId = (data.storageConnectionId ?? '').trim()
    if (braucht && connectionId === '') {
      form.setError("storageConnectionId", { message: "Bitte eine Speicher-Verbindung wählen." })
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch(`/api/libraries/${activeLibrary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: data.type, path: data.path, storageConnectionId: braucht ? connectionId : null, config: {} }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Fehler beim Speichern: ${response.statusText}`)
      }
      const updatedLibrary = (await response.json()) as ClientLibrary
      setLibraries(libraries.map(lib => lib.id === updatedLibrary.id ? updatedLibrary : lib))
      // Factory nachziehen, sonst baut der Verzeichnis-Picker den Provider aus der alten Kopie.
      StorageFactory.getInstance().updateLibrary(updatedLibrary)
      toast.success("Erfolg", { description: "Die Quelle wurde gespeichert." })
    } catch (error) {
      console.error('[StorageForm] Fehler beim Speichern:', error)
      toast.error("Fehler", { description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern" })
    } finally {
      setIsLoading(false)
    }
  }, [activeLibrary, libraries, setLibraries, form])

  return {
    form,
    activeLibrary,
    currentType,
    isLoading,
    isTesting: test.isTesting,
    testDialogOpen: test.testDialogOpen,
    setTestDialogOpen: test.setTestDialogOpen,
    testResults: test.testResults,
    connections,
    connectionsError,
    activeConnection,
    tokenStatus,
    onSubmit,
    handleTest: test.handleTest,
  }
}
