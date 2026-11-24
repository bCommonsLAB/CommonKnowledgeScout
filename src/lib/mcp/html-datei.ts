/**
 * @fileoverview HTML einer Seite aus einer Datei im Speicher der Library lesen.
 *
 * @description
 * Befund der Abnahme: Eine Dokumentseite hatte roh 272.181 Zeichen. Als Parameter
 * `html` muss das durch den Kontext des Agenten; uebergeben wurde deshalb ein von
 * Hand entschlacktes HTML. Mit `htmlDatei` legt der Rechner mit Browser die
 * gespeicherte Seite in den (synchronisierten) Ordner der Library, und die Bruecke
 * liest sie dort — das HTML laeuft nicht durch den Kontext.
 *
 * @module mcp
 */

import type { StorageProvider } from '@/lib/storage/types'
import { MAX_HTML_ZEICHEN } from '@/lib/web-source/seite-lesen'
import { resolveItemByPath } from './resolve-folder'

/** Liest die Datei als Text; wirft, wenn sie fehlt, kein HTML ist oder die Grenze sprengt. */
export async function leseHtmlDatei(provider: StorageProvider, pfad: string): Promise<string> {
  if (!/\.(html?|xhtml)$/i.test(pfad)) throw new Error(`htmlDatei "${pfad}" endet nicht auf .html/.htm`)
  const item = await resolveItemByPath(provider, pfad, 'file')
  const { blob } = await provider.getBinary(item.id)
  const html = await blob.text()
  if (html.trim() === '') throw new Error(`htmlDatei "${pfad}" ist leer`)
  if (html.length > MAX_HTML_ZEICHEN) throw new Error(`htmlDatei "${pfad}" ist ${html.length} Zeichen lang (Grenze ${MAX_HTML_ZEICHEN})`)
  return html
}
