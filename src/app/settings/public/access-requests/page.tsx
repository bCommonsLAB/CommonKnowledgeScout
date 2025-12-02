"use client"

import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { AccessRequestsList } from "@/components/settings/access-requests-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

/**
 * Seite für Verwaltung von Zugriffsanfragen
 * 
 * Zeigt alle Zugriffsanfragen für die aktive Library an.
 * Nur für Owner und Moderatoren zugänglich.
 */
export default function AccessRequestsPage() {
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkPermission() {
      if (!activeLibraryId) {
        setHasPermission(false)
        setLoading(false)
        return
      }

      try {
        // Prüfe Berechtigung durch Versuch, Anfragen abzurufen
        const response = await fetch(`/api/libraries/${activeLibraryId}/access-requests`)
        
        if (response.status === 403) {
          setHasPermission(false)
          setError('Keine Berechtigung. Nur Owner und Moderatoren können Zugriffsanfragen verwalten.')
        } else if (!response.ok) {
          setError('Fehler beim Laden der Zugriffsanfragen')
        } else {
          setHasPermission(true)
        }
      } catch (err) {
        console.error('Fehler beim Prüfen der Berechtigung:', err)
        setError('Fehler beim Prüfen der Berechtigung')
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [activeLibraryId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Zugriffsanfragen verwalten</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Zugriffsanfragen für Ihre Library.
          </p>
        </div>
        <Separator />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!activeLibraryId) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Zugriffsanfragen verwalten</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Zugriffsanfragen für Ihre Library.
          </p>
        </div>
        <Separator />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Bibliothek ausgewählt</AlertTitle>
          <AlertDescription>
            Bitte wählen Sie zuerst eine Bibliothek aus, um Zugriffsanfragen zu verwalten.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Zugriffsanfragen verwalten</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Zugriffsanfragen für Ihre Library.
          </p>
        </div>
        <Separator />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Berechtigung</AlertTitle>
          <AlertDescription>
            {error || 'Nur Owner und Moderatoren können Zugriffsanfragen verwalten.'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Zugriffsanfragen verwalten</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Zugriffsanfragen für Ihre Library. Genehmigen oder lehnen Sie Anfragen ab und senden Sie Einladungen.
        </p>
      </div>
      <Separator />
      <AccessRequestsList libraryId={activeLibraryId} />
    </div>
  )
}

