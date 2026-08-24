/**
 * @fileoverview Stand setzen — Port-Verdrahtung fuer beide Aufrufer (F8).
 *
 * @description
 * `setzeStand` ist provider-frei (Ports, `storage-abstraction.mdc`). Die
 * Verdrahtung dieser Ports gegen einen echten `StorageProvider` stand bisher
 * nur in der Agentensicht-Route — die MCP-Bruecke hatte gar keinen Weg und
 * schrieb `bearbeitungsstand` an den vier Schutzstufen VORBEI (ueber die
 * Datei-Bridge, Live-Befund 24.08.2026). Dieses Modul ist der eine Weg: beide
 * Aufrufer bekommen dieselben Stufen, dieselbe Frontmatter-Chirurgie und
 * denselben Wiederherstellungs-Pfad.
 *
 * @module agent-view
 */

import type { StorageProvider } from '@/lib/storage/types'
import { scanLibraryCoverage } from './run-coverage-scan'
import type { StandRequest } from './stand-plan'
import { setzeStand, type StandErgebnis } from './stand-schreiben'

export interface StandAusfuehrenArgs {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  request: StandRequest
  /** `generatedAt` des gespeicherten Reports; null = noch nie gescannt. */
  gespeicherterGeneratedAt: string | null
}

/**
 * Fuehrt die Stand-Schreiboperation mit echten Storage-Ports aus. Der
 * Teilbaum-Scan der Stufe 4 wird frisch gerechnet und NIE gespeichert
 * (§F10: Rechnung ≠ Cache).
 */
export async function fuehreStandAus(
  args: StandAusfuehrenArgs,
): Promise<StandErgebnis> {
  const { libraryId, userEmail, provider, request } = args
  return setzeStand(
    {
      request,
      gespeicherterGeneratedAt: args.gespeicherterGeneratedAt,
      scanTeilbaum: async () =>
        (await scanLibraryCoverage({ libraryId, userEmail, folderId: request.folderId })).gaps,
      now: () => new Date().toISOString(),
    },
    {
      listFolder: (id) => provider.listItemsById(id),
      readText: async (id) => (await provider.getBinary(id)).blob.text(),
      deleteFile: (id) => provider.deleteItem(id),
      uploadMarkdown: async (folderId, name, content) => {
        const uploaded = await provider.uploadFile(
          folderId,
          new File([content], name, { type: 'text/markdown' }),
        )
        return { fileId: uploaded.id }
      },
      folderName: async () => {
        try {
          return (await provider.getItemById(request.folderId)).metadata.name
        } catch {
          // Lookup dient nur der Anzeige — scheitert er, ist die Id die beste Aussage.
          return request.folderId
        }
      },
    },
  )
}
