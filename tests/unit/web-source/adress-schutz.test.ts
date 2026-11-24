/**
 * @fileoverview Riegel gegen interne Adressen: Was der Server im Auftrag von
 * aussen NICHT abrufen darf.
 */

import { describe, it, expect } from 'vitest'
import { AdresseGesperrtError, geschuetzterLookup, istGesperrteIp, pruefeAdresse } from '@/lib/web-source/adress-schutz'

describe('istGesperrteIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '64:ff9b::7f00:1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe',
  ])('sperrt %s', (ip) => {
    expect(istGesperrteIp(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('laesst %s durch', (ip) => {
    expect(istGesperrteIp(ip)).toBe(false)
  })

  it('sperrt, was keine IP ist', () => {
    expect(istGesperrteIp('beispiel.org')).toBe(true)
  })
})

describe('pruefeAdresse', () => {
  it.each([
    ['file:///etc/passwd', 'Nur http/https'],
    ['ftp://beispiel.org/a', 'Nur http/https'],
    ['http://user:pass@beispiel.org/', 'Zugangsdaten'],
    ['http://beispiel.org:8080/', 'Port 8080'],
    ['http://beispiel.org:27017/', 'Port 27017'],
    ['http://localhost/', 'interner Name'],
    ['http://secretary/api', 'interner Name'],
    ['http://mongo.internal/', 'interner Name'],
    ['http://drucker.local/', 'interner Name'],
    ['http://127.0.0.1/', 'interne Adresse'],
    ['http://2130706433/', 'interne Adresse'],
    ['http://0x7f.1/', 'interne Adresse'],
    ['http://169.254.169.254/latest/meta-data/', 'interne Adresse'],
    ['http://[::1]/', 'interne Adresse'],
    ['http://[::ffff:10.0.0.1]/', 'interne Adresse'],
    ['kein url', 'keine gueltige Adresse'],
  ])('weist %s ab', (adresse, grund) => {
    expect(() => pruefeAdresse(adresse)).toThrow(AdresseGesperrtError)
    expect(() => pruefeAdresse(adresse)).toThrow(grund)
  })

  it('laesst oeffentliche Adressen durch', () => {
    expect(pruefeAdresse('https://beispiel.org/dokumente/1?x=1').hostname).toBe('beispiel.org')
    expect(pruefeAdresse('http://beispiel.org:80/').hostname).toBe('beispiel.org')
    expect(pruefeAdresse('https://93.184.216.34/').hostname).toBe('93.184.216.34')
  })
})

describe('geschuetzterLookup', () => {
  it('weist einen Namen ab, der nach innen aufloest', async () => {
    const fehler = await new Promise<Error | null>((resolve) => {
      geschuetzterLookup('localhost', {}, (e) => resolve(e))
    })
    expect(fehler).toBeInstanceOf(AdresseGesperrtError)
    expect(fehler?.message).toContain('interne Adresse')
  })
})
