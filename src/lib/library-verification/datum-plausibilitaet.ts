/**
 * @fileoverview Plausibilitaetspruefung fuer `date` (Wunschliste 4, W5/A6).
 *
 * @description
 * Der Check kostet nichts und faengt genau die Fehler, die ein Rueckfall auf
 * abgeleitete Quellen erzeugt. Belegt am 06.09.2026 an
 * `26.01 Klimamassnahmen Suedtirol/klimamassnahme-detail1-de.docx` und `.pdf`:
 * Dort ist das verifizierte `date` (2026-08-22) IDENTISCH mit dem
 * `generated_at` der Transformation — das Verarbeitungsdatum steht als
 * Inhaltsdatum, und zwar mit `verified_by: human`, also als Beleg
 * ausgewiesen. Wunschliste 3 nannte drei weitere Faelle, einen davon mit
 * einem Datum in der ZUKUNFT (2026-10-01).
 *
 * Zwei Regeln, beide ohne Kontext ausserhalb des Dokuments:
 *
 *  1. **Zukunft.** Ein Inhaltsdatum, das noch nicht stattgefunden hat, ist
 *     immer falsch — unabhaengig von der Herkunft.
 *  2. **Inhaltsdatum == Verarbeitungsdatum, OHNE Herkunftsmarke.** Ein Datum
 *     ohne `date_quelle` behauptet, aus dem INHALT zu stammen. Faellt es
 *     genau auf den Tag der Transformation, ist das die Signatur von „das
 *     Modell fand keines und nahm heute". Ist `date_quelle` gesetzt
 *     (`pfad`/`datei`), sagt das Feld selbst, woher es kommt — dann ist die
 *     Gleichheit Zufall und kein Befund.
 *
 * Die von der Wunschliste zusaetzlich erwaehnte Abweichung vom PFADDATUM
 * bleibt bewusst aussen vor: Das Pfaddatum ist die groebere Aussage (oft nur
 * monatsscharf), eine legitime inhaltliche Datierung darf davon abweichen,
 * und fuer eine Schwelle gibt es keine Messung. Ein Befund, der im Normalfall
 * feuert, erzieht dazu, Befunde zu ignorieren.
 *
 * Reine Funktionen, kein I/O.
 *
 * @module library-verification
 */

import type { DocumentIssue } from './types'

/**
 * Liest einen Datumswert als Kalendertag `JJJJ-MM-TT`.
 * `null` = kein lesbares Datum (das ist Sache der Facetten-Pruefung,
 * nicht dieser hier).
 */
export function alsKalendertag(wert: unknown): string | null {
  if (wert instanceof Date) {
    return Number.isNaN(wert.getTime()) ? null : wert.toISOString().slice(0, 10)
  }
  if (typeof wert !== 'string') return null
  const treffer = wert.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!treffer) return null
  const [, jahr, monat, tag] = treffer
  const geprueft = new Date(`${jahr}-${monat}-${tag}T00:00:00Z`)
  if (Number.isNaN(geprueft.getTime())) return null
  return geprueft.toISOString().slice(0, 10) === `${jahr}-${monat}-${tag}` ? `${jahr}-${monat}-${tag}` : null
}

/** Gilt ein Wert als gesetzt? (Wie `hasValue` in `document-check.ts`.) */
function gesetzt(wert: unknown): boolean {
  if (wert === undefined || wert === null) return false
  return !(typeof wert === 'string' && wert.trim() === '')
}

/**
 * Meldet unplausible `date`-Werte. `jetzt` ist die Gegenwart des Laufs —
 * uebergeben statt gelesen, damit die Regel testbar bleibt.
 */
export function pruefeDatumPlausibilitaet(
  docMetaJson: Record<string, unknown>,
  jetzt: Date
): DocumentIssue[] {
  const datum = alsKalendertag(docMetaJson.date)
  if (datum === null) return []

  const issues: DocumentIssue[] = []
  const heute = jetzt.toISOString().slice(0, 10)

  if (datum > heute) {
    issues.push({
      code: 'implausible-date',
      severity: 'warning',
      field: 'date',
      message: `Inhaltsdatum liegt in der Zukunft: ${datum}.`,
      autoFixable: false,
    })
  }

  const generiert = alsKalendertag(docMetaJson.generated_at)
  if (generiert !== null && generiert === datum && !gesetzt(docMetaJson.date_quelle)) {
    issues.push({
      code: 'implausible-date',
      severity: 'warning',
      field: 'date',
      message:
        `Inhaltsdatum (${datum}) ist der Tag der Verarbeitung und traegt keine Herkunftsmarke — ` +
        'vermutlich steht hier das Verarbeitungsdatum statt des Inhaltsdatums.',
      autoFixable: false,
    })
  }

  return issues
}
