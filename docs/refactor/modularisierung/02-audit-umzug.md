# Bestands-Audit: der Umzug nach `@ks/module-explorer`

Stand: 2026-08-30. Dritte Messung der Reihe, nach
[`00-audit-galerie.md`](00-audit-galerie.md) und
[`01-audit-galerie-chat.md`](01-audit-galerie-chat.md).

Reine Doku; es wurde kein Code geaendert.

## Die Frage

Sieben Vorarbeits-Wellen sind durch. Die Galerie zieht statt an 30 nur noch an
12 App-Stellen. Der Umzug selbst hat aber **nicht begonnen** — kein Byte liegt
in `packages/`.

Vor dem groessten Schritt des Vorhabens: Wie gross ist er wirklich, und in
welcher Reihenfolge geht er?

## 1. Der Umfang laut Landkarte §5

| Ort | Dateien | Zeilen |
|---|---:|---:|
| `src/components/library/gallery/` | 74 | 12.520 |
| `src/lib/chat/` | 32 | 9.907 |
| `src/components/library/chat/` | 36 | 6.891 |
| `src/hooks/gallery/` | 17 | 2.262 |
| `src/components/library/website/` | 6 | 843 |
| `src/components/library/story/` | 7 | 789 |
| `src/lib/gallery/` | 9 | 755 |
| `src/lib/website/` | 4 | 386 |
| `src/app/explore/` | 3 | 250 |
| `src/components/public/` | 1 | 157 |
| **Summe** | **189** | **34.760** |

Zum Vergleich: Der Explorer, den M4 zur montierbaren Wurzelkomponente gemacht
hat, ist ein Montagepunkt von 59 Zeilen.

## 2. Der Befund, der den Zuschnitt aendert

**`src/lib/chat` gehoert nicht in dieses Paket.**

Aufgeschluesselt nach Bereich — „Aussen-Gruppen" heisst: Import-Ziele
ausserhalb des gesamten Modul-Umfangs:

| Bereich | Dateien | Zeilen | Aussen-Gruppen |
|---|---:|---:|---:|
| Galerie (components + hooks + lib) | 100 | 15.637 | 18 |
| **Chat-Server (`lib/chat`)** | **32** | **9.939** | **23** |
| Chat-UI (`components/library/chat`) | 36 | 6.927 | 19 |
| Website | 10 | 1.239 | 5 |
| Story | 7 | 796 | 6 |
| Explore-Routen + public | 4 | 411 | 2 |

**Fünfzehn dieser 23 Gruppen braucht nur `lib/chat`** und sonst niemand im
Modul-Umfang:

`lib/db`, `lib/env`, `lib/logging`, `lib/repositories`, `lib/services`,
`lib/secretary`, `lib/ingestion`, `lib/external-jobs-repository`,
`lib/external-jobs-log-buffer`, `lib/config`, `lib/storage`, `lib/debug`,
`types/doc-meta`, `types/library`, `utils/decode-storage-file-id`.

Das ist der Server-Stack: Datenbankzugriff, Vektor-Repositories, Ingestion,
Job-Protokolle, LLM-Anbindung. In ein Paket, das in einer **fremden Seite**
montiert werden soll, gehoert davon nichts.

Zwei weitere Zahlen bestaetigen es:

- **52 Dateien ausserhalb** von `lib/chat` haengen daran — ueberwiegend
  API-Routen und Jobs. Das Paket wuerde ihnen den Boden wegziehen.
- **Die Chat-Oberflaeche braucht `lib/chat` fast gar nicht**: 28 ihrer 30
  Importe zeigen auf **eine** Datei, `lib/chat/constants` — Vokabular, kein
  Server.

### Was stattdessen noetig ist

`src/lib/chat/constants.ts` (816 Zeilen, 62 Exporte) ist **bereits
abhaengigkeitsfrei** — sie importiert nur `@ks/contracts` und `zod`. Sie hat
**51 Konsumenten** quer durch UI, Server, Einstellungen, Pipeline und Jobs.

Das ist geteiltes Vokabular und gehoert in ein Paket. M4d hat den Anfang
gemacht (`chat-vocabulary.ts` in `@ks/contracts`) und den Rest bewusst
liegengelassen — „das Paket beschreibt, es rechnet nicht". Fuer den Umzug
muss dieser Rest nachgezogen werden, sonst haengt die Chat-UI am Server-Ordner.

**Folge fuer die Landkarte**: Die Zeile in §5 nennt `src/lib/{chat,gallery,website}`
als Modul-Umfang. Fuer `chat` ist das falsch. Ohne `lib/chat` sind es
**157 Dateien und 24.821 Zeilen** statt 189/34.760.

## 3. Die gute Nachricht: die Bereiche haengen kaum aneinander

Kreuzverweise zwischen den UI-Bereichen, **statische und dynamische Importe**:

| von ↓ / nach → | Galerie | Chat-UI | Story | Website | Explore |
|---|---:|---:|---:|---:|---:|
| **Galerie** | — | 1 | 1 | 1 | 0 |
| **Chat-UI** | 1 | — | 0 | 0 | 0 |
| **Story** | 0 | 3 | — | 0 | 0 |
| **Website** | 4 | 0 | 0 | — | 0 |
| **Explore** | 0 | 0 | 0 | 2 | — |

**Vierzehn Verweise** auf 24.821 Zeilen. Das ist erstaunlich wenig.

> **Messfehler, der fast durchgegangen waere**: Die erste Fassung dieser
> Tabelle zeigte Galerie → Chat-UI = 0. Das Muster suchte nur `from '@/…'` —
> die Galerie laedt das Chat-Panel aber per `import('@/…')` (`next/dynamic`).
> Wer Kopplung misst, muss beide Formen erfassen.

Es gibt allerdings **Zyklen**: Galerie ↔ Chat-UI und Galerie ↔ Website. Zieht
man einen Bereich allein ins Paket, zeigt der Rest von der App ins Paket
(erlaubt) — aber das Paket auch zurueck in die App (verboten, Landkarte §4).

## 4. Optionen

| Option | Umfang | Verdikt |
|---|---|---|
| **A — alles auf einmal** | 157 Dateien, 24.821 Zeilen | **nein.** Das Fuenffache des PR-Budgets (5.000 Zeilen brutto). Und Paketgrenzen brechen im Docker-Build, nicht in Tests — bei dieser Groesse waere die Fehlersuche eine Grabung. |
| **B — die 14 Kreuzverweise zuerst aufloesen, dann Bereich fuer Bereich** | 14 Verweise, dann 5 Wellen | **empfohlen.** Jede Welle einzeln pruefbar, jede unter Budget. Das Muster steht dreimal (Betrachter, Adressierung, Gastgeber). |
| **C — nur die Galerie, Rest bleibt** | 100 Dateien, 15.637 Zeilen | zurueckgestellt. Loest die Zyklen nicht, sondern macht sie zu Grenzverletzungen. |

### Reihenfolge fuer B

| # | Schritt | Umfang | Warum hier |
|---|---|---|---|
| 1 | Chat-Vokabular (`lib/chat/constants`) ins Paket | 816 Zeilen, 51 Konsumenten | loest die Chat-UI vom Server-Ordner; Voraussetzung fuer alles Weitere |
| 2 | Die 14 Kreuzverweise zu Slots/Props machen | 14 Stellen | danach ist jeder Bereich einzeln bewegbar |
| 3 | Explore-Routen + public | 4 Dateien, 411 Zeilen | kleinster Bereich, 2 Aussen-Gruppen |
| 4 | Website | 10 Dateien, 1.239 Zeilen | 5 Aussen-Gruppen |
| 5 | Story | 7 Dateien, 796 Zeilen | 6 Aussen-Gruppen |
| 6 | Chat-UI | 36 Dateien, 6.927 Zeilen | nach Schritt 1 deutlich entkoppelt |
| 7 | Galerie | 100 Dateien, 15.637 Zeilen | die groesste, aber die am besten vorbereitete |

Schritt 7 bleibt ueber Budget und muesste selbst geteilt werden — vermutlich
entlang `lib/gallery` / `hooks/gallery` / `components`.

## 5. Beweis-Ziele

- **Nach Schritt 2**: ein Test, der Kreuzverweise zwischen den fuenf Bereichen
  verbietet. Er faellt sofort gruen und haelt es fest.
- **Nach jedem Umzugsschritt**: `pnpm typecheck:packages` ist der schaerfere
  Nachweis als der Gesamt-Build — er typprueft jedes Paket **isoliert**, ohne
  die Root-`paths`. Ein Rueckwaerts-Import scheitert dort mit `TS2307`, auch
  wenn Webpack ihn aufloesen wuerde.
- **Pflicht bei jedem Schritt**: `pnpm build` lokal. Die Lehre aus M4b.

## 6. Was dieses Audit NICHT beantwortet

- **Ob `src/lib/chat` einen eigenen Zuschnitt braucht.** Es ist Server-Code mit
  52 Konsumenten; ob er ein Paket wird, ein API-Ordner bleibt oder aufgeteilt
  gehoert, ist eine eigene Frage.
- **Wie Schritt 7 zu teilen ist.** Das braucht eine eigene Messung, wenn die
  Schritte 1–6 durch sind.
- **Ob `types/item` (444 Nutzer) und `VIEW_TYPE_REGISTRY` (681 Zeilen, geteilt
  mit Einstellungen/Vorlagen/Chat) vorher aufgeloest werden muessen.** Beide
  stehen im Galerie-Audit als eigene Wellen.
