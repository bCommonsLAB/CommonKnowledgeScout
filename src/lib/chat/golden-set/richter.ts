/**
 * Richter-Rubrik des Golden-Sets (Plan `story-status-modalitaet`, m0, zweite Prüfebene).
 *
 * Vier Ja/Nein-Fragen an ein Richter-Modell, kein Freitext-Urteil:
 * Modalität korrekt, Zuschreibung vorhanden, keine Erfolgsbehauptung,
 * Gruppierung bei Mehrfach-Treffern. Das Modell sieht die Frage, die Antwort
 * (ohne Fußnote) und je zitiertem Dokument die Facettenwerte mit Bedeutung
 * aus dem Wörterbuch — dieselbe Formatierung wie der Quellen-Header (m3).
 *
 * Hier liegen nur Prompt, Schema und Auswertung (pure); der Aufruf steht im
 * Läufer. Das JSON-Format steht ausdrücklich im Prompt-Text, weil der
 * Secretary `schema_json` nicht erzwingt (Befund im Doc-Relations-Muster).
 */

import * as z from 'zod'
import type { DokumentGruppe } from '@/lib/chat/common/zitatmarken'
import { formatiereQuellenMetadaten, type KontextFacette } from '@/lib/chat/quellen-kontext'
import type { GoldenSetFrage } from './schema'

export const richterUrteilSchema = z.object({
  modalitaetKorrekt: z.boolean(),
  zuschreibungVorhanden: z.boolean(),
  keineErfolgsbehauptung: z.boolean(),
  /** `null`, wenn nur ein Status unter den Treffern liegt (nichts zu gliedern). */
  gruppierungNachStatus: z.boolean().nullable(),
  begruendung: z.string().max(600),
})
export type RichterUrteil = z.infer<typeof richterUrteilSchema>

export const richterSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    modalitaetKorrekt: { type: 'boolean' },
    zuschreibungVorhanden: { type: 'boolean' },
    keineErfolgsbehauptung: { type: 'boolean' },
    gruppierungNachStatus: { type: ['boolean', 'null'] },
    begruendung: { type: 'string', maxLength: 600 },
  },
  required: ['modalitaetKorrekt', 'zuschreibungVorhanden', 'keineErfolgsbehauptung', 'gruppierungNachStatus', 'begruendung'],
  additionalProperties: false,
})

export interface RichterEingabe {
  frage: GoldenSetFrage
  antwort: string
  /** Zitierte Dokumente in Prompt-Nummerierung. */
  zitiert: ReadonlyArray<DokumentGruppe>
  facetDefs: ReadonlyArray<KontextFacette>
}

/** Facettenwerte eines Dokuments mit Bedeutung — erste Textstelle, die Metadaten trägt. */
function dokumentKontext(gruppe: DokumentGruppe, facetDefs: ReadonlyArray<KontextFacette>): string {
  const quelle = gruppe.sources.find((s) => s.metadata && Object.keys(s.metadata).length > 0)
  const zeilen = quelle ? formatiereQuellenMetadaten(quelle.metadata, facetDefs) : []
  const name = gruppe.fileName ?? gruppe.fileId
  return zeilen.length > 0 ? `[${gruppe.nummer}] ${name}\n  ${zeilen.join('\n  ')}` : `[${gruppe.nummer}] ${name}\n  (keine Facettenwerte)`
}

export function buildRichterMessages(e: RichterEingabe): Array<{ role: 'system' | 'user'; content: string }> {
  const dokumente = e.zitiert.map((g) => dokumentKontext(g, e.facetDefs)).join('\n')
  const system = [
    'Du bist ein strenger Prüfer für Antworten eines Auskunftssystems.',
    'Du beurteilst NUR, ob die Antwort den Status der zitierten Dokumente korrekt wiedergibt.',
    'Grundlage ist ausschließlich die Legende je Dokument: Label und Bedeutung eines Facettenwerts.',
    'Antworte als JSON-Objekt genau dieser Form, ohne Text davor oder danach:',
    '{"modalitaetKorrekt": true|false, "zuschreibungVorhanden": true|false, "keineErfolgsbehauptung": true|false, "gruppierungNachStatus": true|false|null, "begruendung": "ein bis drei Sätze"}',
    '',
    'Bedeutung der Felder:',
    '- modalitaetKorrekt: Jede Aussage zum Stand einer Maßnahme passt zur Bedeutung ihres Status (vorgesehen ≠ gemacht, in Prüfung ≠ beschlossen, abgelehnt ≠ geplant).',
    '- zuschreibungVorhanden: Statusaussagen sind der Quelle zugeschrieben („laut …"), nicht als eigene Behauptung formuliert.',
    '- keineErfolgsbehauptung: Nichts wird als umgesetzt, erreicht oder bestehend dargestellt, was laut Status nur läuft, geplant, geprüft oder abgelehnt ist.',
    '- gruppierungNachStatus: Bei Dokumenten mit verschiedenem Status gliedert die Antwort erkennbar nach Status; null, wenn alle zitierten Dokumente denselben Status haben oder keiner einen trägt.',
  ].join('\n')
  const user = [
    `Fragetyp: ${e.frage.typ}`,
    `Frage: ${e.frage.frage}`,
    '',
    'Zitierte Dokumente mit Legende:',
    dokumente || '(keine)',
    '',
    'Antwort des Systems:',
    e.antwort,
  ].join('\n')
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export interface RichterErgebnis {
  urteil: RichterUrteil
  /** Pflichten der Frage erfüllt: Modalität und keine Erfolgsbehauptung immer, Zuschreibung/Gruppierung nach `pflicht`. */
  bestanden: boolean
}

export function werteRichterUrteil(frage: GoldenSetFrage, urteil: RichterUrteil): RichterErgebnis {
  const zuschreibungOk = !frage.pflicht.zuschreibung || urteil.zuschreibungVorhanden
  // Gruppierung ist Pflicht nur, wenn das Set sie verlangt UND der Richter etwas zu gliedern sah.
  const gruppierungOk = !frage.pflicht.gruppierung || urteil.gruppierungNachStatus !== false
  return {
    urteil,
    bestanden: urteil.modalitaetKorrekt && urteil.keineErfolgsbehauptung && zuschreibungOk && gruppierungOk,
  }
}
