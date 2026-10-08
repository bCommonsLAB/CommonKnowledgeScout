---
name: veranstaltungen-ueber-die-bruecke
overview: "Ordner mit Audio, PDF, Video und Bildern werden über die MCP-Brücke zu publizierten Seiten: Bestand erfassen, erschließen, Einheiten als Sammeldateien bilden, Mensch prüft Transkripte, transformieren, Rahmen setzen, publizieren, nachziehen. Verallgemeinert aus der Journalistenschulung (Oktober 2026). Vier Wellen (B, E, G, H) in der gemeinsamen Reihenfolge mit bruecke-library-betrieb; der Prüfschritt des Menschen bleibt in der KS-Oberfläche (Owner 08.10.2026). Konzept-Entwurf vom 08.10.2026; die ausführliche Fassung gehört ins Archiv, sobald die Brücke wieder erreichbar ist."
status: geplant
todos:
  - id: welle-b-optionen
    content: "Welle B Optionen durchreichen (vorher W1): quelle_erschliessen um speakerMode, audioPrompt, audioKeywords erweitern (Schlüssel AUDIO_CONTEXT_OPTION_KEYS), transformation_starten um slidesAsTable und appendixInSearch. Befund 08.10.: die Pipeline-Route liest die Optionen (readAudioContextOptions), die Brücke nutzt diese Route aber NICHT — quelle_erschliessen ruft enqueueSourceTranscribeJob, transformation_starten ruft enqueueTemplateOnTextJob; beide Job-Bauer in src/lib/external-jobs/enqueue-secretary-job.ts kennen die Optionen nicht und müssen sie als Job-Parameter aufnehmen. Kein stiller Default: resolveAudioJobContext und resolveAppendixDecision tragen die Quelle der Entscheidung bereits (job | library | default bzw. lauf | library | standard). Tests wie tests/unit/api/pipeline/process-audio-context.test.ts, nur für die Werkzeuge. ERLEDIGT 08.10.: transform-optionen.ts (P6 fuer alle vier Job-Bauer), audioContext in buildSourceTranscribeJob (nur Audio, Video wirft), erschliessen-wege.ts (zwei Wege mit Herkunft und naechstem Schritt — Owner 08.10.: mit Sprechererkennung ODER ohne und danach manuell pruefen), quelle_erschliessen mit sprecherErkennung/kontext/begriffe/folienAlsTabelle/anhangInSuche, transformation_starten in tools-transformation.ts mit P6, job_status.audioKontext, 2.42.0."
    status: completed
  - id: welle-e-einheiten
    content: "Welle E Einheiten (vorher W2 + W4; Owner 08.10.): (1) Der Transformations-Job schreibt beim Auflösen von _source_files die Quellen-Ids in das Twin-Dokument der Sammeldatei (neues Feld in MongoDB; bestehende Sammeldateien bekommen es mit der nächsten Transformation — für den Prüffall einmal transformation_starten erzwingen über die drei Sammeldateien). (2) sammeldatei_anlegen(ordner, dateiname, quellen[], medien[], vorlage?, titel?, include_self?) über buildCompositeReference aus src/lib/creation/composite-transcript.ts (kind composite-transcript, _source_files, _media_files), prüft vorher, dass jede Quelle existiert und ein Transkript hat, startet auf Wunsch transformation_starten; sammeldatei_pruefen(sourceId) über den Nur-Prüfen-Modus von resolveCompositeTranscript. Die Datei hat 863 Zeilen: wickeln, nicht erweitern. (3) abhaengige_dokumente(sourceId) als EINE Mongo-Abfrage über das neue Feld, je Sammeldatei Vorlage, Sprache und überholt (transformationUeberholt aus src/lib/transkript-korrektur/laden.ts); dazu die Rückfrage im Reiter Korrektur und in korrekturen_lesen. Prüffälle: die drei Sammeldateien der Journalistenschulung neu erzeugen und vergleichen; nach einer Korrektur an der Diskussion erscheinen die Sammeldateien 02 und 03 als überholt. ERLEDIGT 08.10.: Feld compositeSources + Index am Twin (shadow-twin-sammeldatei.ts), Resolver liefert sourceIds, Loader vermerkt sie bei jeder Transformation (merkeSammeldateiQuellen); sammeldatei_anlegen/sammeldatei_pruefen/abhaengige_dokumente in tools-sammeldatei.ts; abhaengigeSammeldateien in transkript_korrigieren, korrekturen_lesen (Arbeitsliste), Route und Reiter Korrektur; 2.43.0. Prueffall live offen."
    status: completed
  - id: welle-g-artefakt-lesen
    content: "Welle G Helfer (vorher W5): artefakt_lesen(sourceId, kind, sprache?, vorlage?) liefert Transkript oder Transformation einer Quelle aus MongoDB über ladeTranskript bzw. getShadowTwinsBySourceIds, ohne Spiegel — nötig, damit ein Agent die Zuordnung in Station 3 aus den Transkriptanfängen ableiten kann, auch bei persistToFilesystem=false. Nur lesen; Body ohne Frontmatter optional."
    status: pending
  - id: welle-h-drehbuch
    content: "Welle H Drehbuch (vorher W7): Skill veranstaltung-aufbereiten nach dem Muster .claude/skills/archiv-aufraeumen: Stationen 1 bis 7 plus Nachziehen, je Station die Werkzeuge, die Bestätigungspunkte für den Owner (Library, Zuordnung der Einheiten, Freigabe der Veröffentlichung) und die Prüfpunkte (seite_pruefen, keine Antwort der falschen Person, kein Name ohne Beleg). Station 4 hält an: Hörfehler und Sprechernamen prüft der Mensch im Reiter „Korrektur“ der KS-Oberfläche (Owner 08.10.), der Skill nennt nur die Quellen, die dran sind, und fährt nach der Bestätigung mit abhaengige_dokumente fort. Braucht A bis E aus dem gemeinsamen Wellenplan."
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

Ursprünglich sieben Wellen W1 bis W7; seit 08.10. gilt die Zuordnung im
Abschnitt „Wellen und Entscheidungen" unten. Jede Welle ist ein eigener PR
mit Tests nach dem Muster der bestehenden Werkzeug-Tests unter
`tests/unit/mcp/`, Versionssprung in `tools-info.ts` und einer Zeile für
`src/lib/mcp/**` im Routing-Index von `CLAUDE.md`.

Zwei Dinge außerhalb dieses Plans, die den Fluss trotzdem bremsen:

- **Lange Audio-Stücke.** Der KS-Watchdog setzt Jobs nach 10 Minuten ohne
  Rückmeldung auf `failed`; der Heartbeat je Stück im Secretary (Branch
  `claude/heartbeat-je-stueck`) ist gebaut, aber noch nicht im Prüffall
  belegt. Bis dahin scheitern Stücke über 10 Minuten zufällig, egal ob
  Oberfläche oder Brücke.
- **Secretary ohne VPN.** Sein DNS-Resolver nimmt die VPN-Nameserver; ohne
  VPN fällt MongoDB aus und jeder Job-Aufruf liefert 500 (Befund 08.10.).
  Ein Agent sieht das im Trace unter `secretary_request_ack` mit `status: 500`.

## Wellen und Entscheidungen (Owner 08.10.2026)

Die Wellen beider Brücken-Pläne laufen in EINER Reihenfolge, sortiert nach
Allgemeinheit; die Tabelle steht in
[`bruecke-library-betrieb.plan.md`](bruecke-library-betrieb.plan.md) §3.
Aus diesem Plan stammen **B** (Optionen durchreichen), **E** (Einheiten),
**G** (`artefakt_lesen`) und **H** (Drehbuch). Welle A (`dokumente_auflisten`,
`bestand_pruefen`) aus dem anderen Plan bedient hier Station 1 und 7.

| Vorher | Jetzt | Grund |
|---|---|---|
| W1 | Welle B | Mehr als Durchreichen: die Brücke geht nicht über die Pipeline-Route, die Job-Bauer brauchen die Parameter |
| W2 + W4 | Welle E | Abhängigkeit wird beim Transformieren ins Twin-Dokument geschrieben; `_source_files` steht heute nur im Frontmatter der Sammeldatei im Storage, ein Vollscan über alle Sammeldateien wäre die einzige Alternative |
| W3 | entfällt | Der Prüfschritt des Menschen (Station 4) bleibt in der KS-Oberfläche, Reiter „Korrektur". Kein `korrekturvorschlag_holen`, keine zweite Form von `transkript_korrigieren`; das bestehende Werkzeug bleibt für den Spiegel-Fall |
| W5 | Welle G | unverändert, klein |
| W6 | entfällt | `kosten_schaetzen` wird nicht gebraucht; die Kostenregel unten nennt die Zahlen aus dem Plan `von-menschen-gepruefte-veranstaltung` |
| W7 | Welle H | Station 4 als Haltepunkt, nicht als Werkzeug |

Stand der Vorbedingungen: P3b ist als #357 gemergt (1.2.287); der
Heartbeat-Prüffall im Secretary ist weiter offen (Branch liegt im
Secretary-Repo, nicht hier).

## Regeln, die gelten

- Erschließen, Transformieren und Publizieren kosten Geld: vorher die
  Zahlen aus dem Plan `von-menschen-gepruefte-veranstaltung` nennen
  (Sprecher-Modell 0,006 USD/min, Standard 0,0045 USD/min), dann starten.
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
Agent mit dem Skill aus Welle H kommt vom leeren Ordner bis zu drei
publizierten Vortragsseiten und einer Veranstaltungsseite, mit drei
Rückfragen an den Menschen (Library, Zuordnung der Einheiten, Freigabe der
Veröffentlichung) und einem Haltepunkt, an dem der Mensch Hörfehler und
Namen im Reiter „Korrektur" der KS-Oberfläche prüft. Messen gegen das Drehbuch im Archiv (rund
70 Minuten, davon 50 Minuten Mensch).
