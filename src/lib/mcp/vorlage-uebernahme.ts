/**
 * @fileoverview Vorlagen zwischen Libraries uebernehmen (Handover Library-Anlage, W2).
 *
 * @description
 * Vorlagen leben je Library in MongoDB (`templates`, `_id = <libraryId>:<name>`).
 * Eine Datei im Ordner `templates/` wirkt erst, wenn sie importiert wurde —
 * daher liefen im Brueckentest Mongo (07.10.) und Datei (05.10.) auseinander.
 * Zwei Quellen, ein Schreibweg:
 * - aus einer anderen Library (Mongo → Mongo), wie der Klon im Anlege-Dialog;
 * - aus einer Datei im Storage der Ziel-Library, wie der Import-Knopf
 *   (`template-import-export.ts`), aber mit Aktualisieren statt Abbruch,
 *   wenn `ueberschreiben` gesetzt ist.
 * Geschrieben wird ueber `saveTemplateToMongoDB`/`updateTemplateInMongoDB`,
 * also hinter demselben Konsistenz-Contract wie Formular und Import.
 *
 * @module mcp
 */

import type { StorageProvider } from '@/lib/storage/types'
import { parseTemplate } from '@/lib/templates/template-parser'
import { listTemplatesFromMongoDB, saveTemplateToMongoDB, updateTemplateInMongoDB } from '@/lib/templates/template-service-mongodb'
import type { TemplateDocument } from '@/lib/templates/template-types'
import { resolveItemByPath } from './resolve-folder'

/** Inhalt einer Vorlage ohne Kennung und Zeitstempel. */
type VorlagenInhalt = Pick<TemplateDocument, 'name' | 'metadata' | 'systemprompt' | 'markdownBody' | 'creation' | 'kind'>

export interface UebernahmeZeile {
  name: string
  aktion: 'angelegt' | 'aktualisiert'
  quelle: { art: 'library'; libraryId: string; stand: string | null } | { art: 'datei'; pfad: string; stand: string | null }
  felder: number
}

function standIso(wert: unknown): string | null {
  if (wert instanceof Date) return wert.toISOString()
  return typeof wert === 'string' && wert.trim() !== '' ? wert : null
}

function findeNachName(vorlagen: TemplateDocument[], name: string): TemplateDocument | undefined {
  return vorlagen.find((v) => v.name.toLowerCase() === name.toLowerCase())
}

/** Legt an oder aktualisiert (nur mit `ueberschreiben`) — wirft, wenn die Vorlage schon da ist. */
async function schreibeVorlage(args: {
  inhalt: VorlagenInhalt
  zielLibraryId: string
  userEmail: string
  ueberschreiben: boolean
  zielBestand: TemplateDocument[]
}): Promise<'angelegt' | 'aktualisiert'> {
  const vorhanden = findeNachName(args.zielBestand, args.inhalt.name)
  const { name, metadata, systemprompt, markdownBody, creation, kind } = args.inhalt
  if (!vorhanden) {
    await saveTemplateToMongoDB({
      name, libraryId: args.zielLibraryId, user: args.userEmail, metadata, systemprompt, markdownBody,
      ...(creation ? { creation } : {}), ...(kind ? { kind } : {}),
    })
    return 'angelegt'
  }
  if (!args.ueberschreiben) {
    throw new Error(`Vorlage "${vorhanden.name}" gibt es in der Ziel-Library schon (Stand ${standIso(vorhanden.updatedAt) ?? 'unbekannt'}) — ueberschreiben: true setzen, um sie zu ersetzen`)
  }
  const ergebnis = await updateTemplateInMongoDB(vorhanden.name, args.zielLibraryId, {
    metadata, systemprompt, markdownBody, ...(creation ? { creation } : {}),
  }, args.userEmail)
  if (!ergebnis) throw new Error(`Vorlage "${vorhanden.name}" konnte nicht aktualisiert werden`)
  return 'aktualisiert'
}

/** Vorlagen einer anderen Library uebernehmen; ohne `namen` alle Schema-Vorlagen. Fehler je Zeile. */
export async function uebernimmAusLibrary(args: {
  vonLibraryId: string
  zielLibraryId: string
  userEmail: string
  namen?: string[]
  ueberschreiben: boolean
}): Promise<Array<UebernahmeZeile | { name: string; fehler: string }>> {
  if (args.vonLibraryId === args.zielLibraryId) throw new Error('Quell- und Ziel-Library sind dieselbe')
  const quelle = (await listTemplatesFromMongoDB(args.vonLibraryId, args.userEmail)).filter((v) => v.libraryId === args.vonLibraryId)
  const zielBestand = (await listTemplatesFromMongoDB(args.zielLibraryId, args.userEmail)).filter((v) => v.libraryId === args.zielLibraryId)
  const auswahl = args.namen && args.namen.length > 0 ? args.namen : quelle.map((v) => v.name)
  const zeilen: Array<UebernahmeZeile | { name: string; fehler: string }> = []
  for (const name of auswahl) {
    const vorlage = findeNachName(quelle, name)
    if (!vorlage) {
      zeilen.push({ name, fehler: `Nicht in Library ${args.vonLibraryId} — vorhanden: ${quelle.map((v) => v.name).join(', ') || '(keine)'}` })
      continue
    }
    try {
      const aktion = await schreibeVorlage({ inhalt: vorlage, zielLibraryId: args.zielLibraryId, userEmail: args.userEmail, ueberschreiben: args.ueberschreiben, zielBestand })
      zeilen.push({
        name: vorlage.name, aktion, felder: vorlage.metadata?.fields?.length ?? 0,
        quelle: { art: 'library', libraryId: args.vonLibraryId, stand: standIso(vorlage.updatedAt) },
      })
    } catch (error) {
      zeilen.push({ name: vorlage.name, fehler: error instanceof Error ? error.message : String(error) })
    }
  }
  return zeilen
}

/** Eine Vorlagen-Datei aus dem Storage der Ziel-Library nach MongoDB uebernehmen. */
export async function uebernimmAusDatei(args: {
  provider: StorageProvider
  pfad: string
  zielLibraryId: string
  userEmail: string
  ueberschreiben: boolean
}): Promise<UebernahmeZeile> {
  const item = await resolveItemByPath(args.provider, args.pfad, 'file')
  if (!item.name.toLowerCase().endsWith('.md')) throw new Error(`Vorlagen-Dateien sind Markdown (.md) — "${item.name}" ist keine`)
  const name = item.name.replace(/\.md$/i, '')
  const { blob } = await args.provider.getBinary(item.id)
  const { template, errors } = parseTemplate(await blob.text(), name)
  if (errors.length > 0) {
    throw new Error(`Vorlage "${name}" laesst sich nicht lesen: ${errors.map((e) => e.message).join('; ')}`)
  }
  const zielBestand = (await listTemplatesFromMongoDB(args.zielLibraryId, args.userEmail)).filter((v) => v.libraryId === args.zielLibraryId)
  const aktion = await schreibeVorlage({
    inhalt: { name: template.name, metadata: template.metadata, systemprompt: template.systemprompt, markdownBody: template.markdownBody, creation: template.creation },
    zielLibraryId: args.zielLibraryId, userEmail: args.userEmail, ueberschreiben: args.ueberschreiben, zielBestand,
  })
  const meta = await args.provider.getItemById(item.id)
  return {
    name: template.name, aktion, felder: template.metadata?.fields?.length ?? 0,
    quelle: { art: 'datei', pfad: args.pfad, stand: standIso(meta.metadata.modifiedAt) },
  }
}
