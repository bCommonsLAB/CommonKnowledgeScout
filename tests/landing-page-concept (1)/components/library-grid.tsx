import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Leaf, Code2, Users, ArrowRight } from "lucide-react"
import Link from "next/link"

const libraries = [
  {
    icon: Building2,
    title: "SFSCon Talks (Bozen)",
    description: "Offenes Archiv zu Digitalisierung, Gesellschaft und Open Source – hunderte Talks der letzten Jahre.",
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    slug: "sfscon",
  },
  {
    icon: Leaf,
    title: "Biodiversität Südtirol",
    description: "Daten, Studien und Interviews zu Artenvielfalt, Naturschutz und Klima.",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    slug: "biodiversitaet",
  },
  {
    icon: Code2,
    title: "FOSDEM (Brüssel)",
    description: "Europas größte Open-Source-Konferenz – Wissen, Trends und Community-Inhalte.",
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    slug: "fosdem",
  },
  {
    icon: Users,
    title: "Civic Commons Library",
    description: "Projekte und Methoden für Bürgerbeteiligung, Commons und Teilhabe.",
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    slug: "civic",
  },
]

export function LibraryGrid() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">
            Wähle deine Wissensbibliothek
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            Jede Library enthält strukturierte Inhalte aus Vorträgen, Studien oder Projekten – und kann von dir wie ein
            Gesprächspartner befragt werden.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
          {libraries.map((library) => {
            const Icon = library.icon
            return (
              <Card key={library.title} className="group relative overflow-hidden transition-all hover:shadow-lg">
                <CardHeader>
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${library.bgColor}`}
                  >
                    <Icon className={`h-6 w-6 ${library.color}`} />
                  </div>
                  <CardTitle className="text-xl">{library.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{library.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/library/${library.slug}`}>
                    <Button variant="ghost" className="group/btn gap-2">
                      Befragen
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
