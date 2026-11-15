'use client'

/**
 * @fileoverview Reiter „Sitzungen" der Agentensicht (Plan sitzungen-register, Welle R3).
 *
 * @description
 * Muster Werkbank: Liste gruppiert links, Details rechts (`WerkbankLayout`).
 * Liest NUR die Sitzungs-Route (MongoDB: Register und Ablage-Cache der
 * Sichten-Laeufe) und haengt nicht am Coverage-Report (W8). Sicht, Filter,
 * Gruppen und Auswahl stehen in der Adresse; gerechnet wird mit den reinen
 * `reiter-*`-Funktionen. Der Sprung „Vorhaben in der Werkbank" setzt
 * `?tab=werkbank&vorhaben=<folderId>`.
 *
 * @module components/library/agent-view/sitzungen
 */

import { useMemo } from 'react'
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { Alert, AlertDescription, AlertTitle, Button } from '@ks/ui'
import { useSitzungen } from '@/hooks/agent-view/use-sitzungen'
import { useSitzungenUrlState } from '@/hooks/agent-view/use-sitzungen-url-state'
import { bekannteVorhaben, gruppiere } from '@/lib/agent-view/sitzungen-register/reiter-gruppen'
import { filtereReiter, inSicht, sortiereReiter, zaehleSichten } from '@/lib/agent-view/sitzungen-register/reiter-sicht'
import { AGENT_VIEW_TABS } from '../agent-view-tabs'
import { WerkbankLayout } from '../werkbank/werkbank-layout'
import { SitzungDetail } from './sitzung-detail'
import { SitzungenKennzahlen } from './sitzungen-kennzahlen'
import { SitzungenListe } from './sitzungen-liste'

export function SitzungenPanel({ libraryId }: { libraryId: string }) {
  const { daten, isLoading, fehler, neuLaden, setzen, speichert } = useSitzungen(libraryId)
  const url = useSitzungenUrlState()
  const [, setTab] = useQueryState('tab', parseAsStringLiteral(AGENT_VIEW_TABS))
  const [, setVorhaben] = useQueryState('vorhaben', parseAsString)

  const ansicht = useMemo(() => {
    if (daten === null) return null
    const jetzt = new Date(daten.geladenAm)
    const gefiltert = filtereReiter(daten.zeilen, { suche: url.suche, werkzeuge: url.werkzeuge, von: url.von, bis: url.bis }, jetzt)
    const inDerSicht = sortiereReiter(gefiltert.filter((z) => inSicht(z, url.sicht, jetzt)), url.sortierung)
    return {
      jetzt,
      zahlen: zaehleSichten(gefiltert, jetzt),
      gruppen: gruppiere({ zeilen: inDerSicht, alle: daten.zeilen, gruppierung: url.gruppierung, jetzt }),
      vorhaben: bekannteVorhaben(daten.zeilen),
    }
  }, [daten, url.suche, url.werkzeuge, url.von, url.bis, url.sicht, url.sortierung, url.gruppierung])

  if (fehler !== null) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Sitzungs-Register nicht verfügbar</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          {fehler}
          <Button size="sm" variant="outline" onClick={neuLaden}>Neu laden</Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (isLoading || daten === null || ansicht === null) {
    return <p className="text-sm text-muted-foreground">Lade Sitzungs-Register …</p>
  }

  const gewaehlt = url.auswahl === null ? undefined : daten.zeilen.find((z) => z.registerId === url.auswahl)
  const zurWerkbank = (folderId: string) => {
    void setVorhaben(folderId)
    void setTab('werkbank')
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col gap-2">
      <WerkbankLayout
        breiteFeld="sitzungenListeSize"
        detailAktiv={gewaehlt !== undefined}
        onZurListe={() => void url.setAuswahl(null)}
        liste={
          <SitzungenListe
            sicht={url.sicht} zahlen={ansicht.zahlen} onSicht={url.setSicht}
            gruppierung={url.gruppierung} onGruppierung={(g) => void url.setGruppierung(g)}
            sortierung={url.sortierung} onSortierung={(s) => void url.setSortierung(s)}
            suche={url.suche} onSuche={(s) => void url.setSuche(s === '' ? null : s)}
            werkzeuge={url.werkzeuge} onWerkzeuge={(w) => void url.setWerkzeuge(w.length === 0 ? null : w)}
            von={url.von} bis={url.bis}
            onZeitraum={(von, bis) => { void url.setVon(von); void url.setBis(bis) }}
            gruppen={ansicht.gruppen} auswahl={url.auswahl} jahr={ansicht.jetzt.getFullYear()}
            onWaehlen={(id) => void url.setAuswahl(id)}
          />
        }
        detail={
          gewaehlt !== undefined ? (
            <SitzungDetail
              zeile={gewaehlt}
              libraryId={libraryId}
              vorhaben={ansicht.vorhaben}
              jetzt={ansicht.jetzt}
              speichert={speichert}
              setzen={setzen}
              onZurWerkbank={zurWerkbank}
              onUmgeschluesselt={(id) => void url.setAuswahl(id)}
            />
          ) : (
            <SitzungenKennzahlen
              bilanz={daten.bilanz}
              hinweis={url.auswahl !== null ? `Sitzung „${url.auswahl}" steht nicht (mehr) im Register.` : null}
            />
          )
        }
      />
    </div>
  )
}
