"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useAtomValue } from "jotai"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { Button } from "@/components/ui/button"
import { Plus, BookOpen, Info } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { useStorage } from "@/contexts/storage-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SpaceOverview } from "@/components/spaces/space-overview"
import { CreateLibraryWizard } from "@/components/flows/create-library-wizard"

export function SettingsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const libraries = useAtomValue(librariesAtom)
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const { isCreator, isLoaded: isRoleLoaded } = useUserRole()
  // isLoading: solange die Bibliotheken noch geladen werden, darf NICHT
  // weitergeleitet werden (sonst Cold-Load-Bounce, weil isCreator anfangs
  // gegen leere libraries false ist).
  const { isLoading: isLibrariesLoading } = useStorage()
  const [isNewUser, setIsNewUser] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  // E7: Moderatoren einer fremden Bibliothek duerfen die Anfragen verwalten
  const isModerator =
    libraries.find(lib => lib.id === activeLibraryId)?.accessRole === 'moderator'

  useEffect(() => {
    // Prüfe, ob der newUser-Parameter in der URL ist oder ob keine Bibliotheken vorhanden sind
    const hasNewUserParam = searchParams?.get('newUser') === 'true'
    const hasNoLibraries = libraries.length === 0

    setIsNewUser(hasNewUserParam || hasNoLibraries)
  }, [searchParams, libraries.length])

  // Wenn Gast (und kein Moderator, E7), leite zur Homepage weiter.
  // WICHTIG: Erst weiterleiten, wenn die Rolle wirklich geladen ist
  // (isRoleLoaded) UND die Bibliotheken fertig geladen sind. Sonst wirft der
  // Cold-Load Creators faelschlich auf '/', weil isCreator anfangs gegen die
  // noch leeren libraries false ist.
  useEffect(() => {
    if (isRoleLoaded && !isLibrariesLoading && !isCreator && !isModerator && typeof window !== 'undefined') {
      router.replace('/')
    }
  }, [isRoleLoaded, isLibrariesLoading, isCreator, isModerator, router])

  // URL bereinigen, wenn Bibliotheken vorhanden sind und newUser-Parameter gesetzt ist
  useEffect(() => {
    if (libraries.length > 0 && searchParams?.get('newUser') === 'true') {
      // Entferne den newUser-Parameter aus der URL
      const url = new URL(window.location.href)
      url.searchParams.delete('newUser')
      router.replace(url.pathname + url.search)
    }
  }, [libraries.length, searchParams, router])

  // Wenn Gast, zeige Hinweis, dass keine Libraries erstellt werden können
  if (!isCreator) {
    // E7: Moderatoren sehen ihren Verwaltungsbereich statt des Gast-Hinweises
    if (isModerator) {
      return (
        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Moderation</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                Sie moderieren diese Bibliothek: Zugriffsanfragen verwalten und
                Leser einladen.
              </span>
              <Button asChild size="sm">
                <Link href="/settings/public/access-requests">Zugriffsanfragen öffnen</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )
    }
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Gast-Modus</AlertTitle>
          <AlertDescription>
            Als Gast können Sie keine eigenen Bibliotheken erstellen. Sie haben Zugriff auf Bibliotheken, zu denen Sie eingeladen wurden.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Creator: entweder Willkommensansicht (neuer Nutzer) oder Raum-Übersicht.
  // Der Anlage-Wizard ist als Dialog stets verfügbar.
  return (
    <>
      {isNewUser ? (
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Willkommen bei Knowledge Scout!</h2>
              <p className="text-muted-foreground mt-2">
                Erstellen Sie Ihre erste Bibliothek, um mit der Organisation Ihrer Dokumente zu beginnen.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={() => setWizardOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Erste Bibliothek erstellen
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Sie brauchen nur einen Namen und den Inhaltstyp — Quelle (lokal
              oder Cloud) und alles Weitere richten Sie danach Schritt für
              Schritt ein.
            </p>
          </div>
        </div>
      ) : (
        <SpaceOverview onCreateNew={() => setWizardOpen(true)} />
      )}

      <CreateLibraryWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  )
}
