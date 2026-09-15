/**
 * Huelle: die Guards fuer eingebettete Video-/Audio-Player liegen seit dem Umzug der
 * Buch-Ansicht ins Paket in `@ks/util` (`safe-media-embed.ts`), weil die Buch-Ansicht
 * sie im Embed braucht und ein Paket nicht in die App zurueckgreifen darf.
 */
export { isSafeVideoIframeSrc, isSafeAudioIframeSrc, isDirectAudioFileUrl } from '@ks/util'
