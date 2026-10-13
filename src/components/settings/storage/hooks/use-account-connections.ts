"use client"

/**
 * Speicher-Verbindungen des Kontos fuer die Quellen-Wahl einer Library
 * (Archive · 1 Quelle). Liest nur Zusammenfassungen ohne Geheimnisse.
 */

import { useCallback, useEffect, useState } from "react"
import type { StorageConnectionSummary } from "@/types/storage-connection"

export function useAccountConnections() {
  const [connections, setConnections] = useState<StorageConnectionSummary[] | null>(null)
  const [connectionsError, setConnectionsError] = useState<string | null>(null)

  const reloadConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/account/storage-connections")
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { connections: StorageConnectionSummary[] }
      setConnections(data.connections)
      setConnectionsError(null)
    } catch (error) {
      console.error("[StorageForm] Speicher-Verbindungen konnten nicht geladen werden:", error)
      setConnectionsError(error instanceof Error ? error.message : String(error))
      setConnections([])
    }
  }, [])

  useEffect(() => {
    void reloadConnections()
  }, [reloadConnections])

  return { connections, connectionsError, reloadConnections }
}
