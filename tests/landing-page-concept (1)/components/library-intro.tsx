const introData: Record<string, { headline: string; description: string }> = {
  sfscon: {
    headline: "Entdecke, was Menschen auf der SFSCon gesagt haben",
    description:
      "Verschaffe dir zuerst einen Überblick: Durchsuche die Galerie, filtere nach Themen, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus und stelle Fragen zu den Vorträgen.",
  },
  biodiversitaet: {
    headline: "Entdecke Wissen über Biodiversität in Südtirol",
    description:
      "Verschaffe dir zuerst einen Überblick: Durchsuche die Galerie, filtere nach Themen, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus und stelle Fragen zu den Inhalten.",
  },
  fosdem: {
    headline: "Entdecke, was die Open-Source-Community auf der FOSDEM geteilt hat",
    description:
      "Verschaffe dir zuerst einen Überblick: Durchsuche die Galerie, filtere nach Themen, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus und stelle Fragen zu den Talks.",
  },
  civic: {
    headline: "Entdecke Methoden und Projekte für Bürgerbeteiligung",
    description:
      "Verschaffe dir zuerst einen Überblick: Durchsuche die Galerie, filtere nach Themen, die dich interessieren. Wenn du bereit bist, wechsle in den Story-Modus und stelle Fragen zu den Projekten.",
  },
}

export function LibraryIntro({ slug }: { slug: string }) {
  const intro = introData[slug] || introData.sfscon

  return (
    <section className="border-b bg-background py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Befrage das kollektive Wissen</p>

          <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">{intro.headline}</h1>

          <p className="mb-6 text-base leading-relaxed text-muted-foreground md:text-lg text-pretty">
            {intro.description}
          </p>
        </div>
      </div>
    </section>
  )
}
