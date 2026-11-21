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
    content: "Aufführung für KnowledgeScout: eine leere Bühne, acht Masken `gespraech-…` in der Formensprache der Website; Test liest sie mit dem Leser des Bündels. GEBAUT 21.11.2026 (`buehne/gespraech-auffuehrung.ts`)."
    status: completed
  - id: p4-lesen
    content: "P4 Lesen über der Bühne: Gastgeber-Feld `buehne`, Flächen der Sektion durchsichtig, Zitatmarken in der Farbe ihres Belegs, Lage der Marken messen, Bühnen-Ebene in der App (`stufe=\"blass\"`, `durchlass`). GEBAUT 21.11.2026; vorläufig nur mit `?buehne=an`."
    status: completed
  - id: k3-schalter
    content: "K3 Schalter je Library (Checkliste Per-Library-Config-Feld, voreingestellt aus); Player nur laden, wenn der Schalter an ist (`next/dynamic`)."
    status: pending
  - id: k4-buehnen-modus
    content: "K4 Symbol „Zur Bühne“ und Bühnen-Modus, Zustand in der Adresse (`nuqs`). GEBAUT 21.11.2026 (Owner: Symbol rechts oben, Kreise hin, drei Linien zurück; vorerst ohne Schalter je Library)."
    status: completed
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
@ks/module-website                          App (src/components/library/website)
┌────────────────────────────┐              ┌──────────────────────────────────┐
│ WebsiteStorySektion        │  gastgeber.  │ story/website-story-app.tsx      │
│  · gespraechAusStory ──────┼─ buehne ────▶│  · use-website-buehne (an/aus)   │
│  · misst a[data-beleg] ────┼─ .ebene(…)   │ buehne/website-buehne.tsx        │
│  · Marken in Belegfarbe ◀──┼─ .farbe…     │  · CommonUxPlayer, fest am Bild  │
│  · Karte = Fenster der Ebene│             │  · gespraech-auffuehrung.ts      │
└────────────────────────────┘              └──────────────────────────────────┘
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
heute (Embed, Archiv-Vorschau, Bühne aus). Gebaut 21.11. als **Slot**, nicht als Rückrufe: Die
Sektion rendert, was der Gastgeber als Ebene reicht, und muss keinen Zustand nach oben heben.

```ts
export interface WebsiteStoryBuehne {
  /** Die Bühne hinter dem Inhalt der Karte. Die Sektion schneidet sie auf die Karte zu. */
  ebene: (p: { gespraech: WebsiteGespraech | null; anker: WebsiteAnkerQuelle }) => React.ReactNode
  /** Farbe des Belegs (`#RRGGBB`), dieselbe wie sein Kreis auf der Bühne. */
  farbeFuerBeleg: (belegId: string) => string
}
```

`WebsiteAnkerQuelle` hält die Lage der Marken außerhalb von React (`stand`, `abonniere`). Beim
Scrollen rendert so nur die Ebene der Bühne neu, nicht die Sektion. Den Bühnen-Modus („vorn")
bringt K4; bis dahin steht im Gespräch immer `lesen: true`.

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

Gebaut 21.11.: `src/components/library/website/buehne/gespraech-auffuehrung.ts`. Ein Test liest
sie mit `readSceneFromJson` aus `@commonux/player/format` und prüft, dass alle acht Masken da
sind. Eine Aufführung je Library ist ein späterer Schritt (Entscheid 2).

### 3.5 Lesen über der Bühne (P4)

Gebaut 21.11. (`website-story-buehne.tsx` im Paket, `src/components/library/website/buehne/` in
der App) und im Browser an einem Prüfstand angesehen: Die Kreise legen sich hinter ihre Marken
und folgen beim Scrollen, Klicks gehen an die Seite, keine Fehler in der Konsole.

- **Die Karte ist das Fenster.** Die Ebene ist am Bildschirm fest (`position: fixed`) und liegt
  in der Karte der Sektion; `clip-path` schneidet sie auf die Karte zu. Die Karte bleibt weiß —
  der Hintergrund der Bühne ist damit immer hell, gleich welche Fläche die Sektion hat, und die
  dunkle Schrift bleibt lesbar. Durchsichtig wird nur der Kasten der Antwort. (Anders als
  zuerst geplant liegt die Ebene nicht hinter der ganzen Seite: Deckende Sektionen davor und
  danach hätten sie verdeckt, und über einer dunklen Fläche wäre die Schrift der Karte nicht
  lesbar gewesen.)
- **Zitatmarken:** `a[data-beleg]` trägt die **Dokumentnummer** der Antwort (1, 2, 3 …), nicht
  die `fileId` und nicht die Nummer aus der Antwort (`zitat-titel.ts`, `dokumentNummern`). Die
  Sektion ordnet sie über `belegJeNummer` zu. Mit `citationsVisible` aus sind die Marken
  verborgen, bis jemand „Quellen anzeigen" wählt; so lange wartet jeder Beleg an seinem Ruhe-Ort.
- **Farbe der Marke:** im Ton ihres Belegs gefüllt, so blass wie sein Kreis (30 % über Weiß),
  mit Rand in voller Farbe. Voll gefüllt wäre die Schrift auf blauen und violetten Belegen nicht
  lesbar (gemessen 3,3 : 1). Die Regeln stehen als `<style>` im Bereich der Sektion.
- **Messen:** höchstens einmal je Bild, ausgelöst durch Scrollen (auch in einem inneren
  Behälter), Größenänderung, eine neue Antwort und das Einblenden der Marken. `key` je Marke
  bleibt über das Scrollen gleich (Nummer plus Stelle im Text).
- **Bühnen-Ebene:** `CommonUxPlayer` mit `stufe="blass"`, `durchlass`, `durchsichtig`,
  `einpassen="cover"`, `bewegung="system"`.
- **Rücksicht:** keine Bühne unter 768 px Breite und bei „Kontrast erhöhen"
  (`use-website-buehne.ts`); „Bewegung reduzieren" regelt der Player.
- **An- und ausschalten:** über das Symbol im Kopf der Karte bzw. `?buehne=` (Abschnitt 3.6).
  Erst dann lädt die Seite den Player.

**Befunde aus dem Prüfstand** (für die Abnahme und den Player):

- Frage und Blatt sind im Player geführt und nehmen keine Anker. Die Form der Frage liegt
  deshalb an ihrem Ruhe-Ort oben in der Mitte, nicht hinter der Frage im Text; das weiße Blatt
  sieht man auf der weißen Karte nicht. Soll es anders sein, braucht der Player Anker auch für
  geführte Darsteller.
- Stehen zwei Marken dicht beieinander, stößt ein Kreis den anderen ab und sitzt dann neben
  seiner Marke (Entscheid 5).
- Die Farben folgen dem Namen des Dokuments; ähnliche Kennungen geben ähnliche Farben.

### 3.6 Symbol und Bühnen-Modus (K4, gebaut 21.11.)

Owner 21.11.: Der Schalter steht vorerst als Symbol rechts oben im Kopf der Karte — kleine
Kreise führen zur Bühne, ein Textsymbol mit drei Linien zurück. Der Schalter je Library (K3)
kommt später; bis dahin steht das Symbol an jeder Fragen-Sektion der App.

| `?buehne=` | Zustand | Was man sieht |
|---|---|---|
| fehlt | aus | die Seite wie immer, dazu das Symbol mit den Kreisen; der Player ist nicht geladen |
| `vorn` | vorn | die Bühne statt des Texts, volle Farbe, Schrift, bedienbar; Symbol mit drei Linien |
| `an` | hinten | der Text, dahinter die Bühne blass; Symbol mit den Kreisen |

- Das Symbol mit den Kreisen setzt `vorn`, das mit den Linien `an`. Die Adresse geht mit
  (`nuqs`, `history: push`): Der Zurück-Knopf des Browsers wechselt mit, und jeder Zustand lässt
  sich verlinken. Ein unbekannter Wert meldet sich in der Konsole; die Seite bleibt ohne Bühne.
- **Vorn:** Statt Kacheln und Konversation steht ein Raum (70 % der Fensterhöhe, mindestens
  480 px), den die Bühne füllt (`einpassen="contain"`, `stufe="voll"`, ohne `durchlass`,
  `lesen: false`). Die Eingabe bleibt darunter, außerhalb des Fensters der Ebene.
  - Klick auf eine Anschlussfrage stellt sie.
  - Klick auf einen Beleg öffnet das Blatt mit den Belegen der Antwort.
  - Klick auf das Antwortblatt zeigt mehr Text und wieder weniger.
- **Ein Player für beide Zustände:** Beim Wechsel zwischen hinten und vorn bleibt derselbe Player
  montiert; die Darsteller gleiten, statt neu zu entstehen.
- **Im Blatt stehen die Nummern der Marken** (`[1]`, `[2]` …), wie auf den Kreisen — nicht die
  der Antwort.
- Kein Symbol und keine Bühne unter 768 px Breite und bei „Kontrast erhöhen".

**Offen daraus:** Das weiße Blatt hat auf der weißen Karte keinen Rand (das Konzept nennt einen
feinen Rand; die Maske kennt dafür kein Feld — Wunsch an den Player). Die Darsteller melden sich
mit Namen (`aria-label`), sind aber keine Knöpfe für die Tastatur.

### 3.7 Schalter je Library (K3, geplant)

- Nach `docs/contracts/library-config-field.md`, voreingestellt aus. Vorschlag für den Ort:
  `publicPublishing.buehne.enabled` (Entscheid 3). Ohne Schalter reicht die App keine `buehne`
  an den Gastgeber: kein Symbol, kein Player.

## 4. Wellen

| Welle | Inhalt | Braucht | Größe |
|---|---|---|---|
| K1 | Bündel nach `master` (gebaut 21.11.) | — | klein |
| P3 | `story-gespraech.ts` mit Tests, Typ `WebsiteGespraech`, Typ-Abgleich in der App (gebaut 21.11.) | K1 | mittel |
| E | Aufführung mit acht Masken, Test mit dem Leser des Bündels (gebaut 21.11.) | K1 | klein |
| P4 | Gastgeber-Feld `buehne`, Fenster in der Karte, farbige Marken, Messen, Bühnen-Ebene (gebaut 21.11., vorläufig mit `?buehne=an`) | P3, E | mittel |
| K3 | Schalter je Library (faules Laden ist mit K4 gebaut) | K4 | klein bis mittel |
| K4 | Symbol, Bühnen-Modus, Adresse (gebaut 21.11., vor K3) | P4 | mittel |

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

- **Kontrast:** gemessen in `tests/unit/commonux/gespraech-auffuehrung.test.ts` über 400
  Dokumentfarben: Die Schrift der Karte über einem blassen Kreis und die Schrift auf der Marke
  bleiben über 4,5 : 1 (WCAG AA). Überlagern sich mehrere Kreise, ist das nicht gemessen.
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
