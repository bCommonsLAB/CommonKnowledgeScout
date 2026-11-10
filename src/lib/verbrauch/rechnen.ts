/**
 * @fileoverview Verbrauch der Fragen einer Library: Kosten in Euro und Energie
 * (obere Grenze) — reine Rechnung, ohne Datenbank (Konzept 10.11.2026).
 *
 * Gezeigt werden NUR Zahlen: Zeit, Tokens, Kosten, Energie. Kein Fragetext,
 * keine Person, keine Kennung — die Seite ist anonym lesbar.
 *
 * Energie: Der Anbieter nennt keinen Messwert je Anfrage. Owner-Regel
 * (10.11.2026): obere Grenze einer unabhaengigen Schaetzung ohne kommerzielles
 * Interesse. 0,4 Wh je 1.000 Tokens folgt aus der Schaetzung von Epoch AI
 * (knapp 40 Wh fuer 100.000 Tokens Eingabe); der echte Wert liegt eher darunter.
 *
 * Kosten: Der Secretary meldet US-Dollar. Der Kurs kommt aus der Umgebung
 * (`VERBRAUCH_USD_EUR_KURS`); fehlt er, gibt es KEINE Kosten statt falscher.
 */

export const WH_PRO_1000_TOKENS = 0.4
/** Alltagsvergleiche der Anzeige: Elektroauto und LED-Lampe. */
export const KWH_PRO_100_KM = 15
export const LED_WATT = 10

export function energieWh(tokens: number): number {
  return (tokens / 1000) * WH_PRO_1000_TOKENS
}

/** Kurs aus der Umgebung: null = nicht gesetzt; ein gesetzter, unbrauchbarer Wert ist ein Fehler. */
export function usdEurKurs(roh: string | undefined = process.env.VERBRAUCH_USD_EUR_KURS): number | null {
  if (roh === undefined || roh.trim() === '') return null
  const kurs = Number(roh.trim().replace(',', '.'))
  if (!Number.isFinite(kurs) || kurs <= 0) throw new Error(`VERBRAUCH_USD_EUR_KURS ist kein gültiger Kurs: "${roh}"`)
  return kurs
}

/** Grenzen eines Monats `JJJJ-MM` (UTC, `bis` exklusiv). */
export function monatsGrenzen(monat: string): { von: Date; bis: Date } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monat)
  if (!m) throw new Error(`month muss die Form JJJJ-MM haben (hier: "${monat}")`)
  const jahr = Number(m[1])
  const mon = Number(m[2]) - 1
  return { von: new Date(Date.UTC(jahr, mon, 1)), bis: new Date(Date.UTC(jahr, mon + 1, 1)) }
}

export function aktuellerMonat(jetzt: Date = new Date()): string {
  return `${jetzt.getUTCFullYear()}-${String(jetzt.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Was je Frage aus dem Fragen-Log gelesen wird. */
export interface VerbrauchZeile {
  createdAt: Date | string
  userEmail?: string
  sessionId?: string
  tokenUsage?: { totalTokens?: number; cost?: number | null }
  retrieval?: Array<{ cacheFound?: boolean }>
}

/** Wer fragt — fuer „Meine Sitzung" und die Markierung eigener Zeilen. */
export interface Betrachter {
  userEmail?: string
  sessionId?: string
}

export interface VerbrauchEintrag {
  /** Zeitpunkt, auf die Minute gekuerzt (ISO). */
  zeit: string
  tokens: number | null
  kostenEur: number | null
  energieWh: number | null
  /** Antwort kam aus dem Antwort-Speicher: keine neuen Kosten, keine neue Energie. */
  ausSpeicher: boolean
  eigen: boolean
}

export interface VerbrauchSummen {
  fragen: number
  neuBerechnet: number
  ausSpeicher: number
  /** Neu berechnete Fragen ohne Kostenangabe — dann ist `kostenEur` eine Untergrenze. */
  ohnePreis: number
  /** Neu berechnete Fragen ohne Token-Zahl — dann fehlen sie in Tokens und Energie. */
  ohneTokens: number
  tokens: number
  /** null, wenn kein Kurs gesetzt ist. */
  kostenEur: number | null
  energieWh: number
}

export interface VerbrauchAuswertung {
  summen: VerbrauchSummen
  eintraege: VerbrauchEintrag[]
}

function istEigen(z: VerbrauchZeile, b: Betrachter): boolean {
  if (b.userEmail) return z.userEmail === b.userEmail
  if (b.sessionId) return !z.userEmail && z.sessionId === b.sessionId
  return false
}

/**
 * Zeilen (neueste zuerst) → Summen ueber ALLE Zeilen und die ersten `limit`
 * Eintraege fuer die Liste. `nurEigen` beschraenkt beides auf den Betrachter.
 */
export function verbrauchAuswerten(
  zeilen: ReadonlyArray<VerbrauchZeile>,
  o: { kurs: number | null; betrachter: Betrachter; nurEigen: boolean; limit: number },
): VerbrauchAuswertung {
  const summen: VerbrauchSummen = { fragen: 0, neuBerechnet: 0, ausSpeicher: 0, ohnePreis: 0, ohneTokens: 0, tokens: 0, kostenEur: o.kurs === null ? null : 0, energieWh: 0 }
  const eintraege: VerbrauchEintrag[] = []
  for (const z of zeilen) {
    const eigen = istEigen(z, o.betrachter)
    if (o.nurEigen && !eigen) continue
    const ausSpeicher = (z.retrieval ?? []).some((r) => r.cacheFound === true)
    const zeit = new Date(z.createdAt)
    zeit.setUTCSeconds(0, 0)
    let eintrag: VerbrauchEintrag
    summen.fragen += 1
    if (ausSpeicher) {
      summen.ausSpeicher += 1
      eintrag = { zeit: zeit.toISOString(), tokens: null, kostenEur: o.kurs === null ? null : 0, energieWh: null, ausSpeicher, eigen }
    } else {
      summen.neuBerechnet += 1
      const tokens = typeof z.tokenUsage?.totalTokens === 'number' ? z.tokenUsage.totalTokens : null
      const usd = typeof z.tokenUsage?.cost === 'number' ? z.tokenUsage.cost : null
      const kostenEur = usd !== null && o.kurs !== null ? usd * o.kurs : null
      if (tokens === null) summen.ohneTokens += 1
      else { summen.tokens += tokens; summen.energieWh += energieWh(tokens) }
      if (usd === null) summen.ohnePreis += 1
      else if (summen.kostenEur !== null && kostenEur !== null) summen.kostenEur += kostenEur
      eintrag = { zeit: zeit.toISOString(), tokens, kostenEur, energieWh: tokens === null ? null : energieWh(tokens), ausSpeicher, eigen }
    }
    if (eintraege.length < o.limit) eintraege.push(eintrag)
  }
  return { summen, eintraege }
}
