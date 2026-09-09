/**
 * @fileoverview Repo-Frische (Wunschliste 5, C1): wie alt sind die Aussagen
 * eines Berichts ueber seinen Code? — pur.
 *
 * @description
 * Vier Vorhaben tragen ein `repo:`-Feld, und das Archiv schreibt den Stand des
 * Repos ab (Plaene, Wellen, Termine). Am Tag nach dem Schreiben war die
 * Themenlandkarte an fuenf Stellen falsch — nicht aus Nachlaessigkeit, sondern
 * weil das Repo weiterlief, und nichts hat es gemeldet. Das Muster dagegen
 * gibt es schon fuer Mails (`postfach_bis`): Der Bericht sagt selbst, bis wann
 * seine Aussagen gepruef sind, und der Scan misst den Rueckstand.
 *
 * ```yaml
 * repo: [CommonKnowledgeScout]
 * repo_stand_am: 2026-09-09     # Tag, an dem die Aussagen zuletzt gegen das Repo geprueft wurden
 * repo_stand: 66ef1f3e           # optional: der Commit dazu, fuer Menschen
 * ```
 *
 * Gemessen wird das ALTER des Pruefstands (Tage), nicht der Commit-Rueckstand:
 * der Dienst hat keinen Zugriff auf den Arbeitsbaum, und ein Datum reicht fuer
 * den Zweck. Jeder Zustand ist benannt (`no-silent-fallbacks.md`): kein Repo,
 * Repo ohne Pruefstand, unlesbarer Pruefstand, gelesener Pruefstand.
 *
 * Reine Funktionen, kein I/O — die Gegenwart wird hereingereicht.
 *
 * @module agent-view
 */

/** `JJJJ-MM-TT` — das Datumsformat der Frontmatter-Konvention. */
const DATUM_MUSTER = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PRO_TAG = 86_400_000

/** Zustand des Repo-Pruefstands eines Vorhabens — nie stilles null. */
export type RepoStand =
  /** Der Bericht nennt kein Repo — die Regel hat nichts zu pruefen. */
  | { art: 'ohne_repo' }
  /** Repo genannt, aber kein `repo_stand_am` — die Aussagen sind ungeprueft. */
  | { art: 'ohne_angabe'; repos: string[] }
  /** Feld vorhanden, aber nicht `JJJJ-MM-TT` — sichtbar, nicht verschluckt. */
  | { art: 'unlesbar'; roh: string; repos: string[] }
  /** Gelesen. `rueckstandTage` = volle Tage seit dem Pruefstand; negativ = Datum in der Zukunft. */
  | { art: 'gelesen'; datum: string; rueckstandTage: number; commit: string | null; repos: string[] }

export interface RepoFelder {
  repo: readonly string[]
  repoStandAm: string | null
  repoStand: string | null
}

/**
 * Liest die Repo-Felder und misst das Alter des Pruefstands gegen `jetzt`.
 * Ein Datum, das es nicht gibt (`2026-02-30`), ist unlesbar — nicht der
 * naechste gueltige Tag.
 */
export function leseRepoStand(felder: RepoFelder, jetzt: Date): RepoStand {
  const repos = felder.repo.map((r) => r.trim()).filter(Boolean)
  if (repos.length === 0) return { art: 'ohne_repo' }
  const roh = felder.repoStandAm?.trim() ?? ''
  if (roh === '') return { art: 'ohne_angabe', repos }
  const treffer = DATUM_MUSTER.exec(roh)
  if (treffer === null) return { art: 'unlesbar', roh, repos }
  const jahr = Number(treffer[1])
  const monat = Number(treffer[2])
  const tag = Number(treffer[3])
  const datumUtc = Date.UTC(jahr, monat - 1, tag)
  const gueltig = new Date(datumUtc)
  if (gueltig.getUTCFullYear() !== jahr || gueltig.getUTCMonth() !== monat - 1 || gueltig.getUTCDate() !== tag) {
    return { art: 'unlesbar', roh, repos }
  }
  const heuteUtc = Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())
  const rueckstandTage = Math.floor((heuteUtc - datumUtc) / MS_PRO_TAG)
  const commit = felder.repoStand?.trim() || null
  return { art: 'gelesen', datum: roh, rueckstandTage, commit, repos }
}

/** Ueber der Schwelle? Nur ein gelesener Stand kann im Rueckstand sein. */
export function istRepoImRueckstand(stand: RepoStand, maxTage: number): boolean {
  return stand.art === 'gelesen' && stand.rueckstandTage > maxTage
}

/** Klartext fuer Befund und Sicht. */
export function repoStandLabel(stand: RepoStand): string {
  switch (stand.art) {
    case 'ohne_repo':
      return 'kein Repo genannt'
    case 'ohne_angabe':
      return `Repo ${stand.repos.join(', ')} genannt, aber kein Pruefstand (repo_stand_am fehlt) — die Aussagen ueber den Code sind ungeprueft`
    case 'unlesbar':
      return `repo_stand_am „${stand.roh}" ist kein Datum JJJJ-MM-TT`
    case 'gelesen':
      if (stand.rueckstandTage < 0) return `repo_stand_am ${stand.datum} liegt in der Zukunft`
      return `Pruefstand ${stand.datum}${stand.commit ? ` (${stand.commit})` : ''}, ${stand.rueckstandTage} Tage alt`
  }
}
