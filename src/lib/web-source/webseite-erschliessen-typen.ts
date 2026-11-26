/**
 * @fileoverview Eingabe und Ergebnis von `webseiteErschliessen` (aus `webseite-erschliessen.ts` ausgelagert).
 *
 * @module web-source
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { MediumWeg } from './medium-und-cover'
import type { WebPageExtract } from './page-extract'
import type { MetadatenQuelle, SeitenModus } from './seitenbild'
import type { TranskriptWeg } from './untertitel'

export interface WebseiteErschliessenInput {
  libraryId: string
  userEmail: string
  provider: StorageProvider
  url: string
  folderId: string
  /** Dateiname der Sammeldatei, endet auf .md. */
  dateiname: string
  targetLanguage: string
  /** Typgepruefte Audio-Optionen (Sprechererkennung, Kontext, Begriffe) wie bei quelle_erschliessen. */
  audioContext: Record<string, unknown>
  llmModel?: string
  /** false = Seite nur lesen und Sammeldatei anlegen, kein Medium holen. */
  medienHolen: boolean
  /** false = Medium nur als Quelle (Transkription), ohne Player und Video-Embed. Default true. */
  medienEinbetten?: boolean
  /** Fertiges HTML der Seite (z. B. aus einem Browser) — dann laedt der Server die Seite nicht selbst. */
  seitenHtml?: string
  /** `struktur` = Seite woertlich mit Listen, Tabellen und Links statt Artikeltext. Default `artikel`. */
  seitenModus?: SeitenModus
  /** Welle K3: Stapel-Zugehoerigkeit, die der Transkriptions-Job erbt. */
  batch?: { batchId: string; batchName?: string }
  /** Welle C3: Video-Anmeldung (cookies.txt); weggelassen = vom Konto der Person laden, null = ohne. */
  videoCookies?: string | null
  /**
   * Woher das Transkript kommt: `tonspur` (Vorgabe) laedt das Medium und transkribiert;
   * `untertitel` holt die fertigen Untertitel der Videoseite, ohne Medium und ohne Job.
   */
  transkript?: TranskriptWeg
  /** Nur mit `untertitel`: true = ohne brauchbare Spur die Tonspur transkribieren; sonst ist das ein Fehler. */
  rueckfall?: boolean
  /** Nur mit `untertitel`: gewuenschte Sprache der von Hand gepflegten Spur; weggelassen = Originalsprache des Videos. */
  untertitelSprache?: string
}

/** Welcher Weg zum Transkript genommen wurde und warum. */
export interface TranskriptErgebnis {
  /** `keins` = kein Medium und keine Untertitel (z. B. `medienHolen: false`). */
  weg: TranskriptWeg | 'keins'
  /** Bei `untertitel`: Sprache und Art der Spur, z. B. `en, automatisch`. */
  spur: string | null
  /** Bei `untertitel`: Herkunft im Klartext, wie sie am Twin und in der Sammeldatei steht. */
  herkunft: string | null
  /** Gesetzt, wenn `untertitel` verlangt war, aber auf die Tonspur zurueckgefallen wurde: der Grund. */
  rueckfallGrund: string | null
}

export interface WebseiteErschliessenResult {
  sammeldatei: { sourceId: string; name: string; ordnerId: string }
  seite: Pick<WebPageExtract, 'title' | 'siteName' | 'author' | 'datePublished' | 'imageUrl' | 'language'> & { bloecke: number; medienGefunden: number }
  /** Woher Titel, Text, Datum und Cover kommen: yt-dlp-Metadaten oder das HTML der Seite. */
  metadatenQuelle: MetadatenQuelle
  /** Wie die Seite in die Sammeldatei kam; bei `struktur` zaehlt `verlinkteDateien` die gefundenen PDF-, Dokument- und Medien-Links. */
  seitenModus: SeitenModus
  verlinkteDateien: number
  /** Zahl der Kapitel aus yt-dlp (0 ohne). */
  kapitel: number
  /** Was der Mensch wissen sollte (Datum ist Upload-Datum, Video ohne Beschreibung, automatische Untertitel, Luecken). */
  hinweise: string[]
  transkript: TranskriptErgebnis
  medium: { sourceId: string; name: string; bytes: number; dauerSekunden: number | null; weg: MediumWeg; jobId: string } | null
  /** Bei `transkript.weg: untertitel`: die Quelldatei, deren Twin das Transkript traegt. */
  untertitel: { sourceId: string; name: string; bytes: number; woerter: number; abdeckungAnteil: number | null } | null
  /** Embed-Adresse (YouTube/Vimeo/PeerTube) fuer video_url, sonst null. */
  videoEmbedUrl: string | null
  mediumGrund: string | null
  cover: { sourceId: string; name: string; bytes: number } | null
  coverGrund: string | null
}
