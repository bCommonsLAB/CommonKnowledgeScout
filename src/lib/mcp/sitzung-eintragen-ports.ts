/**
 * @fileoverview Anschluesse von `sitzung_eintragen` an Speicher, Register und Mongo (Register, Welle R4b).
 *
 * @description
 * Verdrahtet die Ports aus `eintragen-dienst.ts` — Speicher nur ueber das
 * `StorageProvider`-Interface (Storage-Abstraktion). Pfade kommen aus
 * `getPathById` (library-relativ wie im Scan), damit Abschnitte der Chronik
 * und der Ablage-Cache des Registers dieselben Namen tragen wie im vollen
 * Lauf. Gelesen wird Version vor Inhalt, geschrieben nur mit `ifVersion` —
 * ein Schreiber dazwischen laesst den Aufruf scheitern statt ihn zu ueberschreiben.
 *
 * @module mcp
 */

import { BERICHT_FILE_NAME } from '@/lib/agent-view/archive-scan'
import { toIso } from '@/lib/agent-view/archive-scan-readers'
import { SITZUNGEN_FILE_NAME, SITZUNGS_SPRACHE, SITZUNGS_VORLAGE } from '@/lib/agent-view/sichten/sitzungen-types'
import { SICHTEN_ORDNER } from '@/lib/agent-view/sichten/types'
import type { EintragPorts } from '@/lib/agent-view/sitzungen-register/eintragen/eintragen-typen'
import { registerNachLauf } from '@/lib/agent-view/sitzungen-register/register-dienst'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { holeNachKennung } from '@/lib/repositories/agent-view-sitzungen-repo'
import { findeTransformationenNachVorlage, setzeQuellFrontmatter } from '@/lib/repositories/shadow-twin-transformationen'
import { supportsVersioning, type StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { FolderPathNotFoundError } from './resolve-folder'
import { loeseAdresse } from './storage/adressierung'

export function eintragPorts(args: { library: Library; provider: StorageProvider }): EintragPorts {
  const { provider } = args
  const libraryId = args.library.id

  async function adresse(pfad: string, erwartet: 'file' | 'folder') {
    try {
      return await loeseAdresse({ provider, pfad, erwartet })
    } catch (error) {
      if (error instanceof FolderPathNotFoundError) return null
      throw error
    }
  }

  return {
    register: {
      holeNachKennung: (sitzungId) => holeNachKennung(libraryId, sitzungId),
      // Pfade aus getPathById sind library-relativ — der Ablage-Cache darf geschrieben werden.
      nachLauf: ({ zeilen, sitzungen, berichtet, art }) =>
        registerNachLauf({ libraryId, zeilen, sitzungen, berichtet, art, ablageSchreiben: true, jetzt: new Date().toISOString() }),
    },
    notizen: (sourceIds) =>
      findeTransformationenNachVorlage({ libraryId, template: SITZUNGS_VORLAGE, language: SITZUNGS_SPRACHE, sourceIds }),
    belegKopf: async (sourceId) => {
      const item = await provider.getItemById(sourceId)
      const { meta } = parseFrontmatter(await (await provider.getBinary(sourceId)).blob.text())
      const modifiedAt = toIso(item.metadata.modifiedAt)
      await setzeQuellFrontmatter({ libraryId, sourceId, fields: meta, sourceModifiedAt: modifiedAt })
      return { fields: meta, modifiedAt }
    },
    ordner: {
      nachId: async (id) => {
        const a = await loeseAdresse({ provider, id, erwartet: 'folder' })
        return { id: a.id, pfad: a.pfad, name: a.name }
      },
      nachPfad: async (pfad) => {
        const gefunden = await adresse(pfad, 'folder')
        if (gefunden === null) return null
        // Der Speicher nennt den Pfad, wie er wirklich heisst (Gross/Klein) — der volle Lauf vergleicht genau.
        const a = await loeseAdresse({ provider, id: gefunden.id, erwartet: 'folder' })
        return { id: a.id, pfad: a.pfad, name: a.name }
      },
      bericht: async (ordnerId) => {
        const treffer = (await provider.listItemsById(ordnerId)).find((k) => k.type === 'file' && k.metadata.name === BERICHT_FILE_NAME)
        return treffer === undefined ? null : treffer.id
      },
    },
    chronik: async () => {
      const a = await adresse(`${SICHTEN_ORDNER}/${SITZUNGEN_FILE_NAME}`, 'file')
      return a === null ? null : a.id
    },
    datei: {
      lesen: async (id) => {
        const item = await provider.getItemById(id)
        const text = await (await provider.getBinary(id)).blob.text()
        return { text, version: item.metadata.version ?? null }
      },
      ersetzen: async (id, text, version) => {
        if (!supportsVersioning(provider)) throw new Error(`Storage-Provider "${provider.name}" kann nicht versioniert ersetzen — nichts geschrieben`)
        if (version === null) throw new Error(`Version von ${id} unbekannt — ohne Version wird nicht ersetzt`)
        await provider.updateFile(id, new Blob([text], { type: 'text/markdown' }), { ifVersion: version })
      },
    },
    jetzt: () => new Date(),
  }
}
