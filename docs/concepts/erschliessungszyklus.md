# Der Erschließungszyklus: vier Schritte pro Vorhaben (v2)

Stand: 2026-08-18 · v2 nach dem ersten vollständigen Pilot-Durchlauf
(`25.01 Common Secretary`). Ergänzung zum Konzept-Set (Twin-Datei-Contract,
Projektauftrag Agentensicht, Bruchstellen-Katalog, Cowork-Briefing).
Zweck: das operative Verfahren, mit dem das Archiv ordnerweise aufgeräumt und
erschlossen wird. Ziel: dasselbe Verfahren läuft stabil auf OneDrive wie auf
Nextcloud.

**Was sich in v2 ändert — und warum.** v1 verlangte „erst Strukturieren, dann
Erschließen" (Namens-Fenster). Der Pilot hat gezeigt: Für den eigentlichen
Aufräumfall — den wilden Haufen alter Dateien — ist das die falsche
Reihenfolge. Niemand kann Aufnahmen und PDFs sinnvoll einsortieren, deren
Inhalt er nicht kennt. **v2 dreht die Schritte: erst lesen, dann einräumen.**
Möglich ist das, weil die Identität der Twins an den umzugsstabilen
Speicher-IDs des Providers hängt (nicht an Pfaden) und die `_`-Spiegelordner
abgeleitete, jederzeit regenerierbare Kopien sind — ein Umzug nach der
Erschließung ist damit kein Bruch, sondern eine **Familien-Operation**
(Welle 0e macht daraus eine Funktion).

---

## 1. Die vier Schritte

| # | Schritt | Wer | Werkzeug | Ergebnis |
|---|---|---|---|---|
| 1 | **Sichten** (Erschließen) | KS-Pipeline; Peter prüft stichprobenartig | KnowledgeScout | Für jede unbekannte Quelle: Transkript + **Typ-Erkennung** (§2) + Transformation mit dem **zum Typ passenden Standard-Template**. Peters Prüfung ist eine Qualitäts-Stichprobe (Typ richtig erkannt? Felder plausibel?) — keine Verifikation |
| 2 | **Strukturieren** | Cowork-Session (mit Peter) | Filesystem + KS-Funktion | Liest die Transformationen — weiß jetzt, was Konzept, E-Mail-Diktat oder Besprechung ist und was veraltet —, entwirft die Ordnerwelt, zieht **Familien** um (Quelle + `_`-Ordner, Welle 0e), Klassen-Entscheid (Original/Beleg/Ableitung), `_INDEX.md` + Stub-`BERICHT.md`, Umzugsprotokoll |
| 3 | **Berichten** | Cowork-Session | Filesystem, liest Twins | `BERICHT.md` auf Twin-Basis (zitiert Transformationen, verweist als echte Links); erkannte Transkript-Schwächen direkt im `_`-Ordner korrigiert; Chronologie aus den Datums-Feldern; Unklares als offene Punkte |
| 4 | **Abnehmen** | Peter | KnowledgeScout | Erst **„Prüfen"** (Import holt Korrekturen — seit Welle 0d gewinnen Handänderungen zuverlässig), dann Verifikation am führenden Artefakt: `verified_by: human:peter`, `verified_at`, `twin_status: stable`. Danach `aktuell.py`/`projekte.py`/`erschliessung.py` |

Der Zyklus läuft **pro Vorhaben** — ein Ordner, ein Durchlauf. Die Pipeline
darf innerhalb eines Schritts beliebig bündeln; der Zyklus ist der Takt,
nicht die Batchgröße.

Innerhalb der Twin-Familie gilt weiter die Lese- und Korrektur-Ordnung aus
dem Contract §2b: **Die Transformation führt** (Felder, Verdichtung, Status;
Cowork liest sie zuerst, Berichte verweisen auf sie, die Abnahme gilt ihr),
**das Transkript belegt** (Zitate; Wortlautfehler werden dort korrigiert).

## 2. Die Typ-Erkennung: erst verstehen, dann das richtige Template

Ein Transkript sagt noch nicht, *was* die Datei ist. Eine Aufnahme kann ein
Konzept-Monolog sein, ein diktierter E-Mail-Entwurf, eine Besprechung, ein
Vortrag; ein PDF ein Papier, ein Angebot, ein Protokoll. **Jeder Typus
braucht eine andere Verdichtung** — eine Besprechungsanalyse mit
„Teilnehmende / Entscheidungen / nächste Schritte" ist für ein diktiertes
Konzept die falsche Brille.

Deshalb wird die Transformation zweistufig:

1. **Typ bestimmen.** Nach dem Transkript entscheidet ein Agent (kleiner,
   billiger LLM-Schritt), welcher Typus vorliegt. Das Ergebnis steht als
   `doc_type` im Frontmatter — nachvollziehbar und korrigierbar.
2. **Typ-Template anwenden.** Die Library hält je Typus ein
   Standard-Template (Registry in der Library-Config, Welle 0f):

   | `doc_type` | Standard-Template (Beispiel) |
   |---|---|
   | `besprechung` | standard-meeting |
   | `konzept` | standard-konzept |
   | `email-diktat` | standard-email-diktat |
   | `vortrag` | standard-session |
   | `notiz` | standard-notiz |

   Nicht zuordenbar → `other` + das Fallback-Template der Library; die
   Entscheidung wird nie geraten, sondern als Feld sichtbar gemacht
   (`no-silent-fallbacks`).

Das ersetzt das bisherige EINE `secretaryService.template` pro Library durch
eine kleine Map — das eine Template bleibt als Fallback bestehen
(rückwärtskompatibel). Die Kostenlogik bleibt gestuft: Transkript + billige
Typ-Erkennung für alles; die Voll-Transformation nach Typ; besonders teure
Auswertungen nur für das, was der Klassen-/Relevanz-Entscheid in Schritt 2
als Kern einstuft.

## 3. Umzüge: Familien-Operation statt Namens-Fenster

v1 sagte: „Alles Umbenennen passiert vor der Erschließung, danach ist das
Fenster zu." Das war zu konservativ — und stand dem Aufräumen im Weg. Richtig
ist:

- **Die Datenbank-Verbindung bricht bei Umzügen nicht** (OneDrive-IDs sind
  umzugsstabil; die Twins hängen an der ID, nicht am Pfad).
- **Spiegel sind wegwerfbar**: Ein veralteter `_`-Ordner wird gelöscht und
  per Export am neuen Ort mit neuem Namen regeneriert.
- **`familie_umziehen` (Welle 0e)** macht daraus einen Handgriff, in fester
  Reihenfolge: erst Import (keine Handkorrektur verlieren), dann Quelle
  verschieben/umbenennen, Namen in der Datenbank nachziehen, alten
  Spiegelordner löschen, Export. Bis die Funktion existiert, gilt die
  Konvention: Quelle und `_`-Ordner immer gemeinsam bewegen, danach „Prüfen".

Umbenennen bleibt am billigsten, solange es noch keine Twins gibt — aber es
ist kein Tor mehr, das sich schließt.

## 4. Der Ordner-Stand im `_INDEX.md`

```yaml
bearbeitungsstand: abgenommen      # ungesichtet | erschlossen | strukturiert | berichtet | abgenommen
bearbeitungsstand_seit: 2026-08-18 # Datum, an dem der Stand gesetzt wurde
```

- Reihenfolge in v2: `ungesichtet → erschlossen → strukturiert → berichtet →
  abgenommen`. (Bestand aus v1, der `strukturiert` vor der Erschließung
  trägt, bleibt gültig — die Werte sind dieselben, nur die erwartete Abfolge
  hat sich gedreht.)
- Gesetzt von dem, der den Schritt abschließt: Peter nach 1 und 4, Cowork
  nach 2 und 3; dabei wird `bearbeitungsstand_seit` neu datiert.
- **Der Stand ist eine Behauptung, keine Wahrheit** — das Soll-Buch der
  doppelten Buchhaltung. Die Agentensicht rechnet das Ist-Buch dagegen:
  Änderungen nach `bearbeitungsstand_seit`, tote/veraltete Verweise oder von
  jüngeren Twins überholte Berichte machen einen Stand sichtbar rückfällig —
  nie still zurückgestuft, immer als Befund mit Todo. Grün ist ein Vorhaben
  erst, wenn Soll und Ist übereinstimmen.

## 5. Die Nahtstellen (Übergaben)

- **1 → 2:** Auslöser ist `erschlossen`. Cowork bekommt einen Auftrag (heute
  Copy-Paste, künftig MCP — siehe §7) und liest die Typ-Transformationen als
  Sortiergrundlage.
- **2 → 3:** Struktur steht, Familien sind umgezogen, Indizes angelegt →
  `strukturiert`.
- **3 → 4:** Die Session meldet zurück (Änderungen, Korrekturen, offene
  Punkte, **Widersprüche zur Coverage** — die Gegenkontrolle bleibt Pflicht).
  Peter drückt „Prüfen" und nimmt ab.

## 6. Provider-Stabilität: OneDrive heute, Nextcloud morgen

- **OneDrive (heute):** lauffähig und im Pilot bewiesen. IDs umzugsstabil —
  Familien-Umzüge erschlossener Bestände sind sicher.
- **Nextcloud (Ziel):** eine harte Voraussetzung — der Provider bildet IDs
  heute aus Pfaden und muss auf Nextclouds stabile `fileid` umgestellt
  werden. Durch v2 (Umzüge NACH der Erschließung sind der Normalfall) wird
  dieser Punkt wichtiger, nicht unwichtiger. Danach den Pilot einmal auf
  Nextcloud wiederholen.
- **Pfadlängen:** `_`-Spiegelordner verdoppeln die Namenslänge; lange
  Quellnamen beim Strukturieren kürzen (per `familie_umziehen`); die Engine
  meldet Überläufe als `path-too-long` (Budget ≈ 347 Zeichen).

## 7. Orchestrierung: von Copy-Paste zu MCP

Heute transportiert Peter Aufträge per Copy-Paste zwischen KnowledgeScout und
Cowork. Zielbild (eigene Welle, siehe Projektauftrag §5): **KnowledgeScout
wird MCP-Server**, der Agent orchestriert. Der Agent hat das Urteil (Was ist
das? Wohin gehört es?), KnowledgeScout die deterministischen Fähigkeiten als
Werkzeuge: `erschliessen`, `pruefen/reparieren/import/export`,
`familie_umziehen`, später `abdeckung_lesen`. Damit wird „Räum diesen Ordner
auf" EIN Auftrag an eine Cowork-Session — und die doppelte Buchhaltung bleibt
vollständig bestehen: Der Agent bekommt Werkzeuge, kein Vertrauen;
KnowledgeScout auditiert weiterhin jeden Verweis und jeden Stand; Peter nimmt
ab. Die Umkehrrichtung (KnowledgeScout startet Sessions per Agent-SDK aus der
Agentensicht heraus) ist die spätere Komfortschicht auf derselben Topologie.

## 8. Was heute schon geht — und was auf Wellen wartet

| Baustein | Stand |
|---|---|
| Schritt 1 Transkription + Transformation, Twin-Kern-Stempel | vorhanden (Wellen 0a/0c/0d gemerged, im Pilot bewiesen) |
| Handkorrektur-Rückweg (Import gewinnt bei jüngerer Datei) | vorhanden (Welle 0d) |
| Typ-Erkennung + Typ-Template-Registry | **Welle 0f** |
| `familie_umziehen` | **Welle 0e** |
| Ausschluss-Globs (`temp/` u. Ä.) | Welle 0b |
| Coverage/Zyklus-Board/Auftrags-Generator/Abnahme-UI | Wellen 1–4 des Projektauftrags |
| MCP-Brücke | eigene Welle (Projektauftrag §5) |

Der Zyklus ist ab sofort in v2 fahrbar; bis Welle 0f wählt die Cowork-Session
das Template je Datei von Hand (ein Satz im Auftrag), bis Welle 0e gilt die
Familien-Konvention.
