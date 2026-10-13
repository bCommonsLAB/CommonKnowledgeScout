/**
 * @fileoverview Slug je Library (Wunschliste 8, Plan Abschnitt 6, G1) — pur.
 *
 * @description
 * Eine Adresse auf Inhalt einer anderen Library nennt nie eine Id und nie
 * einen Hash, sondern den SLUG der Library: kurz, lesbar, eindeutig. Drei
 * Herkuenfte, in dieser Rangfolge:
 *
 * 1. `gesetzt` — `config.adresse.slug`, ausdruecklich vergeben
 *    (`adresse_setzen`, instanzweit eindeutig geprueft).
 * 2. `veroeffentlicht` — `config.publicPublishing.slugName` einer
 *    veroeffentlichten Library (bleibt, wie er ist).
 * 3. `abgeleitet` — aus dem Namen. NICHT stabil: aendert sich der Name,
 *    aendert sich der Slug, und Adressen in Dokumenten brechen. Die Herkunft
 *    wird deshalb immer genannt; wer stabile Adressen will, setzt den Slug.
 *
 * Kollisionen werden benannt, nicht aufgeloest: Gewinnt eine hoehere
 * Herkunft, bekommt die niedrigere `slug: null` und `konflikt`; bei
 * Gleichstand bekommen beide `konflikt` (kein stilles `-2`).
 * `frueher` sind alte Slugs (Merker beim Aendern); eine Adresse mit einem
 * fruehren Slug trifft weiter, die Antwort sagt es.
 *
 * @module library-adresse
 */

/** Kleinbuchstaben, Ziffern, Bindestrich; 1–64 Zeichen, kein Bindestrich am Rand. */
const SLUG_MUSTER = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

export type SlugHerkunft = 'gesetzt' | 'veroeffentlicht' | 'abgeleitet'

const RANG: Record<SlugHerkunft, number> = { gesetzt: 0, veroeffentlicht: 1, abgeleitet: 2 }

/** Was die Slug-Bestimmung von einer Library braucht (Ausschnitt von `Library`). */
export interface SlugQuelle {
  id: string
  label: string
  config?: {
    adresse?: { slug?: string; frueher?: string[] }
    publicPublishing?: { slugName?: string }
  }
}

export interface LibrarySlug {
  libraryId: string
  name: string
  /** null = kein gueltiger, eindeutiger Slug — Grund in `konflikt`. */
  slug: string | null
  herkunft: SlugHerkunft
  frueher: string[]
  konflikt: string | null
}

/** Prueft einen Slug und liefert ihn zurueck; wirft mit Grund. */
export function pruefeSlug(roh: string): string {
  const slug = roh.trim()
  if (!SLUG_MUSTER.test(slug)) {
    throw new Error(`Ungueltiger Slug "${roh}": nur a-z, 0-9 und Bindestrich, 1–64 Zeichen, kein Bindestrich am Rand`)
  }
  return slug
}

/** Leitet einen Slug aus einem Namen ab; '' = der Name ergibt keinen. */
export function leiteSlugAb(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

function kandidat(lib: SlugQuelle): LibrarySlug {
  const frueher = (lib.config?.adresse?.frueher ?? []).map((s) => s.trim()).filter(Boolean)
  const basis = { libraryId: lib.id, name: lib.label, frueher }
  const gesetzt = lib.config?.adresse?.slug?.trim()
  if (gesetzt) {
    return SLUG_MUSTER.test(gesetzt)
      ? { ...basis, slug: gesetzt, herkunft: 'gesetzt', konflikt: null }
      : { ...basis, slug: null, herkunft: 'gesetzt', konflikt: `gesetzter Slug "${gesetzt}" passt nicht in die Adressform` }
  }
  const veroeffentlicht = lib.config?.publicPublishing?.slugName?.trim()
  if (veroeffentlicht) {
    return SLUG_MUSTER.test(veroeffentlicht)
      ? { ...basis, slug: veroeffentlicht, herkunft: 'veroeffentlicht', konflikt: null }
      : { ...basis, slug: null, herkunft: 'veroeffentlicht', konflikt: `veroeffentlichter Slug "${veroeffentlicht}" passt nicht in die Adressform` }
  }
  const abgeleitet = leiteSlugAb(lib.label)
  return abgeleitet === ''
    ? { ...basis, slug: null, herkunft: 'abgeleitet', konflikt: `aus dem Namen "${lib.label}" laesst sich kein Slug ableiten` }
    : { ...basis, slug: abgeleitet, herkunft: 'abgeleitet', konflikt: null }
}

/** Slugs fuer eine Menge Libraries, Kollisionen benannt (siehe Datei-Kommentar). */
export function bestimmeSlugs(libraries: readonly SlugQuelle[]): LibrarySlug[] {
  const eintraege = libraries.map(kandidat)
  const jeSlug = new Map<string, LibrarySlug[]>()
  for (const eintrag of eintraege) {
    if (eintrag.slug === null) continue
    jeSlug.set(eintrag.slug, [...(jeSlug.get(eintrag.slug) ?? []), eintrag])
  }
  for (const [slug, gruppe] of jeSlug) {
    if (gruppe.length < 2) continue
    const besterRang = Math.min(...gruppe.map((e) => RANG[e.herkunft]))
    const beste = gruppe.filter((e) => RANG[e.herkunft] === besterRang)
    for (const eintrag of gruppe) {
      if (beste.length === 1 && eintrag === beste[0]) continue
      eintrag.konflikt = beste.length === 1
        ? `"${slug}" ist belegt von ${beste[0].name} (${beste[0].libraryId})`
        : `"${slug}" ist mehrdeutig: ${beste.map((e) => e.name).join(', ')} — einen Slug mit adresse_setzen vergeben`
      eintrag.slug = null
    }
  }
  return eintraege
}

/** Findet die Library zu einem Slug — aktuell vor frueher. */
export function findeLibraryZuSlug(
  slug: string,
  eintraege: readonly LibrarySlug[],
): { eintrag: LibrarySlug; ueberFrueher: boolean } | { grund: string } {
  const aktuell = eintraege.find((e) => e.slug === slug)
  if (aktuell) return { eintrag: aktuell, ueberFrueher: false }
  const frueher = eintraege.filter((e) => e.frueher.includes(slug))
  if (frueher.length === 1) return { eintrag: frueher[0], ueberFrueher: true }
  if (frueher.length > 1) return { grund: `"${slug}" war frueher mehreren Libraries zugeordnet: ${frueher.map((e) => e.name).join(', ')}` }
  const blockiert = eintraege.find((e) => e.slug === null && e.konflikt?.includes(`"${slug}"`))
  if (blockiert) return { grund: blockiert.konflikt as string }
  return { grund: `Keine Library mit dem Slug "${slug}" bekannt` }
}

/** Alle Slugs, unter denen eine Adresse trifft (aktuell + frueher). */
export function bekannteSlugs(eintraege: readonly LibrarySlug[]): Set<string> {
  const menge = new Set<string>()
  for (const e of eintraege) {
    if (e.slug !== null) menge.add(e.slug)
    for (const alt of e.frueher) menge.add(alt)
  }
  return menge
}
