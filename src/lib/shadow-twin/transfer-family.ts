/**
 * @fileoverview Quelle samt Twin-Familie von Library A nach B uebergeben (Wunschliste 8, W8-3).
 *
 * @description
 * Der Weg, der bisher fehlte und deshalb neben der Bruecke gegangen wurde
 * (Anlass 13.10.: acht Dateien, Kopien eine Weile parallel, im Archiv ein
 * Loch). Neun Schritte (Plan Abschnitt 2):
 *
 * 1. Vorbedingungen (alle VOR dem ersten Schreiben)  2. Import in A
 * 3. Quelle A → B (Kennung aus demselben Blob)       4. Twin-Dokument in B
 * 5. Transkript-Segmente nach B                      6. Export in B
 * 7. Kennung in A nachtragen                         8. Verweis-Datei in A
 * 9. Herkunft: behalten oder nach „zu klären" verwerfen
 *
 * **Abbruch:** Scheitert Schritt 4, wird die eben hochgeladene Kopie in B
 * wieder entfernt — A ist dann inhaltlich unveraendert (der Import zieht nur
 * den Spiegel nach MongoDB). Ab Schritt 5 ist B vollstaendig; ein Fehler dort
 * steht in seiner Schritt-Zeile, die folgenden Schritte laufen nicht mehr,
 * und die Antwort sagt, was fehlt. Es wird NIE etwas in A geloescht.
 * Vektoren werden nie kopiert (Embedding-Konfiguration je Library):
 * `index_aktualisieren` in B ist der bewusste Schritt danach.
 *
 * Alle Aussenzugriffe ueber {@link TransferPorts} — testbar ohne Datenbank.
 *
 * @module shadow-twin
 */

import { isShadowTwinFolderName } from '@ks/util'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { KLAER_ORDNER } from './klaer-ordner'
import { quellkennungAusBlob, type Quellkennung } from './quellkennung'
import { baueVerweisMarkdown, verweisDateiName, type Herkunft } from './verweis-datei'

/** Groessen-Waechter wie bei `kopieren`: die 60-s-Grenze der Bruecke. */
export const MAX_UEBERGABE_BYTES = 250 * 1024 * 1024

export interface TransferPorts {
  ladeTwin(libraryId: string, sourceId: string): Promise<ShadowTwinDocument | null>
  importiere(libraryId: string, sourceId: string): Promise<void>
  exportiere(libraryId: string, sourceId: string): Promise<void>
  legeTwinAn(args: { quelle: ShadowTwinDocument; nachLibraryId: string; sourceId: string; sourceName: string; parentId: string; quellkennung: Quellkennung }): Promise<void>
  /** true = es gab Segmente und sie sind kopiert. */
  kopiereSegmente(vonLibraryId: string, vonSourceId: string, nachLibraryId: string, nachSourceId: string): Promise<boolean>
  setzeKennung(libraryId: string, sourceId: string, quellkennung: Quellkennung): Promise<void>
  /** Quelle in A nach „zu klären" (Weg von quelle_verwerfen). */
  verwirf(sourceId: string): Promise<{ folderId: string; name: string }>
  /** `@<slug>/<pfad>` in B; null = B hat keinen gueltigen Slug. */
  adresseInZiel(pfad: string): string | null
  jetzt(): string
}

export interface TransferArgs {
  von: { libraryId: string; libraryName: string; provider: StorageProvider }
  nach: { libraryId: string; libraryName: string; provider: StorageProvider }
  sourceId: string
  zielOrdnerId: string
  herkunft: Herkunft
  vorschau: boolean
}

export interface TransferSchritt {
  schritt: string
  status: 'ok' | 'uebersprungen' | 'fehler'
  detail?: string
}

export interface TransferPlan {
  quelle: { sourceId: string; name: string; pfad: string; groesse: number }
  ziel: { libraryName: string; ordnerPfad: string; pfad: string; adresse: string | null }
  familie: { twinDokument: boolean; transkript: boolean; transformationen: number }
  verweisDatei: string
  herkunft: Herkunft
}

export interface TransferErgebnis {
  plan: TransferPlan
  vorschau: boolean
  schritte: TransferSchritt[]
  /** Gesetzt, sobald die Quelle in B liegt. */
  neueSourceId: string | null
  offen: string[]
}

function text(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function pfadOhneRand(pfad: string): string {
  return pfad.replace(/^\/+|\/+$/g, '')
}

/** Schritt 1: alles pruefen, was ohne Schreiben pruefbar ist. Wirft mit Grund. */
async function pruefe(args: TransferArgs, ports: TransferPorts): Promise<{ plan: TransferPlan; source: StorageItem; doc: ShadowTwinDocument | null }> {
  const { von, nach, sourceId, zielOrdnerId } = args
  if (von.libraryId === nach.libraryId) throw new Error('Ziel ist dieselbe Library — dafuer gibt es familie_umziehen')
  const source = await von.provider.getItemById(sourceId)
  if (source.type !== 'file') throw new Error(`${sourceId} ist keine Datei`)
  // Wie moveFamily: ein nicht lesbarer Elternordner (z. B. Wurzel) sperrt nicht.
  const eltern = await von.provider.getItemById(source.parentId).catch(() => null)
  if (eltern !== null && isShadowTwinFolderName(eltern.metadata.name)) throw new Error(`Quelle liegt im Twin-Ordner "${eltern.metadata.name}" — uebergeben wird die QUELLE, nie ein Artefakt`)
  const groesse = typeof source.metadata.size === 'number' ? source.metadata.size : 0
  if (groesse > MAX_UEBERGABE_BYTES) throw new Error(`Zu gross fuer einen Aufruf (${Math.round(groesse / 1e6)} MB; Grenze 250 MB)`)
  const ziel = await nach.provider.getItemById(zielOrdnerId)
  if (ziel.type !== 'folder') throw new Error(`Ziel ${zielOrdnerId} ist kein Ordner`)
  if (isShadowTwinFolderName(ziel.metadata.name)) throw new Error(`Twin-Ordner "${ziel.metadata.name}" ist kein Ziel`)
  const name = source.metadata.name
  if ((await nach.provider.listItemsById(zielOrdnerId)).some((k) => k.metadata.name === name)) {
    throw new Error(`Am Ziel liegt bereits "${name}" — nichts uebergeben`)
  }
  const verweis = verweisDateiName(name)
  if ((await von.provider.listItemsById(source.parentId)).some((k) => k.metadata.name === verweis)) {
    throw new Error(`Im Herkunftsordner liegt bereits "${verweis}" — nichts uebergeben`)
  }
  if (args.herkunft === 'verwerfen' && eltern !== null && eltern.metadata.name.toLowerCase() === KLAER_ORDNER.toLowerCase()) {
    throw new Error(`Die Quelle liegt schon in „${KLAER_ORDNER}" — herkunft: behalten waehlen`)
  }
  const doc = await ports.ladeTwin(von.libraryId, sourceId)
  const ordnerPfad = pfadOhneRand(await nach.provider.getPathById(zielOrdnerId))
  const zielPfad = ordnerPfad === '' ? name : `${ordnerPfad}/${name}`
  let transformationen = 0
  for (const sprachen of Object.values(doc?.artifacts?.transformation ?? {})) transformationen += Object.keys(sprachen ?? {}).length
  const plan: TransferPlan = {
    quelle: { sourceId, name, pfad: pfadOhneRand(await von.provider.getPathById(sourceId)), groesse },
    ziel: { libraryName: nach.libraryName, ordnerPfad, pfad: zielPfad, adresse: ports.adresseInZiel(zielPfad) },
    familie: { twinDokument: doc !== null, transkript: doc?.artifacts?.transcript !== undefined, transformationen },
    verweisDatei: verweis,
    herkunft: args.herkunft,
  }
  return { plan, source, doc }
}

export async function uebergibFamilie(args: TransferArgs, ports: TransferPorts): Promise<TransferErgebnis> {
  const { von, nach, sourceId, zielOrdnerId, herkunft } = args
  const { plan, source, doc: docVorher } = await pruefe(args, ports)
  const offen = [
    `index_aktualisieren in „${nach.libraryName}" — Vektoren werden nie kopiert`,
    'Seitenbilder (falls die Quelle welche hatte) in der Ziel-Library neu erzeugen — Bildfragmente gehoeren der Herkunft',
    `in „${von.libraryName}" bleibt der Galerie-/Index-Eintrag stehen; bei Bedarf index_entfernen`,
  ]
  if (args.vorschau) return { plan, vorschau: true, schritte: [], neueSourceId: null, offen }

  const schritte: TransferSchritt[] = []
  const ende = (neueSourceId: string | null): TransferErgebnis => ({ plan, vorschau: false, schritte, neueSourceId, offen })

  // 2) Import in A: Spiegel-Stand sichern, dann frisch lesen.
  let doc = docVorher
  if (doc !== null) {
    await ports.importiere(von.libraryId, sourceId)
    doc = await ports.ladeTwin(von.libraryId, sourceId)
    schritte.push({ schritt: 'import_herkunft', status: 'ok' })
  } else {
    schritte.push({ schritt: 'import_herkunft', status: 'uebersprungen', detail: 'kein Twin-Dokument — nur die Datei wird uebergeben' })
  }

  // 3) Quelle A → B, Kennung aus demselben Blob.
  const { blob, mimeType } = await von.provider.getBinary(sourceId)
  const kennung = await quellkennungAusBlob(blob, ports.jetzt())
  const neu = await nach.provider.uploadFile(zielOrdnerId, new File([blob], source.metadata.name, { type: mimeType }))
  schritte.push({ schritt: 'quelle_kopiert', status: 'ok', detail: plan.ziel.pfad })

  // 4) Twin-Dokument in B — scheitert es, die eigene Kopie zurueckbauen.
  if (doc !== null) {
    try {
      await ports.legeTwinAn({ quelle: doc, nachLibraryId: nach.libraryId, sourceId: neu.id, sourceName: source.metadata.name, parentId: zielOrdnerId, quellkennung: kennung })
      schritte.push({ schritt: 'twin_angelegt', status: 'ok' })
    } catch (error) {
      const rueckbau = await nach.provider.deleteItem(neu.id).then(() => 'Kopie in der Ziel-Library wieder entfernt', (e: unknown) => `Kopie konnte NICHT entfernt werden (${text(e)}) — liegt unter ${plan.ziel.pfad}`)
      throw new Error(`Twin-Dokument in der Ziel-Library nicht angelegt: ${text(error)}. ${rueckbau}; die Herkunft ist unveraendert.`)
    }
  }

  // 5)–9): B ist ab hier vollstaendig; ein Fehler haelt die Kette an und wird genannt.
  const kette: Array<[string, () => Promise<string | undefined>]> = [
    ['segmente_kopiert', async () => (doc !== null && (await ports.kopiereSegmente(von.libraryId, sourceId, nach.libraryId, neu.id)) ? undefined : 'keine Segmente')],
    ['export_ziel', async () => { if (doc === null) return 'kein Twin-Dokument'; await ports.exportiere(nach.libraryId, neu.id); return undefined }],
    ['kennung_herkunft', async () => { if (doc === null) return 'kein Twin-Dokument'; await ports.setzeKennung(von.libraryId, sourceId, kennung); return undefined }],
    ['verweis_geschrieben', async () => {
      const md = baueVerweisMarkdown({
        sourceName: source.metadata.name, nachLibraryId: nach.libraryId, nachLibraryName: nach.libraryName,
        nachPfad: plan.ziel.pfad, adresse: plan.ziel.adresse, herkunft, quellkennung: kennung, jetzt: ports.jetzt(),
      })
      await von.provider.uploadFile(source.parentId, new File([md], plan.verweisDatei, { type: 'text/markdown' }))
      return undefined
    }],
    ['herkunft', async () => {
      if (herkunft === 'behalten') return 'behalten (Kopie bleibt neben dem Verweis)'
      const klaer = await ports.verwirf(sourceId)
      return `nach „${klaer.name}" verschoben`
    }],
  ]
  for (const [schritt, ausfuehren] of kette) {
    try {
      const detail = await ausfuehren()
      const uebersprungen = detail === 'keine Segmente' || detail === 'kein Twin-Dokument'
      schritte.push({ schritt, status: uebersprungen ? 'uebersprungen' : 'ok', ...(detail ? { detail } : {}) })
    } catch (error) {
      schritte.push({ schritt, status: 'fehler', detail: text(error) })
      offen.unshift(`Schritt ${schritt} ist gescheitert, die folgenden liefen nicht — Stand pruefen (twins_pruefen in beiden Libraries)`)
      return ende(neu.id)
    }
  }
  return ende(neu.id)
}
