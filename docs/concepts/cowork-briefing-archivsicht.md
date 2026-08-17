# Briefing an die Cowork-Session: Archivkonzept an den Twin-Contract anschließen

Stand: 2026-08-17. Zweck: Dieses Briefing wird per Copy-Paste in eine
Cowork-Session am Archiv gegeben. Es fasst zusammen, was das Architektur-Review
an den drei Entwürfen der Session geändert hat
(`twin-kontrakt-konzept.md`, `projektauftrag-agentensicht.md`,
`bruchstellen-und-indexentscheid.md`), und listet die Arbeitsaufträge im Archiv.
Die verbindlichen Fassungen liegen im Repo `CommonKnowledgeScout` unter
`docs/concepts/`.

---

## 1. Was sich gegenüber euren Entwürfen geändert hat

1. **Layout korrigiert — Twins liegen im Schattenordner, nicht daneben.**
   KnowledgeScout schreibt heute:

   ```
   X.pdf
   _X.pdf/
     X.md                      # Transkript, sprachneutral (KEIN X.de.md)
     X.<template>.<lang>.md    # Transformation, Template-Name ist Pflicht
   ```

   `X.de.md` neben der Quelle ist ein Alt-Format, das die Plattform aktiv
   wegmigriert. Die Sidecar-Beispiele aus `template-samples/diva sample content/`
   sind eine DIVA-Besonderheit, kein Plattform-Muster.
   **Discovery-Regel neu: Wer `X.pdf` findet, prüft den Ordner `_X.pdf/`.**
2. **Wahrheit nach Dateiklasse, nicht „Filesystem ist immer die Wahrheit".**
   Quellen und Handgeschriebenes (`BERICHT.md`, `_INDEX.md`, Konventionen):
   Filesystem. Erzeugte Twins: MongoDB mit Datei-Spiegel im `_`-Ordner; den
   Abgleich lösen explizite Buttons in KS aus (Prüfen/Import/Export), die Peter
   drückt. Es kommt kein Mongo-Index als neue Leseschicht und kein Dauer-Sync.
3. **Keine `uid`, kein `source_hash`, keine Move-API.** Identität läuft über
   die Speicher-IDs des Providers (auf OneDrive umzugsstabil); euer
   Kurations-Zustand steht im Frontmatter und zieht mit der Datei um. Die
   Familien-Regel bleibt reine Konvention.
4. **Frontmatter-Kern bestätigt — als eigener Twin-Feldsatz**, nicht als
   Erweiterung des Plattform-Pflichtkerns. Für euch unverändert nutzbar:
   `type`, `source_file`, `template`, `language`, `generated_by`,
   `generated_at`, `twin_status`, `verified_by`, `verified_at`.
   Entschieden: Das Reife-Feld heißt `twin_status`; `status` in Berichten
   bleibt der Projektlebenszyklus und wird **nicht** umbenannt.
5. **Verifikation mit Zeitregel:** Eine Verifikation zählt nur, wenn
   `verified_at >= generated_at`. Wird ein Twin neu erzeugt, ist die alte
   Verifikation automatisch sichtbar ungültig — nichts muss gelöscht werden.

## 2. Verhaltensregeln für Sessions im Archiv

- **Der Takt pro Vorhaben** steht im Erschließungszyklus
  (`docs/concepts/erschliessungszyklus.md`): Ihr macht Schritt 1
  (Strukturieren) und Schritt 3 (Berichten auf Twin-Basis) und schreibt danach
  den `bearbeitungsstand` im `_INDEX.md` fort (`strukturiert` bzw.
  `berichtet`, jeweils mit `bearbeitungsstand_seit: <Datum>`). Umbenennen und Umsortieren gehören in Schritt 1 — **vor** der
  Erschließung; danach gilt die Familien-Regel strikt.
- **Twins lesen statt Rohmedien.** Existiert ein Twin, wertet ein Bericht nie
  selbst PDF/Audio aus; er zitiert Transkript/Transformation im
  Verweise-Abschnitt. (Eure Regel — bleibt.)
- **Unerschlossene Quelle = offener Punkt im `_INDEX.md`**, kein Anlass, selbst
  zu transkribieren. Twins erzeugen nur auf expliziten Auftrag — dann exakt
  contract-konform und **in den `_`-Ordner**.
- **Handkorrekturen an Twin-Dateien:** nur in `_`-Ordnern arbeiten; danach
  Peter melden, damit er in KS „Prüfen" laufen lässt (der Import holt die
  Korrektur inhaltsbewusst nach MongoDB oder meldet einen Konflikt). Keine
  Artefakt-Dateien direkt neben die Quelle legen — die werden derzeit beim
  Abgleich übersprungen.
- **Familien-Regel:** Quelle und ihr `_`-Ordner ziehen immer gemeinsam um; nie
  den Basename nur einer Seite ändern. Umzugsprotokoll weiterführen wie gehabt.
- `AKTUELL.md` und `PROJEKTE.md` werden erzeugt, nie von Hand gepflegt (wie gehabt).

## 3. Arbeitsaufträge im Archiv (ein Nachmittag)

a) **`Organisation/Aufraeumen/Konventionen.md` ergänzen** um einen Abschnitt
   „Twin-Familien und Erschließung": Layout und Discovery-Regel aus §1.1, die
   Verhaltensregeln aus §2, die Feldkern-Tabelle aus §1.4 — plus den
   Vier-Schritte-Takt und das Feld `bearbeitungsstand` aus dem
   Erschließungszyklus.
b) **Die zehn `BERICHT.md` mechanisch nachziehen:** `type: bericht` ergänzen
   (`typ:` darf übergangsweise als Alias stehen bleiben),
   `generated_by`/`generated_at` ergänzen, `quelle: erschlossen` durch die
   `generated_*`/`verified_*`-Semantik ersetzen. `status` **nicht** umbenennen.
c) **Erschließungsspalte im `_INDEX.md`:** je Eintrag vermerken, ob ein
   `_`-Ordner mit Transkript existiert — per Skript erzeugt (Vorschlag:
   `Organisation/Tools/erschliessung.py` analog `aktuell.py`), nicht von Hand.
d) **`aktuell.py`/`projekte.py` prüfen:** Die Reader müssen tolerant bleiben,
   wenn neue Kern-Felder im Frontmatter auftauchen.
e) **Widerspruch erwünscht:** Gebt eine Liste zurück, wo diese Regeln euren
   Beobachtungen im Bestand widersprechen. Ihr seid die redundante Sicht auf
   denselben Inhalt — sechs Augen sehen mehr als zwei; Abweichungen sind
   Befunde, keine Störung.

## 4. Der gemeinsame Pilot (zur Kenntnis)

Kandidat: `6. bCommonsLab prototyping/25.01 Common Secretary` (vier Aufnahmen
ohne Transkript — der Selbsttest aus dem eigenen `_INDEX.md`). Ablauf: Peter
erzeugt aus der KS-Agentensicht Aufträge → die KS-Pipeline erschließt die
Aufnahmen → eine Cowork-Session schreibt den `BERICHT.md` auf Twin-Basis und
korrigiert eine Transkript-Schwäche im `_`-Ordner → Peter drückt „Prüfen"
(Import übernimmt) → Peter verifiziert → der Re-Scan zeigt die Lücken als
geschlossen. Rollen: Pipeline erzeugt, Agent konsumiert und korrigiert, Mensch
prüft — niemand verifiziert die eigene Arbeit.

## 5. Pflichtlektüre

- `docs/concepts/twin-datei-contract.md` (Repo CommonKnowledgeScout)
- `docs/concepts/erschliessungszyklus.md` (Repo — der Vier-Schritte-Takt pro Vorhaben)
- `docs/concepts/bruchstellen-katalog.md` (Repo CommonKnowledgeScout)
- `Organisation/Aufraeumen/Konventionen.md` (Archiv; nach Auftrag a aktuell)
