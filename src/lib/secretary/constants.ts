/**
 * Mapping von Sprachcodes zu den Sprachnamen
 * ISO 639-1 Sprachcodes für konsistente Verwendung in der gesamten Anwendung
 */
export const LANGUAGE_MAP = {
  "de": "Deutsch",
  "en": "Englisch",
  "fr": "Französisch",
  "es": "Spanisch",
  "it": "Italienisch",
  "pt": "Portugiesisch",
  "nl": "Niederländisch",
  "pl": "Polnisch",
  "ru": "Russisch",
  "ja": "Japanisch",
  "ko": "Koreanisch",
  "zh": "Chinesisch"
};

/**
 * Array für Sprachauswahl-Dropdowns mit konsistenter Reihenfolge
 * Wichtigste Sprachen zuerst, dann alphabetisch
 */
export const SUPPORTED_LANGUAGES = [
  { code: "de", name: "Deutsch" },
  { code: "en", name: "Englisch" },
  { code: "fr", name: "Französisch" },
  { code: "es", name: "Spanisch" },
  { code: "it", name: "Italienisch" },
  { code: "pt", name: "Portugiesisch" },
  { code: "nl", name: "Niederländisch" },
  { code: "pl", name: "Polnisch" },
  { code: "ru", name: "Russisch" },
  { code: "ja", name: "Japanisch" },
  { code: "ko", name: "Koreanisch" },
  { code: "zh", name: "Chinesisch" }
];

/**
 * Mapping von Template-IDs zu den Template-Namen
 */
export const TEMPLATE_MAP = {
  "track_eco_social": "Ökologisch-Sozial",
  "track_technology": "Technologie",
  "track_business": "Geschäftsorientiert"
}; 