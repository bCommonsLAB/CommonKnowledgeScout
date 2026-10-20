/**
 * Galerie-Profil (Plan galerie-buergeransicht, G1) — reine Funktionen.
 *
 * Zwei Profile, ein Baustein: `gefuehrt` (Bürgeransicht: Filter als Lade,
 * weniger Knöpfe, ruhige Karten) und `experte` (die heutige Ansicht). Die
 * Adresse `?ansicht=` schlägt die Vorgabe der Library
 * (`chat.gallery.standardProfil`), ohne beides gilt `experte`. Unbekannte
 * Werte werden laut gemeldet und wie `experte` behandelt — nie still
 * „irgendwas“ (no-silent-fallbacks).
 */

export const GALERIE_PROFILE = ['gefuehrt', 'experte'] as const
export type GalerieProfil = (typeof GALERIE_PROFILE)[number]
export const GALERIE_PROFIL_VORGABE: GalerieProfil = 'experte'
/** Adress-Parameter, den der Umschalter schreibt. */
export const ANSICHT_PARAM = 'ansicht'

export type ProfilQuelle = 'adresse' | 'config' | 'vorgabe'

export interface ProfilErgebnis {
  profil: GalerieProfil
  quelle: ProfilQuelle
}

function istProfil(wert: unknown): wert is GalerieProfil {
  return typeof wert === 'string' && (GALERIE_PROFILE as readonly string[]).includes(wert)
}

/**
 * Profil aus Adresse und Library-Config. Reihenfolge: Adresse, dann Config,
 * dann Vorgabe. Ein ungültiger Wert wird gemeldet und übersprungen.
 */
export function profilAus(adresse: string | null | undefined, config: unknown): ProfilErgebnis {
  if (adresse !== null && adresse !== undefined && adresse !== '') {
    if (istProfil(adresse)) return { profil: adresse, quelle: 'adresse' }
    console.error(`[galerie-profil] Unbekannter Wert ansicht="${adresse}" in der Adresse — erlaubt: ${GALERIE_PROFILE.join(', ')}`)
  }
  if (config !== undefined && config !== null && config !== '') {
    if (istProfil(config)) return { profil: config, quelle: 'config' }
    console.error(`[galerie-profil] Unbekannter Wert standardProfil="${String(config)}" in der Library-Config — erlaubt: ${GALERIE_PROFILE.join(', ')}`)
  }
  return { profil: GALERIE_PROFIL_VORGABE, quelle: 'vorgabe' }
}

/**
 * Nächste Adresse nach einem Wechsel; der Umschalter schreibt sie per `pushParams`.
 * Owner 20.10.: Experten sehen standardmäßig alle Einträge — der Wechsel zu
 * `experte` räumt `starred` und das zugehörige `sort=stars` weg (eine andere
 * Sortierung bleibt); der Wechsel zu `gefuehrt` setzt die Start-Vorgabe der
 * Library (`startAnsicht`), sofern die Adresse weder `starred` noch `sort` trägt.
 */
export function profilParams(
  aktuell: URLSearchParams | null | undefined,
  profil: GalerieProfil,
  startAnsicht?: unknown,
): URLSearchParams {
  const next = new URLSearchParams(aktuell?.toString() ?? '')
  next.set(ANSICHT_PARAM, profil)
  if (profil === 'experte') {
    next.delete('starred')
    if (next.get('sort') === 'stars') next.delete('sort')
    return next
  }
  return startParamsFuer(startAnsicht, next) ?? next
}

export const START_ANSICHTEN = ['fokus', 'alle'] as const
export type StartAnsicht = (typeof START_ANSICHTEN)[number]

/**
 * Vorgabe beim Start (G2, Owner 19.10.; seit 20.10. nur im geführten Profil —
 * Experten starten mit allen Einträgen): steht `fokus` in der Config und
 * traegt die Adresse weder `starred` noch `sort`, bekommt sie
 * `starred=1&sort=stars` (einmal je Montage, ohne Verlaufseintrag). Sonst
 * `null` = nichts tun. Unbekannter Wert wird gemeldet und wie `alle`
 * behandelt. Ein leerer Fokus wird leer gezeigt — kein Ausweichen auf „alle“.
 */
export function startParamsFuer(startAnsicht: unknown, params: URLSearchParams | null | undefined): URLSearchParams | null {
  if (startAnsicht === undefined || startAnsicht === null || startAnsicht === '' || startAnsicht === 'alle') return null
  if (startAnsicht !== 'fokus') {
    console.error(`[galerie-profil] Unbekannter Wert startAnsicht="${String(startAnsicht)}" in der Library-Config — erlaubt: ${START_ANSICHTEN.join(', ')}`)
    return null
  }
  if (params?.has('starred') || params?.has('sort')) return null
  const next = new URLSearchParams(params?.toString() ?? '')
  next.set('starred', '1')
  next.set('sort', 'stars')
  return next
}

/** Wo die Filter stehen: als Spalte links (Desktop, Experte) oder als Lade (mobil, oder geführt auf jeder Breite). */
export type FilterAnzeige = 'spalte' | 'lade'

export function filterAnzeigeFuer(profil: GalerieProfil, isMobile: boolean): FilterAnzeige {
  if (profil === 'gefuehrt') return 'lade'
  return isMobile ? 'lade' : 'spalte'
}

/**
 * Klassen der beiden Layout-Zweige in `gallery-root.tsx`. Bisher hingen sie
 * fest am Breakpoint (`lg:hidden` / `hidden lg:grid`); jetzt folgen sie der
 * Filteranzeige, damit das geführte Profil auch am Desktop die Lade nutzt.
 */
export function layoutKlassen(anzeige: FilterAnzeige): { leiste: string; desktop: string; liste: string } {
  if (anzeige === 'lade') {
    return {
      leiste: '',
      desktop: 'hidden',
      liste: 'w-full min-w-0 flex flex-col min-h-0 flex-1',
    }
  }
  return {
    leiste: 'lg:hidden',
    desktop: 'hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-3 flex-1 min-h-0 overflow-hidden',
    liste: 'lg:hidden w-full min-w-0 flex flex-col min-h-0 flex-1',
  }
}
