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

**Reihenfolge: 1 AECED → 2 Vortrag 30.09. → 3 SHF.** Agenten arbeiten nur
am Vorhaben, das „jetzt" trägt, es sei denn, der Owner sagt es anders.

## Vorhaben 1 · AECED: Galerie als einbettbare Komponente (M5) — jetzt

- **Termin**: der nächste; der 31.08. ist überschritten.
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

- (noch nichts; Einträge als `- JJJJ-MM-TT: …`)

## Vorhaben 2 · Vortrag 30.09. — danach

- **Termin**: 30.09.
- **Ziel**: eine Vorführung, die eine Stunde lang nicht hängen bleibt.

Bekannte Punkte:

1. OneDrive-Anmeldung stabil neu aufsetzen; sie fällt nach ein bis zwei
   Wochen aus. Teilfortschritt 27.08. (Netzwerkfehler löschen die Anmeldung
   nicht mehr) ist drin.
2. Inhalt des Vortrags festlegen: Library, Weg durch Galerie, Chat, Werkbank.
   Daraus kommen weitere Punkte.

Mitgenommene alte Themen (Kandidaten): Split des OneDrive-Providers (2.294
Zeilen), nur wenn die Anmeldung dort umgebaut wird; ADR 0005 nur entscheiden.

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
generic-finalize-wizard; werden in `creation-wizard.tsx` noch aktiv gerufen),
ADR 0003 Wizard/Schema, und die Reste aus Welle 3-VI. Mehrsprachigkeit DE/IT:
entscheidet das Vorabtreffen.

Neu dazugekommen: (noch nichts)

## Vorrat: geplant

Ohne Termin. Vorhaben bedienen sich hier, wenn ein Punkt auf ihrem Weg liegt.

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
  Job-Modus für Scans über dem 60-Sekunden-Limit (Q7)
- Modularisierung: M6 Oldies-SiteConfig, M7 `@ks/module-agent-view`, M8
  Föderation (ADR 0009) + Retrieval-Profile (ADR 0010), `apps/`-Ebene
- ADR 0005 Co-Creator mit eigener Storage-Auth
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
