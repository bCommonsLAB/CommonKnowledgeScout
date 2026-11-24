/**
 * @fileoverview Felder einer Vorlage binden: Obergrenzen durchsetzen, Zaehlfelder berechnen.
 *
 * @description
 * Befund am Piloten: Die Vorlage verlangte „hoechstens 6 Themen" und bekam 16;
 * ein Zaehlfeld war in zwei Laeufen falsch, obwohl die Zahl im Material
 * abzaehlbar stand. Bitten an das Sprachmodell sind keine Regeln. Was sich
 * pruefen oder ausrechnen laesst, macht deshalb der Server.
 *
 * In der Beschreibung eines Felds `{{feld|beschreibung}}`:
 *
 *   <<max:6>>            Liste: hoechstens 6 Eintraege. Mehr = hinten gekuerzt + Befund.
 *   <<maxWoerter:450>>   Text: hoechstens 450 Woerter. Mehr = Befund (der Text bleibt).
 *
 * Fuer das Sprachmodell wird der Platzhalter zur blossen Zahl („at most
 * <<max:6>> values, most important first" → „at most 6 values, …").
 *
 * Beginnt die Beschreibung mit `=`, rechnet der Server das Feld; was das
 * Sprachmodell dort liefert, wird ersetzt:
 *
 *   =quellen("* - Statement.*")                  Anzahl der Quelldateien mit diesem Namensmuster
 *   =zeilen("Speakers", "Statement:")            Zeilen des Abschnitts „Speakers" im Material, die „Statement:" enthalten
 *   =quellenarten(statement: "* - Statement.*"; programme: "*Programme*")
 *                                                Liste der Werte, deren Muster auf mindestens eine Quelldatei passt
 *
 * Muster: `*` beliebig viele Zeichen, `?` eines; Gross/Klein egal. Quelldateien
 * sind `_source_files` der Sammeldatei. Ein Schreibfehler in der Vorlage ist
 * ein Fehler vor dem Lauf; ein Feld, das sich am Material nicht rechnen laesst
 * (Abschnitt fehlt), wird null und Befund. Pure Helfer, keine Seiteneffekte.
 *
 * @module external-jobs
 */

export interface FeldBindung {
  feld: string
  max?: number
  maxWoerter?: number
  berechnet?: Berechnung
}

export type Berechnung =
  | { art: 'quellen'; muster: string }
  | { art: 'zeilen'; abschnitt: string; text: string }
  | { art: 'quellenarten'; paare: Array<{ wert: string; muster: string }> }

export interface FeldBindungsErgebnis {
  cleanedMeta: Record<string, unknown>
  /** Listen ueber der Obergrenze (gekuerzt) und Texte ueber der Wortgrenze (nicht gekuerzt). */
  grenzen: Array<{ feld: string; art: 'max' | 'maxWoerter'; erlaubt: number; erhalten: number; gekuerzt: boolean }>
  berechnet: Array<{ feld: string; wert: number | string[]; modell: unknown }>
  nichtBerechenbar: Array<{ feld: string; grund: string }>
}

const FELD = /\{\{([^}|]+)\|([^}]+)\}\}/g
const GRENZE_ALLE = /<<\s*max[A-Za-z]*\b[^<>\n]*>>/g
const GRENZE_GUELTIG = /^<<\s*(max|maxWoerter)\s*:\s*(\d{1,6})\s*>>$/
const TEXT = '"((?:[^"\\\\]|\\\\.)*)"'
const FUER_MODELL = 'Computed by the server — return null.'

function entwerte(s: string): string {
  return s.replace(/\\(.)/g, '$1')
}

function leseBerechnung(feld: string, ausdruck: string): Berechnung {
  const quellen = new RegExp(`^=\\s*quellen\\(\\s*${TEXT}\\s*\\)$`).exec(ausdruck)
  if (quellen) return { art: 'quellen', muster: entwerte(quellen[1]) }
  const zeilen = new RegExp(`^=\\s*zeilen\\(\\s*${TEXT}\\s*,\\s*${TEXT}\\s*\\)$`).exec(ausdruck)
  if (zeilen) return { art: 'zeilen', abschnitt: entwerte(zeilen[1]), text: entwerte(zeilen[2]) }
  const arten = /^=\s*quellenarten\((.*)\)$/.exec(ausdruck)
  if (arten) {
    const paare = arten[1].split(';').map((teil) => new RegExp(`^\\s*([A-Za-z0-9_.-]+)\\s*:\\s*${TEXT}\\s*$`).exec(teil))
    if (paare.length > 0 && paare.every((p) => p !== null)) {
      return { art: 'quellenarten', paare: (paare as RegExpExecArray[]).map((p) => ({ wert: p[1], muster: entwerte(p[2]) })) }
    }
  }
  throw new Error(`Feld „${feld}": „${ausdruck}" ist keine bekannte Berechnung — erlaubt: =quellen("muster"), =zeilen("abschnitt", "text"), =quellenarten(wert: "muster"; …)`)
}

/** Liest die Bindungen aller Felder einer Vorlage. Wirft bei Schreibfehlern. */
export function leseFeldBindungen(vorlage: string): FeldBindung[] {
  const bindungen = new Map<string, FeldBindung>()
  for (const treffer of vorlage.matchAll(FELD)) {
    const feld = treffer[1].trim()
    const beschreibung = treffer[2].trim()
    const bindung: FeldBindung = bindungen.get(feld) ?? { feld }
    if (beschreibung.startsWith('=')) bindung.berechnet = leseBerechnung(feld, beschreibung)
    for (const g of beschreibung.matchAll(GRENZE_ALLE)) {
      const m = GRENZE_GUELTIG.exec(g[0])
      if (!m) throw new Error(`Feld „${feld}": ${g[0]} ist keine bekannte Obergrenze — erlaubt: <<max:N>> und <<maxWoerter:N>>`)
      if (Number(m[2]) < 1) throw new Error(`Feld „${feld}": ${g[0]} — die Obergrenze muss mindestens 1 sein`)
      if (m[1] === 'max') bindung.max = Number(m[2])
      else bindung.maxWoerter = Number(m[2])
    }
    if (bindung.berechnet || bindung.max !== undefined || bindung.maxWoerter !== undefined) bindungen.set(feld, bindung)
  }
  const ausserhalb = vorlage.replace(FELD, '').match(GRENZE_ALLE)
  if (ausserhalb) throw new Error(`${ausserhalb[0]} steht ausserhalb einer Feldbeschreibung {{feld|…}} und bindet deshalb nichts`)
  return [...bindungen.values()]
}

/** Vorlage, wie sie ans Sprachmodell geht: Grenzen als Zahl, Berechnungen als Hinweis. */
export function vorlageFuerModell(vorlage: string): string {
  return vorlage.replace(FELD, (_ganz, feld: string, beschreibung: string) => {
    const text = beschreibung.trim().startsWith('=') ? FUER_MODELL : beschreibung.replace(GRENZE_ALLE, (g) => GRENZE_GUELTIG.exec(g)?.[2] ?? g)
    return `{{${feld}|${text}}}`
  })
}

function passt(muster: string, name: string): boolean {
  const re = muster.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${re}$`, 'i').test(name)
}

/**
 * Quelldateien der Sammeldatei aus dem Material; null, wenn das Material keine nennt.
 * Die Pipeline entfernt das Frontmatter, bevor das Material hier ankommt (Befund der
 * Abnahme: `_source_files` fehlte, obwohl 20 Quellen da waren). Massgeblich sind deshalb
 * die Quellbloecke `<source file="…" index="N">`; index 0 ist die Sammeldatei selbst und
 * zaehlt nicht. Ein noch vorhandenes Frontmatter wird ebenfalls gelesen.
 */
export function quellenAusMaterial(material: string): string[] | null {
  const bloecke = [...material.matchAll(/^<source file="([^"]*)" index="(\d+)"[^>]*>\s*$/gm)]
    .filter((m) => m[2] !== '0').map((m) => m[1])
  if (bloecke.length > 0) return bloecke
  const kopf = /^_source_files:\s*(\[.*\])\s*$/m.exec(material.slice(0, 20_000))
  if (!kopf) return null
  try {
    const liste: unknown = JSON.parse(kopf[1])
    return Array.isArray(liste) ? liste.filter((n): n is string => typeof n === 'string') : null
  } catch {
    return null
  }
}

/** Zeilen des ersten Abschnitts mit dieser Ueberschrift; null, wenn es ihn nicht gibt. */
export function zeilenDesAbschnitts(material: string, abschnitt: string): string[] | null {
  const zeilen = material.split(/\r?\n/)
  const start = zeilen.findIndex((z) => /^#{1,6}\s/.test(z) && z.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim().toLowerCase() === abschnitt.trim().toLowerCase())
  if (start === -1) return null
  const ebene = (/^#+/.exec(zeilen[start]) as RegExpExecArray)[0].length
  const rest = zeilen.slice(start + 1)
  const ende = rest.findIndex((z) => z.startsWith('</source>') || (/^#{1,6}\s/.test(z) && (/^#+/.exec(z) as RegExpExecArray)[0].length <= ebene))
  return ende === -1 ? rest : rest.slice(0, ende)
}

function rechne(b: Berechnung, material: string): number | string[] {
  if (b.art === 'zeilen') {
    const zeilen = zeilenDesAbschnitts(material, b.abschnitt)
    if (!zeilen) throw new Error(`Abschnitt „${b.abschnitt}" gibt es im Material nicht`)
    return zeilen.filter((z) => z.toLowerCase().includes(b.text.toLowerCase())).length
  }
  const quellen = quellenAusMaterial(material)
  if (!quellen) throw new Error('Das Material nennt keine Quelldateien (keine Sammeldatei)')
  if (b.art === 'quellen') return quellen.filter((q) => passt(b.muster, q)).length
  return b.paare.filter((p) => quellen.some((q) => passt(p.muster, q))).map((p) => p.wert)
}

function woerter(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Wendet die Bindungen auf das Ergebnis der Transformation an. `meta` bleibt unveraendert. */
export function wendeFeldBindungenAn(meta: Record<string, unknown>, bindungen: ReadonlyArray<FeldBindung>, material: string): FeldBindungsErgebnis {
  const ergebnis: FeldBindungsErgebnis = { cleanedMeta: { ...meta }, grenzen: [], berechnet: [], nichtBerechenbar: [] }
  for (const b of bindungen) {
    if (b.berechnet) {
      try {
        const wert = rechne(b.berechnet, material)
        ergebnis.berechnet.push({ feld: b.feld, wert, modell: meta[b.feld] ?? null })
        ergebnis.cleanedMeta[b.feld] = wert
      } catch (fehler) {
        ergebnis.cleanedMeta[b.feld] = null
        ergebnis.nichtBerechenbar.push({ feld: b.feld, grund: fehler instanceof Error ? fehler.message : String(fehler) })
      }
    }
    const wert = ergebnis.cleanedMeta[b.feld]
    if (b.max !== undefined && Array.isArray(wert) && wert.length > b.max) {
      ergebnis.grenzen.push({ feld: b.feld, art: 'max', erlaubt: b.max, erhalten: wert.length, gekuerzt: true })
      ergebnis.cleanedMeta[b.feld] = wert.slice(0, b.max)
    }
    if (b.maxWoerter !== undefined && typeof wert === 'string' && woerter(wert) > b.maxWoerter) {
      ergebnis.grenzen.push({ feld: b.feld, art: 'maxWoerter', erlaubt: b.maxWoerter, erhalten: woerter(wert), gekuerzt: false })
    }
  }
  return ergebnis
}
