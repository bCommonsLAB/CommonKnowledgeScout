/**
 * @fileoverview HTTP-Abruf einer von aussen genannten Adresse — mit Adress-Schutz,
 * Groessengrenze, Zeitgrenze und geprueften Umleitungen.
 *
 * @description
 * Der eine Weg, auf dem der Server eine Adresse laedt, die ein Mensch oder
 * Agent genannt hat (Seite lesen, Datei holen, Cover, direkt genanntes
 * Medium). Bewusst `node:http(s)` statt `fetch`: Nur hier laesst sich die
 * Namensaufloesung der Verbindung selbst pruefen (`geschuetzterLookup`).
 *
 * - Jede Umleitung wird wie eine neue Adresse geprueft; nach
 *   `maxUmleitungen` ist Schluss.
 * - Der Body wird hoechstens bis `maxBytes` gelesen; darueber bricht der
 *   Abruf mit Zahlen ab, statt ein Bruchstueck zu liefern.
 * - Ein Status ausserhalb 2xx ist KEIN Wurf: Er steht im Ergebnis (ohne
 *   Body), der Aufrufer entscheidet und benennt ihn.
 *
 * @module web-source
 */

import http from 'node:http'
import https from 'node:https'
import type { LookupFunction } from 'node:net'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import type { Readable } from 'node:stream'
import { geschuetzterLookup, pruefeAdresse } from './adress-schutz'

export interface AbrufOptionen {
  headers?: Record<string, string>
  /** Obergrenze des entpackten Bodys in Bytes. */
  maxBytes: number
  /** Zeitgrenze fuer den ganzen Abruf inkl. Umleitungen, Default 30 s. */
  timeoutMs?: number
  /** Default 5. */
  maxUmleitungen?: number
}

export interface AbrufErgebnis {
  status: number
  /** Kopfzeilen der letzten Antwort, Namen klein geschrieben. */
  headers: Record<string, string>
  /** Entpackter Body; leer bei einem Status ausserhalb 2xx. */
  buffer: Buffer
  /** Adresse nach allen Umleitungen. */
  endAdresse: string
  umleitungen: number
}

/** Nur fuer Tests austauschbar (lokaler Testserver); im Betrieb gelten immer die Vorgaben. */
export interface AbrufRiegel {
  pruefe: (url: string) => URL
  lookup: LookupFunction
}

const STANDARD_RIEGEL: AbrufRiegel = { pruefe: pruefeAdresse, lookup: geschuetzterLookup }

export class AbrufZuGrossError extends Error {
  readonly name = 'AbrufZuGrossError'
}

function kopfzeilen(res: http.IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(res.headers)) {
    if (typeof v === 'string') out[k.toLowerCase()] = v
    else if (Array.isArray(v)) out[k.toLowerCase()] = v.join(', ')
  }
  return out
}

function entpackt(res: http.IncomingMessage): Readable {
  const kodierung = (res.headers['content-encoding'] ?? '').toLowerCase().trim()
  if (kodierung === '' || kodierung === 'identity') return res
  if (kodierung === 'gzip' || kodierung === 'x-gzip') return res.pipe(createGunzip())
  if (kodierung === 'deflate') return res.pipe(createInflate())
  if (kodierung === 'br') return res.pipe(createBrotliDecompress())
  throw new Error(`Antwort mit unbekannter Kodierung "${kodierung}" — nicht gelesen`)
}

function einAbruf(url: URL, headers: Record<string, string>, maxBytes: number, lookup: LookupFunction, signal: AbortSignal): Promise<Omit<AbrufErgebnis, 'endAdresse' | 'umleitungen'>> {
  return new Promise((resolve, reject) => {
    const modul = url.protocol === 'https:' ? https : http
    const req = modul.request(url, { method: 'GET', headers: { 'Accept-Encoding': 'gzip, deflate, br', ...headers }, lookup, signal }, (res) => {
      const status = res.statusCode ?? 0
      const kopf = kopfzeilen(res)
      if (status < 200 || status >= 300) {
        res.destroy()
        resolve({ status, headers: kopf, buffer: Buffer.alloc(0) })
        return
      }
      const angekuendigt = Number(kopf['content-length'] ?? '')
      if (Number.isFinite(angekuendigt) && angekuendigt > maxBytes && !kopf['content-encoding']) {
        res.destroy()
        reject(new AbrufZuGrossError(`Antwort ist ${angekuendigt} Bytes gross (Grenze ${maxBytes}) — nicht geladen`))
        return
      }
      let strom: Readable
      try {
        strom = entpackt(res)
      } catch (fehler) {
        res.destroy()
        reject(fehler)
        return
      }
      const teile: Buffer[] = []
      let bytes = 0
      strom.on('data', (teil: Buffer) => {
        bytes += teil.length
        if (bytes > maxBytes) {
          res.destroy()
          reject(new AbrufZuGrossError(`Antwort ist groesser als ${maxBytes} Bytes — abgebrochen, nichts uebernommen`))
          return
        }
        teile.push(teil)
      })
      strom.on('end', () => resolve({ status, headers: kopf, buffer: Buffer.concat(teile) }))
      strom.on('error', reject)
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

/** Laedt eine Adresse; wirft bei gesperrter Adresse, Zeitgrenze, Groessengrenze oder Netzfehler. */
export async function sichererAbruf(adresse: string, optionen: AbrufOptionen, riegel: AbrufRiegel = STANDARD_RIEGEL): Promise<AbrufErgebnis> {
  const maxUmleitungen = optionen.maxUmleitungen ?? 5
  const timeoutMs = optionen.timeoutMs ?? 30_000
  const abbruch = new AbortController()
  const uhr = setTimeout(() => abbruch.abort(), Math.max(1, timeoutMs))
  try {
    let url = riegel.pruefe(adresse)
    let headers = { ...(optionen.headers ?? {}) }
    for (let umleitungen = 0; ; umleitungen++) {
      const antwort = await einAbruf(url, headers, optionen.maxBytes, riegel.lookup, abbruch.signal)
      const ziel = antwort.headers['location']
      if (antwort.status < 300 || antwort.status >= 400 || !ziel) {
        return { ...antwort, endAdresse: url.toString(), umleitungen }
      }
      if (umleitungen >= maxUmleitungen) throw new Error(`Mehr als ${maxUmleitungen} Umleitungen ab ${adresse.slice(0, 200)} — abgebrochen`)
      const naechste = riegel.pruefe(new URL(ziel, url).toString())
      // Kopfzeilen mit Herkunftsbezug gehen nicht an einen fremden Host weiter.
      if (naechste.host !== url.host) headers = Object.fromEntries(Object.entries(headers).filter(([k]) => !/^(cookie|authorization|referer)$/i.test(k)))
      url = naechste
    }
  } catch (fehler) {
    if (abbruch.signal.aborted) throw new Error(`Abruf nach ${Math.round(timeoutMs / 1000)} s abgebrochen (Zeitgrenze): ${adresse.slice(0, 200)}`)
    throw fehler
  } finally {
    clearTimeout(uhr)
  }
}
