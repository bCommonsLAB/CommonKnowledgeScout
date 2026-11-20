"use client"

/**
 * Ist die angemeldete Person Admin dieser Plattform (`KS_ADMIN_EMAIL`)?
 * Steuert nur die Sichtbarkeit von Eintraegen wie „Sprachmodelle"; die
 * Admin-Routen pruefen selbst noch einmal auf dem Server.
 */

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

async function ladeStatus(): Promise<{ istAdmin: boolean }> {
  const antwort = await fetch("/api/admin/status")
  if (!antwort.ok) throw new Error(`Admin-Status: HTTP ${antwort.status}`)
  return (await antwort.json()) as { istAdmin: boolean }
}

export function useKsAdmin(): boolean {
  const status = useQuery({ queryKey: ["ks-admin-status"], queryFn: ladeStatus, staleTime: 5 * 60_000, retry: false })
  useEffect(() => {
    if (status.isError) console.error("[useKsAdmin] Admin-Status nicht geladen:", status.error)
  }, [status.isError, status.error])
  return status.data?.istAdmin === true
}
