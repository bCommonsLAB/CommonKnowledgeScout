/**
 * @fileoverview Sicherer Abruf gegen einen lokalen Testserver: Umleitungen,
 * Groessengrenze, Zeitgrenze, Entpacken — und dass der Standard-Riegel den
 * lokalen Server gar nicht erst erreicht.
 */

import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import http from 'node:http'
import { lookup } from 'node:dns'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { AdresseGesperrtError, pruefeAdresse } from '@/lib/web-source/adress-schutz'
import { AbrufZuGrossError, sichererAbruf, type AbrufRiegel } from '@/lib/web-source/sicherer-abruf'

let server: http.Server
let basis = ''
const gesehen: Array<{ pfad: string; cookie: string | undefined }> = []

/** Test-Riegel: laesst nur den lokalen Testserver zu; alles andere prueft weiter der echte Riegel. */
const TEST_RIEGEL: AbrufRiegel = {
  pruefe: (roh) => {
    const url = new URL(roh)
    if (url.hostname === '127.0.0.1') return url
    return pruefeAdresse(roh)
  },
  lookup: lookup as AbrufRiegel['lookup'],
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    gesehen.push({ pfad: req.url ?? '', cookie: req.headers.cookie })
    if (req.url === '/text') return void res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<p>Hallo</p>')
    if (req.url === '/gzip') return void res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' }).end(gzipSync('entpackt'))
    if (req.url === '/gross') return void res.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(Buffer.alloc(5000, 1))
    if (req.url === '/um') return void res.writeHead(302, { Location: '/text' }).end()
    if (req.url === '/schleife') return void res.writeHead(302, { Location: '/schleife' }).end()
    if (req.url === '/nach-innen') return void res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }).end()
    if (req.url === '/langsam') return void setTimeout(() => res.writeHead(200).end('spaet'), 2000)
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('nichts')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('sichererAbruf', () => {
  it('liest Status, Kopfzeilen und Body', async () => {
    const r = await sichererAbruf(`${basis}/text`, { maxBytes: 1000 }, TEST_RIEGEL)
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toContain('text/html')
    expect(r.buffer.toString('utf8')).toBe('<p>Hallo</p>')
    expect(r.umleitungen).toBe(0)
  })

  it('entpackt gzip', async () => {
    const r = await sichererAbruf(`${basis}/gzip`, { maxBytes: 1000 }, TEST_RIEGEL)
    expect(r.buffer.toString('utf8')).toBe('entpackt')
  })

  it('folgt Umleitungen und nennt die Endadresse', async () => {
    const r = await sichererAbruf(`${basis}/um`, { maxBytes: 1000 }, TEST_RIEGEL)
    expect(r.endAdresse).toBe(`${basis}/text`)
    expect(r.umleitungen).toBe(1)
  })

  it('bricht eine Umleitungsschleife ab', async () => {
    await expect(sichererAbruf(`${basis}/schleife`, { maxBytes: 1000, maxUmleitungen: 3 }, TEST_RIEGEL)).rejects.toThrow('Mehr als 3 Umleitungen')
  })

  it('prueft das Ziel jeder Umleitung — nach innen geht es nicht', async () => {
    await expect(sichererAbruf(`${basis}/nach-innen`, { maxBytes: 1000 }, TEST_RIEGEL)).rejects.toThrow(AdresseGesperrtError)
  })

  it('bricht ueber der Groessengrenze ab, statt ein Bruchstueck zu liefern', async () => {
    await expect(sichererAbruf(`${basis}/gross`, { maxBytes: 1000 }, TEST_RIEGEL)).rejects.toThrow(AbrufZuGrossError)
  })

  it('nennt einen Status ausserhalb 2xx im Ergebnis, ohne Body', async () => {
    const r = await sichererAbruf(`${basis}/fehlt`, { maxBytes: 1000 }, TEST_RIEGEL)
    expect(r.status).toBe(404)
    expect(r.buffer.length).toBe(0)
  })

  it('haelt die Zeitgrenze ein', async () => {
    await expect(sichererAbruf(`${basis}/langsam`, { maxBytes: 1000, timeoutMs: 200 }, TEST_RIEGEL)).rejects.toThrow('Zeitgrenze')
  })

  it('erreicht den lokalen Server mit dem Standard-Riegel nicht', async () => {
    const vorher = gesehen.length
    await expect(sichererAbruf(`${basis}/text`, { maxBytes: 1000 })).rejects.toThrow(AdresseGesperrtError)
    await expect(sichererAbruf(`http://localhost/text`, { maxBytes: 1000 })).rejects.toThrow(AdresseGesperrtError)
    expect(gesehen.length).toBe(vorher)
  })
})
