/**
 * @fileoverview Reine Bausteine von `bibliothek_anlegen` (Handover Library-Anlage, 08.10.).
 *
 * @description
 * Baut eine neue Library so, wie die KS-Oberflaeche sie anlegt: Anlege-Dialog
 * (`use-library-form.ts`, Inhaltstyp in `config.chat.gallery.detailViewType`,
 * Shadow-Twin v2/Mongo) plus Speicher-Schritt (`use-storage-form.ts`: `type`,
 * `path`, `config.nextcloud`). Geheimnisse (App-Passwort, Client-Secret,
 * OAuth) kommen NIE ueber die Bruecke — der Owner traegt sie in Settings →
 * Archive ein.
 *
 * Mit `vorlageVon` werden die Bereiche einer bestehenden Library uebernommen,
 * die NICHTS mit Zugangsdaten oder Aussenwirkung zu tun haben: Chat
 * (Facetten, Antwortregeln, Galerie, Sprache), Verarbeitung (Standard-Vorlage,
 * Zielsprache …) und Ingest-Schalter. Der Vektor-Store bekommt einen eigenen
 * Collection-Namen — sonst teilten sich beide Libraries einen Index (dieselbe
 * Regel wie der Klon im Anlege-Dialog).
 *
 * @module mcp
 */

import type { Library, StorageConfig, StorageProviderType } from '@/types/library'

export const SPEICHER_TYPEN = ['nextcloud', 'local', 'onedrive'] as const
export type SpeicherTyp = (typeof SPEICHER_TYPEN)[number]

export interface SpeicherAngaben {
  typ: SpeicherTyp
  /** Nextcloud: Unterpfad im WebDAV-Root; local: absoluter Pfad auf dem Server. */
  verzeichnis?: string
  webdavUrl?: string
  benutzer?: string
}

/** Verarbeitungs-Schluessel des Secretary-Blocks ohne Verbindung (apiUrl/apiKey bleiben). */
const VERARBEITUNG_SCHLUESSEL = [
  'template', 'targetLanguage', 'pdfExtractionMethod', 'llmModel', 'generateCoverImage', 'coverImagePrompt',
] as const

/** Library-Schalter ohne Geheimnis, die eine Vorlage-Library mitgibt. */
const SCHALTER_SCHLUESSEL = [
  'transcriptionSpeakerMode', 'ingestSourceAppendix', 'extractionKnownNames', 'scanExcludeGlobs',
] as const

/** Was `vorlageVon` bewusst NICHT mitnimmt — wird in der Antwort genannt. */
export const NICHT_UEBERNOMMEN = [
  'Zugangsdaten (nextcloud, onedrive, clientSecret, Tokens)',
  'Secretary-Verbindung (apiUrl, apiKey)',
  'Veroeffentlichung (publicPublishing, Slug) — veroeffentlichung_setzen',
  'Binary-Storage (ingestionStorage)',
  'Agentensicht (agentView)',
] as const

/** Derselbe Name wie im Klon des Anlege-Dialogs (`create-library-dialog.tsx`). */
export function collectionNameFuer(libraryId: string): string {
  return `doc_meta__${libraryId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`
}

function alsObjekt(wert: unknown): Record<string, unknown> {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : {}
}

/** Prueft die Speicher-Angaben je Typ; wirft bei fehlenden Pflichtwerten. */
export function pruefeSpeicher(speicher: SpeicherAngaben): void {
  switch (speicher.typ) {
    case 'nextcloud':
      if (!speicher.webdavUrl?.trim()) throw new Error('Nextcloud: webdavUrl ist Pflicht')
      if (!/^https?:\/\//.test(speicher.webdavUrl.trim())) throw new Error('Nextcloud: webdavUrl muss mit http(s):// beginnen')
      if (!speicher.benutzer?.trim()) throw new Error('Nextcloud: benutzer ist Pflicht')
      return
    case 'local':
      if (!speicher.verzeichnis?.trim()) throw new Error('local: verzeichnis (absoluter Pfad auf dem Server) ist Pflicht')
      if (speicher.webdavUrl || speicher.benutzer) throw new Error('local: webdavUrl und benutzer gelten nur fuer nextcloud')
      return
    case 'onedrive':
      if (speicher.webdavUrl || speicher.benutzer) throw new Error('onedrive: webdavUrl und benutzer gelten nur fuer nextcloud')
      return
    default: {
      const nie: never = speicher.typ
      throw new Error(`Unbekannter Speicher-Typ "${String(nie)}"`)
    }
  }
}

/** Braucht der Speicher ein Geheimnis, das nur der Owner in der Oberflaeche eintraegt? */
export function geheimnisFehlt(speicher: SpeicherAngaben): boolean {
  switch (speicher.typ) {
    case 'nextcloud':
    case 'onedrive':
      return true
    case 'local':
      return false
    default: {
      const nie: never = speicher.typ
      throw new Error(`Unbekannter Speicher-Typ "${String(nie)}"`)
    }
  }
}

export interface UebernahmeErgebnis {
  config: Record<string, unknown>
  uebernommen: string[]
}

/** Uebernimmt die geheimnisfreien Bereiche einer Vorlage-Library fuer die neue Id. */
export function uebernimmKonfiguration(vorlage: Library, neueId: string): UebernahmeErgebnis {
  const quelle = alsObjekt(vorlage.config)
  const config: Record<string, unknown> = {}
  const uebernommen: string[] = []

  const chat = alsObjekt(quelle.chat)
  if (Object.keys(chat).length > 0) {
    const kopie = JSON.parse(JSON.stringify(chat)) as Record<string, unknown>
    const vectorStore = alsObjekt(kopie.vectorStore)
    delete vectorStore.indexOverride
    delete vectorStore.indexName
    kopie.vectorStore = { ...vectorStore, collectionName: collectionNameFuer(neueId) }
    config.chat = kopie
    uebernommen.push('chat (Facetten, Antwortregeln, Galerie, Sprache, Charakter; eigener Vektor-Index)')
  }

  const secretary = alsObjekt(quelle.secretaryService)
  const verarbeitung = Object.fromEntries(VERARBEITUNG_SCHLUESSEL.filter((k) => secretary[k] !== undefined).map((k) => [k, secretary[k]]))
  if (Object.keys(verarbeitung).length > 0) {
    config.secretaryService = verarbeitung
    uebernommen.push(`verarbeitung (${Object.keys(verarbeitung).join(', ')})`)
  }

  for (const schluessel of SCHALTER_SCHLUESSEL) {
    if (quelle[schluessel] === undefined) continue
    config[schluessel] = JSON.parse(JSON.stringify(quelle[schluessel]))
    uebernommen.push(schluessel)
  }
  return { config, uebernommen }
}

/** Speicher-Teil der Config, wie ihn der Speicher-Schritt der Oberflaeche schreibt. */
function speicherConfig(speicher: SpeicherAngaben): Record<string, unknown> {
  if (speicher.typ !== 'nextcloud') return {}
  // appPassword als leeres Feld (Owner 09.10.): das Feld ist in MongoDB
  // sichtbar, und Settings → Archive bietet die Eingabe an, solange es leer ist.
  return { nextcloud: { webdavUrl: speicher.webdavUrl?.trim(), username: speicher.benutzer?.trim(), appPassword: '' } }
}

/** Die neue Library, bereit fuer `LibraryService.updateLibrary`. */
export function baueLibrary(args: {
  id: string
  name: string
  inhaltstyp: string
  speicher: SpeicherAngaben
  uebernahme?: UebernahmeErgebnis
}): Library {
  const basis = args.uebernahme?.config ?? {}
  const chat = alsObjekt(basis.chat)
  const config: Record<string, unknown> = {
    ...basis,
    chat: { ...chat, gallery: { ...alsObjekt(chat.gallery), detailViewType: args.inhaltstyp } },
    shadowTwin: { mode: 'v2', primaryStore: 'mongo', persistToFilesystem: true, allowFilesystemFallback: true },
    ...speicherConfig(args.speicher),
  }
  return {
    id: args.id,
    label: args.name.trim(),
    path: args.speicher.verzeichnis?.trim() ?? '',
    type: args.speicher.typ as StorageProviderType,
    isEnabled: true,
    transcription: 'shadowTwin',
    config: config as StorageConfig,
  }
}
