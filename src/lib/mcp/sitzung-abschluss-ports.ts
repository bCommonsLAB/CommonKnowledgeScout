/**
 * @fileoverview Anschluesse von `sitzung_abschliessen` an Speicher, Register und Job (Register, Welle R4).
 *
 * @description
 * Verdrahtet die Ports aus `abschluss-dienst.ts` mit dem StorageProvider
 * (nur ueber das Interface, Storage-Abstraktion), dem Register-Repo und
 * `starteTransformation` (derselbe Weg wie `transformation_starten`, ohne
 * Ingest). Nicht-Finden wird zum benannten Fehler mit der Meldung des
 * Speichers; eine aktuelle Notiz (`TransformationAktuellError`) wird zur
 * Absage, nicht zum Fehler. Ersetzen geht nur versioniert — sonst Fehler.
 *
 * @module mcp
 */

import { SITZUNGS_SPRACHE, SITZUNGS_VORLAGE } from '@/lib/agent-view/sichten/sitzungen-types'
import type { AbschlussPorts } from '@/lib/agent-view/sitzungen-register/abschluss/abschluss-dienst'
import { SitzungsAbschlussError } from '@/lib/agent-view/sitzungen-register/abschluss/abschluss-typen'
import { meldeSitzungen, setzeSitzung } from '@/lib/agent-view/sitzungen-register/register-dienst'
import { aendereZeile, holeNachKennung, holeZeile } from '@/lib/repositories/agent-view-sitzungen-repo'
import { supportsVersioning, type StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { loeseAdresse } from './storage/adressierung'
import { pruefeSchreibschutz } from './storage/schreibschutz'
import { standardLlmModell } from './tools-erschliessen-shared'
import { vorlageAktualisiertAm } from './tools-vorlagen'
import { starteTransformation } from './transformation-start'
import { TransformationAktuellError } from './transformation-erzwingen'

const SYNC_HINWEIS = 'Gerade erst abgelegt? Dann ist die Datei vermutlich noch nicht synchronisiert — spaeter erneut aufrufen; das Werkzeug wartet nicht'

function nachricht(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function abschlussPorts(args: {
  library: Library
  userEmail: string
  provider: StorageProvider
  jetzt: () => string
}): AbschlussPorts {
  const { library, userEmail, provider } = args
  const libraryId = library.id
  const pfadVon = new Map<string, string>()

  return {
    speicher: {
      ordner: async (ref) => {
        try {
          const a = await loeseAdresse({ provider, ...('pfad' in ref ? { pfad: ref.pfad } : { id: ref.folderId }), erwartet: 'folder' })
          pfadVon.set(a.id, a.pfad)
          return { id: a.id, name: a.name, pfad: a.pfad }
        } catch (error) {
          throw new SitzungsAbschlussError('vorhaben_nicht_gefunden', nachricht(error))
        }
      },
      datei: async (ref) => {
        try {
          const a = await loeseAdresse({ provider, ...('pfad' in ref ? { pfad: ref.pfad } : { id: ref.sourceId }), erwartet: 'file' })
          const item = await provider.getItemById(a.id)
          return { id: item.id, parentId: item.parentId, name: item.metadata.name }
        } catch (error) {
          throw new SitzungsAbschlussError('beleg_nicht_gefunden', `${nachricht(error)} — ${SYNC_HINWEIS}`)
        }
      },
      dateiImOrdner: async (ordnerId, name) => {
        const item = (await provider.listItemsById(ordnerId)).find((k) => k.type === 'file' && k.metadata.name === name)
        return item === undefined ? null : { id: item.id, version: item.metadata.version ?? null }
      },
      lesen: async (id) => (await provider.getBinary(id)).blob.text(),
      anlegen: async (ordnerId, name, text) => {
        const ordnerPfad = pfadVon.get(ordnerId)
        if (ordnerPfad !== undefined) pruefeSchreibschutz(`${ordnerPfad}/${name}`, 'anlegen')
        const angelegt = await provider.uploadFile(ordnerId, new File([text], name, { type: 'text/markdown' }))
        return { id: angelegt.id }
      },
      ersetzen: async (id, text, version) => {
        if (!supportsVersioning(provider)) throw new Error(`Storage-Provider "${provider.name}" kann nicht versioniert ersetzen — nichts geschrieben`)
        if (version === null) throw new Error(`Version von ${id} unbekannt — ohne Version wird nicht ersetzt`)
        const r = await provider.updateFile(id, new Blob([text], { type: 'text/markdown' }), { ifVersion: version })
        return { id: r.id }
      },
    },
    register: {
      holeNachKennung: (sitzungId) => holeNachKennung(libraryId, sitzungId),
      holeZeile: (registerId) => holeZeile(libraryId, registerId),
      umschluesseln: async (registerId, sitzungId) => {
        const r = await setzeSitzung({ libraryId, registerId, eingabe: { sitzungId }, jetzt: args.jetzt() })
        return { zusammengefuehrt: r.zusammengefuehrt }
      },
      melden: async (eingabe) => {
        const [zeile] = await meldeSitzungen({ libraryId, eingaben: [eingabe], gemeldetVon: 'skill', jetzt: args.jetzt() })
        if (zeile?.aktion === undefined) throw new Error(`Melden von ${eingabe.sitzungId}: ${zeile?.fehler ?? 'keine Antwort'}`)
        return zeile.aktion
      },
      belegAnhaengen: async (sitzungId, sourceId) => {
        const doc = await holeNachKennung(libraryId, sitzungId)
        if (doc === null) throw new Error(`Register-Zeile ${sitzungId} fehlt nach dem Melden`)
        if (doc.belegSourceIds.includes(sourceId)) return false
        await aendereZeile(libraryId, doc.registerId, { set: { belegSourceIds: [...doc.belegSourceIds, sourceId], geaendertAm: args.jetzt() } })
        return true
      },
    },
    transformation: async (source, erzwingen) => {
      try {
        return await starteTransformation({
          library, libraryId, userEmail, provider,
          source: { itemId: source.id, parentId: source.parentId, name: source.name },
          template: SITZUNGS_VORLAGE,
          llmModel: standardLlmModell(library),
          zielsprache: SITZUNGS_SPRACHE,
          erzwingen,
          vorlageAktualisiertAm: await vorlageAktualisiertAm(libraryId, userEmail, SITZUNGS_VORLAGE),
          ingest: false,
        })
      } catch (error) {
        if (error instanceof TransformationAktuellError) return { abgesagt: error.message }
        throw error
      }
    },
  }
}
