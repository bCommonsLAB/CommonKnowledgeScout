---
name: d04-tisch-laufzeit
overview: "Detailkonzept D4: Der Zustand eines Tisches am Server — Treffen starten, anhalten und beenden, Agenda mit laufendem Punkt und Timer, Ernte- und Messfenster öffnen und schließen, Stille Runde als Server-Regel, Unterbrechbarkeit, Polling mit Serverzeit, Beamer-Spiegel. Schnittstellen zu Route- und Repo-Konventionen und zum QueryClient."
vorhaben: [26.05 SHF Nachhaltigkeit, 24.09 KnowledgeScout]
status: konzept
---

# D4 · Tisch-Laufzeit

**Grundlage:** [D0](../beteiligung-objektmodell-original-und-kopie.plan.md)
(Klasse **V · Verfahren**, Original in MongoDB),
[D1](d01-veranstaltung-aufsetzen.plan.md) (Snapshot `meetings`,
`meeting_tables` mit Agenda). Präzisiert Abschnitt 2 des Wellen-Plans
(`shf-umsetzung-wellen.plan.md`). Geprüft gegen `master` 579f2d7.

## 1. Zweck und Screens

| Screen | Was passiert |
|---|---|
| M-S1.2 Mein Tisch heute | Ablauf und wer da ist; „Runde 1 starten“ |
| M-S3.2 Runde steuern | Agenda mit Zeiten, laufender Punkt hervorgehoben, Timer, „+5 Min“, „Zur Ernte einladen“, „Auf Beamer zeigen“ |
| M-S6.3 Messung läuft (Fenster-Teil) | Uhr, „6 von 8“, Fenster schließen, „+2:00“ |
| T-S3.1 / E-S3.1 | Teilnehmende sehen den laufenden Punkt und ob die Ernte offen ist |

## 2. Modell (in `meeting_tables` und `meetings`, Klasse V)

```ts
// am Treffen
state: 'freigegeben' | 'laeuft' | 'angehalten' | 'beendet'
stateHistory: { to: string; at: string; by: string; reason?: string }[]

// am Tisch
run: {
  agendaIndex: number              // laufender Agendapunkt (Index in agenda[])
  startedAt: string | null         // Start des laufenden Punkts
  extendedSec: number              // Summe der Verlängerungen dieses Punkts
  pausedAt: string | null          // gesetzt, solange der Tisch angehalten ist
  pausedTotalSec: number           // Summe der Pausen dieses Punkts
  mirroredToBeamer: boolean
}
windows: Array<{
  windowId: string                 // ULID
  kind: 'ernte' | 'messung'
  passageId: string
  agendaIndex: number
  openedAt: string; openedBy: string
  closesAt: string | null          // geplantes Ende (Countdown), null = offen ohne Uhr
  closedAt: string | null; closedBy: string | null
  measurementId?: string           // bei kind = messung (D7)
}>
revision: number                   // steigt bei jeder Änderung; Optimistic Concurrency
```

**Regeln (reine Funktionen in `src/lib/deliberation/runtime/`):**
- Am Tisch ist **höchstens ein Fenster offen**.
- Ein Fenster gehört zu genau einem Agendapunkt der Art `ernte` bzw.
  `messung` mit `passageId` (D1).
- Die Restzeit des laufenden Punkts ist `minutes*60 + extendedSec −
  (jetzt − startedAt − pausedTotalSec)`. Sie wird **am Server gerechnet**
  und als Zahl mitgeliefert.
- **Anhalten** (Tisch oder ganzes Treffen) setzt `pausedAt` und hält den
  Countdown des offenen Fensters an: `closesAt` wird beim Fortsetzen um
  die Pausendauer verschoben. Neue Beiträge und Stellungnahmen werden
  angenommen, solange das Fenster offen ist (Anhalten stoppt die Uhr,
  nicht die Menschen).
- **Unterbrechbar (Entscheidung 10):** Ein angehaltenes Treffen darf Tage
  später fortgesetzt werden. Der gesamte Zustand steht in MongoDB, der
  Client hält nichts.
- **Fenster schließen** löst den Fensterschluss aus (D5: Beiträge werden
  Dateien). Schließen ist endgültig; ein neues Fenster zum selben Punkt
  ist eine neue Runde.
- Ein Fenster mit abgelaufenem `closesAt` schließt **nicht** von selbst.
  Die Moderation schließt. Die Oberfläche zeigt „Zeit abgelaufen“. Grund:
  Ein Schließen ohne Menschen würde die Promotion (D5) ohne Aufsicht
  starten.

## 3. Stille Runde (Entscheidung 4)

Solange ein Ernte- oder Messfenster offen ist, gilt:

| Wer | Sieht |
|---|---|
| Teilnehmende | nur die eigenen Beiträge bzw. Stellungnahmen |
| Moderation des Tisches | wer abgegeben hat (`participantId`, `displayName`, Zeitpunkt), **nicht was** |
| Redaktion, Owner | wie die Moderation; die Regel gilt für alle |

Umsetzung: Ein Filter in den Lese-Endpunkten von D3 und D7 prüft
`windows[]` des Tisches, bevor er Inhalte ausliefert. Getestet wird die
API-Antwort, nicht die Oberfläche.

## 4. Aktualisierung bei den Geräten: Polling mit Serverzeit

- Es gibt kein SSE. Der vorhandene Stream ist an die Session und an einen
  prozesslokalen Bus gebunden (`api/external/jobs/stream`,
  `job-event-bus.ts:62-67`) und trägt bei mehreren Instanzen nicht.
- Die Geräte fragen `GET …/tables/[tableId]/state` in Abständen ab:
  - TanStack Query mit `refetchInterval`, 3 s für die Moderation, 5 s
    für Teilnehmende, 2 s für den Beamer;
  - bei `document.hidden` pausiert.
  - Der QueryClient liegt in `packages/shell/src/providers/query-provider.tsx:19-37`;
    `refetchInterval` wird im Repo bisher nirgends genutzt.
- **Serverzeit:** Jede Antwort trägt `serverNow` (ISO) und die fertig
  gerechneten Restzeiten. Der Client rechnet nur die Anzeige zwischen zwei
  Antworten weiter. Uhrabweichungen der Geräte spielen damit keine Rolle.
  Das Muster gibt es im Repo noch nicht.
- **Antwortgröße klein halten:** Der Endpunkt liefert Zustand, Agenda, das
  offene Fenster und die Zähler („6 von 8“), keine Beitragstexte.

## 5. Aktionen der Moderation

Alle Aktionen gehen über `POST …/tables/[tableId]/actions` mit
`{action, expectedRevision, …}`:

| Aktion | Wirkung | Bedingung |
|---|---|---|
| `start_meeting` (am Treffen) | `state: laeuft` | Treffen `freigegeben`; Redaktion oder eine Moderation des Treffens |
| `pause` / `resume` (Tisch oder Treffen) | `pausedAt` setzen bzw. auflösen, Fenster-Uhr verschieben | — |
| `next_item` / `goto_item {index}` | laufenden Punkt wechseln, Timer neu | kein offenes Fenster, oder `closeWindow: true` mitgeben |
| `extend {seconds}` | `extendedSec += seconds` bzw. `closesAt += seconds` | — |
| `open_window {kind, seconds?}` | neues Fenster am laufenden Punkt | Punkt ist `ernte`/`messung`; kein anderes Fenster offen |
| `close_window` | Fenster schließen → D5 bzw. D7 | Fenster offen |
| `mirror {on}` | Beamer-Spiegel an/aus | — |
| `end_meeting` (am Treffen) | `state: beendet` | alle Fenster geschlossen |

- Ein veraltetes `expectedRevision` ergibt 409. Das schützt vor zwei
  Geräten derselben Moderatorin.
- Jede Aktion landet mit Zeit und Person in `stateHistory` bzw. einem
  Ereignislog am Tisch. Das lesbare Protokoll (Klasse V, gerendert) kommt
  daraus.

## 6. Beamer

- Die Route `/beamer/[tableId]` hat eine eigene Oberfläche ohne App-Rahmen.
  Heute blendet nur die Wurzel-Landingpage den Rahmen aus
  (`app-layout.tsx:41`); dafür braucht es ein eigenes Layout.
- Die Seite ist angemeldet: Redaktion, Moderation des Tisches.
- Sie zeigt, was die Moderation spiegelt: den laufenden Punkt mit Timer,
  die Auswertung (D7) und das Ergebnis (D8).
- Tippen schaltet weiter.
- `requestFullscreen` gibt es im Bestand nicht; die Seite fordert
  Vollbild beim ersten Tippen an.

## 7. Schnittstellen

### 7.1 Bestand

| Zweck | Bestand |
|---|---|
| Route-Gerüst | `docs/architecture/api-route-conventions.md` (Params awaiten, `auth()` → `currentUser()`, Fehler als `{error}`, `FileLogger` im catch); Vorlage `src/app/api/library/[libraryId]/source-user-states/route.ts` |
| Repo-Gerüst | `docs/architecture/mongodb-repository-pattern.md` (`getCollection`, Index-Cache, `ensure…Indexes`); Vorlage `src/lib/repositories/archive-item-properties-repo.ts` |
| Polling | QueryClient `packages/shell/src/providers/query-provider.tsx`; Hook-Muster `packages/api-client/src/llm-models.ts:30-35` |
| Zeitformat | `formatDuration` (`src/components/shared/live-status-line.tsx:21`) |
| Rechte | D11 `resolveDeliberationRole` |

### 7.2 Neu

| Baustein | Signatur |
|---|---|
| Zustandsfunktionen (rein) | `applyTableAction(table, action, now, actor): TableRuntime` (wirft bei unerlaubter Aktion); `remainingSeconds(table, now)`; `openWindow(table)`; `visibilityFor(role, table)` |
| Repo | `meeting-tables-repo.ts`: `getTable`, `updateRuntime(tableId, next, expectedRevision)` (bedingte Aktualisierung auf `revision`) |
| Routen | `GET /api/deliberation/[libraryId]/tables/[tableId]/state` · `POST …/actions` · `POST …/meetings/[meetingId]/actions` |
| Hook | `useTableState(libraryId, tableId, role)` mit `refetchInterval` und `serverNow`-Abgleich |
| Seiten | `/moderation/[tableId]`, `/beamer/[tableId]` (Layout ohne Rahmen) |

## 8. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Zwei Geräte ändern gleichzeitig | 409 mit aktuellem Zustand; der Client zeigt „Zustand hat sich geändert“ |
| Aktion am falschen Tisch (Moderation eines anderen Tisches) | 403 |
| Fenster öffnen an einem Punkt ohne `passageId` | 422; das ist ein Planfehler, den D1 schon verhindern sollte |
| `close_window`, aber der Fensterschluss (D5) scheitert am Storage | Das Fenster ist geschlossen, die Promotion läuft erneut; der Zustand zeigt „Übertragung ins Archiv ausstehend“ (D5) |
| Netz weg beim Teilnehmer | Der Client zeigt den letzten Stand mit Zeitstempel und „keine Verbindung“; kein stiller Countdown ins Leere |

## 9. Tests

- `applyTableAction`: jede Aktion in jedem erlaubten und unerlaubten
  Zustand.
- Pausen über Mitternacht und über Tage (`pausedTotalSec`, verschobenes
  `closesAt`).
- `remainingSeconds` mit Pause und Verlängerung.
- `visibilityFor`: Stille Runde für alle Rollen.
- Route: 409 bei veralteter `revision`, 403 für eine fremde Moderation.

## 10. Offene Fragen

1. Ob bei „online“ und „Zwischenraum“ ein Tisch ohne Moderation laufen
   kann, etwa mit einem Fenster über Tage. Das Modell erlaubt es
   (`closesAt: null`), die Oberfläche ist nicht entworfen.
2. Beamer je Tisch oder ein Beamer für den Saal? Die Designstudie hat je
   Tisch einen.

## 11. Aufwand

| Teil | PT |
|---|---|
| Zustandsfunktionen mit Tests | 1–1,5 |
| Repo mit Revision, Routen, Protokoll | 1 |
| Hook mit Serverzeit, Beamer-Layout (nur Gerüst) | 0,5–1 |
| **Summe D4 (ohne Oberflächen)** | **2,5–3,5** |
