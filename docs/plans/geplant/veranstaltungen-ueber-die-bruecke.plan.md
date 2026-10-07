---
name: veranstaltungen-ueber-die-bruecke
overview: "Ordner mit Audio, PDF, Video und Bildern werden über die MCP-Brücke zu publizierten Seiten: Bestand erfassen, erschließen, Einheiten als Sammeldateien bilden, Mensch prüft Transkripte, transformieren, Rahmen setzen, publizieren, nachziehen. Verallgemeinert aus der Journalistenschulung (Oktober 2026). Sieben Werkzeug-Wellen für die Brücke plus ein Skill als Drehbuch. Konzept-Entwurf vom 08.10.2026; die ausführliche Fassung gehört ins Archiv, sobald die Brücke wieder erreichbar ist."
status: geplant
todos:
  - id: w1-erschliessen-mit-kontext
    content: "Brücke: quelle_erschliessen um speakerMode, audioPrompt, audioKeywords erweitern (P3a-Optionen, Server-Seite seit PR #351/#356 vorhanden; Schlüssel AUDIO_CONTEXT_OPTION_KEYS, Leser readAudioContextOptions). transformation_starten um slidesAsTable und appendixInSearch (P6, PR #352). Kein stiller Default: fehlt ein Wert, entscheidet weiter die Library-Voreinstellung, und der Job-Trace zeigt die Quelle. Tests wie tests/unit/api/pipeline/process-audio-context.test.ts, nur für die Werkzeuge."
    status: pending
  - id: w2-sammeldatei-werkzeug
    content: "Brücke: sammeldatei_anlegen(ordner, dateiname, quellen[], medien[], vorlage?, titel?, include_self?) schreibt die Referenz-Markdown nach der Konvention aus src/lib/creation/composite-transcript.ts (kind composite-transcript, _source_files, _media_files), prüft vorher, dass jede Quelle existiert und ein Transkript hat (sonst Fehler mit Dateinamen), und startet auf Wunsch transformation_starten. sammeldatei_pruefen(sourceId) meldet fehlende Quellen und fehlende Transkripte einer bestehenden Sammeldatei. Prüffall: die drei Sammeldateien der Journalistenschulung aus den Quellen neu erzeugen und mit den vorhandenen vergleichen."
    status: pending
  - id: w3-korrektur-ueber-bruecke
    content: "Brücke: korrekturvorschlag_holen(sourceId, begleitSourceIds[], zielsprache?) ruft denselben Weg wie POST api/library/[libraryId]/transcript-correction/suggest (Secretary P2) und liefert ersetzungen, sprecher, verworfen. transkript_korrigieren bekommt eine zweite Form auf dem P3b-Kern (src/lib/transkript-korrektur/): Mongo zuerst mit ifUpdatedAt statt Spiegel-ifVersion, sprecher[] als Zuordnung Label→Name (Präfix-Ersetzung plus speaker_names), nurVorschau. Der bestehende Spiegel-Weg bleibt für Libraries, die ihn nutzen. Regel: Die Brücke holt Vorschläge und schreibt nur nach ausdrücklicher Bestätigung des Menschen (Owner-Entscheidung 06.10.: Namen nur, wenn belegt)."
    status: pending
  - id: w4-abhaengige-dokumente
    content: "Brücke: abhaengige_dokumente(sourceId) liefert alle Sammeldateien, deren _source_files diese Quelle enthalten, je mit Vorlage, Sprache und dem Befund überholt (Transkript revised_at jünger als die Transformation; Ableitung transformationUeberholt aus src/lib/transkript-korrektur/laden.ts, rückwärts über die Familie). Dazu die Rückfrage im Reiter Korrektur und in korrekturen_lesen. Prüffall: nach einer Korrektur an der Diskussion müssen die Sammeldateien 02 und 03 als überholt erscheinen."
    status: pending
  - id: w5-artefakt-lesen
    content: "Brücke: artefakt_lesen(sourceId, kind, sprache?, vorlage?) liefert Transkript oder Transformation einer Quelle aus MongoDB, ohne Spiegel. Nötig, damit ein Agent die Zuordnung in Station 3 (welches Audio gehört zu welchen Folien) aus den Transkriptanfängen ableiten kann, auch in Libraries mit persistToFilesystem=false (Default ist true; dort reicht datei_lesen auf den Spiegel). Nur lesen, kein Schreiben; Body ohne Frontmatter optional."
    status: pending
  - id: w6-kosten-schaetzen
    content: "Brücke: kosten_schaetzen(sourceIds[] oder ordner) liefert je Quelle Audiominuten (aus Metadaten oder ffprobe im Secretary), PDF-Seiten, erwartete Jobdauer und eine Grobschätzung in USD (Sätze aus dem Plan von-menschen-gepruefte-veranstaltung: Sprecher-Modell 0,006 USD/min, Standard 0,0045 USD/min), plus Warnung, wenn ein Audio-Stück über 10 Minuten läuft (KS-Watchdog 600 s) und der Secretary-Heartbeat nicht belegt ist. Kein Start, nur Auskunft."
    status: pending
  - id: w7-skill-drehbuch
    content: "Skill veranstaltung-aufbereiten nach dem Muster von .claude/skills/archiv-aufraeumen: die sieben Stationen (Bestand, Erschließen, Einheiten bilden, Mensch prüft, Transformieren, Rahmen setzen, Publizieren) plus Nachziehen, je Station die Werkzeuge, die Bestätigungspunkte für den Owner (Library bestätigen, Zuordnung der Einheiten, Namen, Veröffentlichung), die Kostenregeln und die Prüfpunkte (seite_pruefen, keine Antwort der falschen Person, kein Name ohne Beleg). Erst nach W1 bis W4 sinnvoll; W5 und W6 machen ihn schneller."
    status: pending
---

# Veranstaltungen über die Brücke aufbereiten

## Warum

Die Journalistenschulung (Oktober 2026, Library „Dachverband für Soziales")
wurde in zwei Sitzungen von Hand zu drei publizierten Vortragsseiten: Dateien
erschließen, Sammeldateien schreiben, Vorlage bauen, Transkripte korrigieren,
transformieren, publizieren. Jede Station hat inzwischen Code in der
Oberfläche (Pipeline-Sheet mit P3a, Reiter „Korrektur" P3b, Vorlage P4,
Optionen P6). Über die MCP-Brücke erreicht ein Agent davon nur einen Teil.
Ziel dieses Plans: dieselben Stationen so in die Brücke bringen, dass ein
Agent mit dem bestehenden Aufräum-Skill einen Ordner mit Audio, PDF, Video
und Bildern bis zur Veröffentlichung begleitet, und der Mensch nur dort
entscheidet, wo es um Inhalt geht.

Das Konzept ist aus dem Chatverlauf vom 06. bis 08.10.2026 abgeleitet
(P3a-Prüffall, P3b-Bau, P4-Vorbereitung). Die ausführliche Fassung mit
Drehbuch und Zeiten gehört ins Archiv (`24.09 KnowledgeScout`), sobald die
Brücke wieder erreichbar ist; hier liegt der Repo-Auszug.

## Die Stationen

| Nr. | Station | Wer | Heute in der Oberfläche | Heute über die Brücke |
|---|---|---|---|---|
| 1 | Bestand erfassen: Quellen, vorhandene Transkripte, Lücken | Maschine | Datei-Liste, Werkbank | `ordner_listen`, `abdeckung_scannen`, `abdeckung_lesen` |
| 2 | Erschließen: je Quelle ein Transkript (Audio mit oder ohne Sprecher, PDF mit Seitenbildern, Video, Bilder) | Maschine | Pipeline-Sheet mit Sprecher, Kontext, Begriffen | `quelle_erschliessen` (Stapel bis 30, `nur_transkript`), **ohne** Sprecher-Modus und Kontext |
| 3 | Einheiten bilden: was gehört zusammen; je Einheit eine Sammeldatei | Mensch entscheidet, Agent schlägt vor | von Hand (Wizard-Schritt P5 geplant) | `datei_schreiben` nach Konvention, kein Werkzeug |
| 4 | Mensch prüft: Hörfehler und Sprecher-Zuordnung bestätigen | Mensch | Reiter „Korrektur" (P3b) | `transkript_korrigieren` nur mit Spiegel, ohne Sprecher, ohne Vorschlag |
| 5 | Transformieren: Sammeldatei mit Vorlage, Folien, Anhang | Maschine | Pipeline-Sheet mit P6-Optionen | `transformation_starten` (Sammeldatei wird aufgelöst), **ohne** P6-Optionen |
| 6 | Rahmen setzen: Veranstaltungsseite, Facetten, Reihenfolge, Themen | Mensch entscheidet, Agent setzt | Einstellungen, Werkbank | `transformation_starten`, `dokument_felder_setzen`, `themen_setzen` |
| 7 | Publizieren und prüfen | Agent, Mensch sieht hin | Galerie, Story | `dokument_publizieren`, `seite_pruefen`, `bilder_auflisten`, `veroeffentlichung_setzen` |
| Q | Nachziehen: nach einer Korrektur abhängige Sammeldateien neu transformieren | Maschine | Badge „überholt" je Quelle | `transformation_starten erzwingen`, aber kein Finden der Abhängigen |

Zwei Stationen bleiben beim Menschen: die Zuordnung der Einheiten (3) und
die Bestätigung von Namen (4). Der Agent schlägt vor; falsche Zuordnungen
auf veröffentlichten Seiten sind der teuerste Fehler dieses Flusses.

## Die Use Cases, die sich wiederholen

- **Ordner erschließen.** Jeder Ordner, jedes Thema. Vollständig vorhanden.
- **Einheit zusammenstellen und transformieren.** Vortrag, Workshop,
  Interview, Sitzung: Audio plus Unterlagen plus Einladung. Fehlt als Werkzeug.
- **Mensch prüft Transkript.** Immer, wenn Namen und Zahlen auf die Seite
  kommen. Nur in der Oberfläche vollständig.
- **Veranstaltung rahmen.** Einleitungsseite, Facetten, Reihenfolge.
  Vorhanden, braucht nur das Drehbuch.
- **Publizieren und prüfen.** Vorhanden.
- **Nachziehen nach Korrektur.** Fehlt das Finden der Abhängigen.
- **Aufräumen und berichten.** Bestehender Skill `archiv-aufraeumen`.

## Was in der Brücke fehlt, nach Hebel sortiert

Die Reihenfolge der Todos oben: W1 ist Durchreichen vorhandener Optionen,
W2 bis W4 schließen die drei Lücken, die im Prüffall am meisten Handarbeit
gekostet haben, W5 und W6 machen den Agenten selbständiger, W7 macht den
Ablauf wiederholbar. Jede Welle ist ein eigener PR mit Tests nach dem Muster
der bestehenden Werkzeug-Tests unter `tests/unit/mcp/`.

Zwei Dinge außerhalb dieses Plans, die den Fluss trotzdem bremsen:

- **Lange Audio-Stücke.** Der KS-Watchdog setzt Jobs nach 10 Minuten ohne
  Rückmeldung auf `failed`; der Heartbeat je Stück im Secretary (Branch
  `claude/heartbeat-je-stueck`) ist gebaut, aber noch nicht im Prüffall
  belegt. Bis dahin scheitern Stücke über 10 Minuten zufällig, egal ob
  Oberfläche oder Brücke.
- **Secretary ohne VPN.** Sein DNS-Resolver nimmt die VPN-Nameserver; ohne
  VPN fällt MongoDB aus und jeder Job-Aufruf liefert 500 (Befund 08.10.).
  Ein Agent sieht das im Trace unter `secretary_request_ack` mit `status: 500`.

## Regeln, die gelten

- Erschließen, Transformieren und Publizieren kosten Geld: vorher
  `kosten_schaetzen` (W6) oder die Zahlen aus dem Plan
  `von-menschen-gepruefte-veranstaltung` nennen, dann starten.
- Kein stiller Default in neuen Werkzeugen: fehlt eine Option, entscheidet
  die Library-Voreinstellung sichtbar im Trace (`no-silent-fallbacks`).
- Frontmatter flach (`speakers`, `speaker_names`, `revised_*`), nur über den
  zentralen Serializer.
- Die Brücke schreibt Korrekturen nur nach Bestätigung; Vorschläge
  einholen darf sie ohne Rückfrage.
- Repo-Regel „Öffentliches Repo": keine realen Personennamen in Tests und
  Doku, Libraries nur unter ihrem Kürzel.

## Prüffall für den ganzen Fluss

Derselbe Ordner wie bisher: vier Audios, drei PDFs, der Flyer. Soll: Ein
Agent mit dem Skill aus W7 kommt vom leeren Ordner bis zu drei publizierten
Vortragsseiten und einer Veranstaltungsseite, mit genau vier Rückfragen an
den Menschen (Library, Zuordnung der Einheiten, Namen je Diskussion,
Freigabe der Veröffentlichung). Messen gegen das Drehbuch im Archiv (rund
70 Minuten, davon 50 Minuten Mensch).
