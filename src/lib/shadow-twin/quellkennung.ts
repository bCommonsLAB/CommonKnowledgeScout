/**
 * @fileoverview Quellkennung (Wunschliste 8, W8-1): Inhaltshash der Quelldatei — pur.
 *
 * @description
 * Dieselbe Datei hat in zwei Libraries zwei Storage-Ids (OneDrive-Id,
 * Nextcloud-Pfad-Id), und nichts verbindet sie. Die Quellkennung ist das
 * Merkmal, das in beiden gleich ist: SHA-256 ueber den Inhalt, dazu die
 * Groesse und der Zeitpunkt der Berechnung. Sie ist WIEDERERKENNUNG ueber
 * Library-Grenzen, kein Schluessel — Identitaet innerhalb einer Library bleibt
 * die Provider-Id (`docs/concepts/bruchstellen-katalog.md` §2).
 *
 * Das Feld heisst `sourceContentHash`, nicht `sourceHash`:
 * `binaryFragments[].sourceHash` bedeutet schon „Hash des Originalbilds eines
 * Thumbnails" (`thumbnail-repair-service.ts`).
 *
 * Gerechnet wird in der Start-Route aus dem Blob, der ohnehin zum Secretary
 * geht (kein zweites Lesen), am Job gemerkt und beim Abschluss ans
 * Twin-Dokument geschrieben (`finalize-completion.ts`). Reine Funktionen.
 *
 * @module shadow-twin
 */

import { createHash } from 'node:crypto'

/** Die drei Felder am Twin-Dokument (Contract `shadow-twin-contracts.md` §9). */
export interface Quellkennung {
  /** SHA-256 ueber den Dateiinhalt, hex, Kleinbuchstaben. */
  sourceContentHash: string
  /** Groesse in Bytes, wie gehasht. */
  sourceSize: number
  /** Zeitpunkt der Berechnung (ISO) — nicht der Dateizeitstempel. */
  sourceHashedAt: string
}

/** Rechnet die Kennung ueber Bytes; `jetzt` wird hereingereicht (reproduzierbar). */
export function berechneQuellkennung(bytes: Uint8Array, jetzt: string): Quellkennung {
  if (jetzt.trim() === '') throw new Error('berechneQuellkennung: jetzt (ISO) ist Pflicht')
  return {
    sourceContentHash: createHash('sha256').update(bytes).digest('hex'),
    sourceSize: bytes.byteLength,
    sourceHashedAt: jetzt,
  }
}

/** Rechnet die Kennung ueber einen Blob (liest ihn einmal in den Speicher). */
export async function quellkennungAusBlob(blob: Blob, jetzt: string): Promise<Quellkennung> {
  return berechneQuellkennung(new Uint8Array(await blob.arrayBuffer()), jetzt)
}

/** Liest die Kennung aus einem Dokument-Ausschnitt; null = nie gerechnet. */
export function leseQuellkennung(doc: {
  sourceContentHash?: string
  sourceSize?: number
  sourceHashedAt?: string
}): Quellkennung | null {
  if (typeof doc.sourceContentHash !== 'string' || doc.sourceContentHash === '') return null
  if (typeof doc.sourceSize !== 'number' || typeof doc.sourceHashedAt !== 'string') {
    throw new Error(`Quellkennung unvollstaendig: sourceContentHash ohne sourceSize/sourceHashedAt (${doc.sourceContentHash})`)
  }
  return { sourceContentHash: doc.sourceContentHash, sourceSize: doc.sourceSize, sourceHashedAt: doc.sourceHashedAt }
}
