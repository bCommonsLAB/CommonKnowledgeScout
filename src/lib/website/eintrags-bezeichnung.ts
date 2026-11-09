/**
 * Bezeichnung der Einträge einer Library in der Website-Story-Sektion
 * (Owner 09.11.2026): „Quellen" ist technische Sprache. Trägt die Library
 * unter `publicPublishing.gallery.itemLabel`/`itemLabelPlural` ein Wort
 * (z. B. „Vortrag"/„Vorträge", „Talk"/„Talks"), tragen Plakette, Knopf,
 * Spaltentitel, Verweis und Blatt-Titel dieses Wort; sonst die heutigen
 * i18n-Texte. Die Bezeichnung ist EINSPRACHIG je Library — sie steht in
 * jeder Oberflächensprache gleich da.
 *
 * Einzahl ohne Mehrzahl (oder umgekehrt) weist die Veröffentlichung ab
 * (`public-publishing-validation.ts`); hier wird ein solcher Stand gemeldet
 * und wie „kein Eintrag" behandelt, damit nichts still halb ersetzt wird.
 */

export interface BezeichnungQuelle {
  itemLabel?: string
  itemLabelPlural?: string
}

export type Uebersetzer = (key: string, params?: Record<string, string | number>) => string

export interface EintragsBezeichnung {
  /** Ist eine Bezeichnung der Library wirksam? */
  eigen: boolean
  /** Plakette im Antwortkopf: „5 Talks zitiert" / „5 Quellen zitiert". */
  zitiert: (anzahl: number) => string
  /** Knopf im Antwortkopf: „Talks anzeigen" / „Quellen anzeigen". */
  anzeigen: string
  /** Titel der Kartenspalte: „Genannte Talks" / „Genannte Quellen". */
  spalte: string
  /** Verweis unter den Karten ins Blatt: „weitere Talks mit Textstellen". */
  weitere: string
  /** Titel des Belege-Blatts; undefined = Paket-Text „Belege". */
  blattTitel: string | undefined
}

export function eintragsBezeichnung(quelle: BezeichnungQuelle | undefined, t: Uebersetzer): EintragsBezeichnung {
  const einzahl = quelle?.itemLabel?.trim() ?? ''
  const mehrzahl = quelle?.itemLabelPlural?.trim() ?? ''
  if ((einzahl === '') !== (mehrzahl === '')) {
    console.error(`[eintragsBezeichnung] itemLabel und itemLabelPlural gehoeren zusammen (hier: "${einzahl}" / "${mehrzahl}") — heutige Texte`)
  }
  if (einzahl && mehrzahl) {
    return {
      eigen: true,
      zitiert: (n) => (n === 1 ? t('website.story.bezeichnungZitiertEins', { label: einzahl }) : t('website.story.bezeichnungZitiert', { count: n, label: mehrzahl })),
      anzeigen: t('website.story.bezeichnungAnzeigen', { label: mehrzahl }),
      spalte: t('website.story.bezeichnungSpalte', { label: mehrzahl }),
      weitere: t('website.story.bezeichnungWeitere', { label: mehrzahl }),
      blattTitel: mehrzahl,
    }
  }
  return {
    eigen: false,
    zitiert: (n) => (n === 1 ? t('story.konversation.quellenZitiert.one') : t('story.konversation.quellenZitiert.many', { count: n })),
    anzeigen: t('website.story.quellenAnzeigenKurz'),
    spalte: t('website.story.quellenSpalte'),
    weitere: t('website.story.quellenWeitere'),
    blattTitel: undefined,
  }
}
