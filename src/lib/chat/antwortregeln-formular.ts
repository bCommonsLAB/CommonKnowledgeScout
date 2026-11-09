/**
 * Benannte Regelsätze im Settings-Formular (Owner 09.11.2026).
 *
 * Das Formular führt die Regelsätze als Liste `{ name, text }` (react-hook-form
 * kann Listen, keine Records); gespeichert wird `Record<name, text>` wie im
 * Server-Schema (`config.ts`). Die Prüfung ist dieselbe wie auf dem Server
 * (`pruefeAntwortregelnZuFacetten`), nur die Fehlerpfade zeigen auf die
 * Listenfelder, damit sie unter dem richtigen Eingabefeld stehen.
 */

import * as z from 'zod'
import { pruefeAntwortregeln, REGELSATZ_NAME_RE, type RegelFacette } from './antwortregeln'

export interface RegelsatzEintrag {
  name: string
  text: string
}

/** Liste des Formulars → Record fürs Speichern (Namen getrimmt). */
export function variantenAlsRecord(eintraege: ReadonlyArray<RegelsatzEintrag>): Record<string, string> {
  return Object.fromEntries(eintraege.map((e) => [e.name.trim(), e.text]))
}

/**
 * Zod-Refinement des Chat-Formulars: `antwortregeln` wie bisher, dazu je
 * Regelsatz Name (Form, doppelt) und Platzhalter. Pfade zeigen auf
 * `antwortregelnVarianten.<i>.name` bzw. `.text`.
 */
export function pruefeAntwortregelnFormular(
  cfg: { antwortregeln?: string; antwortregelnVarianten?: RegelsatzEintrag[]; gallery?: { facets?: RegelFacette[] } },
  ctx: z.RefinementCtx,
): void {
  const facets = cfg.gallery?.facets ?? []
  for (const f of pruefeAntwortregeln(cfg.antwortregeln, facets)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antwortregeln'], message: `${f.platzhalter}: ${f.grund}` })
  }
  const gesehen = new Set<string>()
  ;(cfg.antwortregelnVarianten ?? []).forEach((e, i) => {
    const name = e.name.trim()
    if (!REGELSATZ_NAME_RE.test(name)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antwortregelnVarianten', i, 'name'], message: 'Name: klein, a-z, 0-9, - und _' })
    } else if (gesehen.has(name)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antwortregelnVarianten', i, 'name'], message: `Regelsatz „${name}" gibt es schon` })
    }
    gesehen.add(name)
    if (!e.text.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antwortregelnVarianten', i, 'text'], message: 'Regelsatz ohne Text — Eintrag entfernen oder füllen' })
    }
    for (const f of pruefeAntwortregeln(e.text, facets)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['antwortregelnVarianten', i, 'text'], message: `${f.platzhalter}: ${f.grund}` })
    }
  })
}
