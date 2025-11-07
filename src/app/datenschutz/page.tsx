import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function DatenschutzPage() {
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
          <h1 className="text-4xl font-bold mb-8">Datenschutzerklärung</h1>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Datenschutz auf einen Blick</h2>
            <h3 className="text-xl font-semibold mb-3">Allgemeine Hinweise</h3>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout ist ein datenschutzfreundliches Projekt. Wir speichern keine personenbezogenen Daten und
              arbeiten ausschließlich mit anonymisierten Anfragen. Es werden keine Nutzerprofile erstellt, keine Cookies
              gesetzt und keine Tracking-Tools verwendet.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Datenerfassung auf dieser Website</h2>
            <h3 className="text-xl font-semibold mb-3">Welche Daten werden erfasst?</h3>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout erfasst <strong>keine personenbezogenen Daten</strong>. Ihre Suchanfragen und
              Interaktionen werden nicht gespeichert, nicht protokolliert und nicht mit Ihrer Person verknüpft.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Technisch notwendige Daten (z. B. IP-Adresse für die Verbindung) werden nur temporär verarbeitet und nicht
              dauerhaft gespeichert.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Nutzung von KI-Modellen</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ihre Anfragen werden an KI-Modelle (Large Language Models) weitergeleitet, um Antworten zu generieren.
              Diese Verarbeitung erfolgt <strong>anonymisiert</strong> und ohne Speicherung personenbezogener Daten.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Die verwendeten KI-Modelle haben keinen Zugriff auf Ihre Identität oder persönliche Informationen. Es
              werden ausschließlich die Textinhalte Ihrer Anfrage verarbeitet.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Hosting</h2>
            <p className="text-muted-foreground leading-relaxed">
              Diese Website wird auf Servern von [Hosting-Anbieter] gehostet. Der Hoster erhebt und speichert
              automatisch Informationen in sogenannten Server-Log-Dateien, die Ihr Browser automatisch übermittelt. Dies
              sind:
            </p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-4 space-y-2">
              <li>Browsertyp und Browserversion</li>
              <li>Verwendetes Betriebssystem</li>
              <li>Referrer URL</li>
              <li>Hostname des zugreifenden Rechners</li>
              <li>Uhrzeit der Serveranfrage</li>
              <li>IP-Adresse</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Diese Daten werden nicht mit anderen Datenquellen zusammengeführt und nach kurzer Zeit automatisch
              gelöscht.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Ihre Rechte</h2>
            <p className="text-muted-foreground leading-relaxed">
              Da wir keine personenbezogenen Daten speichern, gibt es keine Daten, die Sie einsehen, berichtigen oder
              löschen lassen könnten. Sie haben jedoch jederzeit das Recht auf Auskunft über die Verarbeitung Ihrer
              Daten.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Bei Fragen zum Datenschutz kontaktieren Sie uns unter:{" "}
              <a href="mailto:datenschutz@knowledgescout.org" className="underline">
                datenschutz@knowledgescout.org
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Datenminimierung</h2>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout folgt dem Prinzip der Datenminimierung gemäß Art. 5 DSGVO. Wir erheben nur die absolut
              notwendigen Daten für den Betrieb der Plattform und verzichten bewusst auf jegliche Form von Tracking,
              Analytics oder Profiling.
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


