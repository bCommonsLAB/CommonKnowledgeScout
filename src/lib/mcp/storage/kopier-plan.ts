/**
 * @fileoverview Plan fuer `kopieren` (Handover Library-Anlage, W3): reine Auswahl.
 *
 * @description
 * Der Owner musste fuer den Neuaufbau einer Library den Rohquellen-Ordner von
 * Hand kopieren — samt Altlasten (`_`-Twin-Ordner, erzeugte `.md`-Seiten,
 * Dubletten). Dieser Plan entscheidet je Eintrag, ob er mitkommt:
 * - Twin-Ordner (`_…`) kommen NIE mit: sie stehen unter Schreibschutz, und
 *   eine Kopie waere ein veralteter Spiegel ohne Twin in MongoDB.
 * - `nurQuellen`: dazu test-Ordner (derselbe Zaun wie der Batch,
 *   `istVomBatchAusgeschlossen`) und `.md`-Dateien, die zu
 *   einer Quelle im selben Ordner gehoeren (`<Quelle>.<…>.md`, Spiegel der
 *   Transkripte und Transformationen).
 * - `ausschliessen`: Namen oder relative Pfade, die der Mensch nicht will.
 * Was draussen bleibt, steht mit Grund in der Antwort.
 *
 * @module mcp/storage
 */

import { istVomBatchAusgeschlossen } from '@/lib/pipeline/batch-zaun'
import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin'

export interface PlanEintrag {
  /** Pfad relativ zum kopierten Ordner (bei einer Datei: ihr Name). */
  relativ: string
  name: string
  typ: 'file' | 'folder'
  groesse: number
}

export interface Ausgelassen {
  relativ: string
  grund: string
}

function basis(name: string): string {
  const punkt = name.lastIndexOf('.')
  return punkt > 0 ? name.slice(0, punkt) : name
}

/**
 * Ist diese `.md` der Spiegel eines Artefakts einer Quelle im selben Ordner?
 * Regel: Name beginnt mit `<Basis der Quelle>.` und die Quelle ist selbst
 * keine `.md` (Sammeldateien und Notizen sind Quellen, keine Spiegel).
 */
export function istArtefaktSpiegel(name: string, geschwister: readonly string[]): boolean {
  if (!/\.md$/i.test(name)) return false
  return geschwister.some((anderer) => {
    if (anderer === name || /\.md$/i.test(anderer)) return false
    const quelle = basis(anderer)
    return quelle !== '' && name.startsWith(`${quelle}.`)
  })
}

function istAusgeschlossen(relativ: string, name: string, ausschliessen: readonly string[]): boolean {
  return ausschliessen.some((muster) => {
    const m = muster.replace(/^\/+|\/+$/g, '')
    return m === name || m === relativ || relativ.startsWith(`${m}/`)
  })
}

/** Auswahl in einem Ordner — Aufrufer geht rekursiv in die genommenen Unterordner. */
export function waehleImOrdner(args: {
  eltern: string
  eintraege: ReadonlyArray<{ name: string; typ: 'file' | 'folder'; groesse: number }>
  nurQuellen: boolean
  ausschliessen: readonly string[]
}): { nehmen: PlanEintrag[]; ausgelassen: Ausgelassen[] } {
  const namen = args.eintraege.map((e) => e.name)
  const nehmen: PlanEintrag[] = []
  const ausgelassen: Ausgelassen[] = []
  for (const e of args.eintraege) {
    const relativ = args.eltern ? `${args.eltern}/${e.name}` : e.name
    if (istAusgeschlossen(relativ, e.name, args.ausschliessen)) {
      ausgelassen.push({ relativ, grund: 'ausschliessen' })
    } else if (e.typ === 'folder' && isShadowTwinFolderName(e.name)) {
      ausgelassen.push({ relativ, grund: 'Twin-Ordner (immer; Schreibschutz, Twin lebt in MongoDB)' })
    } else if (args.nurQuellen && e.typ === 'folder' && istVomBatchAusgeschlossen(e.name)) {
      ausgelassen.push({ relativ, grund: 'test-Ordner (nurQuellen)' })
    } else if (args.nurQuellen && e.typ === 'file' && istArtefaktSpiegel(e.name, namen)) {
      ausgelassen.push({ relativ, grund: 'erzeugte Seite einer Quelle (nurQuellen)' })
    } else {
      nehmen.push({ relativ, name: e.name, typ: e.typ, groesse: e.groesse })
    }
  }
  return { nehmen, ausgelassen }
}
