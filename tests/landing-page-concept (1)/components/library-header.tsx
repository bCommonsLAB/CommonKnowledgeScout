import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings } from "lucide-react"
import Link from "next/link"

const libraryData: Record<string, { title: string; subtitle: string }> = {
  sfscon: {
    title: "SFSCon Talks (Bozen)",
    subtitle: "Öffentliche Wissensbibliothek",
  },
  biodiversitaet: {
    title: "Biodiversität Südtirol",
    subtitle: "Öffentliche Wissensbibliothek",
  },
  fosdem: {
    title: "FOSDEM (Brüssel)",
    subtitle: "Öffentliche Wissensbibliothek",
  },
  civic: {
    title: "Civic Commons Library",
    subtitle: "Öffentliche Wissensbibliothek",
  },
}

export function LibraryHeader({ slug }: { slug: string }) {
  const library = libraryData[slug] || libraryData.sfscon

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">{library.title}</h1>
              <p className="text-sm text-muted-foreground">{library.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/library/${slug}/admin/wizards`}>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Settings className="h-4 w-4" />
                Wizards konfigurieren
              </Button>
            </Link>
            <Link href={`/library/${slug}/create`}>
              <Button className="gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Content erstellen
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
