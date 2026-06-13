"use client"

/**
 * StartClient — angemeldetes Willkommens-Dashboard ("keine Library gewählt").
 *
 * Zeigt die eigenen/geteilten Bibliotheken als Teaser und einen Einstieg zum
 * Anlegen einer neuen Bibliothek. Wird erreicht: nach dem Login, nach dem
 * Deselektieren im Re-Auth-Dialog ("Später") und über "Home" (eingeloggt).
 * Anonyme Besucher werden auf die Marketing-Startseite geleitet.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAtomValue, useSetAtom } from "jotai"
import { Loader2, Plus } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { useStorage } from "@/contexts/storage-context"
import { LibraryTeasers } from "@/components/start/library-teasers"
import { CreateLibraryWizard } from "@/components/flows/create-library-wizard"

export function StartClient() {
  const router = useRouter()
  const { user, isLoaded: isUserLoaded } = useUser()
  const libraries = useAtomValue(librariesAtom)
  const setActiveLibraryId = useSetAtom(activeLibraryIdAtom)
  const { isLoading: isLibrariesLoading } = useStorage()
  const [wizardOpen, setWizardOpen] = useState(false)

  // Anonyme Besucher gehören auf die Marketing-Startseite.
  useEffect(() => {
    if (isUserLoaded && !user) router.replace("/")
  }, [isUserLoaded, user, router])

  // Bibliothek aktivieren (wie der LibrarySwitcher) und App öffnen.
  const handleSelect = (libraryId: string) => {
    setActiveLibraryId(libraryId)
    try {
      localStorage.setItem("activeLibraryId", libraryId)
    } catch {
      // Storage-Fehler ignorieren — der UI-State ist bereits gesetzt.
    }
    router.push("/library")
  }

  if (!isUserLoaded || (isUserLoaded && !user)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasLibraries = libraries.length > 0
  const vorname = user.firstName?.trim()

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Willkommen{vorname ? `, ${vorname}` : ""}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          {hasLibraries
            ? "Wählen Sie eine Bibliothek aus oder legen Sie eine neue an."
            : "Legen Sie Ihre erste Bibliothek an, um mit der Organisation Ihrer Dokumente zu beginnen."}
        </p>
      </div>

      {isLibrariesLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {hasLibraries && <LibraryTeasers libraries={libraries} onSelect={handleSelect} />}

          {/* Einstieg „Neue Bibliothek" — gestaltet als Teaser */}
          <Card
            role="button"
            onClick={() => setWizardOpen(true)}
            className="flex items-center justify-between border-dashed p-6 transition-colors hover:border-primary"
          >
            <div>
              <p className="text-base font-medium">Neue Bibliothek anlegen</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Name und Inhaltstyp genügen — danach richten Sie die Quelle ein.
              </p>
            </div>
            <Button className="gap-2" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Neue Bibliothek
            </Button>
          </Card>
        </div>
      )}

      <CreateLibraryWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  )
}
