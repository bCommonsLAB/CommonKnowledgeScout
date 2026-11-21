/**
 * Auffuehrung der Buehne hinter der Fragen-Sektion (Plan `commonux-buehne-fragen-sektion`,
 * Abschnitt 3.4): eine leere Buehne und die acht Masken der Gespraechsteile. Form, Farbe, Ruhe-Ort
 * und Schwerkraft stehen hier, nicht im Player. Die Darsteller entstehen zur Laufzeit aus dem
 * Gespraech (`gespraechAusStory`).
 *
 * Formensprache nach dem Konzept: Frage hellblau, Blatt weiss, Akzent Indigo. Werte nach der
 * Vorlage des Players (Nachweis „Gespraech" im Repo commoning-methods).
 *
 * Masse: `sizeX`/`sizeY` × 3 = Welteinheiten; die Buehne misst 28 × 16, Mitte 0 / 0.
 */

type Maske = Record<string, string | number | boolean>

const AKZENT = '#2B2F77'

const FRAGE: Maske = {
  shape: 'square',
  cornerRadius: 1,
  sizeX: 2.4,
  sizeY: 0.55,
  contentSizeX: 2.1,
  contentSizeY: 0.45,
  materialColor: '#63B8F2',
  fontColor: '#0B2A45',
  fontSize: 1.25,
  maxLines: 2,
  // Gefuehrt und `solid`: Die Frage ist der feste Punkt, um den die Belege kreisen.
  motion: 'guided',
  solid: true,
}

const BLATT: Maske = {
  shape: 'square',
  cornerRadius: 0.12,
  materialColor: '#FFFFFF',
  fontColor: '#16161D',
  fontSize: 1.05,
  textScroll: true,
}

const MASKEN: Record<string, Maske> = {
  // Frage: solange die Antwort entsteht in der Mitte, danach ueber dem Blatt.
  'gespraech-frage-offen': { ...FRAGE, positionX: 0, positionY: 1.8 },
  'gespraech-frage': { ...FRAGE, positionX: 0, positionY: 6.4 },
  // Antwortblatt: stehend, mehr als doppelt so gross wie alles andere.
  'gespraech-blatt': { ...BLATT, positionX: 0, positionY: 0.2, sizeX: 2.1, sizeY: 2.9, contentSizeX: 1.8, contentSizeY: 2.6 },
  'gespraech-blatt-gross': { ...BLATT, positionX: 0, positionY: -0.6, sizeX: 3.6, sizeY: 3.5, contentSizeX: 3.2, contentSizeY: 3.2 },
  // Beleg: unterwegs ein kleiner Punkt, der um die Frage kreist; mit der Antwort ein Kreis.
  'gespraech-beleg-punkt': { shape: 'circle', sizeX: 0.14, sizeY: 0.14, positionX: 0, positionY: 1.8, orbit: 0.9, weight: 4 },
  'gespraech-beleg': {
    shape: 'circle',
    sizeX: 0.8,
    sizeY: 0.8,
    contentSizeX: 0.68,
    contentSizeY: 0.5,
    positionX: 0,
    positionY: 0.2,
    fontColor: '#16161D',
    fontSize: 0.72,
    maxLines: 3,
    preference: 'near',
    preferenceStrength: 0.6,
    preferenceReach: 9,
  },
  // Folgefragen: blasse Kreise mit Fragezeichen, ihr Ruhe-Ort liegt unter dem Blatt.
  'gespraech-folgefrage': {
    shape: 'circle',
    sizeX: 0.86,
    sizeY: 0.86,
    contentSizeX: 0.7,
    contentSizeY: 0.55,
    positionX: 0,
    positionY: -6.3,
    materialColor: '#E6ECF5',
    fontColor: AKZENT,
    fontSize: 0.72,
    maxLines: 3,
    backgroundSign: '?',
    motion: 'free',
  },
  // Perle: fruehere Antwort als kleines Blatt, oben links.
  'gespraech-perle': {
    shape: 'square',
    cornerRadius: 0.35,
    sizeX: 0.95,
    sizeY: 0.42,
    contentSizeX: 0.85,
    contentSizeY: 0.36,
    positionX: -11.4,
    positionY: 6.6,
    materialColor: '#FFFFFF',
    fontColor: AKZENT,
    fontSize: 0.62,
    maxLines: 2,
    motion: 'free',
  },
}

export const GESPRAECH_AUFFUEHRUNG = {
  application: {
    humanuxVersion: 2,
    id: 'ks-fragen-sektion',
    name: 'Bühne hinter der Fragen-Sektion',
    entities: {},
    styles: MASKEN,
    views: [{ id: 'v_gespraech', name: 'Gespräch', interaction: true, entityStates: {} }],
  },
}
