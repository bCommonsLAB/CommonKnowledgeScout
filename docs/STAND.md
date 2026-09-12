# Stand des Repos

> Eine Quelle für die Frage „woran wird gerade gearbeitet, und was wartet?".
> Gepflegt von Hand bei jedem Vorhabenswechsel und bei jedem neuen Punkt.
> Stand: 2026-09-09, entschieden vom Owner. Die ausführliche Landkarte mit
> Legende und Motiven aller Wellen liegt in Peters Archiv
> (`24.09 KnowledgeScout/THEMEN.md`); diese Datei ist ihr Repo-Auszug.

## Vier Zustände, kein „offen"

| Zustand | Bedeutung |
|---|---|
| **aktiv** | wird jetzt bearbeitet; hat einen Termin oder einen wartenden Konsumenten |
| **geplant** | gewollt, aber ohne Termin; niemand arbeitet daran, bis der Owner es aufruft |
| **erledigt** | im Code und durch Nutzung abgenommen; Restpunkte stehen als Notiz dabei |
| **verworfen** | bewusst nicht weiterverfolgt, mit Grund |

Code, der seit Monaten in Produktion läuft, gilt als abgenommen, auch ohne
Abnahmedokument. Die `status:`-Marker in Plan-Dateien sind unzuverlässig;
maßgeblich ist diese Datei und der Code.

Die vier Wörter beschreiben **Arbeitspakete im Repo** (Pläne, Wellen, ADRs).
Sie sind Prosa in dieser Datei. Peters Archiv kennt am Vorhaben `status:
aktiv | ruhend | abgeschlossen` und an der Erschließung `bearbeitungsstand:`;
sollten die vier Wörter je ins Frontmatter, heißt das Feld nicht `status`,
sondern `arbeitsstand`, damit nichts kollidiert.

## Wie gearbeitet wird: ein Vorhaben nach dem anderen

Die Einheit der Arbeit ist das **Vorhaben**, ein Anwendungsprojekt mit
Termin, nicht das Thema und nicht der Plan. Jedes Vorhaben hat drei Sorten
Arbeit:

1. **Bekannte Punkte**: was heute schon als nötig erkannt ist.
2. **Mitgenommene alte Themen**: Punkte aus dem Vorrat „geplant", die
   denselben Code berühren. Regel: mitnehmen, was auf dem Weg liegt, nicht,
   was in der Nähe liegt.
3. **Neu dazugekommen**: was erst beim Bauen sichtbar wird. Agenten tragen
   solche Punkte hier ein, mit Datum, statt sie in Hand-offs zu verstreuen.

Ein Vorhaben ist fertig, wenn sein Termin bedient ist. Was von den
mitgenommenen Themen übrig bleibt, geht mit Notiz zurück in den Vorrat.

**Reihenfolge: 1 AECED → 2 Klimamaßnahmen/Vortrag 30.09. → 3 SHF.** Agenten arbeiten nur
am Vorhaben, das „jetzt" trägt, es sei denn, der Owner sagt es anders.

## Vorhaben 1 · AECED: Galerie als einbettbare Komponente (M5) — jetzt

- **Termin**: **Dienstag, 15.09.2026, ganztägiges Arbeitstreffen mit AECED**
  (Owner, 09.09.). Bis dahin soll das Gröbste stehen: die Schritte 1 bis 4 so
  weit, dass der Einbau in die fremde Next-Anwendung gezeigt werden kann. Der
  31.08. ist überschritten.
- **Ziel**: `<KnowledgeScoutExplorer baseUrl="…" library="aeced" view="gallery" />`
  läuft in der Next-Anwendung von AECED, liest anonym von der zentralen
  Instanz, zeigt nur öffentliche Inhalte (ADR 0008, Nachtrag 2026-08-29).
  Kein neues Deployment.
- **Arbeitsauftrag**: [`docs/refactor/modularisierung/AGENT-BRIEF-M5.md`](refactor/modularisierung/AGENT-BRIEF-M5.md)

Bekannte Punkte:

1. Galerie-Adressierung: austauschbares Protokoll statt `next/navigation`
   in `src/utils/document-navigation.ts`; Netz:
   `tests/unit/utils/document-navigation-routen.test.ts`
2. Basis-URL für die Modul-Fetches (bisher bewusst nicht eingebaut, G3)
3. Galerie ins Paket `@ks/module-explorer`: erst die 14 Kreuzverweise zu
   Slots machen, dann Bereich für Bereich (Reihenfolge in
   `02-audit-umzug.md` §4)
4. Hülle `@ks/embed`: npm-Paket, CORS, anonymer Lesezugriff, Locale als Prop
5. Nachweis in einer fremden Next-Anwendung

Mitgenommene alte Themen:

- Galerie-Chat-Mittelschicht benennen (`01-audit-galerie-chat.md`), fällig
  bei Punkt 3
- `apps/`-Frage nur entscheiden (Demo-App ja/nein), nicht die Next-App umziehen

Nicht in diesem Vorhaben: M6 bis M8, Headless-API P8, Story und Chat im Embed
vor der Galerie.

Neu dazugekommen:

- 2026-09-09: Punkt 1 (Adressierung) ist als Welle **M4f** erledigt (PR
  „M4f: Next raus"): kein `next/*` mehr im Galerie-Kegel, Bilder ueber den
  Gastgeber (`next/image` bleibt in der App), Story-Panel als Slot.
  Messung und Wellenplan M4f–M4i in `AGENT-BRIEF-M4f.md`.
- 2026-09-09: Punkt 3, erster Teil, ist als Welle **M4g** erledigt: die
  Renderer-Tabelle und drei weitere App-Bausteine sind Slots, der Kegel
  importiert aus `components/library` nur sich selbst. Der Schnitt ist
  bewusst nur die Galerie (nicht Chat-UI, Story, Website — passt zu „Nicht
  in diesem Vorhaben"). Offen: M4h (Helfer in Pakete), M4i (der Umzug).
- 2026-09-09: **M4h** erledigt (eine PR): zehn Helfer in Pakete oder in den
  Kegel — Registry, Anzeige-Labels und Doc-Meta-Typen nach `@ks/contracts`,
  Slug-Regeln nach `@ks/util`, anonyme Sitzung nach `@ks/api-client`,
  Lokalisierung nach `@ks/module-explorer`. Der Sprung zur Perspektiven-Wahl
  ist App-Politik (`StoryPerspectiveRedirect`), nicht mehr Galerie. Der Kegel
  importiert aus `@/` nur noch sich selbst — **umzugsfertig**. Offen: M4i.
- 2026-09-09: **M4i** erledigt (eine PR): die Galerie liegt in
  `packages/module-explorer/src/gallery/` (110 Dateien per `git mv`),
  `GalleryRoot` kommt aus `@ks/module-explorer/react`; die App-Bruecken
  (Clerk, Next-Adressierung, Gastgeber) bleiben in der App. Punkt 3 ist
  damit fuer die Galerie abgeschlossen; Story/Chat/Website bleiben Slots.
  Naechstes: Punkte 2, 4, 5 (`@ks/embed`), Hand-off in `AGENT-BRIEF-M4f.md` §7.
- 2026-09-09: Hotfix #248 — oldiesforfuture.org war seit dem 30.08. kaputt
  (Folge von #234: Galerie-Karte ausserhalb der Galerie ohne Anbieter).
  Lehre: ein Anbieter-Buendel `GalleryAppProviders` an jedem Montagepunkt,
  Waechter-Test `karte-ausserhalb-galerie.test.ts`.
- 2026-09-10: **M5-basis-url** erledigt (Punkt 2): Alle 43 Requests des
  Explorer-Pakets laufen ueber die Instanz (`InstanceApi` aus `@ks/api-client`;
  in der Galerie `useInstanz()` am Gastgeber, am Explorer-Eintritt die Prop
  `instanz`). Die Voll-App setzt `SAME_ORIGIN_API`, relative Pfade wie bisher.
  Waechter `instanz-fetch.test.ts`. Sortierung in
  `refactor/modularisierung/03-audit-embed-fetches.md`: 12 Lese-Requests fuer
  das Embed (fuer AECED davon 4 bis 7), 7 nur angemeldet, 21 Schreiben, 3 tot
  (`gallery/lib/api.ts`, geloescht). Die DIVA-Klassifizierung erschien auch
  anonym — jetzt nur fuer Mitglieder.
- 2026-09-10: Befunde fuer Punkt 4 (Huelle): nirgends CORS-Header; die
  Middleware laesst `OPTIONS` nicht anonym durch, ein Preflight scheitert also;
  `x-locale` loest einen Preflight aus, wirkt aber nicht; das Locale-Cookie
  geht von fremder Herkunft nicht mit; `explorerGate` zaehlt den Host der
  Instanz. Details im Audit 03.
- 2026-09-10: **M5-adressierung** gebaut (gestapelt auf M5-basis-url):
  `SpeicherGalleryNavigation` fuehrt `doc`, `mode`, `view` usw. im
  React-Zustand statt in der URL — ohne Verlauf, ohne teilbare Adresse.
  `EmbedGalleryProviders` buendelt Betrachter (`ANONYMOUS_VIEWER`), Gastgeber
  (`STILLER_GASTGEBER` mit Instanz) und Adressierung, als Gegenstueck zu
  `GalleryAppProviders`. Waechter: das Paket fasst `window.location` und
  `history` nicht an. Nebenbei: Der Teilen-Knopf blendete sich bei leerer
  Adresse nicht aus, obwohl der Vertrag von `documentShareUrl` das versprach.
- 2026-09-10: #267 landete im Branch von #266 statt auf `master` (25 s nach
  #266 gemergt, bevor GitHub die Basis umgestellt hatte). Ersatz-PR #268 mit
  demselben Commit. Lehre: gestapelte PRs erst mergen, wenn ihre Basis auf
  `master` zeigt — oder gleich gegen `master` stellen.
- 2026-09-10: **M5-buch-renderer** gebaut: Die Buch-Detailansicht liegt im
  Paket (`gallery/components/book-detail/`, per `git mv`: Ansicht,
  Kapitelliste, Anhang-Liste, KI-Hinweis, `reference-format`). Was es in einer
  fremden Seite nicht gibt, kommt herein: Bild, Markdown, KI-Hinweis-Link,
  Zurueck-Link. Die App reicht unter den alten Pfaden `next/image`,
  `MarkdownPreview` und `next/link` herein, ihr Verhalten bleibt gleich. Das
  Embed bekommt `BuchDetailRenderer` (aus der schon geladenen `docMeta`, kein
  zweiter Request) und `EMBED_DETAIL_RENDERERS` (Buch, Testimonial, Blog →
  Buch; alle anderen sagen ausdruecklich „noch nicht verfuegbar"). Mapper und
  Typen liegen in `doc-meta/book-detail-mapper.ts`, `getFileType` in `@ks/util`.
- 2026-09-10: Befund fuer Punkt 4: `md` aus `@ks/viewers` rendert rohes HTML
  (`html: true`) und zieht zwei highlight.js-Stylesheets; die `prose`-Klassen
  brauchen im CSS des Embeds das Tailwind-Typography-Plugin. In der fremden
  Seite pruefen — der Inhalt kommt aus der eigenen Library, aber er landet
  jetzt im DOM eines Kunden.
- 2026-09-10 (kein M5-Bezug, beim lokalen Audio-Test gefunden): `.mpeg`/`.mpg`
  fehlten in allen acht Endungslisten — die Vorschau zeigte „Keine Vorschau
  verfuegbar" und keinen Transkribier-Knopf. Nachgezogen auf Branch
  `claude/test-audio-archive-14e078`; lokal mit zwei Sprachnachrichten in
  „tapping into abundance" bewiesen (Secretary-Videoweg, amharisches
  Transkript). Auf demselben Branch behoben: `provider.getBinary is not a
  function` — batch-resolve reichte einen per `{ ...provider }` kopierten
  Provider an den Resolver (Methoden auf dem Prototype fehlten, jede
  Transkript-Variante galt still als leer); jetzt `withRequestStorageCache`,
  eine fehlende Methode wirft `ShadowTwinProviderIncompleteError`. Offen
  daneben: der Server-Secretary hatte im August noch 200 MB Audio-Grenze und
  scheiterte an mehreren `.mp4` mit ffmpeg; der Job-Monitor zeigt „Worker
  gestoppt", obwohl `/api/external/jobs/worker` `running` meldet.
- 2026-09-10 (kein M5-Bezug): **Grosse Dateien starten mehrfach.** Die
  Start-Route laedt die Quelle erst komplett aus dem Storage (377-MB-Video:
  über 60 s); der Worker bricht nach `JOBS_WORKER_START_TIMEOUT_MS` (60 s) ab
  und startet neu, die abgebrochenen Aufrufe laufen aber weiter. Folge:
  dasselbe Video dreimal beim Secretary, jeder Start setzt einen neuen
  `jobSecretHash`, 29 Rueckmeldungen scheitern mit 401 (hash mismatch), 145
  werden als fremder Prozess ignoriert, zwischendurch steht der Job auf
  „running" mit `worker_start_giveup`. Nach rund sechs Minuten wurde er doch
  fertig und das Transkript gespeichert (zweimal geschrieben) — ob am Ende
  eine Rueckmeldung angenommen wird, haengt am Wettlauf der drei Starts.
  Beleg: Job `8b1275b0-…` (lokal gegen Prod-DB). Passt zu den 25
  „Worker-Timeout" und den `stale_running_reaped` auf dem Server. Eigene
  Aufgabe angelegt.
- 2026-09-10: Owner-Entscheidungen fuer die Huelle: Build mit tsup, CSS unter
  einer Huelle `.ks-embed`, Auslieferung als Datei-Paket (`pnpm pack`),
  CORS fuer jede Herkunft, aber nur oeffentliche Libraries.
- 2026-09-10: **M5-cors** gebaut: `src/lib/embed/embed-cors.ts` nennt die
  Lese-Routen des Embeds; die Middleware beantwortet deren Preflight vor der
  Anmeldung (204) und setzt `Access-Control-Allow-Origin: *` — bewusst ohne
  `Allow-Credentials`, das Embed ist damit anonym per Protokoll. Schreibende
  Routen bekommen keinen CORS-Kopf (Test). Der wirkungslose `x-locale`-Kopf
  der Detailansicht ist weg (die Middleware setzt ihn selbst), damit
  `doc-meta` ohne Preflight geht. Am Dev-Server live geprueft. **Muss vor dem
  15.09. auf der Instanz laufen**, sonst liest das Embed dort nichts.
- 2026-09-10: **M5-huelle** gebaut: `packages/embed` mit
  `<KnowledgeScoutExplorer baseUrl library view="gallery" locale height? />`.
  tsup baut ein ESM-Buendel (React extern, alles andere drin, `"use client"`
  vorn), `scripts/build-css.mjs` Tailwind mit dem Theme aus
  `src/styles/globals.css`, jede Regel unter `.ks-embed`;
  `pnpm --filter @ks/embed run pack:datei` erzeugt `ks-embed-0.1.0.tgz`, und
  `scripts/pruefe-buendel.mjs` laesst den Bau scheitern, wenn `next`- oder
  `@ks`-Importe im Buendel stehen. Dazu: Radix-Portale in `@ks/ui` rendern per
  `PortalContainerProvider` in den Rahmen (App unveraendert: ohne Anbieter
  `<body>`); der Story-Knopf erscheint nur mit Story-Slot; `createInstanceApi`
  schickt die Sprache als `Accept-Language`; `@ks/i18n` ist
  `sideEffects: false` (sonst zog das Buendel `next/navigation` mit).
  Rauchtest: Das gebaute Buendel rendert die ganze Galerie in jsdom gegen eine
  gestubbte Instanz.
- 2026-09-10: Befund Buendelgroesse: minifiziert 186 KB Einstieg, 1,7 MB
  gemeinsames Stueck (vor allem highlight.js mit allen Sprachen aus
  `@ks/viewers`), 89 KB Graph (nachgeladen), CSS 96 KB. Fuer den 15.09.
  tragbar; spaeter highlight.js auf die noetigen Sprachen kuerzen.
- 2026-09-10: Offen fuer Punkt 5 (Nachweis): Die Frage „Demo-App
  `apps/embed-demo` ja oder nein" ist nicht entschieden. Bis dahin zeigt der
  Rauchtest das Buendel in jsdom, nicht in einer fremden Next-App.
- 2026-09-10: **`ci-main` nach #272 rot** (Docker-Build, `51d3228b`):
  `next build` prueft die Typen jeder Datei der Root-`tsconfig.json`, auch
  `packages/embed/tsup.config.ts` — und `tsup` fehlt im Image. Das Dockerfile
  installiert nur die Root-Abhaengigkeiten (`COPY package.json
  pnpm-lock.yaml`, ohne Workspace); lokal hat jedes Paket eigene
  `node_modules`, darum war der Pre-Merge-Check gruen. **Neue Luecke zwischen
  lokalem Build und Image.** Behoben auf `claude/modularisierung-m5-docker-build`:
  Bau-Konfigurationen der Pakete (`packages/*/*.config.ts`) sind raus aus der
  Root-`tsconfig.json` und ESLint und werden im `tsconfig.json` ihres Pakets
  geprueft. Waechter `tests/unit/packages/docker-abhaengigkeiten.test.ts`:
  Jeder Import unter `packages/`, den die App-Typpruefung sieht, muss mit den
  Root-Abhaengigkeiten aufloesbar sein. `ci-main` fuer #271 (CORS) war gruen.
- 2026-09-10: **M5-nachweis** (Owner: im Projekt `commoning-methods`, eigener
  Worktree `ks-embed-nachweis`, Seite `/ks-embed-nachweis`, Library
  `commoning` von knowledgescout.org). Die fremde App laeuft mit Next 16,
  React 19 und Turbopack — vier Befunde, alle im Paket behoben:
  (1) `peerDependencies` erlaubten nur React 18, `npm install` scheiterte;
  jetzt `^18.2.0 || ^19.0.0`. (2) Turbopack lehnte das Buendel ab („dynamic
  usage of require is not supported"): esbuild liess fuer
  `use-sync-external-store/shim` (aus Radix und swr) einen `require`-Ersatz
  stehen; ein tsup-Plugin lenkt `require("react")` auf ESM-`import` um, und
  `pruefe-buendel.mjs` laesst den Bau am Ersatz scheitern. (3)
  Hydrierungsfehler (Server „Loading…", Browser „Lade…"), danach zeichnete
  React die ganze fremde Seite neu: Die Galerie montiert erst im Browser, auf
  dem Server steht nur der Rahmen. (4) Die Detailansicht (`fixed inset-0`)
  deckte das ganze Fenster der fremden Seite zu: `contain: layout` am Rahmen
  haelt sie darin. Dazu zeigt die Detailansicht „In Story Mode ansehen" nur
  mit Story-Slot (Waechter in `galerie-schnitt.test.ts`). Geprueft: alle
  Anfragen gehen an knowledgescout.org, Cover kommen aus dem Blob-Speicher,
  Stile greifen im Rahmen, CORS ist auf der Instanz live.
- 2026-09-10: **Vor dem 15.09. offen**: Auf knowledgescout.org gibt es keine
  oeffentliche Library `aeced` (404; oeffentlich sind commoning, biodiv,
  cast-neustift-2026, klimamassnahmen, oldiesforfuture, sfscon-talks). Ohne
  sie meldet das Embed bei AECED eine unbekannte Library. Ausserdem wirbt der
  Standardtext der Galerie (`texts.book.description` in `@ks/i18n`) fuer den
  Story Mode, den es im Embed nicht gibt — fuer AECED eigene Galerie-Texte in
  der Library setzen.
- 2026-09-11: **M5 komplett auf `master` und deployt** (Version 1.2.246,
  `ci-main` gruen zu #274; der rote Lauf zu #273 war ein Registry-Fehler beim
  Hochladen, das Image von #274 enthaelt #272–#274). Kein Code-Schritt offen.
  Fuer die lokale Sitzung mit beiden Projekten (Library `aeced` einrichten,
  Embed in commoning-methods pruefen, Paket uebergeben):
  [`HANDOFF-M5-aeced-lokal.md`](refactor/modularisierung/HANDOFF-M5-aeced-lokal.md).
  Noch nie geprueft im Embed: Dark Mode der fremden Seite (`.dark .ks-embed`
  gegen `prefers-color-scheme`) und Mobil.

## Vorhaben 2 · Klimamaßnahmen Südtirol: Vortrag 30.09. — danach

- **Termin**: 30.09.
- **Was es ist**: ein Auftritt mit der Library „Klimamaßnahmen"; Ereignis im
  Archiv unter `4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol`.
  Dort wird konzipiert, was die Library und eine Webseite dafür brauchen;
  hier steht nur die Arbeitsliste.
- **Ziel**: eine Vorführung, die eine Stunde lang nicht hängen bleibt, und
  eine Library, die zeigt, was der Vortrag verspricht.

Bekannte Punkte:

1. OneDrive-Anmeldung stabil neu aufsetzen; sie fällt nach ein bis zwei
   Wochen aus. Teilfortschritt 27.08. (Netzwerkfehler löschen die Anmeldung
   nicht mehr) ist drin.
2. Anpassungen an der Library „Klimamaßnahmen" (Umfang aus dem Konzept im
   Archiv-Ordner; noch nicht festgelegt).
3. Webseite für den Vortrag bzw. die Klimamaßnahmen (Site-Modus mit
   Domain-Kopplung existiert seit Juli; was darüber hinaus nötig ist, steht
   im Konzept).

Mitgenommene alte Themen (Kandidaten): Split des OneDrive-Providers (2.294
Zeilen), nur wenn die Anmeldung dort umgebaut wird; Klimamaßnahmen-Reste aus
dem Vorrat (Mapper-Paritätstest, LLM-bereinigte Summe als dritte Zahl), wenn
die Library ohnehin angefasst wird; ADR 0005 nur entscheiden.

Neu dazugekommen: (noch nichts)

## Vorhaben 3 · SHF: Konsensieren-Modul und Begleitfunktionen — ab 16.09. vorbereiten

- **Termine**: Vorabtreffen 16.09., Entwicklung 17.09. bis 09.10., Feature
  Freeze 09.10., Test 13. bis 17.10., Generalprobe 20.10.
- **Was es ist**: digitale Begleitung des Stakeholderforums Nachhaltigkeit
  des Landes Südtirol. Anforderungen im Archiv unter
  `4. Ökosozialer Aktivismus/26.05 SHF Nachhaltigkeit`. Im Repo gibt es
  noch keinen Plan und keine Zeile Code.

Bekannte Punkte: Plan im Repo anlegen · Modul Systemisches Konsensieren
(Widerstandswerte, Timer, iterative Runden, Auswertung) · geschützter
Arbeitsbereich mit Rollen · digitaler Check-out der Arbeitsgruppen ·
Gruppenbeiträge und Kommentierung · anonymisierte öffentliche Sicht mit
Rate-Limiting.

Mitgenommene alte Themen, vom Owner am 09.09. entschieden: **Die Erfassung
wird hier in einem Zug bereinigt**, nicht vorab. Dazu gehören die beiden
Alt-Endpunkte `events/finalize` und `events/publish-final` (Phase 6 von
generic-finalize-wizard; Befund 11.09.: nur `publish-final` wird in
`creation-wizard.tsx` noch gerufen, `:2730` und `:2825`; `events/finalize` hat
in `src/**` keinen Aufrufer mehr),
ADR 0003 Wizard/Schema, und die Reste aus Welle 3-VI. Mehrsprachigkeit DE/IT:
entscheidet das Vorabtreffen.

Neu dazugekommen:

- 2026-09-11 — **Erfassungs-Flow analysiert** (Handover aus dem Archiv,
  `24.09 KnowledgeScout/2026-09-10 Konzept Erfassungs-Flow generisch und mobil/`):
  [`analysis/erfassungs-flow-wiederverwendung.md`](analysis/erfassungs-flow-wiederverwendung.md)
  stuft die dreizehn Stationen S0–S11 am Code ein (konfigurieren / erweitern /
  portieren / neu, mit Belegen aus KnowledgeScout, NatureScout, BetterWriter) und
  listet vierzehn Widersprüche zwischen Konzept und Code. Kernbefunde: S0 ist
  nicht „fehlt", sondern erweitern (Mitgliedschaft mit vier Rollen und
  Einladungs-Token existiert); die Stimme ist binär, nicht Skala; die Werkbank
  ist twin-gebunden und nimmt den Wartekorb nicht auf; die Outbox persistiert
  nicht. Pflicht bis Freeze 31–48 PT, Plattform gesamt 45–65 PT.
  [`analysis/erfassungs-flow-bauweisen-vergleich.md`](analysis/erfassungs-flow-bauweisen-vergleich.md)
  vergleicht „in KnowledgeScout" gegen „eigenständige App als Endpoint-Client"
  gegen „eigenständige App mit React-Paketen". Empfehlung: **A jetzt, C-fähig
  gebaut** — `@ks/capture` spricht nur über `InstanceApi`; der Write-Key wird
  die erste tokenfähige Schreibroute. Umschaltpunkt am 16.09.: SPID/CIE,
  Offline-First mit Store-App, oder getrennte Auslieferung fürs Land.
  Detailkonzept Composer S4/S5 (Handover Teil 3):
  [`plans/erfassungs-composer-s4-s5.plan.md`](plans/erfassungs-composer-s4-s5.plan.md)
  — Anlagen-Modell mit Zustand je Anlage, Paket `@ks/capture`, Abgeben
  sobald eine Anlage fertig ist, elf PR-Scheiben C0–C10 (13–18 PT, +2–3
  für den Write-Key), Abnahme an T-S4.1 bis T-S5.2. Offen: S0-Detailkonzept.
- 2026-09-11 — **Owner-Entscheidungen zur Erfassung** (nach Vorlage der
  Analysen): Bauweise A ist entschieden, auf Modulbasis gebaut (`@ks/capture`
  über `InstanceApi`); **nur Clerk** als Auth, kein SPID/CIE; **kein Zugang
  ohne Konto** — ein Write-Key gibt es nur für Angemeldete, als
  Einladungs-Token an Library und Zieltyp gebunden; Offline-First mit
  Store-App und getrennte Auslieferung fürs Land sind kein Thema; Zielbild
  **eine Library je Organisation**, Zeitpunkt offen. Composer: eine View,
  mobile-first, die auf dem Desktop nur breiter wird (Plan, Abschnitt 5.1).
  Später zu klären: Service Worker im Next-Build, persistentes Rate-Limit.
- 2026-09-11 — **Composer als Klickmodell in Figma** gebaut (Screen-Landkarte,
  ehemals Section `node-id=27-2`, jetzt Matrix `60-2`): Legende Kontext → Konfiguration,
  fünf Kontext-Reihen (Basis SHF, Moderation in Vertretung, Dialogformate,
  AECED, Klimamaßnahmen mit Bewertungskarte und Fachkundigen-Hinweis) in
  390 × 844, Prototyp-Verbindungen in der Basis-Reihe. Belegt, dass
  Kontexte über Einladungs-Token, Schema, Rolle und Library-Regelsatz an
  dieselbe Station kommen, nicht über einen zweiten Ablauf. Ausgedehnt auf
  alle Stationen (Owner 11.09.): Section „S0–S3 Eintritt und Orientieren"
  bis „S9–S11" — alle 13 Stationen als Klickmodell, Prototyp-Verbindungen
  über die Stationen hinweg. Auf Owner-Wunsch (abends) als **Matrix**
  umgehängt (`node-id=60-2`): eine Zeile je Anwendung, eine Spalte je
  Station, Schnittlinien zum Ausdrucken — waagrecht die Storyline einer
  Anwendung, senkrecht alle Varianten einer Station. Rahmen verschoben,
  nicht neu gebaut. Farbleitsystem auf beiden Boards vereinheitlicht:
  Anwendungen warm/grün (Zeilenbänder), Stationen kühl je Gruppe
  (Spaltenköpfe). Play-Modus: Start-Screen `66-2` mit Anwendungswahl,
  je Anwendung Tipp-für-Tipp durch alle Screens (Handy: Figma-App oder
  Prototyp-Link), vor jeder Station ein Hinweis-Popup (Overlay über dem
  ersten Screen, Tipp schließt, „?" holt es zurück; Section `70-2`) für
  Testpersonen. Ketten lückenlos gemacht: 41 angepasste Kopien der
  Basis-Screens nach der Landkarte (Rolle, Bezugsobjekt, Begriffe je
  Anwendung), 74 Popups; jede Anwendung läuft jetzt von S0/S1 bis S11
  (Peters Archiv bis S9). Offen:
  Bestands-Screenshots (lokal) als Vorlage.
- 2026-09-11 — **Architektur und Datenhaltung der Stationen** konzipiert
  (Owner-Frage abends): [`plans/erfassungs-architektur-stationen-datenhaltung.plan.md`](plans/erfassungs-architektur-stationen-datenhaltung.plan.md).
  Der Wizard ist die Maschine von S4/S5 und wird durch das Composer-Konzept
  fertig, nicht ersetzt; die übrigen Stationen sind Regelsatz je Library
  (neues Feld `capture.*`) plus Erweiterung bestehender Module; Neubau nur
  Anlagen-Modell, Bewertungsmodell mit Fenstern, Sichtbarkeits-Regel,
  Synthese mit Fassungen. Datenhaltung: Verfahren in MongoDB (neu
  `consents`, `assessments`, `syntheses`), Wissen als Dokument mit flachem
  Frontmatter im Storage, Rohdaten im Blob. Wellen E0–E7, Pflicht bis Freeze
  E0–E4 (34–49 PT). **Owner-Entscheidungen dazu (11.09. abends):** Flows
  bleiben Dokumente in MongoDB (`kind='wizard'`); eine Library für das SHF,
  Library je Organisation später; Aufbewahrung so lange wie möglich, keine
  automatische Löschung (ADR 0004 O2 vorerst geschlossen); Wizard-Editor nach
  dem Freeze.
- 2026-09-12 — **Verzeichnisstruktur im Storage** (Owner-Korrektur zur
  einen SHF-Library, Konzept §3.4): zwei Bäume `Veranstaltungen/<Reihe>/<Treffen>/`
  (Themen, Ergebnisse, Protokoll) und `Organisationen/<Name>/Beiträge/<Reihe>/<Treffen>/`
  (Beiträge), damit der spätere Umzug einer Organisation in eine eigene
  Library ein Verschieben eines Ordners ist und Storage-Rechte je Organisation
  gesetzt werden können. Bezug im flachen Frontmatter (`reihe`, `treffen`,
  `thema`, `tisch`, `organisation`); Ablage als Pfadvorlage je Zieltyp
  (`capture.ablage`) in der Promotion, ersetzt den `root/inbox`-Default;
  Synthese-Belege über Submission-Id, nicht nur `fileId`. E0 wächst auf 4–5 PT.
- 2026-09-12 — **Feedback-Runden vorbereitet**: im Archivordner liegt
  „2026-09-12 Anwendungsflows und Testleitfaden.md" (die sieben Flows des
  Klickmodells in Worten, Testanleitung, Fragen je Station, Grenzen) und ein
  Ordner `Feedback/` mit Vorlage. Befunde aus den Runden fließen ins
  Composer- und ins Architektur-Konzept; die Screens werden im Klickmodell
  nachgezogen.
- 2026-09-12 — **Dialog-Flow: übersehener Bestand.** Der Testimonial-/
  Dialograum-Flow vom Januar (Event-Container mit `testimonialWriteKey`,
  Recorder, `event-finalize-de`) trägt den Dialogfall zu über 80 Prozent;
  Hauptanalyse auf Branch `claude/dialog-flow-bestand`
  (`docs/analysis/dialog-flow-bestand.md`, mit Prod-DB und Live-Test),
  Nachtrag der zweiten Prüfung hier:
  [`analysis/dialog-flow-bestand-nachtrag.md`](analysis/dialog-flow-bestand-nachtrag.md).
  Kernbefunde: die Gast-Seite `/public/testimonial` ist nicht in den
  öffentlichen Routen (nur die API läuft ohne Konto), der QR zeigt auf den
  Login-Wizard, `author_is_named` wirkt nicht, der Recorder hat weder
  Leitfragen noch Vorschau. Dialog-Welle D0 auf Bestand 10–16 PT, außerhalb
  des Freeze, neben E0/E1. Die Dialog-Zeile des Klickmodells ist am 12.09.
  in der Cowork-Sitzung auf neun Screens neu gebaut (Archiv „Dialog-Flow neu
  - Screen-Vorgabe und Testleitfaden"); Gast-Zugang je Library bleibt
  Owner-Entscheidung.
- 2026-09-12 — **Haltung „vorauseilendes Vertrauen"** für die SHF-Zeilen
  (Archiv „Vorauseilendes Vertrauen - der SHF-Flow im Advocatus-Diaboli"):
  Tischvereinbarung statt Einwilligungsleiter, keine Sichtbarkeitswahl je
  Beitrag, CTA „Beitragen", stille Runde, Tisch-QR mit Kontext (Anmeldung
  bleibt, Owner 12.09.) — im Klickmodell gebaut. Option 2 (Kuratieren als
  Notbremse, Tisch-Abschluss T-S8b.2) ist gebaut, aber Owner-Entscheidung vor
  dem 16.09. Regelsatz `capture.*` um `zugang: konto | qr`,
  `kuratierung: tor | notbremse | keine` und die Tischvereinbarung erweitert,
  Welle D0 im Architektur-Konzept eingetragen (Abschnitt 5 und 7). Offen:
  Kostenprüfung der Haltungsänderung am Code (Archiv-Nachziehliste, Teil C2)
  und ADR 0004 Zweig E2 (Write-Key mit Tisch/Rolle). Figma-Reste (Popups,
  Legenden, vier Screens) laufen über den Cowork-Handover im Archiv.
- 2026-09-12 — **Owner-Entscheidungen (abends):** Option 2 „Tisch-Ernte"
  angenommen (`capture.kuratierung: notbremse` für das SHF, Tisch-Abschluss,
  Kostenprüfung am Code wird Pflicht vor E0); Gast-Zugang für den Dialogfall
  ja (`capture.zugang: qr`, PR #278 mergen); drei Nennungsstufen
  (`author_is_named` muss wirken); Widerruf nur bis zum gemeinsamen Abschluss.
  Offen: Schlüssel-Ablauf, Inbox-Konformität des Gast-Pfads,
  `events/finalize`, Form des Abschlusses (Architektur-Konzept, Abschnitt 6
  und 7).
- 2026-09-11 — Routing-Index in `CLAUDE.md` nennt `src/components/library/gallery/**`
  und `src/lib/gallery/**`; beides existiert nicht mehr (Galerie in
  `packages/module-explorer/src/gallery/**`, Sterne unter
  `api/library/[id]/source-user-states/`). Nachziehen, sobald die Contracts der
  Galerie mitziehen.
- 2026-09-12: **Dialog-Fall (Kolping), nicht Teil dieses Vorhabens, korrigiert
  aber eine Annahme:** Der Testimonial-Pfad vom Januar laeuft API-seitig ohne
  Konto, die Gast-Seite `/public/testimonial` fehlte in der Middleware
  (anonym 404) und der QR-Code zeigte auf den Login-Wizard. Owner-Entscheidung
  12.09.: Gast-Zugang fuer den Dialog-Fall oeffnen — Route und QR-Weiche
  repariert (ehemals PR #278, in PR #279 zusammengeführt). Die Entscheidung vom 11.09.
  („kein Zugang ohne Konto") gilt fuer das SHF; Analyse mit Belegen:
  `docs/analysis/dialog-flow-bestand.md` (ehemals PR #277, in PR #279 zusammengeführt).

## Zwischenschnitt · Twin-Fingerabdruck — aktiv, Online-Session (Owner 09.09.)

- **Was**: Der Sync-Engine-Check liest heute bei jedem `abdeckung_scannen` jede
  Markdown-Datei jeder Twin-Familie (~330 ms je Datei, zwei Anfragen). Ein
  Fingerabdruck aus dem Ordner-Listing plus Mongo-`updatedAt` soll das Lesen
  auf geänderte Quellen beschränken; ein zweiter Lauf über ein unverändertes
  Archiv macht null `getBinary`-Aufrufe.
- **Warum jetzt**: beschleunigt die tägliche Archivarbeit mit Cowork und
  entschärft das 60-Sekunden-Limit, ohne den Job-Modus vorzuziehen. Kein
  Bezug zu M5, deshalb als Zwischenschnitt neben Vorhaben 1.
- **Brief**: [`docs/refactor/twin-fingerabdruck/AGENT-BRIEF.md`](refactor/twin-fingerabdruck/AGENT-BRIEF.md)
  (Stufe 1 Pflicht, Stufe 2 eigene PR).
- **Stufe 1 gebaut** (2026-09-09): Tor in
  `src/lib/shadow-twin/sync-engine/check-stand.ts`, Ablage im Twin-Dokument als
  `checkStand` (`src/lib/repositories/shadow-twin-check-stand.ts`), Zähler
  `wiederverwendet`/`gelesen` im Report, Schalter `erzwingen` an
  `twins_pruefen` und `abdeckung_scannen`. Sieben Tests mit gezähltem
  `getBinary` in `tests/unit/shadow-twin/check-stand.test.ts`. Stufe 2 (eine
  Anfrage statt zwei im OneDrive-Provider) bleibt offen.
- Neu dazugekommen:
  - **2026-09-09 — `updatedAt` war nicht überall gesetzt.** Der Fingerabdruck
    verlässt sich auf `updatedAt` des Twin-Dokuments; fünf Schreibwege setzten
    es nicht und hätten einen veralteten Plan unsichtbar wiederverwendbar
    gemacht. Nachgezogen in derselben PR: `deleteArtifactsByLanguage` und
    `deleteShadowTwinArtifact` (`shadow-twin-repo.ts`) sowie drei Wege in
    `thumbnail-repair-service.ts` (variant-Patch, sourceHash-Patch und die
    beiden Blöcke, die Artefakt-Markdown patchen).
  - **2026-09-09 — Pfadlänge gehört in die Kennung.** Das Pfad-Budget der
    Namens-Migration (Welle 5c) hängt an der Ordnertiefe, die nur der Scan
    kennt. Sie steht deshalb mit im Fingerabdruck. Folge: ein per-Datei-Check
    aus der Archiv-UI (`sourceIds`-Scope, Tiefe unbekannt) und ein
    Teilbaum-Scan rechnen für dieselbe Quelle verschiedene Stände — beide
    korrekt, aber sie verdrängen einander. Bei Bedarf messen, ob das in der
    Praxis vorkommt.
  - **2026-09-09 — `SYNC_ENGINE_VERSION` will gepflegt werden.** Die Konstante
    steht in `check-stand.ts` (nicht wie im Brief in `run-library-sync.ts` —
    das gäbe einen Import-Zyklus). Wer an `sync-plan/**` oder an dem, was
    `collect-*` einsammelt, etwas ändert, zählt sie hoch; sonst verteilt ein
    Deployment alte Pläne weiter.
  - **2026-09-09 — der `^src/`-Filter in `AGENTS.md` war falsch, `ci-main` 515
    ist daran zerbrochen.** Dort stand, die restlichen `tsc`-Treffer lägen in
    `tests/**` und der Next-Build prüfe sie nicht. Er prüft sie: `tsconfig.json`
    zieht mit `**/*.ts` auch `tests/**` ein. Die zwei neuen Pflichtfelder am
    `LibrarySyncReport` brachen `report-merge.fixtures.ts` — grün bei `pnpm test`,
    `pnpm lint` und `tsc | grep '^src/'`, rot erst im Docker-Build auf `master`.
    Dass ältere `.test.ts`-Fehler den Build passieren lassen, trägt nicht: Next
    meldet den ersten Fehler, den es findet. `AGENTS.md` ist korrigiert und nennt
    jetzt den Vorher/Nachher-Vergleich, der Pflichtfeld-Erweiterungen absichert.
    Zusätzlich ist `CoverageTotals.engineCheck` optional — gespeicherte Reports
    aus Scans vor dem Tor tragen es nicht.

## Vorrat: geplant

Ohne Termin. Vorhaben bedienen sich hier, wenn ein Punkt auf ihrem Weg liegt.

- **Wunschliste 5 „Wissen und Zustand auseinanderhalten"** (Cowork, 2026-09-09,
  im Archiv unter `24.09 KnowledgeScout/2026-09-09 Wunschliste 5 - …md`; Belege am
  Code geprüft). Fünf Punkte, zwei Schnitte:
  - Schnitt 1 **erledigt** (Owner-Go 09.09., Werkzeugsatz 2.28.0): A1
    `themen_setzen` weist unbekannte Themen ab (`thema_unbekannt`, Vorschläge,
    Schalter `neuesThemaErlauben`); B1 Befund `sicht_veraltet`
    (`sicht-regel.ts`, nur Library-weiter Scan); C1 Befund `repo_veraltet`
    (`repo-frische.ts`, `repo-regel.ts`) mit Frontmatter `repo_stand_am` +
    optional `repo_stand` und Library-Schwelle `agentView.repoMaxRueckstandTage`.
    **Archiv-Nachzug durch Cowork:** die beiden Felder in
    `Organisation/Aufraeumen/Konventionen.md` aufnehmen und in den vier
    Berichten mit `repo:` setzen; Schwelle in den Library-Einstellungen
    eintragen, sonst bleibt `repo_veraltet` stumm. Nicht gebaut: die
    Repo-Spalte in der Aktuell-Sicht der Werkbank (C1-Wunsch, UI)
  - Schnitt 2 **erledigt** (Werkzeugsatz 2.29.0): B3a `themen_setzen` nimmt
    jeden Ordner unterhalb des Vorhabens und legt mit `indexAnlegen: true`
    eine fehlende `_INDEX.md` nach Vorlage an (bewusst OHNE
    `bearbeitungsstand` — der bleibt `stand_setzen`, und ein geratenes
    `ungesichtet` würde das Gap-Budget alle Befunde des Teilbaums
    zusammenfassen lassen); B3b Stapel über `folderIds` (bis 30 Ordner,
    dieselbe Liste, ein gescheiterter Ordner bricht nichts ab,
    `themen-stapel.ts`); B3c Befund `thema_fehlt` (`thema-regel.ts`, Cowork ·
    warning, ab `bearbeitungsstand: erschlossen`, nur unterhalb eines
    Vorhabens, nur bei gepflegtem `agentView.themen`).
    **Archiv-Nachzug durch Cowork:** Themen an den Ereignisordnern der
    aktiven Vorhaben vergeben — sonst bleibt der Befund nur eine Liste
  - Zurückgestellt: B2 Repo-Verweise prüfen — der Dienst hat keinen Zugriff auf
    `~/projects/`; erst mit lokaler Hülle (M7) sinnvoll. C2 ist keine
    Code-Änderung (Feld `arbeitsstand`, Konventionen-Datei im Archiv)
  - Neu dazugekommen 2026-09-09 (bei B3c gemessen): Ein Ereignisordner ohne
    `_INDEX.md` erklärt keinen Stand und bleibt für `thema_fehlt` stumm; ob
    `index_missing` dort greift, hängt an `indexRequiredMaxDepth`. Wenn die
    Themenvergabe flächig laufen soll, die Tiefe je Library prüfen
  - Neu dazugekommen 2026-09-09: Ein Teilbaum-Scan, dessen Wurzel selbst
    unterhalb des Vorhabens liegt, sieht kein Vorhaben und meldet
    `thema_fehlt` nicht (dieselbe Grenze wie `sicht_veraltet`). Der übliche
    Vorhabens-Scan sieht alles; bei Bedarf messen, ob das in der Praxis stört
  - Themendossiers als erzeugte Sicht (Teil D der Wunschliste) setzen B3 voraus
    und sind damit ab jetzt möglich — kommen in eine spätere Liste
  - Vermerk (09.09.): Beide Schnitte sind gebaut; offen bleibt nur der
    Archiv-Nachzug durch Cowork. Der gehört vor Vorhaben 3 SHF, sonst ist der
    Drift bis dahin wieder da
- Galerie-Rolle fuer angemeldete Fremde (Befund M5, 2026-09-10): `useLibraryRole`
  nimmt `accessRole ?? 'owner'`, und `ExplorerRoot` legt die angezeigte
  oeffentliche Library ohne `accessRole` in den Libraries-Atom. Ein angemeldeter
  Fremder sieht auf `/explore/{slug}` deshalb Verwaltungs-Bedienelemente; der
  Server lehnt die Aktionen ab. Fuer das anonyme Embed ohne Wirkung. Beleg:
  `refactor/modularisierung/03-audit-embed-fetches.md`
- Audio-Namensraum und Diarisierung: `docs/plans/geplant/audio-namensraum-und-diarisierung_c4f81a37.plan.md`
- Mehrsprachigkeit DE/IT/EN (Naturmuseum): ADR 0010 Retrieval-Profile plus
  der stille Sprach-Rückfall A1 aus `docs/refactor/shadow-twin-deterministic/`
- Erfassung (reserviert für Vorhaben 3): ADR 0003, Welle 3-VI, Alt-Endpunkte, Roadmap Plan 2a
- Tamera: generische PDF-Upload-Strecke abnehmen, ein Tag
- Shadow Twin: deterministic B1 (Bilder-Registrierung), B2 (Provider-Cache-Key,
  Provider wird ~43× pro Verzeichnis gebaut), sync-konsolidierung (ein Schreibpfad statt vier)
- `docs/refactor/cover-image-deterministic-flow/`, 11 Schritte, keiner gebaut
- Klimamaßnahmen: Mapper-Paritätstest (Welle-4-Backlog); LLM-bereinigte Summe
  als dritte Zahl in Fußzeile und Graph-Panel (Stufe 3d des Summen-Plans)
- DIVA-Texturen Stufen 4 bis 7 (Galerie-Verifikation, Korrektur-Lauf, Persistenz, Migration)
- Storage über MCP, Rest aus ST1–ST4: Coverage-Nachführung nach Ordner-Umzug;
  Job-Modus für Scans über dem 60-Sekunden-Limit (Q7) — der Twin-Fingerabdruck (Zwischenschnitt) nimmt den meisten Läufen den Grund; danach neu messen
- Modularisierung: M6 Oldies-SiteConfig, M7 `@ks/module-agent-view`, M8
  Föderation (ADR 0009) + Retrieval-Profile (ADR 0010), `apps/`-Ebene
- ADR 0005 Co-Creator mit eigener Storage-Auth
- Verschlüsselung der gespeicherten Storage-Zugangsdaten (Encryption-at-rest):
  liegt fertig als ein Commit auf `origin/claude/lucid-planck-b9i6gj`
  (63a64bb9, 2026-06-22, 12 Dateien), nie gemergt; im Code gibt es heute keine
  Verschlüsselung. Der einzige verbliebene Alt-Branch (Bereinigung 2026-09-09:
  176 Branches gelöscht, alle in master oder per PR gemergt)
- Settings-UX-Folgeplan: Start-Flow, automatisierte Oberflächentests
- Dateigrößen-Reste der Refactor-Wellen: `onedrive-provider.ts` 2.294,
  `job-report-tab.tsx` 2.262, `phase-template.ts` 2.037, `file-list.tsx` 1.761,
  `ingestion-service.ts` 1.474, `client.ts` 1.191; 78 leere Catch-Blöcke in `external-jobs/`
- Drift-Plan-Reste: Backend-Cleanup-Folgewelle (2026-04-28 bewusst übersprungen)
- Juni-Roadmap `docs/roadmap-formatunabhaengige-library-und-onboarding.md`:
  Plan 1 bis auf A4-Feinschliff erledigt, Plan 2 Onboarding-Flow

## Verworfen

- Welle 3-V Job- und Event-Monitor: nur die Vorbereitung 3-V-a lief; bei Bedarf neu aufsetzen
- `p-32874b76` Pinecone-Status-Cache: Pinecone kommt im Code nicht mehr vor
- Nachträgliche Abnahmedokumente für die Refactor-Wellen 1.2 bis 3-IV

## Erledigt (Kurzliste, Details in der Landkarte)

Refactor-Wellen 1.1 bis 3-IV und Welle 4 · Shadow Twin Mongo-only, Wellen
5a–5d · ADR 0004 Inbox-Modell · Pipeline v3, Composite, PDF-Split ·
Live-Diktat (PR #244, #246) · Klimamaßnahmen-Pläne, SDG generisch · DIVA
Stufen 0–3 · Agentensicht W0–W5, Werkbank W1–W8, A1–A7b, ADR 0006, MCP
2.27.0 · Storage über MCP ST1–ST4 (11 von 14) · Modularisierung M1–M4e,
Galerie-Vertrag, -Eine-Quelle, -Betrachter, Umzugs-Messung · Landingpage
und Site-Modus · Favoriten und Kommentare · Settings-UX.

## Die ADRs

| ADR | Entscheidung in einem Satz | Zustand |
|---|---|---|
| 0001 | Event-Jobs und External-Jobs sind getrennte Domänen | akzeptiert |
| 0002 | Galerie-Sterne kommen aus MongoDB, nicht aus Clerk | akzeptiert |
| 0003 | Wizard (Ablauf) und Schema-Template (Datenmodell) trennen | geplant, reserviert für Vorhaben 3 |
| 0004 | Erfassen schreibt in eine Inbox, Veröffentlichen ist ein eigener Schritt | akzeptiert 2026-09-09 (gebaut seit Juni) |
| 0005 | Co-Creator nutzen eigene Storage-Zugangsdaten | zurückgestellt |
| 0006 | Maschinenarbeit gilt als angenommen, der Mensch markiert nur Fehler | akzeptiert |
| 0007 | Monorepo mit Schale, Modul-Paketen und geteilten Bibliotheken | akzeptiert 2026-09-09 (M1–M4e gebaut) |
| 0008 | Ein Deployment, viele Sites; Embed liefert nur Öffentliches | akzeptiert 2026-09-09 |
| 0009 | Mehrere Libraries pro Site, Brücken dazwischen | geplant (nur Typfeld `federated?`) |
| 0010 | Retrieval-Profil je Library: Zugang, Strategie, Sprachen | geplant |

## Pflege

- Neuer Punkt beim Bauen ⇒ Zeile unter „Neu dazugekommen" des laufenden Vorhabens, mit Datum.
- Vorhaben fertig ⇒ Abschnitt nach „Erledigt" kürzen, Reste in den Vorrat, nächstes Vorhaben auf „jetzt".
- Plan-Dateien: aktiv unter `docs/plans/`, wartend unter `docs/plans/geplant/`, fertig unter `docs/plans/archiv/`.
