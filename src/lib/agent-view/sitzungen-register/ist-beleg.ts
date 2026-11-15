/**
 * @fileoverview Ist eines Belegs aus Twin-Daten lesen (Register, Welle R1). Reine Funktionen.
 *
 * @description
 * Der Beleg-Kopf (`session_id`, `werkzeug`, `zuege_von_bis`, `datum`, `ende`,
 * `titel`) steht im Merker `sourceFrontmatter` am Twin (S1b); die Notiz traegt
 * `sitzung`, `werkzeug`, `title`, `date`. W9: Die Kennung kommt aus dem
 * Beleg-Kopf, `sitzung` der Notiz nur ersatzweise; weichen beide ab, sagt es
 * ein Hinweis.
 *
 * @module agent-view/sitzungen-register
 */

import { asString } from '@/lib/agent-view/sichten/bericht-lesen'
import { belegNameLesen, belegOhneEndung } from '@/lib/agent-view/sichten/sitzungen-types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { BELEG_PRAEFIX, type IstBeleg, type SitzungsQuelle, type Zugbereich } from './types'

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/
const ZUEGE = /^\s*(\d+)\s*-\s*(\d+)\s*$/

function isoTag(wert: unknown): string | null {
  const s = asString(wert)
  return s !== null && ISO_TAG.test(s) ? s : null
}

/** `zuege_von_bis: 1-10` → `{ von: 1, bis: 10 }`; unlesbar oder verdreht → null. */
export function zuegeLesen(wert: unknown): Zugbereich | null {
  const m = asString(wert)?.match(ZUEGE)
  if (!m) return null
  const von = Number(m[1])
  const bis = Number(m[2])
  return von >= 1 && bis >= von ? { von, bis } : null
}

export function zuegeText(z: Zugbereich | null): string | null {
  return z === null ? null : `${z.von}-${z.bis}`
}

/** Die Kennung, unter der ein Beleg ins Register gehoert (Kopf vor Notiz). */
export function belegKennung(b: Pick<IstBeleg, 'kopfKennung' | 'notizKennung'>): string | null {
  return b.kopfKennung ?? b.notizKennung
}

/**
 * Volle Kennung oder nur ein Kuerzel? UUIDs (36 Zeichen) und `session_…`
 * (Code in der Cloud) sind lang; Alt-Notizen tragen in `sitzung` mitunter nur
 * die ersten Zeichen. Unter 20 Zeichen gilt eine Kennung als Praefix.
 */
export const MIN_VOLLE_KENNUNG = 20

export function istVolleKennung(kennung: string): boolean {
  return kennung.length >= MIN_VOLLE_KENNUNG && !/\s/.test(kennung)
}

/** Register-Schluessel fuer einen Beleg ohne Zeile: volle Kennung, sonst `beleg:<sourceId>`. */
export function registerIdFuerBeleg(b: IstBeleg): string {
  const kennung = belegKennung(b)
  return kennung !== null && istVolleKennung(kennung) ? kennung : `${BELEG_PRAEFIX}${b.sourceId}`
}

/** Beleg aus einer Notiz-Transformation samt gemerktem Kopf. */
export function istAusTransformation(zeile: TransformationZeile): IstBeleg {
  const kopf = zeile.sourceFrontmatter?.fields ?? {}
  const notiz = zeile.frontmatter ?? {}
  const name = belegNameLesen(zeile.sourceName)
  return {
    sourceId: zeile.sourceId,
    name: zeile.sourceName,
    parentId: zeile.parentId,
    kopfKennung: asString(kopf.session_id),
    notizKennung: asString(notiz.sitzung),
    werkzeug: asString(kopf.werkzeug) ?? asString(notiz.werkzeug),
    repo: asString(kopf.repo),
    branch: asString(kopf.branch),
    zuege: zuegeLesen(kopf.zuege_von_bis),
    titel: asString(kopf.titel) ?? asString(notiz.title) ?? name?.titel ?? belegOhneEndung(zeile.sourceName),
    datum: name?.datum ?? isoTag(kopf.datum) ?? isoTag(notiz.date),
    ende: isoTag(kopf.ende) ?? isoTag(notiz.ende),
    hatNotiz: true,
    notizAktualisiert: zeile.updatedAt,
  }
}

/** Beleg ohne Notiz, nur aus dem Speicher bekannt (`belegSourceIds`). */
export function istOhneNotiz(item: { id: string; parentId: string; name: string }): IstBeleg {
  const name = belegNameLesen(item.name)
  return {
    sourceId: item.id, name: item.name, parentId: item.parentId,
    kopfKennung: null, notizKennung: null, werkzeug: null, repo: null, branch: null, zuege: null,
    titel: name?.titel ?? belegOhneEndung(item.name), datum: name?.datum ?? null, ende: null,
    hatNotiz: false, notizAktualisiert: null,
  }
}

/**
 * Quelle aus `werkzeug` (Beleg-Kopf: code|cowork|chat; Notiz: claude-…).
 * Code in der Cloud traegt Kennungen `session_…`, lokal eine UUID. Unbekannte
 * Werte → null; der Aufrufer weist das als Hinweis aus.
 */
export function quelleAusWerkzeug(werkzeug: string | null, kennung: string | null): SitzungsQuelle | null {
  switch (werkzeug) {
    case 'code':
    case 'claude-code':
      return kennung !== null && kennung.startsWith('session_') ? 'code_cloud' : 'code_lokal'
    case 'cowork':
    case 'claude-cowork':
      return 'cowork'
    case 'chat':
    case 'claude-chat':
      return 'chat'
    default:
      return null
  }
}
