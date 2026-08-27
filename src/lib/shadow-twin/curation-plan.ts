/**
 * @fileoverview Kurations-Patch — reine Entscheidungslogik (Twin-Datei-Contract §4).
 *
 * @description
 * Baut den Feld-Patch fuer die Kurations-Route und prueft die Contract-Regeln,
 * BEVOR geschrieben wird:
 *
 * - Nur Kurations-Felder sind patchbar; `verified_by`/`verified_at` stempelt
 *   ausschliesslich der Server ueber die Verify-Aktion („Kern setzt der
 *   Writer, nicht das LLM" — §4.1). Unbekannte Frontmatter-Felder und der
 *   Body bleiben erhalten, weil der eigentliche Schreibvorgang ueber
 *   `patchFrontmatter` laeuft (§4.2).
 * - Invariante §3.2: niemand verifiziert die eigene Generierung
 *   (Actor-Ebene, {@link actorLevel}).
 * - Spiegel-Drift-Guard §4.3: weicht der Filesystem-Spiegel vom Mongo-Stand
 *   ab, wird NICHT geschrieben — Befund „erst importieren" statt stillem
 *   Ueberschreiben (dieselbe Gleichheit wie der Engine-Konfliktvergleich).
 *
 * Reine Funktionen + typisierte Fehler, kein I/O — die Verdrahtung liegt in
 * `curation-patch.ts`.
 *
 * @module shadow-twin
 */

import { normalizeMarkdownForComparison } from './sync-plan/plan-transformation-sync'
import { TWIN_STATUS_VALUES, actorLevel, type TwinStatus } from './twin-core-fields'

/** Eingabefehler des Aufrufers (Route antwortet 400). */
export class CurationValidationError extends Error {
  readonly code = 'invalid_request' as const
}

/** Verstoss gegen die Selbst-Verifikations-Invariante §3.2 (Route: 409). */
export class SelfVerificationError extends Error {
  readonly code = 'self_verified' as const
}

/** Spiegel weicht vom Mongo-Stand ab — erst importieren (Route: 409). */
export class MirrorDriftError extends Error {
  readonly code = 'mirror_drift' as const
  constructor(mirrorFileName: string) {
    super(
      `Spiegel-Datei „${mirrorFileName}" weicht vom MongoDB-Stand ab — ` +
        'erst importieren („Pruefen" ausfuehren), dann kuratieren. Nichts wurde ueberschrieben.',
    )
  }
}

/** Zielartefakt existiert nicht (Route: 404). */
export class CurationArtifactNotFoundError extends Error {
  readonly code = 'artifact_not_found' as const
}

/** Obergrenze der Markierungs-Notiz — eine Zeile, kein Aufsatz. */
export const MAX_NOTIZ_LAENGE = 280

/** Actor-Schreibweise fuer eine Hand-Kuration (OKF: `human:<id>`, Contract §3.1). */
export function humanActor(userEmail: string): string {
  const trimmed = userEmail.trim()
  if (trimmed === '') throw new CurationValidationError('User-Email fehlt fuer verified_by')
  return `human:${trimmed}`
}

/** Fehler-Markierung des Menschen (ADR 0006) — Notiz ist PFLICHT. */
export interface FehlerMarkierung {
  notiz: string
}

export interface BuildCurationPatchesArgs {
  /** Feld-Patch aus dem Request — erlaubt ist NUR `twin_status`. */
  set?: Record<string, unknown> | null
  /** Verify-Aktion: Server stempelt `verified_by` + `verified_at`. */
  verify: boolean
  /**
   * Markier-Aktion (ADR 0006): Server stempelt `twin_status: flagged` +
   * `flagged_by`/`flagged_at`, die Notiz kommt vom Aufrufer.
   */
  markiere?: FehlerMarkierung | null
  /** `twin_status` des Zielartefakts VOR dem Patch (fuer das Aufloesen). */
  aktuellerTwinStatus?: unknown
  /**
   * Verifikation zuruecknehmen (ADR 0006, Uebergang): `verified_by` und
   * `verified_at` fallen weg. Gedacht fuer Stempel aus Sammelaktionen, die
   * unter der neuen Bedeutung etwas Unwahres behaupten — nicht fuer den
   * Alltag, darum ohne Knopf in der Oberflaeche.
   */
  entferneVerifikation?: boolean
  /** Email des angemeldeten Users (wird zu `human:<email>`). */
  userEmail: string
  /** `generated_by` des Zielartefakts (Invariante §3.2). */
  generatedBy: unknown
  /** Zeitstempel der Kurations-Aktion (ISO). */
  now: string
}

/** Notiz der Fehler-Markierung: nicht leer, eine Zeile, begrenzte Laenge. */
function parseNotiz(value: unknown): string {
  const notiz = typeof value === 'string' ? value.trim() : ''
  if (notiz === '') {
    throw new CurationValidationError(
      'Fehler-Markierung ohne Notiz: bitte in einem Satz sagen, was nicht stimmt — ' +
        'sie sperrt die Abnahme, und wer sie spaeter aufloest, muss den Grund kennen (ADR 0006)',
    )
  }
  if (notiz.length > MAX_NOTIZ_LAENGE) {
    throw new CurationValidationError(
      `Notiz zu lang (${notiz.length} Zeichen, erlaubt ${MAX_NOTIZ_LAENGE}) — eine Zeile genuegt`,
    )
  }
  // Frontmatter bleibt flach und einzeilig (AGENTS.md): Umbrueche zu Leerzeichen.
  return notiz.replace(/\s+/g, ' ')
}

function parseTwinStatus(value: unknown): TwinStatus {
  if (typeof value === 'string' && (TWIN_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as TwinStatus
  }
  throw new CurationValidationError(
    `Ungueltiger twin_status: ${JSON.stringify(value)} — erlaubt: ${TWIN_STATUS_VALUES.join(', ')}`,
  )
}

/**
 * Baut den Frontmatter-Patch einer Kurations-Aktion. Wirft bei leerem Patch,
 * fremden Feldern, ungueltigem Status oder Selbst-Verifikation — es gibt
 * keinen stillen Teil-Erfolg.
 */
export function buildCurationPatches(args: BuildCurationPatchesArgs): Record<string, unknown> {
  const patches: Record<string, unknown> = {}

  const set = args.set ?? {}
  const unknownKeys = Object.keys(set).filter((key) => key !== 'twin_status')
  if (unknownKeys.length > 0) {
    throw new CurationValidationError(
      `Nicht kuratierbare Felder im Patch: ${unknownKeys.join(', ')} — ` +
        'erlaubt ist twin_status; verified_by/verified_at setzt nur die Verify-Aktion',
    )
  }
  if ('twin_status' in set) {
    const status = parseTwinStatus(set.twin_status)
    if (status === 'flagged') {
      throw new CurationValidationError(
        'twin_status „flagged" wird nicht direkt gesetzt — dafuer gibt es die ' +
          'Markier-Aktion (`markiere`), die Urheber, Zeit und Notiz mitstempelt',
      )
    }
    patches.twin_status = status
  }

  if (args.markiere != null && args.verify) {
    throw new CurationValidationError(
      'Markieren und Verifizieren zugleich ergibt keinen Sinn — entweder ist etwas falsch oder geprueft',
    )
  }

  if (args.entferneVerifikation === true) {
    if (args.verify || args.markiere != null) {
      throw new CurationValidationError(
        'Verifikation zuruecknehmen laesst sich nicht mit Verifizieren oder Markieren verbinden',
      )
    }
    patches.verified_by = null
    patches.verified_at = null
  }

  if (args.markiere != null) {
    patches.twin_status = 'flagged' satisfies TwinStatus
    patches.flagged_by = humanActor(args.userEmail)
    patches.flagged_at = args.now
    patches.flagged_note = parseNotiz(args.markiere.notiz)
  }

  if (args.verify) {
    const verifier = humanActor(args.userEmail)
    const generatedLevel = actorLevel(args.generatedBy)
    if (generatedLevel !== null && generatedLevel === actorLevel(verifier)) {
      throw new SelfVerificationError(
        `Verifikation abgelehnt: generated_by und verified_by waeren derselbe Akteur (${generatedLevel}) — ` +
          'niemand verifiziert die eigene Generierung (Contract §3.2)',
      )
    }
    patches.verified_by = verifier
    patches.verified_at = args.now
    // ADR 0006: Verifizieren loest eine Fehler-Markierung auf — der Widerstand
    // ist geklaert. `null` entfernt das Feld (patchFrontmatter laesst es weg).
    // Ein ausdruecklich mitgesetzter twin_status hat Vorrang, kein Ueberschreiben.
    if (args.aktuellerTwinStatus === 'flagged' && !('twin_status' in set)) {
      patches.twin_status = null
      patches.flagged_by = null
      patches.flagged_at = null
      patches.flagged_note = null
    }
  }

  if (Object.keys(patches).length === 0) {
    throw new CurationValidationError(
      'Leerer Kurations-Patch: weder twin_status noch verify, markiere oder entferneVerifikation angegeben',
    )
  }
  return patches
}

/**
 * Spiegel-Drift-Pruefung (Contract §4.3): true, wenn der Spiegel einen
 * anderen Stand traegt als MongoDB. Kein Spiegel (null) ist KEIN Drift —
 * der naechste Export erzeugt ihn.
 */
export function hasMirrorDrift(args: { mongoMarkdown: string; mirrorMarkdown: string | null }): boolean {
  if (args.mirrorMarkdown === null) return false
  return (
    normalizeMarkdownForComparison(args.mirrorMarkdown) !==
    normalizeMarkdownForComparison(args.mongoMarkdown)
  )
}

/** Zielartefakt einer Kurations-Aktion — exakt, ohne „latest/best"-Raten. */
export interface CurationArtifactRef {
  kind: 'transcript' | 'transformation'
  /** Zielsprache; beim (sprachneutralen) Transkript leer. */
  targetLanguage: string
  /** PFLICHT bei Transformation (ArtifactKey-Contract), sonst verboten. */
  templateName?: string
}

/** Validiert die Artefakt-Referenz aus dem Request (Route: 400 bei Verstoss). */
export function parseCurationArtifactRef(value: unknown): CurationArtifactRef {
  if (!value || typeof value !== 'object') {
    throw new CurationValidationError('artifact fehlt: { kind, targetLanguage, templateName? } erwartet')
  }
  const raw = value as Record<string, unknown>
  const kind = raw.kind
  if (kind !== 'transcript' && kind !== 'transformation') {
    throw new CurationValidationError(`Ungueltiger artifact.kind: ${JSON.stringify(kind)}`)
  }
  const targetLanguage = typeof raw.targetLanguage === 'string' ? raw.targetLanguage.trim() : ''
  const templateName = typeof raw.templateName === 'string' && raw.templateName.trim() !== ''
    ? raw.templateName.trim()
    : undefined
  if (kind === 'transformation' && !templateName) {
    throw new CurationValidationError('artifact.templateName ist PFLICHT bei Transformationen (kein Raten)')
  }
  if (kind === 'transcript' && templateName) {
    throw new CurationValidationError('artifact.templateName ist bei Transkripten verboten')
  }
  if (kind === 'transformation' && targetLanguage === '') {
    throw new CurationValidationError('artifact.targetLanguage ist PFLICHT bei Transformationen')
  }
  return { kind, targetLanguage, templateName }
}
