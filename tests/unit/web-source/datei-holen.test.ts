/**
 * @fileoverview Pruefungen vor dem Ablegen einer geholten Datei: Typ, Endung,
 * Signatur, Dateiname. Abgelehnt wird mit Grund, nichts wird umgedeutet.
 */

import { describe, it, expect } from 'vitest'
import { nameAusKopfzeile, pruefeDateiTyp, saubererName } from '@/lib/web-source/datei-holen'

const PDF = Buffer.from('%PDF-1.7\n...')
const HTML = Buffer.from('<!doctype html><html><body>Bitte anmelden</body></html>')

describe('pruefeDateiTyp', () => {
  it('nimmt ein PDF mit passendem Typ, passender Endung und Signatur', () => {
    expect(pruefeDateiTyp({ buffer: PDF, contentType: 'application/pdf', dateiname: 'a.pdf' })).toBe('application/pdf')
    expect(pruefeDateiTyp({ buffer: PDF, contentType: 'application/pdf; charset=binary', dateiname: 'a.pdf', erwarteterTyp: 'application/pdf' })).toBe('application/pdf')
  })

  it('liest den Typ aus der Endung, wenn der Server nur octet-stream nennt — und prueft die Signatur', () => {
    expect(pruefeDateiTyp({ buffer: PDF, contentType: 'application/octet-stream', dateiname: 'a.pdf' })).toBe('application/pdf')
    expect(() => pruefeDateiTyp({ buffer: HTML, contentType: 'application/octet-stream', dateiname: 'a.pdf' })).toThrow('Signatur fehlt')
  })

  it('lehnt eine HTML-Seite statt der Datei ab', () => {
    expect(() => pruefeDateiTyp({ buffer: HTML, contentType: 'text/html; charset=utf-8', dateiname: 'a.pdf' })).toThrow('HTML-Seite statt einer Datei')
    expect(() => pruefeDateiTyp({ buffer: HTML, contentType: 'text/html', dateiname: 'a', erwarteterTyp: 'application/pdf' })).toThrow('HTML-Seite statt einer Datei')
  })

  it('lehnt ab, wenn Erwartung, Endung und Content-Type sich widersprechen', () => {
    expect(() => pruefeDateiTyp({ buffer: PDF, contentType: 'application/pdf', dateiname: 'a.pdf', erwarteterTyp: 'image/png' })).toThrow('Erwartet war "image/png"')
    expect(() => pruefeDateiTyp({ buffer: PDF, contentType: 'application/pdf', dateiname: 'a.docx' })).toThrow('endet auf .docx')
    expect(() => pruefeDateiTyp({ buffer: PDF, contentType: '', dateiname: 'a.docx', erwarteterTyp: 'application/pdf' })).toThrow('passt nicht zur Endung')
  })

  it('lehnt ein angebliches PDF ohne PDF-Inhalt ab', () => {
    expect(() => pruefeDateiTyp({ buffer: Buffer.from('nicht pdf'), contentType: 'application/pdf', dateiname: 'a.pdf' })).toThrow('Signatur fehlt')
  })

  it('raet keinen Typ, wenn weder Server noch Endung ihn nennen', () => {
    expect(() => pruefeDateiTyp({ buffer: PDF, contentType: '', dateiname: 'download' })).toThrow('nennt keinen Dateityp')
    expect(() => pruefeDateiTyp({ buffer: Buffer.from('a;b'), contentType: 'application/octet-stream', dateiname: 'a.csv' })).toThrow('keine Signatur bekannt')
  })

  it('nimmt Typen ohne bekannte Signatur, wenn der Server sie nennt', () => {
    expect(pruefeDateiTyp({ buffer: Buffer.from('a;b'), contentType: 'text/csv', dateiname: 'a.csv' })).toBe('text/csv')
  })
})

describe('Dateiname', () => {
  it('liest filename* vor filename', () => {
    expect(nameAusKopfzeile(`attachment; filename="a.pdf"; filename*=UTF-8''Erkl%C3%A4rung.pdf`)).toBe('Erklärung.pdf')
    expect(nameAusKopfzeile('attachment; filename="Statement Spain.pdf"')).toBe('Statement Spain.pdf')
    expect(nameAusKopfzeile('inline')).toBe('')
  })

  it('entfernt Pfadtrenner und fuehrende Punkte', () => {
    expect(saubererName('../../etc/pass:wd')).toBe('_.._etc_pass_wd')
    expect(saubererName('  a  b.pdf ')).toBe('a b.pdf')
  })
})
