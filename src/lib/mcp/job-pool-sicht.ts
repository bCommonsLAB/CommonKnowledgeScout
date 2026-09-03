/**
 * @fileoverview Warum die Warteschlange stillsteht — Pool-Sicht fuer `job_liste`.
 *
 * @description
 * Befund 29.08.2026 (Prod): Sechs Jobs wurden um 19:08 auf `running` gesetzt,
 * gaben ab 19:13–19:18 kein Lebenszeichen mehr und belegten damit ALLE
 * Worker-Slots. Neunzehn wartende Jobs standen dahinter still. Ueber die
 * Bruecke war das nicht erkennbar: `job_liste` antwortet pro Library und pro
 * User, die Concurrency-Grenze gilt aber fuer den GANZEN Worker-Pool. Der
 * Agent sah eine Warteschlange ohne Grund und konnte nur warten.
 *
 * Die Zahlen dafuer gibt es laengst — `GET /api/external/jobs/worker` rechnet
 * genau sie aus (`runningInPool`, `staleRunningInPool`). Sie fehlten nur dort,
 * wo ein Agent hinschaut. Diese Datei baut daraus den `pool`-Block.
 *
 * WICHTIG: Die Zahlen sind POOL-WEIT (alle Libraries, alle User desselben
 * `JOBS_WORKER_POOL_ID`) — die eigene Job-Liste daneben ist es nicht. Genau
 * diese Differenz ist die Auskunft: „nicht deine Jobs blockieren dich".
 *
 * @module mcp
 */

export interface PoolZahlen {
  /** `JOBS_WORKER_CONCURRENCY` — wie viele Jobs gleichzeitig laufen duerfen. */
  slots: number
  /** `running` im ganzen Pool (nicht nur eigene Library). */
  laufend: number
  /** Davon ohne Lebenszeichen laenger als die Reaper-Schwelle. */
  steckengeblieben: number
  /** Reaper-Schwelle in ms (`JOBS_WORKER_REAPER_MAX_AGE_MS`). */
  schwelleMs: number
}

export interface PoolSicht extends PoolZahlen {
  freieSlots: number
  stillstandSchwelleMinuten: number
  hinweis: string | null
  /** W8: Sind alle laufenden Jobs gleichzeitig verstummt? */
  neustartVerdacht?: NeustartVerdacht
}

import type { NeustartVerdacht } from './job-neustart-verdacht'

function minuten(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000))
}

/**
 * Baut den `pool`-Block inklusive Klartext-Hinweis. `wartend` ist die Anzahl
 * der eigenen queued-Jobs — nur wer wartet, braucht die Erklaerung, warum.
 */
export function bauePoolSicht(
  zahlen: PoolZahlen,
  wartend: number,
  neustart?: NeustartVerdacht,
): PoolSicht {
  const freieSlots = Math.max(0, zahlen.slots - zahlen.laufend)
  const schwelleMin = minuten(zahlen.schwelleMs)
  const eigener = baueHinweis({ ...zahlen, freieSlots, schwelleMin, wartend })
  // Der Neustart-Verdacht steht VOR dem Regelhinweis: Er widerspricht ihm.
  // „nichts zu tun ausser warten" war am 02.09. genau die falsche Auskunft.
  const hinweis = neustart?.verdacht
    ? [neustart.hinweis, eigener].filter(Boolean).join(' ')
    : eigener
  return {
    ...zahlen,
    freieSlots,
    stillstandSchwelleMinuten: schwelleMin,
    hinweis,
    ...(neustart?.verdacht ? { neustartVerdacht: neustart } : {}),
  }
}

function baueHinweis(a: {
  slots: number
  laufend: number
  steckengeblieben: number
  freieSlots: number
  schwelleMin: number
  wartend: number
}): string | null {
  const blockiert = a.wartend > 0 && a.freieSlots === 0

  if (blockiert && a.steckengeblieben > 0) {
    return (
      `Alle ${a.slots} Worker-Slots des Pools sind belegt, davon ${a.steckengeblieben} ohne ` +
      `Lebenszeichen seit ueber ${a.schwelleMin} Minuten. Deine ${a.wartend} wartenden Job(s) ` +
      'stehen hinter Karteileichen, nicht hinter Arbeit. Der Reaper raeumt sie von selbst weg; ' +
      'sofort geht es mit jobs_aufraeumen (raeumt NUR eigene Jobs — liegen die Leichen in einer ' +
      'anderen Library, dort aufrufen).'
    )
  }
  if (blockiert) {
    return (
      `Alle ${a.slots} Worker-Slots des Pools sind belegt und die laufenden Jobs geben noch ` +
      `Lebenszeichen. Deine ${a.wartend} wartenden Job(s) sind also normal in der Schlange — ` +
      'nichts zu tun ausser warten.'
    )
  }
  if (a.steckengeblieben > 0) {
    return (
      `${a.steckengeblieben} laufende(r) Job(s) im Pool geben seit ueber ${a.schwelleMin} Minuten ` +
      'kein Lebenszeichen mehr. Sie blockieren gerade nichts (es sind Slots frei), werden aber ' +
      'nie fertig — der Reaper setzt sie demnaechst auf failed.'
    )
  }
  return null
}

/**
 * Ehrliche Ersatz-Auskunft, wenn die Pool-Zahlen nicht abrufbar waren.
 * Kein stiller Fallback auf Nullen: eine erfundene „0 blockiert" waere genau
 * die Antwort, die den Agenten in die falsche Richtung schickt.
 */
export function poolNichtAbrufbar(fehler: string): string {
  return (
    'Pool-Zahlen (Worker-Slots, steckengebliebene Jobs) waren nicht abrufbar: ' +
    `${fehler}. Ob die Warteschlange durch belegte Slots blockiert ist, ist damit UNBEKANNT — ` +
    'nicht als „nicht blockiert" lesen.'
  )
}

/**
 * Holt die Pool-Zahlen (Worker-Grenzen + Mongo-Zaehler) und baut daraus die
 * Sicht. Faellt Mongo aus, wird das benannt statt beschoenigt.
 *
 * Die Grenzen kommen aus dem Worker-Singleton — dieselbe Quelle, aus der der
 * Worker seine Entscheidung `countRunning() >= concurrency` trifft. Zwei
 * getrennte Ablesungen derselben Env-Variablen waeren zwei Wahrheiten.
 */
export async function holePoolSicht(wartend: number): Promise<
  { pool: PoolSicht; poolHinweis?: undefined } | { pool: null; poolHinweis: string }
> {
  const { ExternalJobsWorker } = await import('@/lib/external-jobs-worker')
  const { ExternalJobsRepository } = await import('@/lib/external-jobs-repository')
  const status = ExternalJobsWorker.getStatus()
  const schwelleMs = ExternalJobsWorker.getReaperMaxAgeMs()
  try {
    const { pruefeNeustart } = await import('./job-neustart-verdacht')
    const repo = new ExternalJobsRepository()
    const [laufend, steckengeblieben, lebenszeichen] = await Promise.all([
      repo.countRunning(),
      repo.countStaleRunning(schwelleMs),
      repo.runningLebenszeichen(),
    ])
    return {
      pool: bauePoolSicht(
        { slots: status.concurrency, laufend, steckengeblieben, schwelleMs },
        wartend,
        pruefeNeustart(lebenszeichen, new Date()),
      ),
    }
  } catch (fehler) {
    return {
      pool: null,
      poolHinweis: poolNichtAbrufbar(fehler instanceof Error ? fehler.message : String(fehler)),
    }
  }
}

/**
 * Sagt, was der Aufruf bewirkt hat — und ausdruecklich auch, was er NICHT
 * bewirkt hat. „0 aufgeraeumt" bei weiterhin blockiertem Pool heisst: die
 * Leichen sind woanders, nicht: es gibt keine.
 */
export function baueErgebnisHinweis(
  aufgeraeumt: number,
  pool: { freieSlots: number; steckengeblieben: number; slots: number } | null,
): string {
  if (aufgeraeumt > 0) {
    return (
      `${aufgeraeumt} Karteileiche(n) auf „failed" gesetzt — die Slots sind frei. Die Jobs sind ` +
      'GESCHEITERT, nicht erledigt: was gebraucht wird, neu starten.'
    )
  }
  if (pool === null) {
    return 'Nichts aufgeraeumt — in dieser Library gab es keinen eigenen Job ueber der Schwelle.'
  }
  if (pool.freieSlots === 0) {
    return (
      'Nichts aufgeraeumt — in dieser Library steht kein eigener Job ueber der Schwelle, der Pool ' +
      `ist aber weiter voll (${pool.slots} von ${pool.slots} Slots belegt, davon ` +
      `${pool.steckengeblieben} ohne Lebenszeichen). Die Blockade liegt in einer anderen Library ` +
      'oder bei einem anderen User: dort aufrufen, sonst bleibt nur der eingebaute Reaper.'
    )
  }
  return 'Nichts aufgeraeumt — kein eigener Job dieser Library steht ueber der Schwelle, und es sind Slots frei.'
}
