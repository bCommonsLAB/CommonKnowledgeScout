"use client"

/**
 * StorageReauthDialog — app-weiter Anmelde-Dialog fuer abgelaufene/
 * fehlende Storage-Anmeldung (Welle 3-IV-UX-3c, F2).
 *
 * Wird global im StorageContextProvider gerendert (Props statt
 * useStorage, um einen Import-Zyklus mit dem Context zu vermeiden).
 *
 * Verhalten:
 * - Erscheint, wenn der Storage-Zugriff Anmeldung verlangt
 *   (libraryStatus 'waitingForAuth' bzw. isAuthRequired) — z.B. beim
 *   Archiv-Einstieg nach Tagen mit abgelaufenem Token.
 * - NICHT in den Settings (dort fuehren Wizard/Zusammenfassung).
 * - Fuehrt NUR den Anmelde-Schritt aus und kehrt zur aktuellen Seite
 *   zurueck; die Token-Uebernahme nach der Rueckkehr passiert hier
 *   ebenfalls (ausserhalb der Settings).
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Cloud } from "lucide-react"
import { startOneDriveReauth, processOneDriveAuthReturn } from "@/lib/storage/onedrive-reauth"
import type { ClientLibrary } from "@/types/library"

interface StorageReauthDialogProps {
  currentLibrary: ClientLibrary | null
  isAuthRequired: boolean
  libraryStatus: string
  refreshAuthStatus: () => void
  /**
   * "Später": Bibliothek deselektieren (in den "keine Library gewählt"-Zustand
   * wechseln), statt nur den Dialog lokal auszublenden. Verhindert, dass der
   * Dialog bei jedem Seitenladen erneut blockiert.
   */
  onDismissLibrary?: (libraryId: string) => void
}

export function StorageReauthDialog({
  currentLibrary,
  isAuthRequired,
  libraryStatus,
  refreshAuthStatus,
  onDismissLibrary,
}: StorageReauthDialogProps) {
  const pathname = usePathname()
  const [dismissedForLibrary, setDismissedForLibrary] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [returnProcessed, setReturnProcessed] = useState(false)

  const inSettings = pathname?.startsWith("/settings") === true

  // OAuth-Rueckkehr ausserhalb der Settings verarbeiten (in den
  // Settings uebernimmt use-storage-form.ts diese Aufgabe).
  useEffect(() => {
    if (returnProcessed || inSettings || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const authSuccess = params.get("authSuccess") === "true"
    const authError = params.get("authError")
    const libraryId = params.get("libraryId")

    if (!authSuccess && !authError) return
    setReturnProcessed(true)

    void (async () => {
      if (authSuccess && libraryId) {
        try {
          const ok = await processOneDriveAuthReturn(libraryId)
          if (ok) {
            toast.success("Anmeldung erfolgreich", {
              description: "Die Verbindung zum Speicherort ist wiederhergestellt.",
            })
            refreshAuthStatus()
          }
        } catch (error) {
          console.error("[StorageReauthDialog] Token-Uebernahme fehlgeschlagen:", error)
          toast.error("Anmeldung unvollständig", {
            description: error instanceof Error ? error.message : String(error),
          })
        }
      }
      if (authError) {
        toast.error("Anmeldung fehlgeschlagen", { description: authError })
      }
      // URL bereinigen
      const url = new URL(window.location.href)
      url.searchParams.delete("authSuccess")
      url.searchParams.delete("authError")
      url.searchParams.delete("libraryId")
      url.searchParams.delete("errorDescription")
      window.history.replaceState({}, "", url.toString())
    })()
  }, [returnProcessed, inSettings, refreshAuthStatus])

  const needsAuth =
    !!currentLibrary &&
    currentLibrary.type === "onedrive" &&
    (isAuthRequired || libraryStatus === "waitingForAuth")

  const open =
    needsAuth && !inSettings && dismissedForLibrary !== currentLibrary?.id

  const handleLogin = async () => {
    if (!currentLibrary) return
    setIsStarting(true)
    try {
      await startOneDriveReauth(currentLibrary.id)
    } catch (error) {
      console.error("[StorageReauthDialog] Re-Auth konnte nicht gestartet werden:", error)
      toast.error("Anmeldung konnte nicht gestartet werden", {
        description: error instanceof Error ? error.message : String(error),
      })
      setIsStarting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && currentLibrary) {
          setDismissedForLibrary(currentLibrary.id)
          onDismissLibrary?.(currentLibrary.id)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" /> Anmeldung erforderlich
          </DialogTitle>
          <DialogDescription>
            Die Anmeldung der Bibliothek &quot;{currentLibrary?.label}&quot; bei
            OneDrive ist abgelaufen oder fehlt. Melden Sie sich neu an, um
            wieder auf Ihre Dateien zuzugreifen — Sie kehren danach automatisch
            hierher zurück.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (!currentLibrary) return
              setDismissedForLibrary(currentLibrary.id)
              onDismissLibrary?.(currentLibrary.id)
            }}
          >
            Später
          </Button>
          <Button onClick={() => void handleLogin()} disabled={isStarting}>
            {isStarting ? "Leite weiter…" : "Bei OneDrive anmelden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
