"use client"

import * as React from "react"
import { useIngestionData, type IngestionData } from "./use-ingestion-data"

interface IngestionDataContextValue {
  data: IngestionData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const IngestionDataContext = React.createContext<IngestionDataContextValue | null>(null)

interface IngestionDataProviderProps {
  libraryId: string
  fileId: string
  docModifiedAt?: string
  /**
   * Wenn true, werden auch Kapitel geladen (für Story View).
   * Wenn false, nur kompakte Daten (für Story Info).
   */
  includeChapters?: boolean
  children: React.ReactNode
}

/**
 * Provider für Ingestion-Daten.
 * Lädt die Daten einmal und stellt sie allen Consumer-Komponenten zur Verfügung.
 */
export function IngestionDataProvider({
  libraryId,
  fileId,
  docModifiedAt,
  includeChapters = true, // Default: chapters laden (für Story View)
  children,
}: IngestionDataProviderProps) {
  const { data, loading, error, refetch } = useIngestionData(libraryId, fileId, docModifiedAt, includeChapters)

  const value = React.useMemo(
    () => ({ data, loading, error, refetch }),
    [data, loading, error, refetch]
  )

  return <IngestionDataContext.Provider value={value}>{children}</IngestionDataContext.Provider>
}

/**
 * Hook zum Zugriff auf die Ingestion-Daten aus dem Context.
 */
export function useIngestionDataContext(): IngestionDataContextValue {
  const context = React.useContext(IngestionDataContext)
  if (!context) {
    throw new Error("useIngestionDataContext must be used within IngestionDataProvider")
  }
  return context
}

