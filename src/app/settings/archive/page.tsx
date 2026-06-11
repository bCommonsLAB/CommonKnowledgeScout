import { Metadata } from "next"
import { Suspense } from "react"
import { Separator } from "@/components/ui/separator"
import { StorageForm } from "@/components/settings/storage-form"
import { SecretaryServiceForm } from "@/components/settings/secretary-service-form"
import { ContentTypeForm } from "@/components/settings/chat"

export const metadata: Metadata = {
  title: "Bibliothek - Archiv",
  description: "Wo Ihre Dokumente liegen und wie sie zu Wissen werden.",
}

function SectionLoader() {
  return <div className="text-center text-muted-foreground">Lädt...</div>
}

// meSpace > Archiv (User-Entscheid 2026-06-11): Speicherort, Verarbeitung
// und Inhaltstyp bilden EINE Erzaehlung — gegliedert wie die App-Navigation
// (Archive/Explore/Story), damit Laien die Settings dem Ort zuordnen koennen.
export default function ArchiveSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">Archiv</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Das Archiv ist der Arbeitsbereich Ihrer Bibliothek. So hängt alles
          zusammen: Ihre Dokumente liegen in einem <strong>Speicherort</strong> (1).
          Der <strong>Inhaltstyp</strong> (2) legt fest, was Ihre Bibliothek
          enthält und wie es in Archiv, Explore und Story dargestellt wird.
          Bei der <strong>Verarbeitung</strong> (3) werden neue Dokumente
          transkribiert und mit einem Template in diesen Inhaltstyp verwandelt.
        </p>
      </div>
      <Separator />

      {/* 1 — Speicherort */}
      <section className="space-y-3">
        <div>
          <h4 className="text-base font-semibold">1 · Speicherort</h4>
          <p className="text-sm text-muted-foreground">
            Wo die Dateien Ihres Archivs liegen — lokal oder in Ihrer Cloud.
          </p>
        </div>
        <StorageForm />
      </section>

      <Separator />

      {/* 2 — Inhaltstyp */}
      <section className="space-y-3">
        <div>
          <h4 className="text-base font-semibold">2 · Inhaltstyp</h4>
          <p className="text-sm text-muted-foreground">
            Was Ihre Bibliothek enthält — bestimmt das Layout in Archiv,
            Explore und Story.
          </p>
        </div>
        <Suspense fallback={<SectionLoader />}>
          <ContentTypeForm />
        </Suspense>
      </section>

      <Separator />

      {/* 3 — Verarbeitung */}
      <section className="space-y-3">
        <div>
          <h4 className="text-base font-semibold">3 · Verarbeitung</h4>
          <p className="text-sm text-muted-foreground">
            Wie neue Dokumente zu Wissen werden: Template, Zielsprache und
            Cover-Bild für die Transformation.
          </p>
        </div>
        <SecretaryServiceForm />
      </section>
    </div>
  )
}
