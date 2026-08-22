/**
 * @fileoverview Erschliessungs-Block fuer `_INDEX.md` (Wunschliste 2, W5b).
 *
 * @description
 * Abloesung von `Organisation/Tools/erschliessung.py`: Fuer jeden Ordner mit
 * `_INDEX.md` wird je Quelle im Teilbaum (ohne Teilbaeume mit eigenem Index,
 * ohne `_`-Twin-Ordner) die Stufe bestimmt — offen / teil-erschlossen
 * (nur Transkript) / erschlossen (Transformation) — aus den Twin-Familien in
 * Mongo (Wahrheit), nicht mehr aus Dateinamen auf der Platte. Der Block steht
 * zwischen den Markern des Skripts und wird ersetzt; der Rest des `_INDEX.md`
 * bleibt unberuehrt (Entscheid Peter 2026-08-22: KS schreibt NUR diesen Block).
 * Reine Funktionen, kein I/O.
 *
 * @module agent-view
 */

import type { ArchiveFolderNode } from './archive-types'
import type { RawTwinFamily } from './coverage-inputs'
import { artDerDatei, erschliessungDerFamilie } from './aenderungen-seit'

export const BLOCK_START = '<!-- erschliessung:start -->'
export const BLOCK_END = '<!-- erschliessung:end -->'
const MAX_LISTE = 20

export interface IndexBlock {
  folderId: string
  path: string
  quellen: number
  erschlossen: number
  teil: number
  offen: number
  block: string
}

/** Naechster Index-Ordner (Ordner selbst oder Vorfahre mit `_INDEX.md`); null = keiner. */
function indexOwner(folder: ArchiveFolderNode, byId: ReadonlyMap<string, ArchiveFolderNode>): string | null {
  let current: ArchiveFolderNode | undefined = folder
  while (current) {
    if (current.index) return current.folderId
    current = current.parentFolderId === null ? undefined : byId.get(current.parentFolderId)
  }
  return null
}

function stufe(erschliessung: ReturnType<typeof erschliessungDerFamilie>): 'erschlossen' | 'teil' | 'offen' {
  if (erschliessung === 'transformation') return 'erschlossen'
  if (erschliessung === 'transkript') return 'teil'
  return 'offen'
}

/** Baut je Index-Ordner den Block (nur fuer Ordner MIT `_INDEX.md`). */
export function erschliessungsBloecke(args: {
  folders: readonly ArchiveFolderNode[]
  families: readonly RawTwinFamily[]
  heute: string
}): IndexBlock[] {
  const byId = new Map(args.folders.map((f) => [f.folderId, f]))
  const bySource = new Map(args.families.map((f) => [f.sourceId, f]))
  const quellenJeIndex = new Map<string, Array<{ rel: string; stufe: 'erschlossen' | 'teil' | 'offen' }>>()

  for (const folder of args.folders) {
    const owner = indexOwner(folder, byId)
    if (owner === null) continue
    const ownerPath = byId.get(owner)?.path ?? ''
    for (const file of folder.files) {
      if (artDerDatei(file.name) !== 'quelle') continue
      const rel = ownerPath && file.path.startsWith(`${ownerPath}/`) ? file.path.slice(ownerPath.length + 1) : file.path
      const list = quellenJeIndex.get(owner) ?? []
      list.push({ rel, stufe: stufe(erschliessungDerFamilie(bySource.get(file.fileId))) })
      quellenJeIndex.set(owner, list)
    }
  }

  return args.folders
    .filter((f) => f.index)
    .map((f) => {
      const quellen = (quellenJeIndex.get(f.folderId) ?? []).sort((a, b) => a.rel.localeCompare(b.rel))
      const offen = quellen.filter((q) => q.stufe === 'offen')
      const teil = quellen.filter((q) => q.stufe === 'teil')
      const erschlossen = quellen.length - offen.length - teil.length
      const liste = (eintraege: typeof quellen) => [
        ...eintraege.slice(0, MAX_LISTE).map((q) => `- [ ] ${q.rel}`),
        ...(eintraege.length > MAX_LISTE ? [`- … und ${eintraege.length - MAX_LISTE} weitere`] : []),
      ]
      const z = [BLOCK_START, '## Erschließung (erzeugt)', '']
      z.push(`Stand ${args.heute} — erzeugt von KnowledgeScout (\`erschliessung_block_schreiben\`), nicht von Hand pflegen.`, '')
      if (quellen.length === 0) {
        z.push('Keine Quelldateien in diesem Teilbaum.')
      } else {
        z.push(`**${quellen.length} Quellen: ${erschlossen} erschlossen (Transformation vorhanden), ${teil.length} teil-erschlossen (nur Transkript), ${offen.length} offen.**`)
        if (offen.length > 0) z.push('', 'Offen (kein Transkript):', '', ...liste(offen))
        if (teil.length > 0) z.push('', 'Teil-erschlossen (Transformation fehlt):', '', ...liste(teil))
      }
      z.push(BLOCK_END)
      return { folderId: f.folderId, path: f.path, quellen: quellen.length, erschlossen, teil: teil.length, offen: offen.length, block: z.join('\n') }
    })
}

/** Ersetzt den Block zwischen den Markern (oder haengt ihn an); wirft bei Start ohne Ende. */
export function indexMitBlock(text: string, block: string): string {
  if (text.includes(BLOCK_START)) {
    if (!text.includes(BLOCK_END)) throw new Error('Start-Marker ohne Ende-Marker im _INDEX.md')
    const [vorher, rest] = text.split(BLOCK_START, 2)
    const nachher = rest.split(BLOCK_END, 2)[1] ?? ''
    return vorher + block + nachher
  }
  return `${text.replace(/\n+$/, '')}\n\n${block}\n`
}
