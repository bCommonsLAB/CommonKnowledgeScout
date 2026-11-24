/**
 * @fileoverview Befunde eines Jobs statt stummem `completed` (Welle K3).
 *
 * @description
 * Ein Index-Lauf mit 0 von 58 Folienbildern, ohne Cover und ohne Anhaenge
 * war am 11.10.2026 `completed` — der Job hatte ja gearbeitet. Der Status
 * bleibt `completed` (Owner 12.10.: ein Befund ist ein Feld, keine neue
 * Statusart); diese Datei rechnet aus Schrittdetails und den Ereignissen der
 * Lesersicht (`job-ereignisse.ts`) eine Liste Klartext-Befunde. Leere Liste
 * heisst: nichts zu melden. Reine Funktion, keine Datenbank.
 *
 * @module mcp
 */

import type { ExternalJobStep } from '@/types/external-job'
import { coverQuelleAus, folienAus, type JobEreignis } from './job-ereignisse'
import { bilderAusSchritt, uebersprungenHinweis } from './job-schritte'

/** Mehr Namen sagen nichts Neues — die vollstaendige Liste steht am Schritt. */
const MAX_NAMEN = 10

function namenKurz(namen: readonly string[]): string {
  if (namen.length === 0) return ''
  const kopf = namen.slice(0, MAX_NAMEN).join(', ')
  return namen.length > MAX_NAMEN ? ` (${kopf}, … +${namen.length - MAX_NAMEN})` : ` (${kopf})`
}

/** Folien-Befund: Schrittdetails (`ingest_rag.slideImages`) vor Ereignissen, weil sie die Namen tragen. */
function folienBefund(steps: readonly ExternalJobStep[], ereignisse: readonly JobEreignis[]): string | null {
  const ingest = steps.find((s) => s.name === 'ingest_rag')
  const ausSchritt = ingest ? bilderAusSchritt(ingest) : undefined
  if (ausSchritt) {
    if (ausSchritt.unaufgeloest.length === 0) return null
    const gesamt = ausSchritt.aufgeloest + ausSchritt.unaufgeloest.length
    return `Folien: ${ausSchritt.unaufgeloest.length} von ${gesamt} ohne Adresse${namenKurz(ausSchritt.unaufgeloest)}`
  }
  const ausEreignis = folienAus(ereignisse)
  if (!ausEreignis || ausEreignis.unaufgeloest === 0) return null
  return `Folien: ${ausEreignis.unaufgeloest} von ${ausEreignis.aufgeloest + ausEreignis.unaufgeloest} ohne Adresse${namenKurz(ausEreignis.namen)}`
}

function coverBefund(ereignisse: readonly JobEreignis[]): string | null {
  const cover = coverQuelleAus(ereignisse)
  // own_fragment (2.51.0): Cover aus einem Bild-Fragment am eigenen Twin (Webseite als Quelle) — gueltige Herkunft.
  if (!cover || cover.quelle === 'slides' || cover.quelle === 'flyer' || cover.quelle === 'own_fragment') return null
  if (cover.quelle === 'none') return `Cover: keine Quelle${cover.grund ? ` (${cover.grund})` : ''}`
  return `Cover: unbekannte Herkunft "${cover.quelle}"`
}

function anhaengeBefund(ereignisse: readonly JobEreignis[]): string | null {
  const letzte = [...ereignisse].reverse().find((e) => e.name === 'attachments_source')
  if (!letzte) return null
  if (letzte.attribute['anzahl'] !== 0) return null
  return typeof letzte.attribute['grund'] === 'string'
    ? `Anhaenge: nicht gerechnet (${letzte.attribute['grund']})`
    : 'Anhaenge: keine PDF-Quelle unter den compositeSources der Sammeldatei gefunden'
}

function seitenbilderBefunde(ereignisse: readonly JobEreignis[]): string[] {
  const befunde: string[] = []
  for (const e of ereignisse) {
    if (e.name === 'extract_only_page_images_skipped') {
      befunde.push(`Seitenbilder: nicht registriert${typeof e.attribute['grund'] === 'string' ? ` (${e.attribute['grund']})` : ''}`)
    } else if (e.name === 'extract_only_page_images_error') {
      befunde.push(`Seitenbilder: Registrierung fehlgeschlagen${typeof e.attribute['message'] === 'string' ? ` (${e.attribute['message']})` : ''}`)
    } else if (e.name === 'extract_only_page_images_registered' && e.attribute['registriert'] === 0) {
      const gesehen = typeof e.attribute['twinItems'] === 'number' ? ` (${e.attribute['twinItems']} Dateien im Twin-Ordner gesehen)` : ''
      befunde.push(`Seitenbilder: keine aus dem Twin-Ordner registriert${gesehen}`)
    } else if (e.name === 'frontmatter_json_list_invalid') {
      befunde.push(`Frontmatter: Listenfeld als JSON-Text nicht lesbar${typeof e.attribute['message'] === 'string' ? ` — ${e.attribute['message']}` : ''}`)
    }
  }
  return befunde
}

/**
 * Befunde eines Jobs — Klartext, eine Zeile je Befund, leere Liste = nichts
 * zu melden. Der bisherige `nichtsGeschrieben`-Hinweis (Transformation oder
 * alles uebersprungen) steht hier mit drin und bleibt zusaetzlich als Feld.
 */
/** Welle K3 (Playlist-Lesejob): Schrittdetails `web_source.fehlgeschlagen` — Fehlschlaege je Video sind kein stummes completed. */
function webSourceBefund(steps: readonly ExternalJobStep[]): string | null {
  const d = steps.find((s) => s.name === 'web_source')?.details as { lesbar?: unknown; fehlgeschlagen?: unknown; ersterFehler?: unknown } | undefined
  if (!d || typeof d.fehlgeschlagen !== 'number' || d.fehlgeschlagen === 0) return null
  const lesbar = typeof d.lesbar === 'number' ? ` von ${d.lesbar}` : ''
  const grund = typeof d.ersterFehler === 'string' && d.ersterFehler ? ` (erster Fehler: ${d.ersterFehler.slice(0, 200)})` : ''
  return `Playlist: ${d.fehlgeschlagen}${lesbar} Videos nicht lesbar${grund}`
}

/** Template-Schritt: verworfene Facettenwerte (Trace-Attribut `verworfen`, im Log unter `details.verworfen`). */
function facettenBefunde(ereignisse: readonly JobEreignis[]): string[] {
  const befunde: string[] = []
  for (const e of ereignisse) {
    if (e.name !== 'facet_values_rejected') continue
    const details = e.attribute['details'] as { verworfen?: unknown } | undefined
    const liste = e.attribute['verworfen'] ?? details?.verworfen
    if (!Array.isArray(liste)) {
      befunde.push('Facetten: Werte ausserhalb des Woerterbuchs verworfen (Einzelheiten im Ereignis facet_values_rejected nicht lesbar)')
      continue
    }
    for (const eintrag of liste as Array<{ feld?: unknown; verworfen?: unknown }>) {
      const werte = Array.isArray(eintrag.verworfen) ? eintrag.verworfen.map((w) => String(w)) : []
      befunde.push(`Facette "${String(eintrag.feld)}": ${werte.length} Wert(e) ausserhalb des Woerterbuchs verworfen${namenKurz(werte)}`)
    }
  }
  return befunde
}

/** Template-Schritt: ueberschrittene Obergrenzen und nicht rechenbare Felder (Trace-Attribute, im Log unter `details`). */
function feldBefunde(ereignisse: readonly JobEreignis[]): string[] {
  const befunde: string[] = []
  for (const e of ereignisse) {
    if (e.name !== 'field_bindings_applied') continue
    const quelle = (e.attribute['details'] ?? e.attribute) as { grenzen?: unknown; nichtBerechenbar?: unknown }
    for (const g of (Array.isArray(quelle.grenzen) ? quelle.grenzen : []) as Array<{ feld?: unknown; art?: unknown; erlaubt?: unknown; erhalten?: unknown }>) {
      befunde.push(g.art === 'max'
        ? `Feld "${String(g.feld)}": ${String(g.erhalten)} Eintraege, erlaubt sind ${String(g.erlaubt)} — hinten gekuerzt`
        : `Feld "${String(g.feld)}": ${String(g.erhalten)} Woerter, erlaubt sind ${String(g.erlaubt)} — nicht gekuerzt`)
    }
    for (const n of (Array.isArray(quelle.nichtBerechenbar) ? quelle.nichtBerechenbar : []) as Array<{ feld?: unknown; grund?: unknown }>) {
      befunde.push(`Feld "${String(n.feld)}": nicht berechenbar, bleibt leer (${String(n.grund)})`)
    }
  }
  return befunde
}

export function befundeFuerJob(args: {
  status: string
  steps: ExternalJobStep[] | undefined
  ereignisse: readonly JobEreignis[]
}): string[] {
  const steps = args.steps ?? []
  const befunde: string[] = []
  const uebersprungen = uebersprungenHinweis({ status: args.status, steps })
  if (uebersprungen) befunde.push(uebersprungen)
  for (const b of [folienBefund(steps, args.ereignisse), coverBefund(args.ereignisse), anhaengeBefund(args.ereignisse), webSourceBefund(steps)]) {
    if (b) befunde.push(b)
  }
  befunde.push(...seitenbilderBefunde(args.ereignisse))
  befunde.push(...facettenBefunde(args.ereignisse))
  befunde.push(...feldBefunde(args.ereignisse))
  return befunde
}
