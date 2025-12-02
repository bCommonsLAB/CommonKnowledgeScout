"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAtomValue } from "jotai"
import { librariesAtom } from "@/atoms/library-atom"
import { LibraryForm } from "@/components/settings/library-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, BookOpen, Cloud, FolderOpen } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export function SettingsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const libraries = useAtomValue(librariesAtom)
  const { isCreator } = useUserRole()
  const [isNewUser, setIsNewUser] = useState(false)
  const [createNewLibrary, setCreateNewLibrary] = useState(false)
  
  useEffect(() => {
    // Prüfe, ob der newUser-Parameter in der URL ist oder ob keine Bibliotheken vorhanden sind
    const hasNewUserParam = searchParams?.get('newUser') === 'true'
    const hasNoLibraries = libraries.length === 0
    
    setIsNewUser(hasNewUserParam || hasNoLibraries)
  }, [searchParams, libraries.length])
  
  // Wenn Gast (WeSpace), leite zur Homepage weiter
  useEffect(() => {
    if (!isCreator && typeof window !== 'undefined') {
      // Gäste sollten nicht auf /settings sein - leite zur Homepage weiter
      router.replace('/')
    }
  }, [isCreator, router])

  // URL bereinigen, wenn Bibliotheken vorhanden sind und newUser-Parameter gesetzt ist
  useEffect(() => {
    if (libraries.length > 0 && searchParams?.get('newUser') === 'true') {
      // Entferne den newUser-Parameter aus der URL
      const url = new URL(window.location.href)
      url.searchParams.delete('newUser')
      router.replace(url.pathname + url.search)
    }
  }, [libraries.length, searchParams, router])

  // Wenn Gast (WeSpace), zeige Hinweis, dass keine Libraries erstellt werden können
  if (!isCreator) {
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Gast-Modus</AlertTitle>
          <AlertDescription>
            Als Gast (WeSpace) können Sie keine eigenen Bibliotheken erstellen. Sie haben Zugriff auf Bibliotheken, zu denen Sie eingeladen wurden.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  // Wenn es ein neuer Benutzer ist, zeige eine spezielle Willkommensansicht
  if (isNewUser && !createNewLibrary) {
    return (
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Lokale Bibliothek
              </CardTitle>
              <CardDescription>
                Erstellen Sie eine Bibliothek auf Ihrem lokalen Dateisystem für direkten Zugriff auf Ihre Dateien.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ideal für Dokumente, die Sie lokal verwalten möchten. Die Dateien bleiben auf Ihrem Computer.
              </p>
              <Button className="w-full" onClick={() => setCreateNewLibrary(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Lokale Bibliothek erstellen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Cloud-Bibliothek
              </CardTitle>
              <CardDescription>
                Verbinden Sie sich mit OneDrive, Google Drive oder anderen Cloud-Speicherdiensten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Greifen Sie auf Ihre Cloud-Dateien zu und verwalten Sie sie zentral in Knowledge Scout.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setCreateNewLibrary(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Cloud-Bibliothek erstellen
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Sie können später jederzeit weitere Bibliotheken hinzufügen oder diese Einstellungen ändern.
          </p>
        </div>
      </div>
    )
  }

  // Normale Bibliotheksverwaltung für bestehende Benutzer oder wenn eine neue Bibliothek erstellt wird
  return <LibraryForm createNew={createNewLibrary} />;
} 