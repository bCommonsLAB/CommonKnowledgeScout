# Der Erschließungszyklus: vier Schritte pro Vorhaben

Stand: 2026-08-17 · Ergänzung zum Konzept-Set (Twin-Datei-Contract,
Projektauftrag Agentensicht, Bruchstellen-Katalog, Cowork-Briefing).
Zweck: das operative Verfahren, mit dem das Archiv ordnerweise aufgeräumt und
erschlossen wird — der Takt für die Zielbild-Etappen 3, 4 und 6.
Ziel: dasselbe Verfahren läuft stabil auf OneDrive wie auf Nextcloud.

---

## 1. Die vier Schritte

| # | Schritt | Wer | Werkzeug | Ergebnis |
|---|---|---|---|---|
| 1 | **Strukturieren** | Cowork-Session (mit Peter) | Filesystem | Klassen-Entscheid pro Fund (Original/Beleg/Ableitung, Zielbild §7): Ableitungen gelöscht, Belege ins Kaltarchiv; Dateinamen repariert und gekürzt; Struktur nach Modell C; `_INDEX.md` angelegt (+ Stub-`BERICHT.md`); Umzugsprotokoll geführt |
| 2 | **Erschließen** | KS-Pipeline; Peter prüft stichprobenartig | KnowledgeScout | Twins in Mongo + `_`-Spiegelordner (Transkript, Transformationen, Twin-Kern). Peters Prüfung ist eine **Qualitäts-Stichprobe** (richtiges Template? OCR brauchbar? sonst Re-Run) — **keine Verifikation** |
| 3 | **Berichten** | Cowork-Session | Filesystem, liest Twins | `BERICHT.md` auf Twin-Basis aktualisiert (zitiert Transkripte statt Rohmedien); erkannte Transkript-Schwächen direkt im `_`-Ordner korrigiert; Unklares als offene Punkte im `_INDEX.md` |
| 4 | **Abnehmen** | Peter | KnowledgeScout | Erst **„Prüfen"** (Import holt die Cowork-Korrekturen nach Mongo oder meldet Konflikt), dann Verifikation: `verified_by: human:peter`, `verified_at`, `twin_status: stable`. Eigene kleine Korrekturen davor direkt in KS oder Obsidian (nach Obsidian-Änderung erneut „Prüfen"). Danach `aktuell.py`/`projekte.py` laufen lassen |

Der Zyklus läuft **pro Vorhaben** — ein Ordner, ein Durchlauf, nichts wird
doppelt angefasst. Die Pipeline darf innerhalb eines Schritts beliebig bündeln;
der Zyklus ist der Takt, nicht die Batchgröße.

## 2. Warum diese Reihenfolge trägt

1. **Schritt 1 vor Schritt 2 ist das Namens-Fenster.** Solange keine Twins
   existieren, sind Umbenennen und Umsortieren gratis. Sobald erschlossen ist,
   hängen `_`-Ordner und Twin-Dateinamen am Quellnamen — dann gilt die
   Familien-Regel, und ein halber Rename (Bruchstelle B2) ist der teuerste
   Fehler. Weil alle identitätskritischen Operationen vor der Erschließung
   liegen, verlässt sich das Verfahren im Normalfall **gar nicht** auf
   umzugsstabile Speicher-IDs — das macht es provider-stabil per Konstruktion.
2. **Verifikation ist der letzte Schritt.** `verified_by` wird genau einmal
   gesetzt, wenn am Inhalt nichts mehr passiert (temporale Regel:
   `verified_at >= generated_at`). Eine Verifikation schon in Schritt 2 wäre
   nach den Cowork-Korrekturen aus Schritt 3 entweder veraltet oder doppelte
   Arbeit.
3. **Zwischen Schritt 3 und der Abnahme steht immer „Prüfen".** Sonst nimmt
   Schritt 4 in KS einen Stand ab, der die Datei-Korrekturen noch nicht
   enthält. Ein gemeldeter Konflikt ist dabei ein Befund, kein Fehler.

Korrekturen **nach** der Abnahme sind erlaubt — sie starten für die betroffene
Datei einen Mini-Zyklus 3→4 (korrigieren → „Prüfen" → neu verifizieren). Die
alte Verifikation wird durch die temporale Regel von selbst als ungültig sichtbar.

## 3. Der Ordner-Stand im `_INDEX.md`

Jedes `_INDEX.md` trägt den Stand seines Ordners als ein flaches Feld:

```yaml
bearbeitungsstand: ungesichtet   # ungesichtet | strukturiert | erschlossen | berichtet | abgenommen
```

- Gesetzt von dem, der den Schritt abschließt: Cowork nach 1 und 3
  (`strukturiert`, `berichtet`), Peter nach 2 und 4 (`erschlossen`, `abgenommen`).
- Die Agentensicht liest das Feld: `ungesichtet` erzeugt einen Sammel-Gap statt
  tausend Einzel-Gaps (Gap-Budget im Projektauftrag), und nach Stand lässt sich
  filtern, welche Vorhaben in welchem Schritt stecken.
- Kein neues Werkzeug nötig: ein Frontmatter-Feld, flach, Obsidian-kompatibel.

## 4. Die Nahtstellen (Übergaben)

- **1 → 2:** Auslöser ist `bearbeitungsstand: strukturiert`. Verarbeitet wird,
  was nach dem Klassen-Entscheid übrig ist (Originale mit Relevanz
  Kern/Kontext) — Ableitungen sind gelöscht, Belege liegen außerhalb des Scans
  (Kaltarchiv bzw. Ausschluss-Glob).
- **2 → 3:** Ein Auftragstext an die Cowork-Session — später aus dem
  Auftrags-Generator der Agentensicht, bis dahin von Hand nach dem Muster im
  Cowork-Briefing.
- **3 → 4:** Die Session meldet zurück: was geändert wurde, welche Dateien im
  `_`-Ordner korrigiert sind, was offen bleibt. Peter drückt „Prüfen" und nimmt ab.

## 5. Provider-Stabilität: OneDrive heute, Nextcloud morgen

Das Verfahren selbst ist provider-agnostisch: Es besteht aus
Datei-Konventionen (Schritte 1 und 3) und KS-Funktionen hinter der
Storage-Abstraktion (Schritte 2 und 4). Konkrete Randbedingungen:

- **OneDrive (heute):** lauffähig. Bekannte Randbedingung ist die
  Auth-Stabilität der OneDrive-Anbindung (Anmeldung fällt nach 1–2 Wochen aus;
  Neuaufsetzen ist ohnehin vor dem 30.09 geplant). Speicher-IDs sind
  umzugsstabil — auch spätere Familien-Umzüge bereits erschlossener Bestände
  (z. B. Modell-C-Konsolidierungen) sind sicher.
- **Nextcloud (Ziel):** eine harte Voraussetzung — der Nextcloud-Provider
  bildet IDs heute aus Pfaden und muss auf Nextclouds stabile `fileid`
  umgestellt werden, sonst verlieren spätere Umzüge erschlossener Bestände die
  Twin-Zuordnung (Plattform-Backlog, Bruchstellen-Katalog §2). Danach den
  Pilot einmal auf Nextcloud wiederholen — das ist das Akzeptanzkriterium für
  „stabil auf beiden".
- **Pfadlängen:** `_`-Spiegelordner verdoppeln die Namenslänge im Pfad. Lange
  Quellnamen deshalb in Schritt 1 kürzen; die Engine meldet Überläufe als
  `path-too-long`-Befund (Budget ≈ 347 Zeichen).

## 6. Was heute schon geht — und was auf Wellen wartet

| Baustein | Stand |
|---|---|
| Schritt 1 und 3 (Konventionen, Cowork) | sofort — Briefing liegt vor |
| Schritt 2 (Pipeline + Spiegelordner) | vorhanden; Twin-Kern-Felder kommen mit Welle 0 automatisch, bis dahin werden sie bei Reparatur/Export nachgezogen |
| „Prüfen"/Import (Schritt 4, erster Teil) | vorhanden (Sync-Engine, Buttons pro Datei/Ordner/Library) |
| Abnahme-UI in KS (Schritt 4, zweiter Teil) | Welle 4 des Projektauftrags; bis dahin: Frontmatter in Obsidian setzen — gleiche Felder, gleicher Effekt |
| Ordner-Stand-Filter, Sammel-Gaps, Auftrags-Generator | Wellen 1–3 des Projektauftrags |

Der Zyklus ist damit ab sofort fahrbar; die Agentensicht macht ihn schrittweise
bequemer, ändert ihn aber nicht.
