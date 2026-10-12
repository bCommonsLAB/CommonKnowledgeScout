/**
 * @fileoverview Lesersicht eines Meta-Dokuments (Welle K1).
 *
 * @description
 * Welle J brauchte drei Nachzuege, und jeder Befund kam aus dem Live-Prueffall:
 * Das Ergebnis lebt im Meta-Dokument und in der Galerie-Karte, kein
 * Brueckenwerkzeug zeigte eines von beiden. Der Pruefer sah Twin-Frontmatter
 * (`coverImageUrl: ""`) und Job-Zaehler (`aufgeloest: 58`) und meldete „OK",
 * der Owner sah in der Galerie kein Cover.
 *
 * Diese Datei rechnet aus dem Meta-Dokument (`doc_meta__<libraryId>`, `kind:
 * 'meta'`) genau die Felder, die die Karte und der Session-Detail zeigen:
 * Cover, Anhaenge als Paare, Folien mit/ohne Adresse, Galeriebilder. Reine
 * Funktionen ohne Datenbank — `dokument_lesen` und `dokumente_auflisten`
 * (`lesersicht: true`) rufen sie. Formen, die nicht passen (z. B. `slides` als
 * JSON-Text statt Liste), werden GENANNT, nicht still als leer gezaehlt.
 *
 * @module mcp
 */

import type { StorageConfig } from '@/types/library'

/** Nur die Veroeffentlichung der Library-Konfiguration — mehr braucht die Adresse nicht. */
export type VeroeffentlichungsSicht = Pick<StorageConfig, 'publicPublishing'> | undefined

export interface Anhang { name: string | null; url: string }

export interface Folien {
  anzahl: number
  mitAdresse: number
  /** Seitenzahlen der Folien ohne http(s)-Adresse; ohne `page_num` steht die Position (1-basiert). */
  ohneAdresse: number[]
}

/** Was die Galerie-Karte und der Session-Detail aus dem Meta-Dokument zeigen. */
export interface Lesersicht {
  titel: string | null
  detailViewType: string | null
  publikation: string | null
  coverImageUrl: string | null
  coverThumbnailUrl: string | null
  anhaenge: Anhang[]
  /** null, wenn `slides` nicht als Liste vorliegt — der Grund steht in `hinweise`. */
  folien: Folien | null
  galerieBilder: number
  upsertedAt: string | null
  /** Formen, die die Lesersicht nicht deuten konnte — nie still. */
  hinweise: string[]
}

function alsObjekt(wert: unknown): Record<string, unknown> {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : {}
}

function alsText(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() !== '' ? wert : null
}

export function istAdresse(wert: unknown): wert is string {
  return typeof wert === 'string' && /^https?:\/\//i.test(wert.trim())
}

/** `attachments_url` und `attachments_names` als Paare; eine String-Adresse zaehlt als eine. */
export function anhaengeAusMeta(meta: Record<string, unknown>): Anhang[] {
  const roh = meta['attachments_url']
  const urls = Array.isArray(roh) ? roh.filter((u): u is string => typeof u === 'string' && u.trim() !== '')
    : alsText(roh) ? [roh as string] : []
  const namenRoh = meta['attachments_names']
  const namen = Array.isArray(namenRoh) ? namenRoh : []
  return urls.map((url, i) => ({ name: alsText(namen[i]), url }))
}

/** Folien-Bilanz aus `slides`; kein Array → null plus Grund. */
export function folienAusMeta(meta: Record<string, unknown>): { folien: Folien | null; hinweis: string | null } {
  const roh = meta['slides']
  if (roh === undefined || roh === null) return { folien: { anzahl: 0, mitAdresse: 0, ohneAdresse: [] }, hinweis: null }
  if (!Array.isArray(roh)) {
    return { folien: null, hinweis: `slides liegt im Meta-Dokument nicht als Liste vor (${typeof roh}) — der Ingest hat die Folien nicht als Liste gelesen` }
  }
  const ohneAdresse: number[] = []
  let mitAdresse = 0
  roh.forEach((slide, i) => {
    const s = alsObjekt(slide)
    if (istAdresse(s['image_url'])) { mitAdresse += 1; return }
    const seite = s['page_num']
    ohneAdresse.push(typeof seite === 'number' && Number.isFinite(seite) ? seite : i + 1)
  })
  return { folien: { anzahl: roh.length, mitAdresse, ohneAdresse }, hinweis: null }
}

/** Lesersicht aus dem rohen Meta-Dokument (so wie `getMetaByFileId` es liefert). */
export function lesersichtAusMeta(doc: Record<string, unknown>): Lesersicht {
  const meta = alsObjekt(doc['docMetaJson'])
  const publication = alsObjekt(doc['publication'])
  const hinweise: string[] = []
  const { folien, hinweis } = folienAusMeta(meta)
  if (hinweis) hinweise.push(hinweis)
  const galerieRoh = meta['galleryImageUrls']
  if (galerieRoh !== undefined && galerieRoh !== null && !Array.isArray(galerieRoh)) {
    hinweise.push(`galleryImageUrls liegt nicht als Liste vor (${typeof galerieRoh})`)
  }
  return {
    titel: alsText(doc['title']) ?? alsText(meta['title']),
    detailViewType: alsText(doc['detailViewType']) ?? alsText(meta['detailViewType']),
    publikation: alsText(publication['status']),
    coverImageUrl: alsText(meta['coverImageUrl']) ?? alsText(doc['coverImageUrl']),
    coverThumbnailUrl: alsText(meta['coverThumbnailUrl']) ?? alsText(doc['coverThumbnailUrl']),
    anhaenge: anhaengeAusMeta(meta),
    folien,
    galerieBilder: Array.isArray(galerieRoh) ? galerieRoh.length : 0,
    upsertedAt: alsText(doc['upsertedAt']),
    hinweise,
  }
}

/** Kurzform je Zeile fuer `dokumente_auflisten` mit `lesersicht: true`. */
export function lesersichtKurz(meta: Record<string, unknown>): {
  cover: boolean
  anhaenge: number
  folienMitAdresse: number | null
  folienAnzahl: number | null
} {
  const { folien } = folienAusMeta(meta)
  return {
    cover: alsText(meta['coverImageUrl']) !== null,
    anhaenge: anhaengeAusMeta(meta).length,
    folienMitAdresse: folien ? folien.mitAdresse : null,
    folienAnzahl: folien ? folien.anzahl : null,
  }
}

/**
 * Oeffentliche Galerie-Adresse des Dokuments (`/explore/<slug>?doc=<docSlug>`)
 * oder null MIT Grund — eine private Library hat keine Adresse, und das soll
 * der Aufrufer lesen, statt es aus einem leeren Feld zu raten.
 */
export function galerieAdresse(
  config: VeroeffentlichungsSicht,
  doc: Record<string, unknown>,
): { galerieAdresse: string | null; galerieAdresseGrund: string | null } {
  const pub = config?.publicPublishing
  const slug = alsText(pub?.slugName)
  const docSlug = alsText(doc['slug']) ?? alsText(alsObjekt(doc['docMetaJson'])['slug'])
  if (!pub || !slug) return { galerieAdresse: null, galerieAdresseGrund: 'Library hat keinen oeffentlichen Slug (publicPublishing.slugName)' }
  if (!pub.isPublic) return { galerieAdresse: null, galerieAdresseGrund: 'Library ist nicht oeffentlich (isPublic: false) — nur angemeldet in der Galerie sichtbar' }
  if (!docSlug) return { galerieAdresse: null, galerieAdresseGrund: 'Meta-Dokument ohne slug — Eintrag ist nicht per ?doc= adressierbar' }
  return { galerieAdresse: `/explore/${slug}?doc=${encodeURIComponent(docSlug)}`, galerieAdresseGrund: null }
}
