"use client"

/**
 * Eine Zeile der Tabelle „Sprachmodelle": Position, Modell, Preis, Probe, Schalter.
 * Knoepfe brechen nie um — bei wenig Platz nur Symbol, Text im Tooltip.
 */

import { ArrowDown, ArrowUp, CheckCircle2, FlaskConical, Pencil, XCircle } from "lucide-react"
import { Badge, Button, Switch, TableCell, TableRow, Tooltip, TooltipContent, TooltipTrigger } from "@ks/ui"
import type { SprachmodellZeile } from "@/types/sprachmodell"
import { formatKontext, formatPreis, formatZeitpunkt } from "./format"

interface ModellZeileProps {
  modell: SprachmodellZeile
  position: number
  istErste: boolean
  istLetzte: boolean
  beschaeftigt: boolean
  onHoch: () => void
  onRunter: () => void
  onProbe: () => void
  onSchalter: (aktiv: boolean) => void
  onBearbeiten: () => void
}

function ProbeStand({ modell }: { modell: SprachmodellZeile }) {
  const probe = modell.probe
  if (!probe) return <span className="text-xs text-muted-foreground">noch keine</span>
  const text = probe.ok
    ? `${formatZeitpunkt(probe.at)} · ${(probe.ms / 1000).toFixed(1)} s · Antwort „${probe.antwort ?? ""}"`
    : `${formatZeitpunkt(probe.at)} · ${probe.fehler ?? "ohne Meldung"}`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
          {probe.ok
            ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            : <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />}
          {probe.ok ? `${(probe.ms / 1000).toFixed(1)} s` : "gescheitert"}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{text}</TooltipContent>
    </Tooltip>
  )
}

export function ModellZeile(props: ModellZeileProps) {
  const { modell, position, istErste, istLetzte, beschaeftigt } = props
  const schalterGesperrt = beschaeftigt || (!modell.isActive && !modell.probe?.ok)
  return (
    <TableRow className={modell.isActive ? undefined : "text-muted-foreground"}>
      <TableCell className="w-20">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span className="w-5 text-right tabular-nums">{position}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={beschaeftigt || istErste} onClick={props.onHoch} title="Nach oben">
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={beschaeftigt || istLetzte} onClick={props.onRunter} title="Nach unten">
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{modell.name}</div>
        {modell.imKatalog === false && (
          <Badge variant="destructive" className="my-0.5 whitespace-nowrap">nicht mehr bei OpenRouter</Badge>
        )}
        <div className="text-xs text-muted-foreground font-mono">{modell.modelId}</div>
        {modell.strengths && <div className="text-xs text-muted-foreground">{modell.strengths}</div>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm tabular-nums">{formatPreis(modell.preisEin, modell.preisAus)}</TableCell>
      <TableCell className="hidden xl:table-cell whitespace-nowrap text-sm tabular-nums">{formatKontext(modell.kontext)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <ProbeStand modell={modell} />
          <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={beschaeftigt} onClick={props.onProbe} title="Probefrage über den Secretary">
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            <span className="hidden xl:inline xl:ml-1">Probe</span>
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={modell.isActive}
          disabled={schalterGesperrt}
          onCheckedChange={props.onSchalter}
          aria-label={modell.isActive ? "Abschalten" : "Aktiv schalten"}
          title={!modell.isActive && !modell.probe?.ok ? "Erst nach erfolgreicher Probe" : undefined}
        />
      </TableCell>
      <TableCell className="w-10">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={beschaeftigt} onClick={props.onBearbeiten} title="Name und Stärken bearbeiten">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
