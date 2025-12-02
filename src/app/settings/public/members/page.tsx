/**
 * @fileoverview Library Members Management Page
 * 
 * @description
 * Page for managing library members (moderators).
 * Only owners can access this page and add/remove moderators.
 * 
 * @module settings
 */

"use client"

import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { MembersList } from "@/components/settings/members-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"

/**
 * Seite für Verwaltung von Library-Mitgliedern (Moderatoren)
 * 
 * Zeigt alle Moderatoren für die aktive Library an.
 * Nur für Owner zugänglich.
 */
export default function MembersPage() {
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
        // Prüfe Berechtigung durch Versuch, Mitglieder abzurufen
        const response = await fetch(`/api/libraries/${activeLibraryId}/members`)
        
        if (response.status === 403) {
          setHasPermission(false)
          setError('Keine Berechtigung. Nur Owner können Moderatoren verwalten.')
        } else if (!response.ok) {
          setError('Fehler beim Laden der Mitglieder')
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
          <h3 className="text-lg font-medium">Moderatoren verwalten</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Moderatoren für Ihre Library. Moderatoren können Zugriffsanfragen verwalten und Einladungen versenden.
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
          <h3 className="text-lg font-medium">Moderatoren verwalten</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Moderatoren für Ihre Library.
          </p>
        </div>
        <Separator />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Bibliothek ausgewählt</AlertTitle>
          <AlertDescription>
            Bitte wählen Sie zuerst eine Bibliothek aus, um Moderatoren zu verwalten.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Moderatoren verwalten</h3>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Moderatoren für Ihre Library.
          </p>
        </div>
        <Separator />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keine Berechtigung</AlertTitle>
          <AlertDescription>
            {error || 'Nur Owner können Moderatoren verwalten.'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Moderatoren verwalten</h3>
        <p className="text-sm text-muted-foreground">
          Verwalten Sie Moderatoren für Ihre Library. Moderatoren können Zugriffsanfragen verwalten und Einladungen versenden, haben aber keinen Zugriff auf die Library-Einstellungen.
        </p>
      </div>
      <Separator />
      <MembersList libraryId={activeLibraryId} />
    </div>
  )
}

