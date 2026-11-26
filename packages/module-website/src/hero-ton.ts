/**
 * Ton des Kopfs mit Bild (Frontmatter `hero_tone`, 26.11.2026).
 *
 * Der Standard-Kopf (`hero_layout: overlay`) legt einen dunklen Schleier ueber
 * `hero_image` und setzt den Text weiss und zentriert — richtig fuer Fotos,
 * falsch fuer ein helles, gestaltetes Hintergrundbild. `hero_tone: light`
 * laesst den Schleier weg: Text linksbuendig in den Farben des Profils
 * (Titel im Akzent, Unterzeile in der Textfarbe der Flaeche `default`), das
 * Bild am rechten Rand ausgerichtet. `dark` ist die Vorgabe (wie bisher).
 */

export const HERO_TONES = ['dark', 'light'] as const
export type HeroTon = (typeof HERO_TONES)[number]

/** Kopf-Varianten, bei denen `hero_tone` wirkt (nur der Standard-Kopf mit Bild). */
export const HERO_TON_LAYOUTS: readonly string[] = ['overlay']

/**
 * Liefert den Ton oder `undefined`, wenn das Feld fehlt (dann gilt `dark`).
 * Ein ungueltiger Wert wirft — kein stiller Ersatz.
 */
export function heroTon(wert: unknown): HeroTon | undefined {
  if (wert === undefined || wert === null || wert === '') return undefined
  if (typeof wert === 'string' && (HERO_TONES as readonly string[]).includes(wert.trim())) return wert.trim() as HeroTon
  throw new Error(`hero_tone "${String(wert)}" ist ungueltig (erlaubt: ${HERO_TONES.join(', ')})`)
}

/** Fuer den Mapper: ungueltig wird laut gemeldet, die oeffentliche Seite zeigt den dunklen Kopf. */
export function heroTonGeprueft(wert: unknown): HeroTon | undefined {
  try {
    return heroTon(wert)
  } catch (error) {
    console.error(`[website] ${error instanceof Error ? error.message : String(error)} — der Kopf zeigt die dunkle Fassung`)
    return undefined
  }
}

/**
 * Befunde zu `hero_tone`, die das Publizieren nicht verhindern: das Feld wirkt
 * nur am Standard-Kopf mit Bild. Ein ungueltiger Wert wirft (siehe `heroTon`).
 */
export function heroTonHinweise(wert: unknown, heroLayout: unknown, heroBild: unknown): string[] {
  const ton = heroTon(wert)
  if (ton !== 'light') return []
  const layout = typeof heroLayout === 'string' && heroLayout.trim() ? heroLayout.trim() : 'overlay'
  if (!HERO_TON_LAYOUTS.includes(layout)) {
    return [`hero_tone light wirkt nur bei hero_layout ${HERO_TON_LAYOUTS.join(', ')} — bei "${layout}" bleibt es ohne Wirkung`]
  }
  if (typeof heroBild !== 'string' || !heroBild.trim()) {
    return ['hero_tone light ohne hero_image: der Kopf ohne Bild kennt keinen Ton — das Feld bleibt ohne Wirkung']
  }
  return []
}

/**
 * `object-position` des hellen Kopfs: waagrecht am rechten Rand (das Gestaltete
 * des Bilds liegt rechts, der Text links), senkrecht nach `hero_image_position`
 * (`hero-bild-position.ts` liefert `50% <hoehe>`); ohne Angabe die Mitte.
 */
export function heroHellBildPosition(bildPosition: string | undefined): string {
  if (!bildPosition) return '100% 50%'
  const teile = bildPosition.split(' ')
  if (teile.length !== 2) throw new Error(`Bildposition "${bildPosition}" hat nicht die Form "<x> <y>"`)
  return `100% ${teile[1]}`
}
