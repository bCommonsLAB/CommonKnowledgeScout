/**
 * @fileoverview Typen der Konto-Seite „Sprachmodelle" (globale Modell-Liste `llm_models`).
 *
 * @description
 * Geteilt zwischen den Admin-Routen unter `/api/admin/llm-models/**` und der
 * Seite `src/components/settings/account/sprachmodelle/`. Die Liste gilt fuer
 * ALLE Libraries; pflegen darf sie nur, wer in `KS_ADMIN_EMAIL` steht.
 */

/** Ergebnis einer Probefrage ueber den Secretary an das Modell. */
export interface ModellProbe {
  ok: boolean
  /** Zeitpunkt der Probe (ISO). */
  at: string
  /** Dauer der Probe in Millisekunden. */
  ms: number
  /** Gekuerzte Antwort des Modells (nur bei ok). */
  antwort?: string
  /** Fehlermeldung (nur bei !ok). */
  fehler?: string
}

/** Eine Zeile der Tabelle: gespeicherter Eintrag plus Angaben aus dem OpenRouter-Katalog. */
export interface SprachmodellZeile {
  modelId: string
  name: string
  strengths: string
  url?: string
  isActive: boolean
  order: number
  probe?: ModellProbe
  /** Preis je 1 Mio. Eingabe-Token in USD; null = im Katalog ohne festen Preis. */
  preisEin: number | null
  /** Preis je 1 Mio. Ausgabe-Token in USD; null = im Katalog ohne festen Preis. */
  preisAus: number | null
  /** Kontextfenster in Token; null = unbekannt. */
  kontext: number | null
  /** false = steht nicht (mehr) im OpenRouter-Katalog; null = Katalog nicht geladen. */
  imKatalog: boolean | null
}

export interface SprachmodellListe {
  modelle: SprachmodellZeile[]
  /** Gesetzt, wenn der OpenRouter-Katalog nicht geladen werden konnte (Preise fehlen dann). */
  katalogFehler?: string
}

/** Treffer der Katalog-Suche im Dialog „Modell hinzufuegen". */
export interface KatalogEintrag {
  modelId: string
  name: string
  kontext: number | null
  preisEin: number | null
  preisAus: number | null
}

/** Aenderbare Felder eines Eintrags. */
export interface SprachmodellAenderung {
  name?: string
  strengths?: string
  isActive?: boolean
}
