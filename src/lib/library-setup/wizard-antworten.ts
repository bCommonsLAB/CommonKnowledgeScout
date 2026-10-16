/**
 * @fileoverview Antworten des Anlege-Wizards → Library-Entwurf (Plan
 * speicher-verbindungen-und-library-anlage, C2).
 *
 * @description
 * Der Wizard sammelt seine Antworten als flache Formularwerte; hier werden sie
 * ueber dieselben Bausteine wie `bibliothek_anlegen` zu einer Library: Entwurf
 * (`baueLibrary`, Vorlage via `uebernimmKonfiguration`), Antworten ueber den
 * Antwortweg des Katalogs (`wendeAntwortenAn`), Kontext fuer
 * `pruefeEinrichtung`. Eine leere Eingabe heisst „nicht beantwortet" — die
 * Zusammenfassung zeigt sie als offen, es wird nichts still vorbelegt.
 *
 * @module library-setup
 */

import type { DetailViewType } from '@/lib/detail-view-types/registry'
import type { Library } from '@/types/library'
import { baueLibrary, uebernimmKonfiguration, type SpeicherTyp } from './entwurf'
import { pruefeEinrichtung, wendeAntwortenAn } from './pruefung'
import type { EinrichtungsKontext, EinrichtungsPruefung } from './typen'

export interface WizardAntworten {
  name: string
  inhaltstyp: DetailViewType | ''
  /** Id der Vorlage-Library; '' = keine. */
  vorlageVon: string
  vorlagenKopieren: boolean
  speicherTyp: SpeicherTyp
  /** nur nextcloud/onedrive; '' = keine gewaehlt. */
  verbindungId: string
  verzeichnis: string
  /** null = aus dem Inhaltstyp. */
  audioErwartet: boolean | null
  /** Komma-getrennte ISO-Codes; '' = offen. */
  aufnahmeSprachen: string
  /** Ein Name je Zeile; '' = offen. */
  bekannteNamen: string
  facettenStandard: boolean
  /** null = offen. */
  graph: boolean | null
  /** '' = offen. */
  antwortsprache: string
  /** '' = offen. */
  antwortregeln: string
}

export const LEERE_ANTWORTEN: WizardAntworten = {
  name: '', inhaltstyp: '', vorlageVon: '', vorlagenKopieren: true, speicherTyp: 'nextcloud', verbindungId: '',
  verzeichnis: '', audioErwartet: null, aufnahmeSprachen: '', bekannteNamen: '', facettenStandard: false,
  graph: null, antwortsprache: '', antwortregeln: '',
}

/** Nur was die Vorlage-Wahl braucht: Id, Inhaltstyp, Config. */
export interface VorhandeneLibrary {
  id: string
  label: string
  config?: { chat?: { gallery?: { detailViewType?: string } } } & Record<string, unknown>
}

export interface WizardEntwurf {
  library: Library
  kontext: EinrichtungsKontext
  pruefung: EinrichtungsPruefung
}

function liste(text: string, trenner: RegExp): string[] {
  return text.split(trenner).map((s) => s.trim()).filter((s) => s !== '')
}

/** Katalog-Antworten aus den Formularwerten; nur Beantwortetes. */
export function katalogAntworten(a: WizardAntworten): Record<string, unknown> {
  return {
    ...(a.facettenStandard ? { facetten: 'standard' } : {}),
    ...(a.graph !== null ? { graph: a.graph } : {}),
    ...(a.aufnahmeSprachen.trim() ? { aufnahmeSprachen: liste(a.aufnahmeSprachen.toLowerCase(), /[,;\s]+/) } : {}),
    ...(a.bekannteNamen.trim() ? { bekannteNamen: liste(a.bekannteNamen, /\n/) } : {}),
    ...(a.antwortsprache ? { antwortsprache: a.antwortsprache } : {}),
    ...(a.antwortregeln.trim() ? { antwortregeln: a.antwortregeln.trim() } : {}),
  }
}

/** Baut den Entwurf und prueft ihn gegen den Katalog. Wirft bei ungueltigen Antworten. */
export function baueWizardEntwurf(id: string, a: WizardAntworten, vorhandene: readonly VorhandeneLibrary[]): WizardEntwurf {
  const vorlage = a.vorlageVon ? vorhandene.find((l) => l.id === a.vorlageVon) : undefined
  if (a.vorlageVon && !vorlage) throw new Error(`Vorlage-Library ${a.vorlageVon} nicht gefunden`)
  const typ = a.inhaltstyp || undefined
  const mitVerbindung = a.speicherTyp !== 'local' && a.verbindungId !== ''
  const basis = baueLibrary({
    id,
    name: a.name,
    inhaltstyp: typ,
    speicher: { typ: a.speicherTyp, verzeichnis: a.verzeichnis },
    uebernahme: vorlage ? uebernimmKonfiguration(vorlage, id) : undefined,
    storageConnectionId: mitVerbindung ? a.verbindungId : undefined,
  })
  const library = wendeAntwortenAn(basis, katalogAntworten(a))
  const kontext: EinrichtungsKontext = {
    andereLibrariesGleichenTyps: typ ? vorhandene.filter((l) => l.config?.chat?.gallery?.detailViewType === typ).length : 0,
    vorlageGewaehlt: Boolean(vorlage),
    ...(a.audioErwartet !== null ? { audioErwartet: a.audioErwartet } : {}),
  }
  return { library, kontext, pruefung: pruefeEinrichtung(library, kontext) }
}
