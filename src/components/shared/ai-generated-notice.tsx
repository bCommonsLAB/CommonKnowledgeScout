import { Info, Bot } from "lucide-react"
import Link from "next/link"

/**
 * Props für die KI-Info-Komponente
 */
interface AIGeneratedNoticeProps {
  /**
   * Optionale Liste von Quellen, die angezeigt werden sollen
   */
  sources?: Array<{ id: string; fileName?: string }>
  /**
   * Kompakte Variante für kleine Bereiche (ohne Quellenliste)
   */
  compact?: boolean
  /**
   * Zusätzliche CSS-Klassen
   */
  className?: string
}

/**
 * Zentrale Komponente zur Kennzeichnung von KI-generierten Inhalten
 * 
 * Erfüllt die Transparenzpflicht gemäß EU AI Act Art. 50-53.
 * Kann überall eingebaut werden, wo KI-generierte Inhalte angezeigt werden.
 */
export function AIGeneratedNotice({ sources, compact = false, className = "" }: AIGeneratedNoticeProps) {
  const hasSources = sources && sources.length > 0

  if (compact) {
    // Kompakte Variante ohne Quellenliste
    return (
      <div className={`mt-3 pt-3 border-t border-border/50 ${className}`}>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span>Dieser Inhalt wurde automatisch mit KI formuliert.</span>
            {hasSources && (
              <span className="ml-1">
                Basierend auf {sources.length} {sources.length === 1 ? "Quelle" : "Quellen"}.
              </span>
            )}
            {" "}
            <Link href="/rechtliche-hinweise" className="underline hover:text-foreground">
              Mehr erfahren
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Vollständige Variante mit Quellenliste
  return (
    <div className={`mt-4 pt-4 border-t border-border/50 ${className}`}>
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Bot className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
        <div className="flex-1 space-y-2">
          <div className="text-xs">
            <span>⚠️ Dieser Inhalt wurde mit KI formuliert.</span>
            {" "}
            <Link href="/rechtliche-hinweise" className="underline hover:text-foreground ml-1">
              Mehr zu KI-generierten Inhalten erfahren
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

