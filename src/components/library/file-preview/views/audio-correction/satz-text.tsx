'use client'

/**
 * Satztext mit offenen Korrektur-Vorschlaegen als Revision im Text: der alte
 * Teil durchgestrichen, der neue hellblau dahinter (wie im Aenderungsmodus).
 * Rein darstellend; Uebernehmen/Verwerfen sitzt an der Randkarte.
 */

import * as React from 'react'
import type { KorrekturVorschlag } from '@/lib/transkript-korrektur/assistent-pruefung'

interface Stueck {
  text: string
  vorschlag: KorrekturVorschlag | null
}

/** Zerlegt den Satz an den (nicht ueberlappenden) ersten Vorkommen der Vorschlaege. */
export function zerlegeMitVorschlaegen(text: string, vorschlaege: readonly KorrekturVorschlag[]): Stueck[] {
  const treffer = vorschlaege
    .map((v) => ({ v, pos: text.indexOf(v.alt) }))
    .filter((t) => t.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
  const out: Stueck[] = []
  let cursor = 0
  for (const { v, pos } of treffer) {
    if (pos < cursor) continue // ueberlappt mit einem frueheren Vorschlag: nur an der Karte zeigen
    if (pos > cursor) out.push({ text: text.slice(cursor, pos), vorschlag: null })
    out.push({ text: v.alt, vorschlag: v })
    cursor = pos + v.alt.length
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), vorschlag: null })
  return out
}

export function SatzText({ text, vorschlaege }: { text: string; vorschlaege: readonly KorrekturVorschlag[] }) {
  if (vorschlaege.length === 0) return <span>{text}</span>
  return (
    <span>
      {zerlegeMitVorschlaegen(text, vorschlaege).map((s, i) =>
        s.vorschlag ? (
          <React.Fragment key={i}>
            <span className="text-muted-foreground line-through decoration-sky-500">{s.text}</span>
            <span className="rounded bg-sky-100 px-0.5 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">{s.vorschlag.neu}</span>
          </React.Fragment>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  )
}
