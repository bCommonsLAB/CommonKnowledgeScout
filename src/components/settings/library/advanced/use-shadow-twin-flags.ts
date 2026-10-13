"use client"

/**
 * Zustand der beiden Shadow-Twin-Schalter (ausserhalb von react-hook-form,
 * wie bisher) plus Azure-Verfuegbarkeit fuer die Strategie-Vorschau.
 * Herkunft: use-library-form.ts (vor Teil B eine Form fuer alles).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { ClientLibrary } from "@/types/library"
import { readShadowTwinFlags, type ShadowTwinFlags } from "./storage-twins-form-model"

export function useShadowTwinFlags(activeLibrary: ClientLibrary | undefined) {
  const [persistToFilesystem, setPersistToFilesystem] = useState(true)
  const [allowFilesystemFallback, setAllowFilesystemFallback] = useState(true)
  const [azureConfigured, setAzureConfigured] = useState<boolean | null>(null)
  // Gespeicherter Stand, gegen den der Dirty-Check laeuft
  const snapshotRef = useRef<ShadowTwinFlags>({ persistToFilesystem: true, allowFilesystemFallback: true })

  // Schalter aus der Library ableiten (v2-only: mode/primaryStore fix)
  useEffect(() => {
    const next = readShadowTwinFlags(activeLibrary?.config)
    snapshotRef.current = next
    setPersistToFilesystem(next.persistToFilesystem)
    setAllowFilesystemFallback(next.allowFilesystemFallback)
  }, [activeLibrary?.id, activeLibrary?.config])

  // Azure-Verfuegbarkeit abrufen (fuer die Strategie-Vorschau)
  useEffect(() => {
    const id = activeLibrary?.id
    if (!id) {
      setAzureConfigured(null)
      return
    }
    let cancelled = false
    fetch(`/api/library/${id}/media-storage-strategy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return
        const azure = (data as Record<string, unknown>).azureConfigured
        if (typeof azure === "boolean") setAzureConfigured(azure)
      })
      .catch((err: unknown) => {
        console.error("[ShadowTwinFlags] Medien-Speicher-Strategie nicht abrufbar:", err)
        if (!cancelled) setAzureConfigured(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeLibrary?.id])

  const isDirty = useMemo(
    () =>
      persistToFilesystem !== snapshotRef.current.persistToFilesystem ||
      allowFilesystemFallback !== snapshotRef.current.allowFilesystemFallback,
    [persistToFilesystem, allowFilesystemFallback],
  )

  const flags: ShadowTwinFlags = { persistToFilesystem, allowFilesystemFallback }
  return { flags, setPersistToFilesystem, setAllowFilesystemFallback, azureConfigured, isDirty }
}
