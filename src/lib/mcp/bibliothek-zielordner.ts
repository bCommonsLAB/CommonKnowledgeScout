/**
 * @fileoverview Verzeichnis einer Library auf ihrer Speicher-Verbindung: anlegen
 * und, wenn es fehlt, den Grund richtig benennen.
 *
 * @description
 * Befund: `bibliothek_anlegen` trug ein Verzeichnis ein, das es auf dem Speicher
 * noch nicht gab. `speicher_pruefen` meldete danach einen 404 und riet, die
 * Adresse der Verbindung zu pruefen — obwohl nur der Ordner fehlte. Der Umweg
 * war: Library auf die Wurzel stellen, Ordner anlegen, zurueckstellen.
 *
 * Hier wird das Verzeichnis ueber einen Provider an der Wurzel der Verbindung
 * angelegt (`getServerProviderAnVerbindungsWurzel`). Scheitert das, bleibt die
 * Library bestehen und das Ergebnis nennt den Grund — kein stilles Weitergehen.
 *
 * @module mcp
 */

import { getServerProviderAnVerbindungsWurzel } from '@/lib/storage/server-provider-wurzel'
import type { StorageProvider } from '@/lib/storage/types'

export type ZielordnerStand =
  | { status: 'angelegt'; verzeichnis: string; angelegt: string[] }
  | { status: 'vorhanden'; verzeichnis: string }
  | { status: 'nicht_geprueft'; grund: string }
  | { status: 'fehler'; verzeichnis: string; grund: string }

function segmente(verzeichnis: string | undefined): string[] {
  return (verzeichnis ?? '').replace(/\\/g, '/').split('/').map((s) => s.trim()).filter(Boolean)
}

/** Geht den Pfad ab der Wurzel des Providers und legt fehlende Ordner an. Nennt, was angelegt wurde. */
export async function legeVerzeichnisAn(provider: StorageProvider, verzeichnis: string): Promise<{ angelegt: string[] }> {
  let aktuell = 'root'
  const gegangen: string[] = []
  const angelegt: string[] = []
  for (const segment of segmente(verzeichnis)) {
    const kinder = await provider.listItemsById(aktuell)
    const treffer = kinder.find((k) => k.type === 'folder' && k.metadata.name === segment)
    gegangen.push(segment)
    if (treffer) {
      aktuell = treffer.id
    } else {
      aktuell = (await provider.createFolder(aktuell, segment)).id
      angelegt.push(gegangen.join('/'))
    }
  }
  return { angelegt }
}

/** Prueft, ob der Pfad ab der Wurzel des Providers existiert; nennt das erste fehlende Segment. */
export async function findeFehlendesSegment(provider: StorageProvider, verzeichnis: string): Promise<string | null> {
  let aktuell = 'root'
  const gegangen: string[] = []
  for (const segment of segmente(verzeichnis)) {
    const treffer = (await provider.listItemsById(aktuell)).find((k) => k.type === 'folder' && k.metadata.name === segment)
    gegangen.push(segment)
    if (!treffer) return gegangen.join('/')
    aktuell = treffer.id
  }
  return null
}

/** Legt das Verzeichnis einer neuen Library an. `hatVerbindung: false` = nichts zu tun, mit Grund. */
export async function stelleZielordnerSicher(args: {
  userEmail: string
  libraryId: string
  verzeichnis: string | undefined
  hatVerbindung: boolean
  wurzelProvider?: (userEmail: string, libraryId: string) => Promise<StorageProvider>
}): Promise<ZielordnerStand> {
  if (!args.hatVerbindung) return { status: 'nicht_geprueft', grund: 'Die Library liegt (noch) auf keiner Speicher-Verbindung — das Verzeichnis wird dort nicht angelegt' }
  const verzeichnis = segmente(args.verzeichnis).join('/')
  if (!verzeichnis) return { status: 'vorhanden', verzeichnis: '/' }
  try {
    const provider = await (args.wurzelProvider ?? getServerProviderAnVerbindungsWurzel)(args.userEmail, args.libraryId)
    const { angelegt } = await legeVerzeichnisAn(provider, verzeichnis)
    return angelegt.length > 0 ? { status: 'angelegt', verzeichnis, angelegt } : { status: 'vorhanden', verzeichnis }
  } catch (error) {
    return { status: 'fehler', verzeichnis, grund: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Wenn die Wurzel der Library nicht lesbar ist: liegt es an der Verbindung oder fehlt nur das Verzeichnis?
 * Liest nur. `null` = keine Aussage moeglich (keine Verbindung, Wurzel als Verzeichnis).
 */
export async function diagnoseVerzeichnis(args: {
  userEmail: string
  libraryId: string
  verzeichnis: string | undefined
  hatVerbindung: boolean
  wurzelProvider?: (userEmail: string, libraryId: string) => Promise<StorageProvider>
}): Promise<{ verbindungAntwortet: boolean; verzeichnisFehlt: string | null; grund: string } | null> {
  if (!args.hatVerbindung || segmente(args.verzeichnis).length === 0) return null
  let provider: StorageProvider
  try {
    provider = await (args.wurzelProvider ?? getServerProviderAnVerbindungsWurzel)(args.userEmail, args.libraryId)
  } catch (error) {
    return { verbindungAntwortet: false, verzeichnisFehlt: null, grund: `Die Speicher-Verbindung selbst antwortet nicht: ${error instanceof Error ? error.message : String(error)}` }
  }
  const fehlt = await findeFehlendesSegment(provider, args.verzeichnis as string)
  return fehlt
    ? { verbindungAntwortet: true, verzeichnisFehlt: fehlt, grund: `Die Speicher-Verbindung antwortet, aber das Verzeichnis "${fehlt}" gibt es dort nicht — anlegen oder das Verzeichnis der Library korrigieren (speicher_verbindung_zuweisen mit verzeichnis)` }
    : { verbindungAntwortet: true, verzeichnisFehlt: null, grund: 'Die Speicher-Verbindung antwortet und das Verzeichnis existiert — der Fehler liegt woanders' }
}
