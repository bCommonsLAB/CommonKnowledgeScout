'use client'

import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "@/lib/i18n/hooks"

function UeberPageContent() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.backToHome')}
          </Button>
        </Link>

        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold mb-8">Über Knowledge Scout</h1>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Ein gemeinsames Adventure-Projekt</h2>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout ist kein fertiges Produkt – es ist ein <strong>digitales Labor</strong>, das experimentell
              erforscht, wie KI als Werkzeug für kollektives Lernen eingesetzt werden kann.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Das Projekt ist explorativ und nicht kommerziell. Ergebnisse und Texte sind Zwischenschritte im Prozess –
              keine amtlichen oder wissenschaftlich geprüften Aussagen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Die Idee: Befrage nicht die KI, befrage kollektives Wissen</h2>
            <p className="text-muted-foreground leading-relaxed">
              Statt generische KI-Antworten zu liefern, macht Knowledge Scout{" "}
              <strong>kuratiertes, kollektives Wissen</strong> zugänglich. Jede Antwort basiert auf echten Vorträgen,
              Publikationen und Dokumenten – mit transparenten Quellenangaben.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Die KI dient als Vermittler, nicht als Erfinder. Sie formuliert Antworten basierend auf vorhandenen
              Inhalten, erfindet aber nichts hinzu.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Wie es funktioniert</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">1. Wissensbibliotheken erkunden</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Wähle eine Wissensbibliothek (z. B. SFSCon Talks, Biodiversität Südtirol) und verschaffe dir einen
                  Überblick über die verfügbaren Inhalte.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">2. Themen filtern</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Filtere nach Jahren, Themen oder Tracks, um die Inhalte einzugrenzen, die dich interessieren.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">3. Story-Modus aktivieren</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Wechsle in den Story-Modus und erhalte eine automatisch generierte Themenübersicht. Stelle Fragen oder
                  folge den vorgeschlagenen Folgefragen, um tiefer in die Inhalte einzutauchen.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Wer steckt dahinter?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Knowledge Scout ist ein Experiment von <strong>Crystal Design</strong> und <strong>bcommonsLAB</strong> –
              in Zusammenarbeit mit offenen Communities und Forschungspartner:innen.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Das Projekt wird kontinuierlich weiterentwickelt und lebt von Feedback und Beteiligung. Wenn du Ideen,
              Fragen oder Anregungen hast, melde dich gerne unter{" "}
              <a href="mailto:kontakt@knowledgescout.org" className="underline">
                kontakt@knowledgescout.org
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Transparenz & Vertrauen</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wir legen großen Wert auf Transparenz. Alle verwendeten Quellen sind nachvollziehbar, alle KI-generierten
              Inhalte sind als solche gekennzeichnet, und wir speichern keine personenbezogenen Daten.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Mehr dazu in unseren{" "}
              <Link href="/rechtliche-hinweise" className="underline">
                rechtlichen Hinweisen
              </Link>{" "}
              und der{" "}
              <Link href="/datenschutz" className="underline">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </section>

          <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Mitmachen & Testen</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Knowledge Scout ist ein offenes Labor. Wenn du Interesse hast, am Projekt mitzuforschen, neue
              Wissensbibliotheken vorzuschlagen oder Feedback zu geben, freuen wir uns über deine Nachricht.
            </p>
            <Button asChild>
              <a href="mailto:kontakt@knowledgescout.org">{t('home.cta.buttonContact')}</a>
            </Button>
          </div>
        </article>
      </div>
    </div>
  )
}

export default function UeberPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <UeberPageContent />
    </Suspense>
  )
}



