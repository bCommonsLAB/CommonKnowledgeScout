/**
 * @fileoverview Eine Antwort ohne lesbaren Text einordnen: leer, Schutzseite, JavaScript-Seite, unbekannt.
 *
 * @description
 * Befund am Piloten: Eine Website gab dem Server mit HTTP 200 eine Antwort
 * ohne Text und ohne Titel. Der Hinweis nannte „JavaScript" — die Seite steht
 * im Browser aber als gewoehnliches HTML. Eine falsche Diagnose schickt den
 * Menschen in die falsche Richtung; deshalb wird hier nur benannt, wofuer es
 * Indizien im HTML gibt, und sonst gesagt, dass der Grund offen ist.
 *
 * @module web-source
 */

export type LeereAntwortArt = 'leer' | 'schutzseite' | 'javascript' | 'unbekannt'

export interface LeereAntwort {
  art: LeereAntwortArt
  hinweis: string
  /** Laenge des rohen HTML in Zeichen. */
  rohZeichen: number
  /** Die ersten Zeichen des rohen HTML, Leerraum geglaettet — zum Selbst-Nachsehen. */
  rohAnfang: string
}

/** Kennzeichen verbreiteter Schutzseiten gegen Automaten (Zwischenseite statt Inhalt). */
const SCHUTZ = /_Incapsula_Resource|incapsula|imperva|cf-chl|cf_chl_|challenge-platform|Just a moment|captcha|datadome|px-captcha|perimeterx|distil_|akamai[^"']{0,40}(bm|bot)|bot ?detection|access denied|request unsuccessful/i
/** Kennzeichen einer Seite, die ihren Inhalt erst im Browser aufbaut. */
const APP_GERUEST = /<div\b[^>]*\bid\s*=\s*["'](app|root|__next|__nuxt|svelte|main-app)["']|<app-root\b|ng-version=|data-reactroot|window\.__NUXT__|__NEXT_DATA__/i

const WEG = 'Abhilfe: die Seite im Browser oeffnen und ihr HTML uebergeben (Parameter html).'

export function deuteLeereAntwort(html: string): LeereAntwort {
  const rohZeichen = html.length
  const rohAnfang = html.replace(/\s+/g, ' ').trim().slice(0, 400)
  const basis = { rohZeichen, rohAnfang }
  if (html.trim() === '') {
    return { ...basis, art: 'leer', hinweis: `Die Antwort ist leer (0 Zeichen HTML). ${WEG}` }
  }
  if (SCHUTZ.test(html)) {
    return { ...basis, art: 'schutzseite', hinweis: `Die Antwort (${rohZeichen} Zeichen) ist vermutlich eine Schutzseite gegen automatische Abrufe, nicht die Seite selbst — siehe rohAnfang. ${WEG}` }
  }
  if (APP_GERUEST.test(html)) {
    return { ...basis, art: 'javascript', hinweis: `Das HTML (${rohZeichen} Zeichen) traegt nur das Geruest einer Anwendung; der Inhalt entsteht erst im Browser (JavaScript). Rendern kann die Bruecke nicht. ${WEG}` }
  }
  return { ...basis, art: 'unbekannt', hinweis: `Das HTML (${rohZeichen} Zeichen) traegt keinen lesbaren Text; der Grund ist daraus nicht erkennbar (Schutzseite, JavaScript oder leere Seite) — siehe rohAnfang. ${WEG}` }
}
