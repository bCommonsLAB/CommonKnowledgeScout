# Ergebnis der Testsession Werkbank-Abnahme (A1–A6)

**Durchgeführt:** 25.08.2026, lokal · Library „Onedrive Test" (Peters Archiv,
148 Vorhaben) · Prüfarchiv „26.01 Klimamaßnahmen Südtirol"
**Anleitung:** [testsession-werkbank-abnahme-a1-a6.md](testsession-werkbank-abnahme-a1-a6.md)

---

## 1. Kaputt

### K1 — Nach einem Reload ist jede Verifikation aus der Anzeige weg

Nach 28 Verifikationen und einem Seiten-Reload steht das Vorhaben wieder auf
„0 von 28 geprüft", alle Artefakte auf `○`, der Chip auf „Unverifiziert".

**Die Arbeit ist nicht verloren** — sie ist geschrieben. Im Frontmatter des
Transkripts steht `verified_by: human:peter.aichner@…` und
`verified_at: 2026-08-25T14:19:07.656Z`; der Server hat 26× mit 200 geantwortet.

**Ursache:** Baum, Zähler und Chip lesen ihren Zustand ausschließlich aus dem
**gespeicherten CoverageReport** (hier: Scan 11:07:30, also vor allen
Verifikationen) plus **In-Memory-Overrides** (`use-artefakt-kuration.ts`,
`useState`, keine Persistenz). Beim Reload sind die Overrides weg, der Report
weiß von nichts.

**Kosten:** Sichtbar wird die Arbeit erst nach einem Voll-Scan (~8 Minuten).
Wer nach 56 Verifikationen neu lädt, sieht eine Stunde Arbeit verschwinden und
macht sie vermutlich nochmal. Die Anleitung nennt das in §7 als bekannte
Grenze — sie unterschätzt die Folge deutlich.

**Lösungsrichtung (günstig):** Die Verifikation steckt in den **Mongo-Twins**
(`coverage-service.ts` → `buildFamilySummaries`), nicht im Storage-Scan. Eine
schlanke Route „Verifikationen je Vorhaben" könnte sie in *einer* Mongo-Abfrage
nachladen und den Report überlagern — ohne Graph-Aufrufe, also in
Millisekunden. Kein Voll-Scan nötig.

### K2 — Widerspruch auf einem Bildschirm

Der Frontmatter-Block zeigt `verified_by` / `verified_at`, während Chip und
Tab-Zeichen daneben „Unverifiziert" / `○` sagen. Der Kopf leitet seinen Zustand
aus dem alten Report ab, obwohl der geladene Inhalt die Wahrheit direkt
danebenstehen hat.

---

## 2. Langsam: Verifizieren (gemessen)

| Verifizieren | Dauer |
|---|---|
| 1. (mit Route-Kompilierung) | 10.890 ms |
| 2. | 3.279 ms |
| 3. | 2.695 ms |
| 4. | 2.452 ms |

**~2,5–3,3 s pro Klick.** 28 Transkripte + 28 Zusammenfassungen ≈ 2,5 Minuten
reine Wartezeit. Die Sammelaktion läuft sequenziell: ~75 s je Durchgang.

Je Aufruf **12–14 nacheinander laufende HTTP-Roundtrips**:

1. **Selbst-Aufruf per HTTP** — `GET localhost:3000/api/libraries/{id}` bei
   jedem Verifizieren. Ein direkter Funktionsaufruf würde ihn ersetzen.
2. **Pfad wird jedes Mal neu abgelaufen** — `/me/drive/root:/Arc..` plus 6–8
   Einzelabfragen, um dieselbe Datei wiederzufinden. Kein Cache über die Sitzung.
3. **Spiegel-Write als `DELETE` + `PUT`** statt Inhalts-Update — zwei Runden,
   und zwischen beiden existiert die Spiegeldatei **nicht**. Ein Absturz genau
   dort verliert sie. → Kein Tempo-Thema, ein Datenverlust-Risiko.
4. **Clerk-Nutzerabfrage bei jedem Request**, ohne Cache.

Der Drift-Guard (Lesen der Spiegeldatei zum Vergleich mit MongoDB) ist Absicht
und bleibt. Das Problem sind die Wege drumherum.

---

## 3. Unerwartet, aber Absicht

- **Halb geprüfte Familien sehen unverändert aus.** Eine Twin-Familie bekommt
  ihr `✓` erst, wenn Transkript **und** Zusammenfassung geprüft sind
  (`werkbank-baum.ts`, `every(artefaktGeprueft)`). Nach 26 erfolgreichen
  Verifikationen der Zusammenfassungen stand der Zähler weiter auf `2/28` —
  korrekt, aber ohne jede Rückmeldung. Das Symbol kennt nur `○` und `✓` und
  verschluckt „halb fertig".
- **Das Prüfarchiv hat 2 Cowork-Befunde** (`M 28 · C 2 · K 0`). Die Anleitung
  nennt es „keine Maschinen-Befunde" — das gilt nicht mehr. Folge: der
  Abnehmen-Knopf bleibt gesperrt, Tooltip „Blockiert: 2 Cowork-Befunde offen".
- Der Kopf zeigte vor dem frischen Scan „Anderer Scan-Scope als zuvor — kein
  Vergleich" statt der Vergleichszeile. Ehrlicher Rückfall, kein Fehler.

---

## 4. Umgebung (kein Produkt-Befund)

`.env` des Worktrees hatte `INTERNAL_SELF_BASE_URL=http://localhost:3001`,
während der Server auf 3000 lief. `getSelfBaseUrl()` (`src/lib/env.ts`) nimmt
diese Variable **vor** `NEXT_PUBLIC_APP_URL` — jeder Server→Server-Aufruf lief
ins Leere (`ECONNREFUSED`). Betraf Scan **und** Bericht-Route. Beide Variablen
stehen jetzt auf 3000.

Nebenbefund: Nach einem gescheiterten Token-Refresh **löscht** der Code die
OneDrive-Tokens in der DB (`onedrive-provider.ts:480`) — auch bei einem reinen
Netzwerkfehler.

---

## 5. Abgenommen

| Block | Ergebnis |
|---|---|
| **A1 Kopf** | Zwei Zeilen, Scan-Details + Neu scannen, Vergleichszeile „0 erledigt · 2 neu", vier Karten, „0 wartet auf dich" **mit** Grund |
| **A2 Baum** | Vier Ebenen bis zum Artefakt, Zähler `0/28` bzw. `n/m` je Ordner, `○` + Familien-Zahl je Artefakt, `?vorhaben=…&artefakt=…` in der Adresszeile |
| **A3 Dokument** | Bericht (BERICHT.md) und Ordner-Beschreibung (_INDEX.md) je mit Archiv-Link; Artefakt mit drei Tabs, Audio-Abspieler, PDF-Vorschau, ehrlicher Word-Satz; Frontmatter über dem Text |
| **A4 Kopf** | Ein Bauplan für Vorhaben und Artefakt, EIN großer Knopf + `⋯`; Tooltip nennt den Sperrgrund im Klartext; Menü vollständig inkl. „Befunde & Auftrag" |
| **A5 Fluss** | Verifizieren, Tabwechsel und Sprung aufs nächste offene Artefakt laufen. Vorbehalt: Tempo (§2) und K1 |
| **A6 Themen** | Vokabular im Dropdown, Vorhaben erscheint unter **jedem** Thema, „Ohne Thema" (147) zuletzt |

**Der `_INDEX.md`-Schreibtest ist der sauberste Befund der Session:** Die Datei
wuchs um **exakt 62 Byte** — genau die Länge der neuen Zeile
`themen: [DEV-Klimamassnahmen, LIB-Klimamassnahmen, ACT-Klima]` plus
Zeilenumbruch. Kein anderes Byte hat sich bewegt, der Body ist unangetastet.

---

## 6. Wünsche — in dieser Session umgesetzt

| | Was | Wo |
|---|---|---|
| W1 | „Bereit" ist erstes Segment **und** Default, amber betont wie die Karte „wartet auf dich" — dieselbe Frage, dieselbe Farbe | `use-werkbank-url-state.ts`, `werkbank-filter-leiste.tsx` |
| W2 | Bereichs-Gruppen starten bei langen Listen **zugeklappt** (Schwelle 20). Kurze Listen bleiben offen, Handgriff schlägt die Automatik, Gruppe der Auswahl bleibt offen | `werkbank-gruppen.ts` (`berechneEingeklappt`) |
| W3 | **Neueste zuerst** — Vorhaben und Ordner absteigend (Namen beginnen mit Jahr/Monat), Bereiche bleiben aufsteigend | `werkbank-filter.ts`, `werkbank-baum.ts` |
| W4 | Frontmatter zweispaltig, Werte auf einer Kante | `werkbank-artefakt-dokument.tsx` |
| W5 | Markdown zwei Stufen kleiner (12 px) mit abgeflachten Überschriften — als **Opt-in-Prop**, damit Docs und Archiv unverändert bleiben | `markdown-preview.tsx` (`schriftstufe`) |

Tests: 393 grün · Typecheck und Lint ohne neue Meldungen.

---

## 7. Wünsche — offen

- **Halb-Zeichen für Twin-Familien** (`◐`) plus Zähler als „26/28 Teile" statt
  „2/28 Familien", damit eine Sammelaktion sichtbar wirkt.
- **Themen über die MCP-Brücke.** Die Zuordnung ist Aufgabe des Aufräum-Agenten,
  nicht des Menschen im Dropdown — er hat die Übersicht. Der Schreibweg
  existiert (`themen-schreiben.ts` → `setzeThemen()`), es fehlen:
  1. Werkzeug `themen_setzen` nach dem Muster von `tools-stand.ts`
     (mit `erwarteteThemen` als Riegel gegen konkurrierende Schreiber)
  2. Themen **und** Vokabular in der MCP-Kompaktsicht — sonst rät der Agent
  3. Ein Schritt im Skill `archiv-aufraeumen`, zwischen „4 — Gegenprüfen" und
     „5 — Neu scannen"

---

## 8. Architektur-Einwand: Beweislast umdrehen

Der heutige Entwurf verlangt **Zustimmung zu allem**, was die Maschine tut —
jedes Transkript, jede Zusammenfassung muss abgehakt werden, sonst bewegt sich
der Fluss nicht.

Peters Modell ist umgekehrt: die Maschine arbeiten **lassen**, ihre Arbeit
wohlwollend entgegennehmen, und nur eingreifen, wo er einen **Fehler sieht**.

- Artefakte starten als angenommen — neutral gezeichnet, nicht als Mangel.
- Der Mensch markiert den **Fehler**, nicht die Korrektheit. Ein als fehlerhaft
  markiertes Dokument wird repariert und bekommt **dann** das grüne Häkchen.
- Abnahme und Fortschritt hängen **nicht** daran, ob er geprüft hat.
- Aufgabe der Sicht: dem Menschen helfen, die **Widerstände** zu entdecken —
  statt ihn durch 56 Bestätigungen zu führen.

**Reihenfolge-Konsequenz:** Diese Frage ist **vor** K1/K2 zu klären. Wenn
Verifikation nicht mehr das Tor ist, verliert K1 seine Schärfe — und A5
(„Prüfen im Fluss") samt Sammelaktionen steht mit zur Disposition. Sonst
repariert man eine Anzeige für einen Ablauf, den niemand will.

---

## 9. Nebenprodukt: Themen-Vokabular

Namenskonvention (Entscheidung 25.08.2026) — Präfix sagt die **Art** der
Arbeit, danach der Gegenstand ohne Leerzeichen:

| Präfix | Bedeutung |
|---|---|
| `ACT-` | Aktivismus — die Arbeit in der Welt |
| `DEV-` | Entwicklung an einem bestimmten Projekt |
| `KS-` | Querschnitt KnowledgeScout |
| `LIB-` | Inhaltsarbeit für eine Library |
| `SEC-` | Querschnitt Secretary Service |

Alphabetisch sortiert ergibt das fünf saubere Blöcke in der Gruppierung
„Thema". 24 Einträge sind in der Library-Konfiguration von „Onedrive Test"
hinterlegt (`config.agentView.themen`).

**Wichtig für den Aufräum-Agenten:** Die **Ordnernamen geben das Thema nicht
her** — sie sind Ereignisnamen. „26.04 Klimabotschafter Treffen" gehört zu
`ACT-Klima`, ohne dass ein Wort darauf hinweist. Das Vokabular liefert die
Auswahl; die Zuordnung verlangt den Blick in den Bericht.
