/**
 * @fileoverview Reine Bausteine von `bibliothek_anlegen` (Handover Library-Anlage, 08.10.).
 *
 * @description
 * Baut eine neue Library so, wie die KS-Oberflaeche sie anlegt: Anlege-Dialog
 * (`use-library-form.ts`, Inhaltstyp in `config.chat.gallery.detailViewType`,
 * Shadow-Twin v2/Mongo) plus Speicher-Schritt (`use-storage-form.ts`: `type`,
 * `path`, `storageConnectionId`). Zugangsdaten liegen seit Teil A des Plans
 * speicher-verbindungen-und-library-anlage an der Speicher-Verbindung der
 * Person; seit A3 nennt der Agent die Verbindung (Id oder Bezeichnung aus
 * `speicher_verbindungen_auflisten`), der Typ folgt aus ihr. Ohne Verbindung
 * bleibt eine nextcloud-/onedrive-Library „ausstehend", bis
 * `speicher_verbindung_zuweisen` sie anhaengt. Geheimnisse kommen NIE ueber
 * die Bruecke.
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
import type { StorageConnectionSummary } from '@/types/storage-connection'
import { waehleVerbindung } from './speicher-verbindung-wahl'

export const SPEICHER_TYPEN = ['nextcloud', 'local', 'onedrive'] as const
export type SpeicherTyp = (typeof SPEICHER_TYPEN)[number]

export interface SpeicherAngaben {
  typ: SpeicherTyp
  /** nextcloud/onedrive: Unterpfad auf der Verbindung; local: absoluter Pfad auf dem Server. */
  verzeichnis?: string
}

/** Was der Agent zum Speicher sagt (Eingabe von `bibliothek_anlegen`). */
export interface SpeicherEingabe {
  speicherTyp?: SpeicherTyp
  speicherVerbindung?: string
  verzeichnis?: string
}

/** Aufgeloester Speicher: Typ, Verzeichnis, Verbindung (null = ausstehend oder local). */
export interface SpeicherWahl {
  speicher: SpeicherAngaben
  verbindung: StorageConnectionSummary | null
}

/** Verarbeitungs-Schluessel des Secretary-Blocks ohne Verbindung (apiUrl/apiKey bleiben). */
const VERARBEITUNG_SCHLUESSEL = [
  'template', 'targetLanguage', 'pdfExtractionMethod', 'llmModel', 'generateCoverImage', 'coverImagePrompt',
] as const

/** Library-Schalter ohne Geheimnis, die eine Vorlage-Library mitgibt. */
const SCHALTER_SCHLUESSEL = [
  'transcriptionSpeakerMode', 'transcriptionLanguages', 'ingestSourceAppendix', 'extractionKnownNames', 'scanExcludeGlobs',
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

/**
 * Bestimmt den Speicher der neuen Library. Mit `speicherVerbindung` folgt der
 * Typ aus der Verbindung (ein abweichender `speicherTyp` ist ein Fehler);
 * ohne sie ist `speicherTyp` Pflicht, local braucht ein Verzeichnis, und
 * nextcloud/onedrive bleiben ohne Verbindung (ausstehend).
 */
export function bestimmeSpeicher(eingabe: SpeicherEingabe, kandidaten: StorageConnectionSummary[]): SpeicherWahl {
  const verzeichnis = eingabe.verzeichnis?.trim() || undefined
  if (eingabe.speicherVerbindung !== undefined) {
    const verbindung = waehleVerbindung(eingabe.speicherVerbindung, kandidaten)
    if (eingabe.speicherTyp && eingabe.speicherTyp !== verbindung.type) {
      throw new Error(`speicherTyp ${eingabe.speicherTyp} passt nicht zur Verbindung "${verbindung.label}" (${verbindung.type}) — speicherTyp weglassen`)
    }
    return { speicher: { typ: verbindung.type, verzeichnis }, verbindung }
  }
  const typ = eingabe.speicherTyp
  if (!typ) throw new Error('speicherVerbindung (Id oder Bezeichnung) oder speicherTyp angeben')
  switch (typ) {
    case 'local':
      if (!verzeichnis) throw new Error('local: verzeichnis (absoluter Pfad auf dem Server) ist Pflicht')
      return { speicher: { typ, verzeichnis }, verbindung: null }
    case 'nextcloud':
    case 'onedrive':
      return { speicher: { typ, verzeichnis }, verbindung: null }
    default: {
      const nie: never = typ
      throw new Error(`Unbekannter Speicher-Typ "${String(nie)}"`)
    }
  }
}

/** Liegt dieser Speichertyp auf einer Speicher-Verbindung (mit Geheimnis) statt auf einem lokalen Pfad? */
export function brauchtVerbindung(typ: SpeicherTyp): boolean {
  switch (typ) {
    case 'nextcloud':
    case 'onedrive':
      return true
    case 'local':
      return false
    default: {
      const nie: never = typ
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

/** Die neue Library, bereit fuer `LibraryService.updateLibrary`. */
export function baueLibrary(args: {
  id: string
  name: string
  inhaltstyp: string
  speicher: SpeicherAngaben
  uebernahme?: UebernahmeErgebnis
  /** Speicher-Verbindung, auf der die Library liegt (nextcloud/onedrive); fehlt = ausstehend. */
  storageConnectionId?: string
}): Library {
  const basis = args.uebernahme?.config ?? {}
  const chat = alsObjekt(basis.chat)
  const config: Record<string, unknown> = {
    ...basis,
    chat: { ...chat, gallery: { ...alsObjekt(chat.gallery), detailViewType: args.inhaltstyp } },
    shadowTwin: { mode: 'v2', primaryStore: 'mongo', persistToFilesystem: true, allowFilesystemFallback: true },
  }
  return {
    id: args.id,
    label: args.name.trim(),
    path: args.speicher.verzeichnis?.trim() ?? '',
    type: args.speicher.typ as StorageProviderType,
    isEnabled: true,
    transcription: 'shadowTwin',
    ...(args.storageConnectionId ? { storageConnectionId: args.storageConnectionId } : {}),
    config: config as StorageConfig,
  }
}
