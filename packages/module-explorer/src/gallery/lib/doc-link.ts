/**
 * @fileoverview `?doc=<slug>`-Links im Inhalt erkennen.
 *
 * @description
 * Die Vorlagen der AECED-Karten und -Methoden schreiben Querverweise als
 * Markdown-Links `[Name](?doc=<slug>)` — „Anschlusskarten", „passende
 * Karten". In der Voll-App traegt die Adresszeile den Parameter, ein Klick
 * laedt die Galerie mit `?doc=` neu. Im Embed gibt es keine Adresszeile: Die
 * Galerie fuehrt `doc` im Speicher (`SpeicherGalleryNavigation`), und ein
 * solcher Link wuerde die fremde Seite mit einem Parameter neu laden, den
 * niemand liest. Der Klick muss deshalb in der Galerie bleiben.
 *
 * Erkannt wird bewusst nur die Form, die die Vorlagen erzeugen: ein Link, der
 * mit `?` beginnt und `doc` traegt. Pfade und fremde Adressen gehoeren dem
 * Browser — auch ein Link auf die Instanz selbst.
 *
 * @module lib
 */

/** Nur zum Zerlegen des Links; die Herkunft spielt keine Rolle. */
const BASIS = 'http://ks-doc-link.invalid/'

/**
 * Der Slug aus einem `?doc=<slug>`-Link — oder `null`, wenn der Link nicht
 * diese Form hat (anderer Pfad, fremde Adresse, kein oder leerer `doc`).
 */
export function docSlugAusHref(href: string | null | undefined): string | null {
  if (!href) return null
  const roh = href.trim()
  if (!roh.startsWith('?')) return null
  let url: URL
  try {
    url = new URL(roh, BASIS)
  } catch {
    return null
  }
  const slug = url.searchParams.get('doc')?.trim() ?? ''
  return slug.length > 0 ? slug : null
}
