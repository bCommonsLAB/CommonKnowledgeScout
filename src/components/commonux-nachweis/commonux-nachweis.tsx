"use client"

/**
 * Nachweis M2 des Plans „Player herauslösen" (Repo commoning-methods): Die Bühne aus dem
 * Bündel `@commonux/player` (Common UX, früher HumanUX) läuft in KnowledgeScout, mit React 18
 * und Tailwind 3.
 *
 * Zwei Ansichten derselben Aufführung:
 * - „Kasten": die Bühne in einem Rahmen, mit eigenem Hintergrund (`einpassen="contain"`).
 * - „Hintergrund": die Bühne füllt die Fläche hinter einer gewöhnlichen Karte, ohne eigenen
 *   Hintergrund (`einpassen="cover"`, `durchsichtig`) — die Richtung von Etappe 6.
 *
 * Jeder Klick auf einen Darsteller landet im Protokoll darunter (Ereignis des Players).
 */
import { useState } from "react"
import { CommonUxPlayer, type DarstellerKlick } from "@commonux/player"
import szene from "./nachweis-auffuehrung.json"

type Ansicht = "kasten" | "hintergrund"

interface ProtokollEintrag extends DarstellerKlick {
  nr: number
}

const ANSICHTEN: ReadonlyArray<{ id: Ansicht; titel: string }> = [
  { id: "kasten", titel: "Kasten" },
  { id: "hintergrund", titel: "Hintergrund" },
]

export function CommonUxNachweis() {
  const [ansicht, setAnsicht] = useState<Ansicht>("kasten")
  const [protokoll, setProtokoll] = useState<ProtokollEintrag[]>([])

  const merke = (klick: DarstellerKlick) =>
    setProtokoll((alt) => [{ ...klick, nr: (alt[0]?.nr ?? 0) + 1 }, ...alt].slice(0, 6))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2" role="group" aria-label="Ansicht der Bühne">
        {ANSICHTEN.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAnsicht(a.id)}
            aria-pressed={ansicht === a.id}
            className={
              ansicht === a.id
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
            }
          >
            {a.titel}
          </button>
        ))}
      </div>

      {ansicht === "kasten" ? (
        <div className="h-[60vh] min-h-[320px] overflow-hidden rounded-lg border">
          <CommonUxPlayer szene={szene} onDarstellerKlick={merke} />
        </div>
      ) : (
        <div className="relative h-[60vh] min-h-[320px] overflow-hidden rounded-lg border bg-muted/40">
          <div className="absolute inset-0">
            <CommonUxPlayer szene={szene} einpassen="cover" durchsichtig onDarstellerKlick={merke} />
          </div>
          {/* Gewöhnliche Oberfläche darüber; nur die Karte fängt Klicks, der Rest geht zur Bühne. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-4">
            <div className="pointer-events-auto max-w-sm rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
              <h3 className="mb-1 text-sm font-semibold">Gewohnte Oberfläche</h3>
              <p className="text-sm text-muted-foreground">
                Diese Karte gehört zu KnowledgeScout. Dahinter läuft die Bühne ohne eigenen Hintergrund.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-lg border bg-card p-4 text-card-foreground">
        <h2 className="mb-2 text-sm font-semibold">Klicks auf Darsteller</h2>
        {protokoll.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keiner. Ein Klick auf eine Blase erscheint hier.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {protokoll.map((e) => (
              <li key={e.nr} className="font-mono">
                {`${e.nr}. ${e.darstellerId} auf ${e.seiteId ?? "–"}`}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
