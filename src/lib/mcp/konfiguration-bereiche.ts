/**
 * @fileoverview Bereiche von `konfiguration_lesen`/`konfiguration_setzen` (Welle D): reine Funktionen.
 *
 * @description
 * Die Chat-Konfiguration einer Library (`config.chat`) traegt fuenf Dinge,
 * die beim Aufsetzen und Nachschaerfen wiederkommen: die Facetten
 * (`gallery.facets`, JSON-Form des Editor-Exports), die Antwortregeln, die
 * Chat-Einstellungen (Platzhalter, Sprache, Charakter …), die
 * Galerie-Einstellungen (Typ, Sortierung …) und die Veroeffentlichung
 * (eigener Block, eigenes Werkzeug). Hier wird der neue Zustand berechnet;
 * geprueft wird er mit demselben Schema wie im Formular
 * (`chat-config-validation.ts`), geschrieben in `tools-konfiguration.ts`.
 *
 * Nicht ueber die Bruecke setzbar: `embeddings`, `vectorStore`, `models`,
 * `userPreferences` — Infrastruktur des Betreibers; eine geaenderte
 * Embedding-Dimension macht den Index unbrauchbar.
 *
 * @module mcp
 */

export const BEREICHE = ['facetten', 'antwortregeln', 'chat', 'galerie', 'veroeffentlichung'] as const
export type Bereich = (typeof BEREICHE)[number]

/** Schluessel von `config.chat`, die der Bereich `chat` setzen darf. */
export const CHAT_SETZBAR: ReadonlySet<string> = new Set([
  'placeholder', 'maxChars', 'maxCharsWarningMessage', 'footerText', 'companyLink',
  'targetLanguage', 'character', 'accessPerspective', 'socialContext', 'genderInclusive', 'tocSummaryField',
])

/** Schluessel von `config.chat.gallery`, die der Bereich `galerie` setzen darf (facets gehoeren zu `facetten`). */
export const GALERIE_SETZBAR: ReadonlySet<string> = new Set([
  'detailViewType', 'showSdgProfile', 'galleryCardDensity', 'groupByField', 'defaultSortField', 'defaultSortDirection',
  // Plan galerie-buergeransicht, G3: Profil beim Oeffnen und Start ohne Adress-Parameter
  'standardProfil', 'startAnsicht',
])

export interface KonfigurationEingabe {
  /** Ersetzt `gallery.facets` als Ganzes — dieselbe JSON-Form wie Import/Export des Facetten-Editors. */
  facetten?: unknown[]
  /** Antwortregeln-Text; leerer String loescht. */
  antwortregeln?: string
  /** Benannte Regelsaetze (Owner 09.11.2026): Teil-Update je Name; leerer String loescht den Regelsatz. */
  varianten?: Record<string, string>
  chat?: Record<string, unknown>
  galerie?: Record<string, unknown>
}

function alsObjekt(wert: unknown): Record<string, unknown> {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : {}
}

function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function pruefeSchluessel(bereich: string, werte: Record<string, unknown>, erlaubt: ReadonlySet<string>): void {
  const fremd = Object.keys(werte).filter((k) => !erlaubt.has(k))
  if (fremd.length > 0) {
    throw new Error(`${bereich}: unbekannt oder nicht ueber die Bruecke setzbar: ${fremd.join(', ')} — erlaubt: ${[...erlaubt].join(', ')}`)
  }
}

/**
 * Neuer `config.chat`-Zustand aus altem Zustand und Eingabe. Liefert die
 * geaenderten Schluessel (nur echte Aenderungen). Wirft bei fremden Schluesseln.
 */
export function wendeKonfigurationAn(
  altChat: Record<string, unknown> | undefined,
  eingabe: KonfigurationEingabe,
): { chat: Record<string, unknown>; geaendert: string[] } {
  const alt = alsObjekt(altChat)
  const altGalerie = alsObjekt(alt.gallery)
  const neu: Record<string, unknown> = { ...alt }
  const neuGalerie: Record<string, unknown> = { ...altGalerie }
  const geaendert: string[] = []

  if (eingabe.facetten !== undefined) {
    if (!gleich(altGalerie.facets, eingabe.facetten)) geaendert.push('facetten')
    neuGalerie.facets = eingabe.facetten
  }
  if (eingabe.antwortregeln !== undefined) {
    const text = eingabe.antwortregeln.trim()
    if (!gleich(alt.antwortregeln, text === '' ? undefined : text)) geaendert.push('antwortregeln')
    if (text === '') delete neu.antwortregeln
    else neu.antwortregeln = text
  }
  if (eingabe.varianten !== undefined) {
    const altVarianten = alsObjekt(alt.antwortregelnVarianten)
    const neuVarianten: Record<string, unknown> = { ...altVarianten }
    for (const [name, wert] of Object.entries(eingabe.varianten)) {
      const text = wert.trim()
      if (!gleich(altVarianten[name], text === '' ? undefined : text)) geaendert.push(`varianten.${name}`)
      if (text === '') delete neuVarianten[name]
      else neuVarianten[name] = text
    }
    neu.antwortregelnVarianten = neuVarianten
  }
  if (eingabe.chat !== undefined) {
    pruefeSchluessel('chat', eingabe.chat, CHAT_SETZBAR)
    for (const [key, wert] of Object.entries(eingabe.chat)) {
      if (!gleich(alt[key], wert)) geaendert.push(`chat.${key}`)
      neu[key] = wert
    }
  }
  if (eingabe.galerie !== undefined) {
    pruefeSchluessel('galerie', eingabe.galerie, GALERIE_SETZBAR)
    for (const [key, wert] of Object.entries(eingabe.galerie)) {
      if (!gleich(altGalerie[key], wert)) geaendert.push(`galerie.${key}`)
      neuGalerie[key] = wert
    }
  }
  if (eingabe.facetten !== undefined || eingabe.galerie !== undefined) neu.gallery = neuGalerie
  return { chat: neu, geaendert }
}

/** Lesesicht je Bereich — Infrastruktur nur als Auskunft, nie als Eingabe. */
export function chatSicht(chat: unknown, bereich: Exclude<Bereich, 'veroeffentlichung'>): unknown {
  const c = alsObjekt(chat)
  const galerie = alsObjekt(c.gallery)
  switch (bereich) {
    case 'facetten':
      return Array.isArray(galerie.facets) ? galerie.facets : []
    case 'antwortregeln':
      // Seit 2.70.0 ein Objekt: der Text und die benannten Regelsaetze (rules=<name> einer Website-Sektion).
      return {
        text: typeof c.antwortregeln === 'string' ? c.antwortregeln : null,
        varianten: alsObjekt(c.antwortregelnVarianten),
      }
    case 'chat':
      return {
        ...Object.fromEntries([...CHAT_SETZBAR].map((k) => [k, c[k] ?? null])),
        nurLesbar: { embeddings: c.embeddings ?? null, vectorStore: c.vectorStore ?? null, models: c.models ?? null },
      }
    case 'galerie':
      return Object.fromEntries([...GALERIE_SETZBAR].map((k) => [k, galerie[k] ?? null]))
    default: {
      const nie: never = bereich
      throw new Error(`Unbekannter Bereich "${String(nie)}"`)
    }
  }
}
