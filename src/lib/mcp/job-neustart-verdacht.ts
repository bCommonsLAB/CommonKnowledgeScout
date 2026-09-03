/**
 * @fileoverview Prozess-Neustart am Muster erkennen (Welle W8).
 *
 * @description
 * Cowork-Befund 02.09.2026: Beim Server-Neustart um 12:45 verstummten alle
 * sechs Worker-Slots **innerhalb einer Minute**. `job_liste` sagte dazu
 * „nichts zu tun ausser warten" — und das war falsch: Es gab nichts mehr,
 * worauf zu warten war, der Prozess war weg. Bis der Reaper nach seiner
 * langen Schwelle zuschlug, stand die Warteschlange. Zweimal 30 Minuten
 * Stillstand an einem Tag.
 *
 * Der Normalfall und der Ausfall sind am Muster zu unterscheiden:
 *
 * - Ein ARBEITENDER Job schweigt minutenlang (Transkription, LLM-Lauf) —
 *   aber seine Nachbarn schweigen zu anderen Zeiten. Die letzten
 *   Lebenszeichen liegen auseinander.
 * - Bei einem PROZESS-NEUSTART hoeren alle im selben Moment auf. Die letzten
 *   Lebenszeichen liegen dicht beieinander und alle in der Vergangenheit.
 *
 * Dieses Modul benennt genau das — als **Verdacht**, nicht als Befund, und
 * ohne selbst zu handeln. Ein zweiter Automat neben dem Reaper wuerde die
 * Entscheidung wieder verstecken; hier bekommt der Mensch den Satz, der ihm
 * gefehlt hat, und `jobs_aufraeumen` ist der Griff dazu.
 *
 * @module mcp
 */

/** Wie dicht die letzten Lebenszeichen liegen muessen, um „gleichzeitig" zu heissen. */
export const GLEICHZEITIG_FENSTER_MS = 120_000

/** Wie lange alle schweigen muessen, bevor der Verdacht ueberhaupt aufkommt. */
export const MINDEST_STILLE_MS = 5 * 60_000

export interface NeustartVerdacht {
  verdacht: boolean
  /** Spanne zwischen aeltestem und juengstem Lebenszeichen, in Sekunden. */
  spanneSekunden: number | null
  /** Wie lange das JUENGSTE Lebenszeichen her ist, in Minuten. */
  stilleMinuten: number | null
  hinweis: string | null
}

const KEIN_VERDACHT: NeustartVerdacht = {
  verdacht: false, spanneSekunden: null, stilleMinuten: null, hinweis: null,
}

/**
 * Prueft die letzten Lebenszeichen der laufenden Jobs auf das Neustart-Muster.
 *
 * Bewusst erst ab ZWEI laufenden Jobs: Ein einzelner stiller Job beweist
 * nichts — er koennte schlicht arbeiten. Das Muster lebt davon, dass mehrere
 * gleichzeitig verstummen.
 */
export function pruefeNeustart(
  lebenszeichen: readonly Date[],
  jetzt: Date,
): NeustartVerdacht {
  if (lebenszeichen.length < 2) return KEIN_VERDACHT

  const zeiten = lebenszeichen.map((datum) => datum.getTime()).sort((a, b) => a - b)
  const aeltestes = zeiten[0]
  const juengstes = zeiten[zeiten.length - 1]
  const spanneMs = juengstes - aeltestes
  const stilleMs = jetzt.getTime() - juengstes

  if (spanneMs > GLEICHZEITIG_FENSTER_MS || stilleMs < MINDEST_STILLE_MS) return KEIN_VERDACHT

  const spanneSekunden = Math.round(spanneMs / 1000)
  const stilleMinuten = Math.round(stilleMs / 60_000)
  return {
    verdacht: true,
    spanneSekunden,
    stilleMinuten,
    hinweis:
      `Alle ${lebenszeichen.length} laufenden Jobs des Pools sind innerhalb von ${spanneSekunden} ` +
      `Sekunden verstummt und schweigen seit ${stilleMinuten} Minuten. Das ist das Muster eines ` +
      'PROZESS-NEUSTARTS, nicht das von laufender Arbeit: Ein arbeitender Job schweigt zwar auch ' +
      'minutenlang, aber nicht im Gleichschritt mit allen anderen. Warten hilft hier nicht — ' +
      'jobs_aufraeumen mit kurzer mindestStillstandMinuten gibt die Slots sofort frei, statt die ' +
      'Reaper-Schwelle abzusitzen. (Verdacht aus dem Zeitmuster, kein Beweis: Wenn tatsaechlich ' +
      'alle Jobs gleichzeitig in einen langen Schritt gegangen sind, waeren sie noch am Leben.)',
  }
}
