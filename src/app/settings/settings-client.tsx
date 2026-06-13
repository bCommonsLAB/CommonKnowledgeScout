"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useAtomValue } from "jotai"
import { librariesAtom, activeLibraryIdAtom } from "@/atoms/library-atom"
import { LibraryForm } from "@/components/settings/library-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, BookOpen, Users, Globe, ChevronRight } from "lucide-react"
import { useUserRole } from "@/hooks/use-user-role"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

// Raum-Karten der Übersicht: Erklärung der drei Räume für Anwender
// ohne Technik-Wissen (Konzept: docs/settings-ux/README.md §2/§5).
const spaceCards = [
  {
    id: "mespace",
    icon: BookOpen,
    space: "meSpace",
    title: "Meine Bibliothek",
    description:
      "Bauen Sie Ihre eigene Bibliothek auf — gegliedert wie die App: das " +
      "Archiv (wo Dokumente liegen und zu Wissen werden), Explore (wie man " +
      "sie in der Galerie erkundet) und Story (das Gespräch mit den Inhalten).",
    links: [
      { title: "Library", href: "/settings/general" },
      { title: "Archive", href: "/settings/archive" },
      { title: "Explore", href: "/settings/explore" },
      { title: "Story", href: "/settings/story" },
      { title: "Erweitert", href: "/settings/advanced" },
    ],
  },
  {
    id: "wespace",
    icon: Users,
    space: "weSpace",
    title: "Gemeinsam arbeiten",
    description:
      "Teilen Sie Ihre Bibliothek mit Personen, denen Sie vertrauen: Laden " +
      "Sie Mitglieder ein und vergeben Sie Rollen — vom Mitleser bis zum " +
      "Mitgestalter.",
    links: [{ title: "Personen", href: "/settings/public/members" }],
  },
  {
    id: "usspace",
    icon: Globe,
    space: "usSpace",
    title: "Veröffentlichen",
    description:
      "Machen Sie Ihre Bibliothek öffentlich zugänglich: mit eigenem Link " +
      "und Startseite — und behalten Sie die Kontrolle darüber, wer Zugang " +
      "bekommt.",
    links: [
      { title: "Öffentlicher Auftritt", href: "/settings/public" },
      { title: "Zugriffsanfragen", href: "/settings/public/access-requests" },
    ],
  },
]

function SpaceOverview({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {spaceCards.map((card) => (
          <Card key={card.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <card.icon className="w-4 h-4" />
                {card.space}
              </div>
              <CardTitle className="text-lg">{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <nav className="flex flex-col gap-1">
                {card.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    {link.title}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))}
              </nav>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
        <p className="text-sm text-muted-foreground">
          Sie möchten eine weitere Bibliothek aufbauen?
        </p>
        <Button variant="outline" onClick={onCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Bibliothek erstellen
        </Button>
      </div>
    </div>
  )
}

export function SettingsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const libraries = useAtomValue(librariesAtom)
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const { isCreator } = useUserRole()
  const [isNewUser, setIsNewUser] = useState(false)
  const [createNewLibrary, setCreateNewLibrary] = useState(false)

  // E7: Moderatoren einer fremden Bibliothek duerfen die Anfragen verwalten
  const isModerator =
    libraries.find(lib => lib.id === activeLibraryId)?.accessRole === 'moderator'

  useEffect(() => {
    // Prüfe, ob der newUser-Parameter in der URL ist oder ob keine Bibliotheken vorhanden sind
    const hasNewUserParam = searchParams?.get('newUser') === 'true'
    const hasNoLibraries = libraries.length === 0

    setIsNewUser(hasNewUserParam || hasNoLibraries)
  }, [searchParams, libraries.length])

  // Wenn Gast (und kein Moderator, E7), leite zur Homepage weiter
  useEffect(() => {
    if (!isCreator && !isModerator && typeof window !== 'undefined') {
      // Gäste sollten nicht auf /settings sein - leite zur Homepage weiter
      router.replace('/')
    }
  }, [isCreator, isModerator, router])

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

        <div className="flex justify-center">
          <Button size="lg" onClick={() => setCreateNewLibrary(true)}>
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
    )
  }

  // Neue Bibliothek wird erstellt: direkt das Grundlagen-Formular zeigen
  if (createNewLibrary) {
    return <LibraryForm createNew={true} />
  }

  // Bestehende Benutzer: Raum-Übersicht (meSpace / weSpace / usSpace)
  return <SpaceOverview onCreateNew={() => setCreateNewLibrary(true)} />
}
