"use client"

/**
 * Zustand und Anlage des Anlege-Wizards (Plan speicher-verbindungen-und-library-anlage, C2).
 *
 * Haelt die Antworten, rechnet daraus bei jeder Aenderung den Entwurf samt
 * `pruefeEinrichtung` (reine Funktionen in `src/lib/library-setup/`) und legt
 * die Library ueber `POST /api/libraries` an; mit Vorlage-Library werden deren
 * Vorlagen ueber `/api/templates` kopiert.
 */

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSetAtom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import { toast } from "@ks/ui"
import { useLibraries, useSetActiveLibraryId, useSetLibraries } from "@ks/shell/react"
import { currentFolderIdAtom, folderItemsAtom, folderNavigationAtom, lastLoadedFolderAtom } from "@/atoms/library-atom"
import type { ClientLibrary } from "@/types/library"
import { LEERE_ANTWORTEN, baueWizardEntwurf, type WizardAntworten, type WizardEntwurf } from "@/lib/library-setup/wizard-antworten"

interface VorlageDoc {
  name: string
  metadata: unknown
  systemprompt: string
  markdownBody: string
  creation?: unknown
}

/** Kopiert die Vorlagen einer Library; liefert die Namen, die nicht kopiert wurden. */
async function kopiereVorlagen(vonId: string, nachId: string): Promise<string[]> {
  const antwort = await fetch(`/api/templates?libraryId=${encodeURIComponent(vonId)}`)
  if (!antwort.ok) throw new Error(`Vorlagen der Vorlage-Library nicht lesbar (HTTP ${antwort.status})`)
  const { templates } = (await antwort.json()) as { templates: VorlageDoc[] }
  const fehlgeschlagen: string[] = []
  for (const t of templates) {
    const kopie = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...t, libraryId: nachId }),
    })
    if (!kopie.ok) fehlgeschlagen.push(t.name)
  }
  return fehlgeschlagen
}

export function useCreateLibrary(onCreated?: (libraryId: string) => void) {
  const router = useRouter()
  const libraries = useLibraries()
  const setLibraries = useSetLibraries()
  const setActiveLibraryId = useSetActiveLibraryId()
  const [id] = useState(() => uuidv4())
  const [antworten, setAntworten] = useState<WizardAntworten>(LEERE_ANTWORTEN)
  const [isSaving, setIsSaving] = useState(false)
  const setFolderNav = useSetAtom(folderNavigationAtom)
  const setFolderItems = useSetAtom(folderItemsAtom)
  const setLastLoadedFolder = useSetAtom(lastLoadedFolderAtom)
  const setCurrentFolderId = useSetAtom(currentFolderIdAtom)

  const setze = useCallback((patch: Partial<WizardAntworten>) => setAntworten((alt) => ({ ...alt, ...patch })), [])

  // Ungueltige Antworten (z. B. Sprach-Code, Platzhalter) zeigt die Zusammenfassung als Fehler.
  const ergebnis = useMemo((): { entwurf: WizardEntwurf | null; fehler: string | null } => {
    try {
      return { entwurf: baueWizardEntwurf(id, antworten, libraries), fehler: null }
    } catch (error) {
      console.debug("[CreateLibraryWizard] Entwurf ungueltig:", error)
      return { entwurf: null, fehler: error instanceof Error ? error.message : String(error) }
    }
  }, [id, antworten, libraries])

  const anlegen = useCallback(async () => {
    const entwurf = ergebnis.entwurf
    if (!entwurf || entwurf.pruefung.pflichtOffen) return
    setIsSaving(true)
    try {
      const response = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entwurf.library),
      })
      if (!response.ok) {
        const daten = (await response.json().catch((e: unknown) => {
          console.debug("[CreateLibraryWizard] Fehlerantwort ohne JSON:", e)
          return {}
        })) as { error?: string }
        throw new Error(daten.error ?? `Fehler beim Speichern: HTTP ${response.status}`)
      }
      if (antworten.vorlageVon && antworten.vorlagenKopieren) {
        const fehlgeschlagen = await kopiereVorlagen(antworten.vorlageVon, id)
        if (fehlgeschlagen.length > 0) {
          console.error("[CreateLibraryWizard] Vorlagen nicht kopiert:", fehlgeschlagen)
          toast({ title: "Vorlagen teilweise nicht kopiert", description: fehlgeschlagen.join(", "), variant: "destructive" })
        }
      }
      const { id: neuId, label, type, path, isEnabled, storageConnectionId, config } = entwurf.library
      const neu: ClientLibrary = { id: neuId, label, type, path, isEnabled, storageConnectionId, config: { ...config } }
      setLibraries([...libraries, neu])
      // Ordner-Zustand der alten Library SYNCHRON vor dem Wechsel leeren (sonst Race beim ersten Laden).
      setFolderNav((state) => ({ ...state, folderCache: {} }))
      setFolderItems([])
      setLastLoadedFolder(null)
      setCurrentFolderId("root")
      setActiveLibraryId(id)
      toast({
        title: "Bibliothek erstellt",
        description: `„${entwurf.library.label}" — Einrichtung ${entwurf.pruefung.erledigt} von ${entwurf.pruefung.gesamt}.`,
      })
      onCreated?.(id)
      router.push("/settings/archive")
    } catch (error) {
      console.error("[CreateLibraryWizard] Anlage fehlgeschlagen:", error)
      toast({ title: "Fehler", description: error instanceof Error ? error.message : String(error), variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }, [ergebnis.entwurf, antworten.vorlageVon, antworten.vorlagenKopieren, id, libraries, setLibraries, setActiveLibraryId, setFolderNav, setFolderItems, setLastLoadedFolder, setCurrentFolderId, onCreated, router])

  return { antworten, setze, entwurf: ergebnis.entwurf, fehler: ergebnis.fehler, anlegen, isSaving, libraries }
}
