'use client'

/**
 * @fileoverview Rechte Seite des Reiters „Sitzungen" mit gewaehlter Sitzung (Register, Welle R3).
 *
 * @description
 * Figma „2 · Sitzung gewählt" und „3 · Auffällig": Kopf mit Stand-Schritten,
 * Kasten „warum" und Hinweise, Vorschlag (sichtbar bei Bedarf), Belege,
 * Kennung, Bemerkung, Knopfzeile. Geschrieben wird nur ueber die PATCH-Route
 * (`setzen`); danach laedt die Liste neu, der Stand kommt vom Server.
 * Schlaegt ein Schreiben fehl, sagt es der Dialog bzw. eine Meldung.
 *
 * @module components/library/agent-view/sitzungen
 */

import { useEffect, useState } from 'react'
import { useToast } from '@ks/ui'
import type { SitzungSetzenAntwort } from '@/lib/agent-view/sitzungen-register/reiter-antwort'
import { leseZugbereiche } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import type { SetzEingabe } from '@/lib/agent-view/sitzungen-register/schreib-plaene'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'
import { SitzungAktionen } from './sitzung-aktionen'
import { SitzungBelege, SitzungBemerkung, SitzungKennung, SitzungVorschlag } from './sitzung-felder'
import { SitzungGrundDialog, type GrundDialogArt } from './sitzung-grund-dialog'
import { SitzungHinweise } from './sitzung-hinweise'
import { SitzungKopf, StandSchritte } from './sitzung-kopf'

const PFLICHT = (t: string) => (t.trim() === '' ? 'Ein Grund ist Pflicht.' : null)

function bemerkungMit(alt: string | null, zusatz: string): string {
  return alt === null || alt.trim() === '' ? zusatz : `${alt}\n${zusatz}`
}

export function SitzungDetail(props: {
  zeile: SitzungsSicht
  libraryId: string
  vorhaben: readonly string[]
  jetzt: Date
  speichert: boolean
  setzen: (args: { registerId: string; eingabe: SetzEingabe }) => Promise<SitzungSetzenAntwort>
  onZurWerkbank: (folderId: string) => void
  onUmgeschluesselt: (registerId: string) => void
}) {
  const { zeile } = props
  const { toast } = useToast()
  const [dialog, setDialog] = useState<GrundDialogArt | null>(null)
  const [vorschlagGewuenscht, setVorschlagGewuenscht] = useState(false)
  useEffect(() => setVorschlagGewuenscht(false), [zeile.registerId])
  const vorschlagSichtbar = vorschlagGewuenscht || zeile.vorhabenVorschlag !== null || zeile.hinweise.some((h) => h.code === 'beleg_ohne_vorhaben')

  const schreibe = async (eingabe: SetzEingabe) => {
    const r = await props.setzen({ registerId: zeile.registerId, eingabe })
    if (r.umgeschluesselt !== null) props.onUmgeschluesselt(r.umgeschluesselt.nach)
  }
  const direkt = (eingabe: SetzEingabe) => {
    schreibe(eingabe).catch((error: unknown) =>
      toast({ title: 'Nicht gespeichert', description: error instanceof Error ? error.message : String(error), variant: 'destructive' }),
    )
  }

  const ueberspringen = (): GrundDialogArt => ({
    titel: 'Sitzung überspringen',
    beschreibung: 'Die Sitzung kommt nicht ins Archiv. Der Grund steht danach an der Zeile.',
    platzhalter: 'z. B. ohne Substanz, nur eine Zugriffsfrage',
    knopf: 'Überspringen',
    vorbelegt: zeile.entscheidungGrund ?? '',
    pruefen: PFLICHT,
    absenden: (t) => schreibe({ entscheidung: 'ueberspringen', entscheidungGrund: t }),
  })
  const trennen = (): GrundDialogArt => ({
    titel: 'In Teile trennen',
    beschreibung: 'Zugbereiche je Teil, getrennt durch Semikolon, z. B. „1-10; 11-25". Der Skill schließt die Teile einzeln ab.',
    platzhalter: '1-10; 11-25',
    knopf: 'Trennen',
    vorbelegt: zeile.zugbereiche.map((z) => `${z.von}-${z.bis}`).join('; '),
    pruefen: (t) => {
      const r = leseZugbereiche(t)
      if (!r.ok) return r.fehler
      return r.bereiche.length < 2 ? 'Mindestens zwei Teile.' : null
    },
    absenden: async (t) => {
      const r = leseZugbereiche(t)
      if (!r.ok) throw new Error(r.fehler)
      await schreibe({ entscheidung: 'trennen', zugbereiche: r.bereiche })
    },
  })
  const soLassen = (): GrundDialogArt => ({
    titel: 'So lassen',
    beschreibung: 'Der Beleg bleibt ohne Vorhaben. Der Grund kommt in die Bemerkung; der Hinweis bleibt sichtbar.',
    platzhalter: 'z. B. gehört zu keinem Vorhaben, nur Organisation',
    knopf: 'Vermerken',
    vorbelegt: '',
    pruefen: PFLICHT,
    absenden: (t) => schreibe({ bemerkung: bemerkungMit(zeile.bemerkung, `So gelassen (ohne Vorhaben): ${t}`) }),
  })

  return (
    <div className="@container flex h-full flex-col gap-[18px] overflow-auto px-7 py-6">
      <SitzungKopf zeile={zeile} onZurWerkbank={props.onZurWerkbank} />
      <StandSchritte zeile={zeile} />
      <SitzungHinweise zeile={zeile} jetzt={props.jetzt} onVorschlagen={() => setVorschlagGewuenscht(true)} onSoLassen={() => setDialog(soLassen())} />
      {vorschlagSichtbar && (
        <SitzungVorschlag
          zeile={zeile}
          vorhaben={props.vorhaben}
          speichert={props.speichert}
          onSetzen={(ordner) => direkt({ vorhabenVorschlag: ordner === null ? null : { ordner, herkunft: 'reiter' } })}
        />
      )}
      <SitzungBelege zeile={zeile} libraryId={props.libraryId} />
      <SitzungKennung zeile={zeile} />
      <SitzungBemerkung zeile={zeile} speichert={props.speichert} onSpeichern={(text) => direkt({ bemerkung: text })} />
      <SitzungAktionen
        zeile={zeile}
        libraryId={props.libraryId}
        speichert={props.speichert}
        onUeberspringen={() => setDialog(ueberspringen())}
        onNichtUeberspringen={() => direkt({ entscheidung: 'offen' })}
        onVorschlagen={() => setVorschlagGewuenscht(true)}
        onTrennen={() => setDialog(trennen())}
      />
      <SitzungGrundDialog art={dialog} onSchliessen={() => setDialog(null)} />
    </div>
  )
}
