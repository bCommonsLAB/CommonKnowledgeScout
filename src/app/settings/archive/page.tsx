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
          Im Archiv verarbeiten Sie bestehende Quellen zu Inhalten Ihrer
          Bibliothek: Ihre Dokumente liegen in einer <strong>Quelle</strong> (1).
          Der <strong>Inhaltstyp</strong> (2) legt fest, was daraus entsteht und
          wie es in Archiv, Explore und Story dargestellt wird. Die{" "}
          <strong>Verarbeitung</strong> (3) ist Ihr Journalist-Moment: Eine
          Vorlage verwandelt das Rohmaterial in strukturierte Beiträge.
        </p>
      </div>
      <Separator />

      {/* 1 — Quelle */}
      <section className="space-y-3">
        <div>
          <h4 className="text-base font-semibold">1 · Quelle</h4>
          <p className="text-sm text-muted-foreground">
            Woher die Dokumente Ihres Archivs kommen — lokal oder aus Ihrer Cloud.
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
          <h4 className="text-base font-semibold">3 · Verarbeitung — Ihr Journalist-Moment</h4>
          <p className="text-sm text-muted-foreground">
            Eine Vorlage verwandelt das Rohmaterial Ihrer Dokumente in
            strukturierte Beiträge. Diese Standardwerte gelten, wenn Sie im
            Archiv Dokumente verarbeiten.
          </p>
        </div>
        <SecretaryServiceForm />
      </section>
    </div>
  )
}
