/**
 * @fileoverview Schutz gegen interne Adressen (SSRF) fuer Abrufe im Auftrag von aussen.
 *
 * @description
 * Wer dem Server eine Adresse nennt, die er laden soll, koennte sonst interne
 * Dienste erreichen: Metadaten-Endpunkte der Cloud, die Datenbank, den
 * Secretary, den eigenen Host. Zwei Riegel, beide noetig:
 *
 * 1. `pruefeAdresse` VOR dem Abruf: nur http/https, keine Zugangsdaten in der
 *    Adresse, nur die Standard-Ports, kein interner Name, keine interne IP.
 * 2. `geschuetzterLookup` BEIM Verbindungsaufbau: Die Namensaufloesung, die
 *    die Verbindung tatsaechlich benutzt, wird geprueft. Eine Pruefung vorab
 *    allein reicht nicht — der Name koennte zwischen Pruefung und Verbindung
 *    auf eine interne IP umgestellt werden (DNS-Rebinding).
 *
 * Liefert EIN Name mehrere IPs und ist eine davon intern, wird der ganze Name
 * abgewiesen. Abgewiesen wird laut (`AdresseGesperrtError`), nie still.
 *
 * @module web-source
 */

import { lookup as dnsLookup } from 'node:dns'
import { BlockList, isIP } from 'node:net'
import type { LookupFunction } from 'node:net'

export class AdresseGesperrtError extends Error {
  readonly name = 'AdresseGesperrtError'
}

/** Ports, die ein Abruf von aussen benutzen darf (leer = Standard des Schemas). */
const ERLAUBTE_PORTS = new Set(['', '80', '443'])

/** Namen, die nie ins oeffentliche Netz zeigen. */
const INTERNE_ENDUNGEN = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp', '.home.arpa']

const GESPERRT = new BlockList()
for (const [netz, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) GESPERRT.addSubnet(netz, bits, 'ipv4')
for (const [netz, bits] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) GESPERRT.addSubnet(netz, bits, 'ipv6')

/** IPv4-Adresse aus einer IPv4-abgebildeten IPv6-Adresse (`::ffff:a.b.c.d` oder `::ffff:hhhh:hhhh`), sonst null. */
function abgebildeteV4(ip: string): string | null {
  const m = ip.toLowerCase().match(/^::ffff:(.+)$/)
  if (!m) return null
  if (isIP(m[1]) === 4) return m[1]
  const hex = m[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hex) return null
  const a = Number.parseInt(hex[1], 16)
  const b = Number.parseInt(hex[2], 16)
  return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`
}

/** true, wenn die IP nicht ins oeffentliche Netz zeigt. Was keine IP ist, gilt als gesperrt. */
export function istGesperrteIp(ip: string): boolean {
  const familie = isIP(ip)
  if (familie === 4) return GESPERRT.check(ip, 'ipv4')
  if (familie === 6) {
    const v4 = abgebildeteV4(ip)
    if (v4) return GESPERRT.check(v4, 'ipv4')
    return GESPERRT.check(ip, 'ipv6')
  }
  return true
}

/** Prueft Schema, Zugangsdaten, Port und Hostnamen einer Adresse; wirft `AdresseGesperrtError`. */
export function pruefeAdresse(roh: string): URL {
  let url: URL
  try {
    url = new URL(roh)
  } catch {
    throw new AdresseGesperrtError(`"${roh.slice(0, 200)}" ist keine gueltige Adresse`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AdresseGesperrtError(`Nur http/https wird abgerufen, nicht "${url.protocol}"`)
  }
  if (url.username || url.password) throw new AdresseGesperrtError('Adressen mit Zugangsdaten (user:pass@) werden nicht abgerufen')
  if (!ERLAUBTE_PORTS.has(url.port)) throw new AdresseGesperrtError(`Port ${url.port} wird nicht abgerufen (nur 80 und 443)`)
  // URL liefert IPv6 in eckigen Klammern und normalisiert Schreibweisen wie 0x7f.1 oder 2130706433 zu 127.0.0.1.
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!host) throw new AdresseGesperrtError('Adresse ohne Hostnamen')
  if (isIP(host) !== 0) {
    if (istGesperrteIp(host)) throw new AdresseGesperrtError(`"${host}" ist eine interne Adresse und wird nicht abgerufen`)
    return url
  }
  if (host === 'localhost' || !host.includes('.') || INTERNE_ENDUNGEN.some((e) => host.endsWith(e))) {
    throw new AdresseGesperrtError(`"${host}" ist ein interner Name und wird nicht abgerufen`)
  }
  return url
}

/**
 * Namensaufloesung fuer `http(s).request({ lookup })`: reicht nur oeffentliche IPs durch.
 * Zeigt auch nur EINE der IPs eines Namens nach innen, scheitert die Verbindung.
 */
export const geschuetzterLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (fehler, adressen) => {
    if (fehler) {
      callback(fehler, '', 0)
      return
    }
    const gesperrt = adressen.find((a) => istGesperrteIp(a.address))
    if (gesperrt || adressen.length === 0) {
      const grund = gesperrt ? `loest auf die interne Adresse ${gesperrt.address} auf` : 'loest auf keine Adresse auf'
      callback(new AdresseGesperrtError(`"${hostname}" ${grund} und wird nicht abgerufen`), '', 0)
      return
    }
    if (options.all) callback(null, adressen)
    else callback(null, adressen[0].address, adressen[0].family)
  })
}
