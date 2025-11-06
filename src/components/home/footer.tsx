import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        {/* Transparenz-Hinweis gemäß EU AI Act */}
        <div className="mb-8 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            Inhalte stammen aus offenen Quellen und öffentlichen Archiven.{" "}
            Antworten werden mithilfe transparenter KI-Modelle formuliert.{" "}
            <Link href="/rechtliche-hinweise" className="underline hover:text-foreground">
              Mehr erfahren →
            </Link>
          </p>
        </div>

        {/* Links zu rechtlichen Seiten */}
        <div className="mb-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link href="/datenschutz" className="text-muted-foreground hover:text-foreground underline">
            Datenschutz
          </Link>
          <Link href="/impressum" className="text-muted-foreground hover:text-foreground underline">
            Impressum
          </Link>
          <Link href="/rechtliche-hinweise" className="text-muted-foreground hover:text-foreground underline">
            Rechtliche Hinweise
          </Link>
          <Link href="/ueber" className="text-muted-foreground hover:text-foreground underline">
            Über das Projekt
          </Link>
        </div>

        {/* Projekt-Info */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ein Experiment von <span className="font-medium text-foreground">Crystal Design</span> &{" "}
            <span className="font-medium text-foreground">bcommonsLAB</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            – in Zusammenarbeit mit offenen Communities und Forschungspartner:innen.
          </p>
        </div>
      </div>
    </footer>
  )
}






