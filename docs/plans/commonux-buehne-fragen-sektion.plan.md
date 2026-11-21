---
name: commonux-buehne-fragen-sektion
overview: "Hinter der Fragen-Sektion der Website liegt die Common-UX-Bühne: blass und ohne Schrift, die Belege als Kreise hinter ihren Zitatmarken. Ein Symbol wechselt in den Bühnen-Modus. Die Bühne liegt neben der Sektion, nicht in ihr: Die Sektion meldet Gespräch und Lage der Zitatmarken über `WebsiteStoryGastgeber`, die Anwendung setzt die Darsteller. Der Player kommt als Bündel `@commonux/player` aus dem Repo commoning-methods."
status: entwurf
todos:
  - id: k1-buendel
    content: "K1 Bündel nach master: `vendor/commonux-player-0.2.0.tgz`, Abhängigkeit, `COPY vendor` im Dockerfile vor dem Install, Wächter-Test. GEBAUT 21.11.2026."
    status: completed
  - id: p3-gespraech
    content: "P3 Antwort → Gespräch: reine Funktion in `@ks/module-website` (`story-gespraech.ts`), Typ `WebsiteGespraech` im Paket, Typ-Abgleich mit `Gespraech` des Players als Test in der App. GEBAUT 21.11.2026 (`gespraechAusStory`, `gespraechStand`, `gespraechFrageId`)."
    status: completed
  - id: e-auffuehrung
    content: "Aufführung für KnowledgeScout: eine leere Bühne, acht Masken `gespraech-…` in der Formensprache der Website; Test liest sie mit dem Leser des Bündels."
    status: pending
  - id: p4-lesen
    content: "P4 Lesen über der Bühne: Gastgeber-Feld `buehne`, Flächen der Sektion durchsichtig, Zitatmarken in der Farbe ihres Belegs, Lage der Marken messen, Bühnen-Ebene in der App (`stufe=\"blass\"`, `durchlass`)."
    status: pending
  - id: k3-schalter
    content: "K3 Schalter je Library (Checkliste Per-Library-Config-Feld, voreingestellt aus); Player nur laden, wenn der Schalter an ist (`next/dynamic`)."
    status: pending
  - id: k4-buehnen-modus
    content: "K4 Symbol „Zur Bühne“ und Bühnen-Modus, Zustand in der Adresse (`nuqs`)."
    status: pending
---

# Common-UX-Bühne hinter der Fragen-Sektion

> **Stand 21.11.2026.** Löst den Abschnitt „Wie es gebaut wird · In KnowledgeScout" des
> Konzepts „Etappe 6 — Die Bühne hinter dem Chat" ab (Archiv, Vorhabensordner
> KnowledgeScout). Dort war der Ort `StoryRoot`; Owner-Entscheid 20.11.: Ziel ist die
> Fragen-Sektion der Website. Formen, Ablauf und Kräfte stehen weiter im Konzept, die
> Schnittstelle des Players im README des Pakets `@commonux/player` (Repo commoning-methods).

## 1. Ziel

Auf einer Website-Seite mit Sektion `layout=story` liegt hinter der Seite eine Bühne.

- **Lesen (Normalfall):** Die Seite steht vorn wie heute. Dahinter die Bühne, blass (Deckkraft
  0,3) und ohne Schrift. Hinter der Frage liegt ihre Form, hinter der Antwort das Blatt, jeder
  Beleg als Kreis hinter seiner Zitatmarke. Die Marke trägt die Farbe ihres Belegs. Beim
  Scrollen folgen die Kreise ihren Marken.
- **Bühnen-Modus:** Das Symbol „Zur Bühne" blendet die Seite aus. Die Bühne bekommt volle
  Farbe und Schrift; Klick auf eine Anschlussfrage stellt sie. Dasselbe Symbol führt zurück.
- **Aus ist der Normalzustand:** Ohne Schalter der Library lädt die Seite den Player nicht und
  sieht aus wie heute.

Nicht Teil dieses Plans: der volle Story-Modus (`StoryRoot`), die Themen-Sektion
(`layout=topics`), Line of Interest, Satelliten und Kamera (P5 des Konzepts).

## 2. Was sich gegenüber dem Konzept ändert

| Konzept (19.11.) | Dieser Plan |
|---|---|
| Bühnen-Ebene als erstes Kind von `StoryRoot` | Bühne neben der Fragen-Sektion, montiert von der Anwendung |
| Übersetzer Gliederung/Antwort → Aufführung mit Lagen (K2) | Übersetzer Antwort → Gespräch ohne Lagen (P3); Darsteller und Lagen macht der Player |
| Bühnen „Übersicht", „Thema", „Antwort", „Bühnen-Modus" | Eine leere Bühne mit acht Masken; die Darsteller entstehen zur Laufzeit |
| Themen als Blasen in der Übersicht | Entfällt für die Fragen-Sektion (sie hat keine Themenübersicht) |
| Zustand `?buehne=vorn` | Bleibt, über `nuqs` in der App |

## 3. Aufbau

```
@ks/module-website                         App (src/components/library/website)
┌───────────────────────────┐              ┌──────────────────────────────────┐
│ WebsiteStorySektion       │  gastgeber.  │ WebsiteLandingLive               │
│  · Konversation (k)       │  buehne      │  · Bühnen-Ebene (fixed, inset 0, │
│  · story-gespraech.ts ────┼─ gespraech ─▶│    pointer-events: none)         │
│  · misst a[data-beleg] ───┼─ anker ─────▶│  · CommonUxPlayer (next/dynamic) │
│  · Marken in Belegfarbe ◀─┼─ farbe ──────│  · Aufführung, Schalter, ?buehne │
└───────────────────────────┘              └──────────────────────────────────┘
```

### 3.1 Paketgrenze

`@ks/module-website` importiert den Player nicht. Das Paket geht in `@ks/embed`; dort soll
kein Player mitreisen (Ladegewicht rund 160 kB), und das Startseiten-Embed bekommt keine
Bühne — die Container-Anwendung hat ihre eigene. Folgen:

- Der Typ des Gesprächs steht als `WebsiteGespraech` im Paket, strukturgleich mit `Gespraech`
  des Players. Ein Test in der App (`tests/unit/…`) weist ein `WebsiteGespraech` einem
  `Gespraech` aus `@commonux/player` zu; ändert der Player den Typ, bricht `tsc`.
- Die Farbe eines Belegs (`farbeFuerDokument`) reicht die App als Funktion herein.
- `paket-schnitt.test.ts` bekommt das Verbot `@commonux/*`.

### 3.2 Gastgeber-Feld `buehne`

`WebsiteStoryGastgeber` bekommt ein optionales Feld. Fehlt es, verhält sich die Sektion wie
heute (Embed, Archiv-Vorschau, Schalter aus).

```ts
export interface WebsiteStoryBuehne {
  /** Das Gespräch der Sektion; `null`, solange keine Frage gestellt ist. */
  onGespraech: (gespraech: WebsiteGespraech | null) => void
  /** Lage der Zitatmarken in Bildschirmkoordinaten, je Beleg; bei jedem Bild neu. */
  onAnker: (anker: WebsiteBelegAnker[]) => void
  /** Farbe des Belegs (`#RRGGBB`), dieselbe wie sein Kreis auf der Bühne. */
  farbeFuerBeleg: (fileId: string) => string
  /** Vorn steht die Bühne: Die Sektion blendet ihren Inhalt aus (Bühnen-Modus). */
  buehneVorn: boolean
}
```

### 3.3 Antwort → Gespräch (P3)

Reine Funktion `gespraechAusStory` in `packages/module-website/src/story-gespraech.ts`.
Vorbild mit Tests: `src/domain/ks-gespraech.ts` in commoning-methods (ohne die Zuordnung zu
Elementen). Eine aufgezeichnete Antwort liegt dort als Fixture
(`src/domain/__fixtures__/ks-antwort-aeced.json`).

| Gespräch | Quelle in KnowledgeScout |
|---|---|
| `frage.id`, `frage.text` | Frage des sichtbaren Paars (`sichtbaresPaar`). Die ID entsteht aus dem Wortlaut (`gespraechFrageId`), bei Frage und Anschlussfrage gleich: Eine gestellte Anschlussfrage fliegt so von ihrer Stelle in die Mitte |
| `stand` | `sucht` ab dem Senden; `schreibt` erst ab `prompt_complete` oder `llm_progress` (`llm_start` kommt schon während der Suche); `fertig` mit der Antwort; `fehler` bei einem Fehler und bei einer abgebrochenen Frage (ohne Antwort, ohne Lauf) |
| `antwort.text` | Text der Antwort; er kommt in einem Stück, das Blatt erscheint erst dann |
| `belege[]` | je `DocReference`: `id` und `dokument` sind die `fileId`, `nummer` ist `number` (zählt nicht von 1 durch), `titel` ist `title`, sonst `fileName`, sonst `description`; `fundstellen` aus der Zahl der `passages`. Zwei Nummern desselben Dokuments (ältere Antworten) sind ein Beleg. Vor der Antwort gibt es keine Belege |
| `folgefragen[]` | `anschlussfragen` der Antwort; die Zahl wechselt |
| `verlauf[]` | frühere beantwortete Paare der Sitzung, älteste zuerst; `kurzfrage` aus `kurztitel`, sonst der Wortlaut (die Maske der Perle kürzt). Eine wiederholte Frage steht einmal |
| `lesen` | `true`, solange die Seite vorn steht |

Kein stiller Rückfall: Ein Beleg ohne `fileId` fehlt im Gespräch und wird im Ergebnis gezählt
(`verworfen`); die Funktion erfindet keine ID. Das Ergebnis nennt außerdem je Zitatmarke die ID
ihres Belegs (`belegJeNummer`) — das braucht P4, weil die Marken nur die Nummer tragen.

**Gebaut 21.11.** Zwei Befunde daraus, beide für den Player (Abschnitt 5, Entscheide 7 und 8):
Vor der Antwort kennt KnowledgeScout keine Belege, also kreisen beim Suchen keine Punkte. Und
für eine abgebrochene Frage hat das Gespräch keinen eigenen Stand.

### 3.4 Aufführung

Eine kleine Aufführung im Format HumanUX v2: eine leere Bühne, in `application.styles` die
acht Masken `gespraech-frage-offen`, `gespraech-frage`, `gespraech-blatt`,
`gespraech-blatt-gross`, `gespraech-beleg-punkt`, `gespraech-beleg`, `gespraech-folgefrage`,
`gespraech-perle`. Formensprache nach dem Konzept: Frage hellblau, Blatt weiß, Akzent Indigo.
Werte-Vorlage: `src/features/gespraech-nachweis/nachweis-szene.ts` in commoning-methods.

Ablage zuerst als Datei in der App (`src/components/library/website/buehne/`). Ein Test liest
sie mit `readSceneFromJson` aus `@commonux/player/format` und prüft, dass alle acht Masken da
sind. Eine Aufführung je Library ist ein späterer Schritt (Entscheid 2).

### 3.5 Lesen über der Bühne (P4)

- **Flächen:** Mit `buehne` werden die Fläche der Sektion und die weiße Karte durchsichtig.
  Text und Eingabe bleiben deckend lesbar; Kontrast siehe Risiken.
- **Zitatmarken:** `a[data-beleg]` trägt die **Nummer**, nicht die `fileId`
  (`zitat-titel.ts`). Die Sektion ordnet Nummer → `fileId` über die Belege der Antwort zu und
  setzt die Farbe aus `farbeFuerBeleg`. Mit `citationsVisible` aus sind die Marken verborgen
  und haben keine Lage; dann wartet jeder Beleg an seinem Ruhe-Ort.
- **Messen:** je Bild (`requestAnimationFrame`, nur solange die Sektion im Fenster ist und
  sich etwas geändert hat) `getBoundingClientRect` der Marken; `key` je Marke bleibt über das
  Scrollen gleich (Nummer plus laufende Stelle). Vorbild: Funktion `messe` in
  `gespraech-nachweis.tsx`. Die Anker gehen an einem eigenen Weg an die Bühne, damit die
  übrigen Props des Players stabil bleiben und er nicht mitrendert.
- **Bühnen-Ebene:** in `WebsiteLandingLive`, Geschwister der Seite, `position: fixed`,
  `inset: 0`, hinter dem Inhalt, `pointer-events: none`. Player mit `stufe="blass"`,
  `durchlass`, `durchsichtig`, `einpassen="cover"`, `bewegung="system"`.
- **Rücksicht:** auf schmalen Bildschirmen keine Bühne hinter dem Text; bei „Kontrast erhöhen"
  bleibt sie aus; „Bewegung reduzieren" regelt der Player.

### 3.6 Schalter und Bühnen-Modus (K3, K4)

- **Schalter je Library** nach `docs/contracts/library-config-field.md`, voreingestellt aus.
  Vorschlag für den Ort: `publicPublishing.buehne.enabled` (Entscheid 3).
- **Laden:** `CommonUxPlayer` und seine Stile über `next/dynamic` ohne SSR, nur wenn der
  Schalter an ist und die Seite eine Sektion `layout=story` hat.
- **Symbol „Zur Bühne"** im Kopf der Karte neben „Antworten anpassen". Zustand in der Adresse
  (`?buehne=vorn`, `nuqs`, `history: push`).
- **Bühnen-Modus:** `stufe="voll"`, ohne `durchlass`, `lesen: false`. `onDarstellerKlick` mit
  `gespraechDarstellerId("folgefrage", id)` stellt die Frage; Klick auf einen Beleg öffnet die
  Detailansicht des Gastgebers (`detail`) bzw. führt in die Galerie.

## 4. Wellen

| Welle | Inhalt | Braucht | Größe |
|---|---|---|---|
| K1 | Bündel nach `master` (gebaut 21.11.) | — | klein |
| P3 | `story-gespraech.ts` mit Tests, Typ `WebsiteGespraech`, Typ-Abgleich in der App (gebaut 21.11.) | K1 | mittel |
| E | Aufführung mit acht Masken, Test mit dem Leser des Bündels | K1 | klein |
| P4 | Gastgeber-Feld `buehne`, durchsichtige Flächen, farbige Marken, Messen, Bühnen-Ebene | P3, E | mittel |
| K3 | Schalter je Library, faules Laden | P4 | klein bis mittel |
| K4 | Symbol, Bühnen-Modus, Adresse | K3 | mittel |

P3 und E laufen parallel. Je Welle eine PR; vor dem Merge `pnpm build` lokal grün
(`AGENTS.md`), weil das Bündel eine Abhängigkeit aus einer Datei ist.

## 5. Offene Entscheide (Owner)

1. **Meldet auch das Startseiten-Embed das Gespräch?** `KnowledgeScoutSite` könnte `buehne`
   als Prop an die Container-Anwendung durchreichen. Empfehlung: nein, bis eine
   Container-Anwendung es braucht; Commoning Methods fragt selbst über die Chat-Schnittstelle.
2. **Aufführung je Library oder eine für alle?** Empfehlung: eine Datei in der App; je
   Library erst, wenn eine zweite Formensprache gebraucht wird.
3. **Ort und Name des Schalters** (`publicPublishing.buehne.enabled`?) und ob er auch für
   Mitglieder in `/library` gilt oder nur öffentlich.
4. **Mehrere Stellen aus demselben Dokument** (Q-player-05): heute ein Beleg je Dokument,
   `passages` wird zu `fundstellen`. So lassen?
5. **Dicht stehende Marken** (Q-player-07): Dürfen Belege einander beim Lesen überlagern?
   Betrifft den Player; hier nur die Abnahme.
6. **Bündel auf npm** statt als Datei unter `vendor/`? Heute Datei; jede neue Version des
   Players ist ein Commit mit neuem Tarball.
7. **Punkte beim Suchen:** Die Belege kommen erst mit der Antwort. Der Stream nennt vorher nur
   eine Zahl (`retrieval_complete.uniqueFileIdsCount`). Sollen so viele namenlose Punkte
   kreisen? Sie verschwänden mit der Antwort und die Belege entstünden neu an der Frage.
   Empfehlung: erst in P4 am Bild entscheiden.
8. **Abgebrochene Frage:** heute `fehler`, weil der Player dort nur die Frage zeigt. Bekommt
   `fehler` im Player später eine eigene Geste (grau, Zittern), braucht es einen fünften Stand.

## 6. Risiken

- **Kontrast:** Die Schrift der Seite über den kräftigsten Farben der Belege messen (WCAG AA),
  bevor P4 abgenommen wird.
- **Ruckeln beim Scrollen:** Messen je Bild darf kein Layout erzwingen, das die Seite bremst;
  in P4 auf einem schwachen Gerät messen.
- **Zwei Wahrheiten:** Sektion und Bühne zeigen denselben Stand nur, wenn das Gespräch aus
  einer Funktion kommt. Die Bühne hält keinen eigenen Zustand über Fragen.
- **Alte Bündel im Cache:** Next hält ein Paket in `node_modules` für unveränderlich, solange
  Name und Version gleich bleiben. Neues Bündel ⇒ neue Version, nie denselben Dateinamen
  überschreiben.

## 7. Abnahme

1. Schalter aus: Seite, Netzwerk und Bündelgröße wie vor diesem Plan; kein Abruf des Players.
2. Schalter an, Frage gestellt: Punkte kreisen beim Suchen, mit der Antwort liegen Blatt,
   Frage und Belegkreise hinter ihren Stellen; jede Marke hat die Farbe ihres Kreises.
3. Scrollen: Die Kreise folgen ihren Marken ohne Sprung; ohne Marke im Fenster warten sie am
   Rand.
4. Anschlussfrage gestellt: Sie fliegt von ihrer Stelle in die Mitte; ein wiedergefundenes
   Dokument behält seine Farbe.
5. „Zur Bühne" und zurück, auch über die Adresse und den Zurück-Knopf des Browsers.
6. Klicks auf Seite, Eingabe und Blätter gehen im Lesen nie an die Bühne.
7. Startseiten-Embed und Archiv-Vorschau unverändert; `dist/` von `@ks/embed` enthält keinen
   Player.
