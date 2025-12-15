import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Inhalte stammen aus offenen Quellen und öffentlichen Archiven. Antworten werden mithilfe transparenter
            KI-Modelle formuliert.{" "}
            <Link href="/rechtliche-hinweise" className="underline hover:text-foreground transition-colors">
              Mehr erfahren →
            </Link>
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Ein Experiment von <span className="font-medium text-foreground">Crystal Design</span> &{" "}
            <span className="font-medium text-foreground">bcommonsLAB</span>
          </p>
          <p className="text-sm text-muted-foreground">
            – in Zusammenarbeit mit offenen Communities und Forschungspartner:innen.
          </p>

          <div className="flex justify-center gap-6 pt-4 text-xs text-muted-foreground">
            <Link href="/ueber" className="hover:text-foreground transition-colors">
              Über das Projekt
            </Link>
            <Link href="/rechtliche-hinweise" className="hover:text-foreground transition-colors">
              Rechtliche Hinweise
            </Link>
            <Link href="/impressum" className="hover:text-foreground transition-colors">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground transition-colors">
              Datenschutz
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
