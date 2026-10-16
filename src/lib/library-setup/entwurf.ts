/**
 * @fileoverview Entwurf einer neuen Library — gemeinsam fuer Anlege-Wizard (C2)
 * und `bibliothek_anlegen` (Plan speicher-verbindungen-und-library-anlage).
 *
 * @description
 * Baut eine neue Library so, wie die KS-Oberflaeche sie anlegt: Inhaltstyp in
 * `config.chat.gallery.detailViewType`, Shadow-Twin v2/Mongo, Speicher als
 * `type` + `path` + `storageConnectionId`. Mit einer Vorlage-Library werden
 * die Bereiche uebernommen, die NICHTS mit Zugangsdaten oder Aussenwirkung zu
 * tun haben: Chat (Facetten, Antwortregeln, Galerie, Sprache), Verarbeitung
 * (Standard-Vorlage, Zielsprache …) und Ingest-Schalter. Der Vektor-Store
 * bekommt einen eigenen Collection-Namen — sonst teilten sich beide
 * Libraries einen Index. Reine Funktionen, Client und Server.
 *
 * @module library-setup
 */

import type { Library, StorageConfig, StorageProviderType } from '@/types/library'

export const SPEICHER_TYPEN = ['nextcloud', 'local', 'onedrive'] as const
export type SpeicherTyp = (typeof SPEICHER_TYPEN)[number]

export interface SpeicherAngaben {
  typ: SpeicherTyp
  /** nextcloud/onedrive: Unterpfad auf der Verbindung; local: absoluter Pfad auf dem Server. */
  verzeichnis?: string
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

/** Eigener Vektor-Index je Library (dieselbe Konvention wie per_library). */
export function collectionNameFuer(libraryId: string): string {
  return `doc_meta__${libraryId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`
}

function alsObjekt(wert: unknown): Record<string, unknown> {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : {}
}

export interface UebernahmeErgebnis {
  config: Record<string, unknown>
  uebernommen: string[]
}

/** Uebernimmt die geheimnisfreien Bereiche einer Vorlage-Library fuer die neue Id. */
export function uebernimmKonfiguration(vorlage: { config?: unknown }, neueId: string): UebernahmeErgebnis {
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
  /** Fehlt er, ist die Library ein Entwurf, den `pruefeEinrichtung` als offen meldet. */
  inhaltstyp?: string
  speicher: SpeicherAngaben
  uebernahme?: UebernahmeErgebnis
  /** Speicher-Verbindung, auf der die Library liegt (nextcloud/onedrive); fehlt = ausstehend. */
  storageConnectionId?: string
}): Library {
  const basis = args.uebernahme?.config ?? {}
  const chat = alsObjekt(basis.chat)
  const config: Record<string, unknown> = {
    ...basis,
    chat: {
      ...chat,
      gallery: { ...alsObjekt(chat.gallery), ...(args.inhaltstyp ? { detailViewType: args.inhaltstyp } : {}) },
    },
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
