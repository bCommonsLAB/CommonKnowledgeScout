/**
 * @fileoverview Verweis-Datei einer uebergebenen Quelle (Wunschliste 8, W8-3) — pur.
 *
 * @description
 * Wird eine Quelle mit `familie_uebergeben` in eine andere Library gegeben,
 * bleibt im Herkunftsordner kein Loch, sondern eine Markdown-Datei mit
 * `type: verweis`: „Das Original liegt jetzt in Library X, Pfad Y". Damit
 * entsteht `quelle_verschwunden` bei einer BEABSICHTIGTEN Uebergabe gar nicht
 * erst, und ein Mensch, der den Ordner oeffnet, findet den Weg.
 *
 * **Name:** `Verweis – <Quellname>.md`. Bewusst NICHT `<Stamm>.verweis.md`:
 * Jede Markdown-Datei, die mit `<Stamm>.` beginnt, gilt als Geschwister-
 * Artefakt der Quelle (`selectSiblingArtifactFiles`) und wuerde beim
 * naechsten Import als Twin-Artefakt eingelesen.
 *
 * Frontmatter flach und Obsidian-kompatibel (`snake_case`, eine Ebene,
 * AGENTS.md), geschrieben mit `createMarkdownWithFrontmatter`. Die Adresse
 * `@<slug>/<pfad>` nennt nie eine Id; nur wenn die Ziel-Library keinen
 * gueltigen Slug hat, steht die Library-Id als Rueckfallebene im Feld
 * `uebergeben_nach_library_id` (benannt, nicht still).
 *
 * @module shadow-twin
 */

import { createMarkdownWithFrontmatter } from '@/lib/markdown/compose'
import type { Quellkennung } from './quellkennung'

export type Herkunft = 'behalten' | 'verwerfen'

/** Dateiname der Verweis-Datei — kein Geschwister-Artefakt der Quelle (siehe oben). */
export function verweisDateiName(sourceName: string): string {
  const name = sourceName.trim()
  if (name === '') throw new Error('verweisDateiName: Quellname ist leer')
  return `Verweis – ${name}.md`
}

export interface VerweisAngaben {
  sourceName: string
  nachLibraryId: string
  nachLibraryName: string
  /** Library-relativer Pfad der Quelle in der Ziel-Library. */
  nachPfad: string
  /** `@<slug>/<pfad>`; null = Ziel-Library ohne gueltigen Slug. */
  adresse: string | null
  herkunft: Herkunft
  quellkennung: Quellkennung
  /** ISO-Zeitpunkt der Uebergabe. */
  jetzt: string
}

const HERKUNFT_TEXT: Record<Herkunft, string> = {
  behalten: 'Die Datei bleibt auch hier liegen, als Kopie. Massgeblich ist das Original in der anderen Library.',
  verwerfen: 'Die Datei hier wurde mit ihren Auswertungen in den Unterordner „zu klären" verschoben; nichts wurde geloescht.',
}

export function baueVerweisMarkdown(a: VerweisAngaben): string {
  const tag = a.jetzt.slice(0, 10)
  const meta: Record<string, unknown> = {
    type: 'verweis',
    title: `Verweis: ${a.sourceName}`,
    source_file: a.sourceName,
    uebergeben_nach_library: a.nachLibraryName,
    uebergeben_nach_pfad: a.nachPfad,
    ...(a.adresse !== null ? { uebergeben_nach_adresse: a.adresse } : { uebergeben_nach_library_id: a.nachLibraryId }),
    uebergeben_am: tag,
    herkunft: a.herkunft,
    source_content_hash: a.quellkennung.sourceContentHash,
    generated_by: 'knowledgescout/familie_uebergeben',
    generated_at: a.jetzt,
  }
  const ziel = a.adresse !== null
    ? `[[${a.adresse}|${a.sourceName}]]`
    : `\`${a.nachPfad}\` (die Library hat keinen gueltigen Adress-Slug; adresse_setzen behebt das)`
  const body = [
    `# Verweis: ${a.sourceName}`,
    '',
    `Das Original liegt seit ${tag} in der Library „${a.nachLibraryName}": ${ziel}`,
    '',
    HERKUNFT_TEXT[a.herkunft],
    '',
  ].join('\n')
  return createMarkdownWithFrontmatter(body, meta)
}
