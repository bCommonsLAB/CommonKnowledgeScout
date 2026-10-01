'use client'

/**
 * Verarbeitungsschritte in einfachen Worten (D2).
 *
 * Der Chat-Server meldet technische Schritte (Cache, Retriever, Chunks,
 * Token). Im Story-Modus sieht die Person stattdessen, was gerade passiert:
 * „Ich lese die passenden Dokumente", „Ich formuliere die Antwort". Die
 * Uebersetzung der Schritte in Zeilen ist eine reine Funktion
 * (`verarbeitungInWorten`), die Komponente zeigt die Zeilen nur an.
 *
 * Jeder Fall der Schritt-Union ist hier ausdrücklich behandelt; was keine
 * Zeile ergibt (`retriever_selected`, `complete`), steht als Kommentar.
 */

import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { ChatProcessingStep } from '@ks/contracts'
import { useTranslation } from '@ks/i18n/react'

export interface VerarbeitungZeile {
  text: string
  zustand: 'laeuft' | 'fertig' | 'fehler'
}

type Uebersetzer = (key: string, params?: Record<string, string | number>) => string

/** Wie die Antwort gesucht wird — alle drei Empfehlungen des Servers, keine Luecke. */
const LESEWEG: Record<'chunk' | 'summary' | 'unclear', string> = {
  chunk: 'processing.plain.readPassages',
  summary: 'processing.plain.readSummaries',
  unclear: 'processing.plain.readBoth',
}

function dokumente(t: Uebersetzer, anzahl: number): string {
  return anzahl === 1 ? t('processing.plain.documentsOne') : t('processing.plain.documentsMany', { count: anzahl })
}

function fundstellen(t: Uebersetzer, schritt: Extract<ChatProcessingStep, { type: 'retrieval_complete' }>): string {
  const count = schritt.sourcesCount
  const files = schritt.uniqueFileIdsCount
  if (files !== undefined && files > 0) {
    const documents = dokumente(t, files)
    return count === 1
      ? t('processing.plain.passagesOneIn', { documents })
      : t('processing.plain.passagesManyIn', { count, documents })
  }
  return count === 1 ? t('processing.plain.passagesOne') : t('processing.plain.passagesMany', { count })
}

/** Uebersetzt die Server-Schritte in Zeilen fuer Nicht-Fachleute. */
export function verarbeitungInWorten(schritte: ChatProcessingStep[], t: Uebersetzer): VerarbeitungZeile[] {
  const finde = <K extends ChatProcessingStep['type']>(type: K) =>
    schritte.find((s): s is Extract<ChatProcessingStep, { type: K }> => s.type === type)
  const zeilen: VerarbeitungZeile[] = []

  // 1. Erinnern: gab es die Antwort schon?
  const cacheStart = finde('cache_check')
  const cacheErgebnis = finde('cache_check_complete')
  if (cacheStart || cacheErgebnis) {
    zeilen.push(
      cacheErgebnis
        ? { text: t(cacheErgebnis.found ? 'processing.plain.foundEarlier' : 'processing.plain.notFoundYet'), zustand: 'fertig' }
        : { text: t('processing.plain.lookingUp'), zustand: 'laeuft' },
    )
  }

  // 2. Verstehen: wie wird gesucht? (`retriever_selected` wiederholt nur die Empfehlung.)
  const analyseStart = finde('question_analysis_start')
  const analyseErgebnis = finde('question_analysis_result')
  if (analyseStart || analyseErgebnis) {
    zeilen.push(
      analyseErgebnis
        ? { text: t(LESEWEG[analyseErgebnis.recommendation]), zustand: 'fertig' }
        : { text: t('processing.plain.thinking'), zustand: 'laeuft' },
    )
  }

  // 3. Lesen
  const lesenFertig = finde('retrieval_complete')
  if (finde('retrieval_start') || finde('retrieval_progress') || lesenFertig) {
    zeilen.push(
      lesenFertig
        ? { text: fundstellen(t, lesenFertig), zustand: 'fertig' }
        : { text: t('processing.plain.reading'), zustand: 'laeuft' },
    )
  }

  // 4. Zusammenstellen
  const promptFertig = finde('prompt_complete')
  if (finde('prompt_building') || promptFertig) {
    zeilen.push(
      promptFertig
        ? {
            text:
              promptFertig.documentsUsed === 1
                ? t('processing.plain.composedOne')
                : t('processing.plain.composedMany', { count: promptFertig.documentsUsed }),
            zustand: 'fertig',
          }
        : { text: t('processing.plain.composing'), zustand: 'laeuft' },
    )
  }

  // 5. Formulieren
  const llmFertig = finde('llm_complete')
  if (finde('llm_start') || finde('llm_progress') || llmFertig) {
    zeilen.push(
      llmFertig
        ? { text: t('processing.plain.written'), zustand: 'fertig' }
        : { text: t('processing.plain.writing'), zustand: 'laeuft' },
    )
  }

  // 6. Aufbereiten — `complete` traegt die Antwort selbst, hier zaehlt nur „fertig".
  const fertig = finde('complete')
  if (finde('parsing_response') || fertig) {
    zeilen.push(
      fertig ? { text: t('processing.plain.done'), zustand: 'fertig' } : { text: t('processing.plain.finishing'), zustand: 'laeuft' },
    )
  }

  const fehler = finde('error')
  if (fehler) zeilen.push({ text: t('processing.plain.failed', { error: fehler.error }), zustand: 'fehler' })

  return zeilen
}

const SYMBOL: Record<VerarbeitungZeile['zustand'], React.ReactNode> = {
  laeuft: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
  fertig: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  fehler: <XCircle className="h-3 w-3 text-red-500" />,
}

export interface VerarbeitungEinfachProps {
  schritte: ChatProcessingStep[]
}

export function VerarbeitungEinfach({ schritte }: VerarbeitungEinfachProps) {
  const { t } = useTranslation()
  const zeilen = verarbeitungInWorten(schritte, t)
  if (zeilen.length === 0) return null
  return (
    <ul className="space-y-1.5" aria-live="polite">
      {zeilen.map((zeile, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="mt-0.5 shrink-0">{SYMBOL[zeile.zustand]}</span>
          <span className={zeile.zustand === 'fehler' ? 'text-destructive' : 'text-muted-foreground'}>{zeile.text}</span>
        </li>
      ))}
    </ul>
  )
}
