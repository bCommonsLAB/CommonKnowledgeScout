/**
 * Galerie-Profil und Start-Ansicht aus der gespeicherten Config fuer das
 * Formular (Plan galerie-buergeransicht, G3). Fehlt das Feld, gilt die
 * Vorgabe (experte, alle); ein unbekannter Wert wird gemeldet und durch die
 * Vorgabe ersetzt — nie still (no-silent-fallbacks). Dieselben Listen wie
 * `galerie-profil.ts` im Explorer-Paket.
 */

export const GALERIE_PROFILE = ['gefuehrt', 'experte'] as const
export type GalerieProfilWert = (typeof GALERIE_PROFILE)[number]
export const START_ANSICHTEN = ['fokus', 'alle'] as const
export type StartAnsichtWert = (typeof START_ANSICHTEN)[number]

function werteAus<T extends string>(
  feld: string, wert: unknown, erlaubt: readonly T[], vorgabe: T,
): T {
  if (wert === undefined || wert === null || wert === '') return vorgabe
  if (typeof wert === 'string' && (erlaubt as readonly string[]).includes(wert)) return wert as T
  console.error(`[Galerie-Einstellungen] Unbekannter Wert ${feld}="${String(wert)}" — Vorgabe "${vorgabe}" verwendet`)
  return vorgabe
}

/** `chat.gallery.standardProfil` fuer das Formular: gefuehrt | experte (Vorgabe experte). */
export function standardProfilAus(wert: unknown): GalerieProfilWert {
  return werteAus('standardProfil', wert, GALERIE_PROFILE, 'experte')
}

/** `chat.gallery.startAnsicht` fuer das Formular: fokus | alle (Vorgabe alle). */
export function startAnsichtAus(wert: unknown): StartAnsichtWert {
  return werteAus('startAnsicht', wert, START_ANSICHTEN, 'alle')
}
