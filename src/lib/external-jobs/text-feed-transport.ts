/**
 * @fileoverview Transport des Text-Feeds: ein POST mit ausdruecklicher Zeitgrenze.
 *
 * @description
 * Der Text-Feed ruft die synchron arbeitende Callback-Route auf, die erst
 * antwortet, wenn Transformation und Ingest durch sind — bei grossen Vorlagen
 * weit ueber fuenf Minuten. Das globale `fetch` (undici) bricht ohne Header
 * nach 300 s mit „fetch failed" ab (`headersTimeout`); genau so wurde am
 * 11.10.2026 ein fertiger Job als gescheitert gemeldet. Hier laeuft der
 * Aufruf ueber `node:http`, das keine versteckte Grenze kennt; die einzige
 * Grenze ist die, die der Aufrufer nennt — und ihr Ablauf ist als
 * `TextFeedZeitablauf` unterscheidbar von einem Netzfehler.
 *
 * @module external-jobs
 */

import http from 'node:http'
import https from 'node:https'

export interface TextFeedAntwort {
  ok: boolean
  status: number
  text: string
}

/** Die Zeitgrenze ist abgelaufen — die Route rechnet moeglicherweise weiter. */
export class TextFeedZeitablauf extends Error {
  readonly name = 'TextFeedZeitablauf'
  constructor(readonly zeitgrenzeMs: number) {
    super(`Text-Feed ohne Antwort nach ${Math.round(zeitgrenzeMs / 1000)} s`)
  }
}

/** POST als JSON; loest mit der Antwort auf oder wirft Zeitablauf/Netzfehler. */
export function sendeTextFeed(args: {
  url: string
  body: string
  headers: Record<string, string>
  zeitgrenzeMs: number
}): Promise<TextFeedAntwort> {
  const ziel = new URL(args.url)
  const client = ziel.protocol === 'https:' ? https : http
  return new Promise<TextFeedAntwort>((resolve, reject) => {
    let erledigt = false
    const beende = (fn: () => void) => {
      if (erledigt) return
      erledigt = true
      clearTimeout(timer)
      fn()
    }
    const req = client.request(
      ziel,
      {
        method: 'POST',
        headers: { ...args.headers, 'Content-Length': String(Buffer.byteLength(args.body)) },
      },
      (res) => {
        const stuecke: Buffer[] = []
        res.on('data', (chunk: Buffer) => stuecke.push(chunk))
        res.on('end', () => {
          const status = res.statusCode ?? 0
          beende(() => resolve({ ok: status >= 200 && status < 300, status, text: Buffer.concat(stuecke).toString('utf8') }))
        })
        res.on('error', (fehler) => beende(() => reject(fehler)))
      },
    )
    // Eine Gesamtgrenze, nicht die Leerlaufgrenze des Sockets: die Route
    // schweigt bis zum Schluss, Leerlauf ist hier der Normalfall.
    const timer = setTimeout(() => {
      beende(() => {
        req.destroy()
        reject(new TextFeedZeitablauf(args.zeitgrenzeMs))
      })
    }, Math.max(1, args.zeitgrenzeMs))
    req.on('error', (fehler) => beende(() => reject(fehler)))
    req.end(args.body)
  })
}
