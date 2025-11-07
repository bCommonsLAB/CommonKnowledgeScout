import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function RechtlicheHinweisePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </Link>

        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold mb-8">Rechtliche Hinweise</h1>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Zweck des Projekts</h2>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout ist ein offenes Forschungs- und Entwicklungsprojekt zur Erkundung kollektiven Wissens. Die
              Plattform dient ausschließlich Bildung und Exploration. Es handelt sich um ein experimentelles Labor,
              nicht um ein kommerzielles Produkt.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Herkunft der Inhalte</h2>
            <p className="text-muted-foreground leading-relaxed">
              Alle Inhalte stammen aus öffentlich zugänglichen Quellen (z. B. Vorträgen, Publikationen, Webseiten). Die
              Originalautor:innen sind jeweils angegeben. Knowledge Scout erstellt keine eigenen Inhalte, sondern macht
              bestehendes Wissen durchsuchbar und zugänglich.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Nutzung von KI-Modellen</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Texte, Zusammenfassungen und Antworten werden mithilfe von Large-Language-Modellen (LLMs) automatisch
              formuliert. Die Modelle fassen Inhalte sprachlich zusammen, verändern sie jedoch nicht inhaltlich.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Wichtig:</strong> Jede Antwort verweist auf ihre zugrunde liegenden Quellen. Die KI erfindet keine
              Inhalte, sondern formuliert Antworten basierend auf den verfügbaren Dokumenten.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Haftungsausschluss</h2>
            <p className="text-muted-foreground leading-relaxed">
              Der Betreiber übernimmt keine Gewähr für Richtigkeit, Vollständigkeit oder Aktualität automatisch
              erzeugter Texte. Die Nutzung erfolgt auf eigene Verantwortung. Knowledge Scout ist ein experimentelles
              Projekt und liefert keine amtlichen oder wissenschaftlich geprüften Aussagen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Urheberrecht & Quellen</h2>
            <p className="text-muted-foreground leading-relaxed">
              Urheberrechte verbleiben bei den jeweiligen Autor:innen oder Institutionen. Alle verwendeten Quellen
              werden transparent angegeben. Fehlerhafte oder unvollständige Quellenangaben können unter{" "}
              <a href="mailto:kontakt@knowledgescout.org" className="underline">
                kontakt@knowledgescout.org
              </a>{" "}
              gemeldet werden.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Datenschutz</h2>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout speichert keine personenbezogenen Daten und arbeitet ausschließlich mit anonymisierten
              Anfragen. Es werden keine Nutzerprofile erstellt. Weitere Informationen finden Sie in unserer{" "}
              <Link href="/datenschutz" className="underline">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Transparenz nach EU AI Act</h2>
            <p className="text-muted-foreground leading-relaxed">
              Gemäß Art. 50–53 des EU AI Act kennzeichnen wir alle KI-generierten Inhalte transparent. Nutzer:innen
              werden im Moment der Interaktion darauf hingewiesen, dass Antworten automatisch formuliert wurden. Die
              Datenherkunft und verwendeten Quellen sind jederzeit nachvollziehbar.
            </p>
          </section>

          <div className="mt-12 p-6 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Letzte Aktualisierung:</strong>{" "}
              {new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}


