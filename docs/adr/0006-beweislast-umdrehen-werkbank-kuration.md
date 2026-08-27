# ADR 0006 — Beweislast umdrehen: Fehler markieren statt Zustimmung einsammeln

- **Status**: Angenommen — Modell B (entschieden von Peter am 2026-08-26)
- **Datum**: 2026-08-25
- **Kontext**: Architektur-Einwand aus der Testsession Werkbank-Abnahme, §8 in
  [`testsession-werkbank-abnahme-ergebnis.md`](../concepts/testsession-werkbank-abnahme-ergebnis.md)
- **Entscheider**: Repo-Owner

## Kontext

Die Werkbank (Wellen A1–A6) behandelt menschliche Prüfung als **Bringschuld des
Menschen**: Jedes prüfbare Artefakt einer Twin-Familie (Transkript und
Standard-Zusammenfassung) gilt als offen (`○`), bis Peter es einzeln
verifiziert (`verified_by: human:…`, `werkbank-baum.ts` →
`artefaktGeprueft`). Eine Familie bekommt ihr `✓` erst, wenn **alle**
vorhandenen prüfbaren Artefakte menschlich geprüft sind; Zähler (`n/m`),
Sprung-Fluss (A5) und die Meldung „wartet auf die Abnahme" hängen daran.

Die Testsession hat gemessen, was das kostet: 2,5–3,3 s pro Verifizieren-Klick,
28 Transkripte + 28 Zusammenfassungen ≈ 2,5 Minuten reine Wartezeit — für ein
einziges Vorhaben von 148. Die Sammelaktion (≈75 s je Durchgang) wurde genau
dafür gebaut, diese Last zu bündeln — und beweist damit den Einwand: Wer 26
Zusammenfassungen **pauschal** bestätigt, hat sie nicht gelesen. Das grüne
Häkchen sagt dann nichts mehr aus.

Peters Einwand (Ergebnis-Dokument §8): Er will die Maschine arbeiten
**lassen**, ihre Arbeit wohlwollend entgegennehmen und nur eingreifen, wo er
einen **Fehler sieht**. Die Sicht soll ihm helfen, **Widerstände zu
entdecken** — nicht ihn durch 56 Bestätigungen führen.

**Reihenfolge-Konsequenz:** Diese Frage steht **vor** der Anzeige-Reparatur
K1/K2. Die *Mechanik* (Kurationszustand aus MongoDB nachladen statt
Voll-Scan) ist modellneutral und wird unabhängig gebaut; die *Symbolik* —
welches Zeichen ein Artefakt trägt und was gezählt wird — folgt erst dieser
Entscheidung. Sonst repariert man eine Anzeige für einen Ablauf, den niemand
will.

## Modell A — Zustimmungspflicht (heutiger Entwurf)

Der Mensch beweist die Korrektheit: Ein Artefakt ist so lange „offen", bis er
es aktiv bestätigt hat.

- **Zeichen:** `○` offen / `✓` geprüft. Der Default ist der Mangel — 100 %
  der frisch erzeugten Maschinen-Arbeit startet als „unerledigt".
- **Fortschritt:** `n/m Familien geprüft` je Ordner/Vorhaben. Fortschritt
  entsteht ausschließlich durch Klicks des Menschen.
- **A5 „Prüfen im Fluss":** der Kern der Bedienung. Nach jedem Verifizieren
  Tab-Wechsel bzw. Sprung zum nächsten **offenen** Artefakt, bis nichts mehr
  offen ist („wartet auf die Abnahme").
- **Sammelaktionen** („28 Transkripte prüfen"): notwendiges Ventil, um 2×28
  Einzelklicks zu bündeln — strukturell eine Massen-Zustimmung.
- **Zustands-Chip** am Artefakt: „Unverifiziert" / „Geprüft" — er benennt die
  ausstehende Pflicht.
- **Abnehmen-Knopf:** formal sperren ihn NUR offene Maschinen-Befunde
  (Entscheidung 6, `vorhaben-kopf.tsx`); die eigene Prüfschuld sperrt nie.
  Faktisch führt aber der ganze Fluss (Zähler, Meldungen, Sprung) dorthin,
  erst bei `m/m` abzunehmen — die Zustimmungspflicht wirkt als soziales Tor,
  nicht als technisches.

## Modell B — Beweislast umgedreht (Peters Modell)

Der Mensch markiert den Fehler: Artefakte gelten als **angenommen**, sobald
die Maschine sie abgeliefert hat und kein Widerstand vorliegt.

- **Zeichen:** Artefakte starten **neutral angenommen** — nicht als Mangel
  gezeichnet. Die Vertrauensampel (wer hat erzeugt, wer geprüft —
  `verification: maschinell/mensch/ungueltig`) bleibt als **Auskunft**
  sichtbar, ist aber kein Gate mehr.
- **Fehler-Markierung:** Der Mensch markiert ein Dokument als fehlerhaft
  (Kandidat: bestehendes Feld `twin_status`, z. B. `fehlerhaft` — Festlegung
  offen, s. u.). Ein markiertes Dokument wird repariert und bekommt **dann**
  das grüne Häkchen (`verified_by: human:…` — der bestehende Verify-Weg,
  jetzt bedeutungsvoll: es steht nur dort, wo wirklich hingeschaut wurde).
- **Fortschritt:** nicht „n von m bestätigt", sondern „k Widerstände offen"
  (Maschinen-Befunde + Fehler-Markierungen). Null Widerstände = nichts zu tun.
- **A5:** verliert die Pflicht-Rolle. Der Sprung-Fluss kann bleiben, springt
  aber sinnvollerweise zum nächsten **Widerstand** (Befund, markierter
  Fehler) statt zum nächsten Unbestätigten. Lesen ohne Klicken hinterlässt
  keine Schuld.
- **Sammelaktionen:** entfallen ersatzlos — es gibt nichts massenhaft zu
  bestätigen. (Genau ihre Existenz war das Symptom.)
- **Zustands-Chip:** wird zur Herkunfts-/Vertrauensauskunft
  („angenommen · maschinell erzeugt", „geprüft · Mensch", „fehlerhaft
  markiert", „ungültig: nach Prüfung neu erzeugt") statt zur Pflichtanzeige
  „Unverifiziert".
- **Abnehmen-Knopf:** bleibt, Semantik wird ehrlicher: „entgegengenommen,
  Widerstände ausgeräumt". Gesperrt durch offene Maschinen-Befunde (wie
  heute) **plus** offene Fehler-Markierungen — die sind echte, vom Menschen
  benannte Widerstände. Die Verifikations-Quote sperrt weiterhin nichts, und
  es gibt auch keinen Fluss mehr, der etwas anderes suggeriert.

### Was in beiden Modellen unverändert gilt

- Verify stempelt der **Server**, Selbst-Verifikation bleibt verboten (409),
  der **Spiegel-Drift-Guard** bleibt (Contract §3.2/§4.3).
- `abgenommen` bleibt menschliche Selbstauskunft — Knopf in der Werkbank,
  nie über die MCP-Brücke.
- Die temporale Regel bleibt: wird ein geprüftes Artefakt neu erzeugt, wird
  die Prüfung ungültig — in Modell B heißt das: es fällt auf „angenommen
  (maschinell)" zurück, nicht auf „Mangel".

## Empfehlung

**Modell B annehmen.** Begründung:

1. **Die Messung entscheidet:** 56 Pflicht-Bestätigungen à ~3 s sind
   Buchhaltung ohne Erkenntnisgewinn. Die Session selbst hat gezeigt, dass
   die Pflicht in der Praxis per Sammelaktion pauschal erfüllt wird — damit
   ist das Häkchen als Qualitätsaussage bereits heute entwertet. Modell B
   macht es wieder wahr.
2. **Skalierung:** 148 Vorhaben × ~2 Artefakte × Einzelzustimmung ist kein
   Arbeitsmodell für eine Person. Fehler-Markierung skaliert mit der Zahl
   der **Fehler**, nicht mit der Zahl der Dokumente.
3. **Die Sicherheitsarchitektur hängt nicht am Zwang:** Drift-Guard,
   Selbst-Verifikations-Verbot und Befund-Gate an der Abnahme bleiben
   vollständig erhalten. Aufgegeben wird nur die Pflicht, nicht die
   Möglichkeit — explizites Verifizieren bleibt für Dokumente, die Peter
   wirklich gelesen hat.
4. **Der Zweck der Sicht** („dem Menschen helfen, Widerstände zu entdecken")
   deckt sich mit dem, was die Befund-Maschinerie ohnehin kann — Modell B
   richtet die UI auf die vorhandene Stärke aus, statt eine zweite
   Fleiß-Buchhaltung daneben zu stellen.

Kosten der Umkehr (bewusst in Kauf genommen): Umbau von Zähler, Sprunglogik
und Baum-Symbolik; die Sammelaktionen (Welle A4/A5) werden zurückgebaut; die
Abnahme-Semantik muss neu erklärt werden. Der Schreibpfad (Kurations-Route,
`twin_status`, Verify) bleibt — es ändert sich die Deutung, kaum der Speicher.

## Entscheidung (2026-08-26)

**Modell B ist angenommen.** Die vier offenen Punkte sind damit festgelegt:

### 1. Zeichensprache

| Zeichen | Bedeutung | Wann |
|---|---|---|
| **Oranger Haken** | „höchstwahrscheinlich OK" | Standard — die Maschine hat geliefert, niemand hat widersprochen |
| **Grüner Haken** | „geprüft — ein Mensch hat hingesehen" | nur nach echtem Verifizieren (`verified_by: human:…`) |
| **Stopp-Zeichen** | „blockiert" | Fehler-Markierung eines Menschen ODER offener Maschinen-Befund |

Der Default ist nicht mehr der Mangel: `○` entfällt. `?` (Report aus einem
Scan vor A2) bleibt — dort liegt wirklich keine Auskunft vor.

**Ein** Zeichen für „blockiert", nicht zwei: Maschinen-Befund und
Fehler-Markierung tragen dasselbe Stopp-Zeichen, die Herkunft steht im Titel.
Damit gibt es genau eine Sprache für „hier geht die Abnahme nicht".

Der Wunsch „Halb-Zeichen für Twin-Familien" (Ergebnis §7) entfällt ersatzlos:
Ohne Zustimmungspflicht gibt es kein „halb bestätigt" mehr.

### 2. Speicherform der Fehler-Markierung

Der vorhandene Wert `twin_status: fehlerhaft` trägt den Zustand, die Herkunft
folgt dem Muster von `verified_by`/`verified_at`:

- `flagged_by: human:<email>` — wer markiert hat (der **Server** stempelt, wie bei Verify)
- `flagged_at: <ISO-Zeitstempel>` — wann
- `flagged_note: <eine Zeile>` — **Pflicht**: was nicht stimmt

Die Notiz ist Pflicht, weil die Markierung die Abnahme blockiert: Wer sie
später auflöst — auch Peter selbst in drei Wochen — muss wissen, warum.
Frontmatter bleibt flach (AGENTS.md), Schreibweg bleibt die bestehende
Kurations-Route samt Spiegel-Drift-Guard.

Auflösen: Reparatur + Verifizieren räumt `twin_status` weg und stempelt
`verified_by` — dort steht das grüne Häkchen dann zu Recht.

### 3. Sprung-Ziel

Der Sprung bleibt, zielt aber auf den **nächsten Widerstand** (offener
Maschinen-Befund oder Fehler-Markierung). Gibt es keinen, springt nichts —
dann ist das Vorhaben abnehmbar. Lesen ohne Klicken hinterlässt keine Schuld.

### 4. Übergang: Stempel aus der Zustimmungs-Ära

**Stempel aus Sammelaktionen werden zurückgesetzt, Einzelklicks bleiben.**
Begründung: Unter der neuen Bedeutung behauptet ein grüner Haken „ein Mensch
hat hingesehen" — bei einer Massen-Bestätigung ist das unwahr. Der frühere
Vorschlag (alles unverändert lassen) widerspräche der Umkehr.

Die Messung im Prüfarchiv „26.01 Klimamassnahmen Südtirol" (2026-08-26) zeigt,
dass beide Fälle sauber trennbar sind:

| Schwung | Zeitraum | Stempel | Deutung |
|---|---|---|---|
| 1 | 25.08. 14:18:32–14:19:11 | 4, gemischte Art | Einzelklicks (~10 s Abstand) — bleiben |
| 2 | 25.08. 14:21:57–14:23:02 | 26 Zusammenfassungen | Sammelaktion (~2,5 s Takt) — zurücksetzen |
| 3 | 26.08. 07:26:09 | 1 Transkript | Einzelklick — bleibt |
| 4 | 26.08. 07:29:35–07:30:05 | 4 Transkripte | Einzelklicks (~7 s Abstand) — bleiben |

Regel für das Rücksetz-Skript: Stempel **einer** Art, die in einem Schwung im
Gleichtakt entstanden sind (mehr als 5 Stück, Abstand unter 5 s), gelten als
Sammelaktion. Das Skript zeigt im Trockenlauf, was es anfassen würde, und
schreibt über den bestehenden Kurations-Weg — Mongo UND Spiegel, kein
Direktschreiben am Drift-Guard vorbei.

### Umbau-Umfang, der daraus zwingend folgt

- Zähler: „k Widerstände offen" statt „n von m geprüft"
- Sammelaktionen (Welle A4/A5) werden zurückgebaut — ihre Existenz war das Symptom
- Zustands-Chip wird Herkunfts-Auskunft statt Pflichtanzeige
- `artefaktGeprueft`/`familienPruefstand` behalten ihre Bedeutung, verlieren
  aber die Gate-Rolle im Fluss
- Abnehmen-Knopf: gesperrt durch Maschinen-Befunde **plus** offene
  Fehler-Markierungen (`istAbnehmbar`)
- Hinfällig: der Standardreiter-Nachzieher aus dem Testlauf 26.08.2026 (Sprung
  landete auf dem bereits geprüften Zusammenfassungs-Reiter) — der Pflicht-Fluss,
  in dem er stört, verschwindet

## Verweise

- Ergebnis-Dokument §8 (Einwand), §2 (Messwerte), §5/A5 (abgenommener Fluss):
  [`testsession-werkbank-abnahme-ergebnis.md`](../concepts/testsession-werkbank-abnahme-ergebnis.md)
- Heutige Mechanik: `src/lib/agent-view/werkbank-baum.ts`
  (`artefaktGeprueft`, `familienPruefstand`),
  `src/lib/agent-view/werkbank-abnahme.ts` (Sammelziele, Sprung),
  `src/components/library/agent-view/werkbank/vorhaben-kopf.tsx`
  (Abnehmen-Gate = nur Maschinen-Befunde)
- K1-Nachlade-Mechanik (modellneutral, eigene Umsetzung):
  `/api/library/[libraryId]/agent-view/kuration`
