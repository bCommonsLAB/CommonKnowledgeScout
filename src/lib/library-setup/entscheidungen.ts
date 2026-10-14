/**
 * @fileoverview Entscheidungskatalog der Library-Anlage (Plan
 * speicher-verbindungen-und-library-anlage §5, Schritt C1).
 *
 * @description
 * Eine Quelle fuer App-Wizard (C2), Bruecke (C3) und die Einrichtungs-Anzeige
 * in den Settings: jede Zeile der Tabelle in §5 als Daten — Schluessel,
 * Feldpfad, Gewicht, Bedingung, Vorgabe ohne Antwort, Frage, Optionen.
 * Was ohne Antwort gilt, steht hier als `vorgabe` und nicht verstreut im Code.
 * Zeilen 1–11 stehen hier, 12–19 („spaeter") in `entscheidungen-spaeter.ts`.
 *
 * Fest und deshalb ohne Frage: Shadow Twin v2/Mongo, Vektor-Collection-Name,
 * Secretary-Verbindung aus der Umgebung.
 *
 * @module library-setup
 */

import { z } from 'zod'
import { TARGET_LANGUAGE_VALUES } from '@ks/contracts'
import { formatiereAntwortregelnFehler, pruefeAntwortregeln } from '@/lib/chat/antwortregeln'
import { DETAIL_VIEW_TYPES } from '@/lib/detail-view-types/registry'
import type { Library, StorageConfig } from '@/types/library'
import { ENTSCHEIDUNGEN_SPAETER } from './entscheidungen-spaeter'
import { audioErwartet, hatErfassenWizards, inhaltstypVon } from './inhaltstyp-merkmale'
import { standardFacettenFuer } from './standard-facetten'
import type { EinrichtungsLibrary, Entscheidung } from './typen'

type Chat = NonNullable<StorageConfig['chat']>
type Galerie = NonNullable<Chat['gallery']>

function chat(library: EinrichtungsLibrary): Chat {
  return library.config?.chat ?? {}
}

function mitChat(library: Library, aenderung: (alt: Chat) => Chat): Library {
  return { ...library, config: { ...library.config, chat: aenderung(chat(library)) } }
}

function mitGalerie(library: Library, aenderung: (alt: Galerie) => Galerie): Library {
  return mitChat(library, (c) => ({ ...c, gallery: aenderung(c.gallery ?? {}) }))
}

const LISTE = (max: number) => z.array(z.string().trim().min(1)).max(max)

const GRUNDLAGEN_BIS_STORY: readonly Entscheidung[] = [
  {
    nr: 1, schluessel: 'name', titel: 'Name', frage: 'Wie heisst die Library?',
    gewicht: 'pflicht', schritt: 'grundlagen', feldpfade: ['label'], giltWenn: 'immer', vorgabe: null,
    beantwortet: (l) => l.label.trim() !== '',
  },
  {
    nr: 2, schluessel: 'inhaltstyp', titel: 'Inhaltstyp',
    frage: 'Welche Art Inhalte sammelt sie? Bestimmt Standard-Vorlage, Pflichtfelder und Detailansicht.',
    gewicht: 'pflicht', schritt: 'grundlagen', feldpfade: ['config.chat.gallery.detailViewType'], giltWenn: 'immer', vorgabe: null,
    optionen: DETAIL_VIEW_TYPES.map((t) => ({ wert: t, label: t })),
    beantwortet: (l) => inhaltstypVon(l) !== null,
  },
  {
    nr: 3, schluessel: 'speicher', titel: 'Speicher',
    frage: 'Wo liegen die Dateien? nextcloud/onedrive: Speicher-Verbindung plus Verzeichnis; local: absoluter Pfad.',
    gewicht: 'pflicht', schritt: 'quelle', feldpfade: ['type', 'storageConnectionId', 'path'],
    giltWenn: 'immer (Verbindung nur bei nextcloud/onedrive)', vorgabe: null,
    beantwortet: (l) => (l.type === 'local' ? l.path.trim() !== '' : (l.storageConnectionId ?? '').trim() !== ''),
  },
  {
    nr: 4, schluessel: 'vorlageVon', titel: 'Vorlage-Library',
    frage: 'Soll die Konfiguration einer bestehenden Library gleichen Typs uebernommen werden?',
    gewicht: 'empfohlen', schritt: 'grundlagen', feldpfade: [], giltWenn: 'bei der Anlage, wenn eine andere Library gleichen Typs existiert',
    vorgabe: 'nichts übernommen',
    gilt: (_l, k) => (k.andereLibrariesGleichenTyps ?? 0) > 0,
    beantwortet: (_l, k) => k.vorlageGewaehlt === true,
  },
  {
    nr: 5, schluessel: 'facetten', titel: 'Facetten',
    frage: 'Welche Metafelder sollen in der Galerie filterbar sein? "standard" uebernimmt den Vorschlag des Inhaltstyps.',
    gewicht: 'empfohlen', schritt: 'finden', feldpfade: ['config.chat.gallery.facets'], giltWenn: 'immer',
    vorgabe: 'keine eigenen; Vorschlag: Standard-Facetten des Inhaltstyps',
    optionen: [{ wert: 'standard', label: 'Standard-Facetten des Inhaltstyps' }],
    beantwortet: (l) => Array.isArray(chat(l).gallery?.facets),
    antwort: {
      schema: z.literal('standard'),
      anwenden: (l) => {
        const typ = inhaltstypVon(l)
        if (!typ) throw new Error('facetten: erst den Inhaltstyp festlegen')
        return mitGalerie(l, (g) => ({ ...g, facets: standardFacettenFuer(typ) }))
      },
    },
  },
  {
    nr: 6, schluessel: 'graph', titel: 'Graph sichtbar', frage: 'Soll die Galerie die Graph-Ansicht anbieten?',
    gewicht: 'empfohlen', schritt: 'finden', feldpfade: ['config.chat.gallery.graph.enabled'], giltWenn: 'immer', vorgabe: 'aus',
    optionen: [{ wert: 'true', label: 'ja' }, { wert: 'false', label: 'nein' }],
    beantwortet: (l) => chat(l).gallery?.graph?.enabled !== undefined,
    antwort: {
      schema: z.boolean(),
      anwenden: (l, wert) => mitGalerie(l, (g) => ({ ...g, graph: { ...g.graph, enabled: wert as boolean } })),
    },
  },
  {
    nr: 7, schluessel: 'aufnahmeSprachen', titel: 'Sprachen der Aufnahmen',
    frage: 'In welchen Sprachen wird in den Aufnahmen gesprochen (ISO-Codes, z. B. de, it)?',
    gewicht: 'empfohlen', schritt: 'verarbeitung', feldpfade: ['config.transcriptionLanguages'], giltWenn: 'Audio/Video erwartet',
    vorgabe: 'Modell entscheidet je Stück',
    gilt: audioErwartet,
    beantwortet: (l) => l.config?.transcriptionLanguages !== undefined,
    antwort: {
      schema: z.array(z.string().trim().regex(/^[a-z]{2,3}$/, 'ISO-Code wie de, it, en')).max(10),
      anwenden: (l, wert) => ({ ...l, config: { ...l.config, transcriptionLanguages: wert as string[] } }),
    },
  },
  {
    nr: 8, schluessel: 'bekannteNamen', titel: 'Bekannte Namen / Organisationen',
    frage: 'Welche Namen und Organisationen kommen vor (hilft der Transkription bei der Schreibweise)?',
    gewicht: 'empfohlen', schritt: 'verarbeitung', feldpfade: ['config.extractionKnownNames'], giltWenn: 'Audio/Video erwartet',
    vorgabe: 'keine', gilt: audioErwartet,
    beantwortet: (l) => l.config?.extractionKnownNames !== undefined,
    antwort: {
      schema: LISTE(200),
      anwenden: (l, wert) => ({ ...l, config: { ...l.config, extractionKnownNames: wert as string[] } }),
    },
  },
  {
    nr: 9, schluessel: 'antwortsprache', titel: 'Antwortsprache des Story-Modus',
    frage: 'In welcher Sprache antwortet der Story-Modus? "global" folgt der Sprache der Oberflaeche.',
    gewicht: 'empfohlen', schritt: 'story', feldpfade: ['config.chat.targetLanguage'], giltWenn: 'immer', vorgabe: 'Vorgabe des Chats',
    optionen: TARGET_LANGUAGE_VALUES.map((s) => ({ wert: s, label: s })),
    beantwortet: (l) => chat(l).targetLanguage !== undefined,
    antwort: {
      schema: z.enum(TARGET_LANGUAGE_VALUES as [string, ...string[]]),
      anwenden: (l, wert) => mitChat(l, (c) => ({ ...c, targetLanguage: wert as Chat['targetLanguage'] })),
    },
  },
  {
    nr: 10, schluessel: 'antwortregeln', titel: 'Antwortregeln',
    frage: 'Welche Regeln gelten fuer Antworten (Platzhalter {{facette:<metaKey>}} und {{legende:<metaKey>}} erlaubt)?',
    gewicht: 'empfohlen', schritt: 'story', feldpfade: ['config.chat.antwortregeln'], giltWenn: 'immer', vorgabe: 'keine',
    beantwortet: (l) => chat(l).antwortregeln !== undefined,
    antwort: {
      schema: z.string().max(8000),
      anwenden: (l, wert) => {
        const text = wert as string
        const fehler = pruefeAntwortregeln(text, chat(l).gallery?.facets ?? [])
        if (fehler.length > 0) throw new Error(`antwortregeln: ${formatiereAntwortregelnFehler(fehler)}`)
        return mitChat(l, (c) => ({ ...c, antwortregeln: text }))
      },
    },
  },
  {
    nr: 11, schluessel: 'erfassenWizards', titel: 'Wizards „Inhalte erfassen"',
    frage: 'Welche „Inhalte erfassen"-Wizards bietet die Library an? Auswahl in Settings → Archive · 4 Erfassen.',
    gewicht: 'empfohlen', schritt: 'erfassen', feldpfade: ['config.captureWizards'], giltWenn: 'Inhaltstyp mit Wizards',
    vorgabe: 'nur Standard-Wizard', gilt: hatErfassenWizards,
    beantwortet: (l) => l.config?.captureWizards !== undefined,
  },
]

/** Alle 19 Zeilen der Tabelle in §5, in Tabellen-Reihenfolge. */
export const ENTSCHEIDUNGEN: readonly Entscheidung[] = [...GRUNDLAGEN_BIS_STORY, ...ENTSCHEIDUNGEN_SPAETER]

/** Eintrag per Schluessel; wirft bei unbekanntem Schluessel. */
export function entscheidung(schluessel: string): Entscheidung {
  const treffer = ENTSCHEIDUNGEN.find((e) => e.schluessel === schluessel)
  if (!treffer) throw new Error(`Unbekannte Entscheidung "${schluessel}" — bekannt: ${ENTSCHEIDUNGEN.map((e) => e.schluessel).join(', ')}`)
  return treffer
}
