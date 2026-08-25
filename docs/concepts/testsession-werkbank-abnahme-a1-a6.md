# Testsession: Werkbank-Abnahme (Wellen A1–A6)

**Für:** Peter, lokal auf `master` nach dem Merge von PR #194
**Dauer:** grob 30–45 Minuten
**Prüfarchiv:** „26.01 Klimamaßnahmen Südtirol" (28 Familien, keine
Maschinen-Befunde — ideal zum Durchspielen)

Diese Anleitung ist bewusst in einfachen Worten gehalten: je Block steht,
**was du tust**, **was du sehen solltest** und **was ein Fehler wäre**.
Abweichungen bitte notieren (Screenshot + kurzer Satz reicht) und am Ende
gesammelt zurückmelden.

---

## 0. Vorbereitung (einmalig, wichtig)

1. `master` ziehen, dann lokal prüfen:

   ```bash
   bash scripts/welle-pre-merge-check.sh
   ```

2. App starten, deine Library öffnen, in die **Agentensicht** wechseln.
3. **Zuerst „Neu scannen" drücken und den Scan abwarten** (~8 Minuten
   Voll-Scan). Ohne frischen Scan fehlen den neuen Ansichten die Daten —
   du würdest überall Hinweise wie „Scan vor A2/A6 — neu scannen" sehen.
   Diese Hinweise sind dann KEIN Fehler, sondern Absicht.
4. In den **Einstellungen → Erweitert → Agentensicht** das neue Feld
   **„Themen-Vokabular"** füllen: eine Zeile pro Thema, z. B.

   ```
   Klima
   Commoning
   KI
   ```

   Speichern. (Kommas und eckige Klammern sind absichtlich verboten.)

---

## 1. Der Kopf ist eine Zeile (A1)

**Tu:** Agentensicht öffnen, nichts anklicken. Einmal durchatmen und oben
hinschauen.

**Du solltest sehen:**

- Über der Arbeitsfläche stehen nur ZWEI Zeilen: die Kopfzeile
  („Agentensicht · Scan <Datum> · berechnet, nicht Wahrheit · seit dem
  letzten Scan: … erledigt · … neu") und die Tab-Leiste
  (Werkbank · Baum · Zyklus-Board · Todos & Auftrag).
- Rechts in der Kopfzeile: „Scan-Details" (aufklappbar — dort wohnen jetzt
  die Konventionen, das Gap-Budget und die Zyklus-Verteilung) und der
  Knopf „Neu scannen".
- Rechts im Leerzustand (nichts gewählt): vier Karten. Die ERSTE, betonte
  nennt, wie viele Vorhaben JETZT auf dich warten. Darunter die
  Bestandszahlen als kleine Nebenzeile.

**Fehler wäre:** die acht alten Kennzahlen oder die Akteur-Chips noch oben
im Kopf; eine dritte Zeile über der Arbeitsfläche; eine unerklärte „0
wartet auf dich" (wenn 0, muss ein Satz danebenstehen, warum).

---

## 2. Der Baum geht bis zum Artefakt (A2)

**Tu:** Links „26.01 Klimamaßnahmen Südtirol" anklicken. Dann mit dem
kleinen Pfeil auf- und zuklappen. In einen Ordner hineinschauen.

**Du solltest sehen:**

- Vier Ebenen: Bereich (Gruppenkopf) → Vorhaben → Ordner → Artefakt.
- An Vorhaben und Ordnern ein Zähler wie `0/28` (geprüft/gesamt).
- An jedem Artefakt ein Zeichen: `○` offen, `✓` geprüft — und eine kleine
  Zahl (wie viele Dateien die Twin-Familie hat).
- Klick auf ein Artefakt wählt es aus (rechts wechselt die Ansicht) und
  die Adresszeile trägt `?vorhaben=…&artefakt=…` — Reload landet wieder
  genau dort.
- Ordner ohne prüfbare Artefakte erscheinen nicht; die Filter oben
  (Alle · Zu tun · Bereit) blenden ganze Äste aus wie bisher.

**Fehler wäre:** ruckelnde oder leere Liste beim Scrollen (Virtualisierung),
Artefakte unter dem falschen Ordner, ein `?` als Prüf-Kennung TROTZ
frischem Scan.

---

## 3. Rechts steht ein Dokument (A3)

**Tu:** Erst das Vorhaben anklicken, dann ein Artefakt (z. B. eine
`.m4a`-Aufnahme, ein PDF und einmal ein `.docx`).

**Du solltest sehen:**

- **Vorhaben gewählt:** Tabs „Bericht" und „Ordner-Beschreibung". Der
  Bericht rendert wie gewohnt; die Ordner-Beschreibung zeigt den
  `_INDEX.md` (oder sagt benannt, dass er fehlt). Die alten gestapelten
  Blöcke (Befunde, Twin-Familien) sind weg.
- **Artefakt gewählt:** drei Tabs — „Original" (ohne Häkchen),
  „Transkript" und „Zusammenfassung" (je mit ○/✓ im Tab-Reiter).
- Original: bei Audio ein Abspieler, bei PDF die eingebettete Vorschau,
  bei Word ein ehrlicher Satz „keine eingebettete Vorschau" mit
  Archiv-Link.
- Über Transkript/Zusammenfassung steht das Frontmatter sichtbar als
  Block — genau dort fällt ein Hörfehler in `authors`/`participants` auf.
- Der Kopf bleibt beim Scrollen stehen; nur das Dokument scrollt.

**Fehler wäre:** irgendetwas rechts, das man zuklappen muss; ein leerer
Tab ohne Erklärungssatz; ein Dokument, dessen Ende man nicht erreicht
(Scroll).

---

## 4. Ein Kopf, der abnimmt (A4)

**Tu:** Zwischen Vorhaben und Artefakt hin- und herwechseln und den Kopf
vergleichen. Menü `⋯` öffnen. Beim Vorhaben „Befunde & Auftrag" anklicken.

**Du solltest sehen:**

- Beide Köpfe sind gleich gebaut: Zeile 1 = Titel · Zustands-Chip · EIN
  großer Knopf · `⋯`. Zeile 2 = Breadcrumb · Fortschritt/Hinweis ·
  Aktionen.
- Beim Vorhaben heißt der Knopf „Vorhaben abnehmen" — er ist NUR gesperrt,
  wenn Maschinen-Befunde offen sind (deine eigenen offenen Punkte sperren
  ihn nie; der Tooltip erklärt den Zustand).
- Beim Artefakt heißt er „Verifizieren" und wirkt auf den AKTIVEN Tab;
  auf „Original" ist er gesperrt und der Tooltip sagt warum.
- Im `⋯`-Menü des Vorhabens: Stand-Menü, Zu Liste, Teilbaum neu scannen,
  Befunde & Auftrag (öffnet den gewohnten Befunde-Dialog mit dem
  Auftrags-Kopierer), Archiv-Link, folderId kopieren.

**Fehler wäre:** zwei große Knöpfe nebeneinander; ein gesperrter Knopf
ohne erklärenden Tooltip; der Auftrags-Generator nirgends mehr auffindbar.

---

## 5. Prüfen im Fluss (A5) — der Kern der Session

**Tu:** Im Prüfverzeichnis ein offenes Artefakt wählen. Zusammenfassung
lesen, „Verifizieren" drücken. Dann weiterprüfen, bis ein Ordner fertig
ist. Danach einmal die Sammelaktion: beim VORHABEN im Kopf
„n Transkripte prüfen …" drücken.

**Du solltest sehen:**

- Nach dem Verifizieren: Ist am selben Artefakt noch der andere Tab offen
  (z. B. Transkript), wechselt erst der Tab. Ist das Artefakt komplett,
  springt die Auswahl zum NÄCHSTEN offenen Artefakt — der Baum klappt auf
  und scrollt mit, `✓` und Zähler zählen sofort hoch.
- Beim letzten Artefakt eines Ordners: eine kurze Meldung „Ordner ‚…' ist
  fertig — weiter mit ‚…'".
- Wenn ALLES geprüft ist: Meldung, dass das Vorhaben auf die Abnahme
  wartet — und der Abnehmen-Knopf oben ist frei.
- Sammelaktion: ERST eine Rückfrage, die die Zahl nennt („28 Transkripte
  als geprüft bestätigen?"). Nach dem Ja läuft sie durch und meldet
  „n von n verifiziert" (Fehler je Datei würden dort im Klartext stehen).
- Zum Schluss: „Vorhaben abnehmen" drücken — der Stand wechselt auf
  „Abgenommen" mit dem Hinweis, dass der Report noch den alten Scan zeigt.

**Fehler wäre:** ein Sprung ins Leere oder auf ein bereits geprüftes
Artefakt; eine Sammelaktion OHNE Rückfrage; ein stiller Fehlschlag
(nichts passiert und nichts erklärt es).

---

## 6. Themen pflegen (A6)

**Tu:** Ein Vorhaben wählen. Im Kopf (Zeile 2) „Themen (…)" öffnen. Ein
Thema aus dem Dropdown wählen, eines neu antippen, speichern. Dann links
oben die Gruppierung von „Baum" auf „Thema" umschalten. Zur Kontrolle das
`_INDEX.md` des Ordners im Archiv ansehen.

**Du solltest sehen:**

- Das Dropdown bietet dein Vokabular aus den Einstellungen an (plus
  bereits vergebene Themen), ohne die schon zugewiesenen.
- Nach dem Speichern: In der Gruppierung „Thema" hängt das Vorhaben unter
  JEDEM seiner Themen; ohne Themen unter „Ohne Thema" (zuletzt).
- Im `_INDEX.md` steht jetzt eine Zeile `themen: [Klima, Commoning]` —
  und ALLE anderen Zeilen der Datei sind unangetastet (Schreibweise,
  Kommentare, Leerzeilen).
- Leeres oder doppeltes Thema, Komma im Namen: wird mit klarer Meldung
  abgelehnt, nichts wird geschrieben.

**Fehler wäre:** ein umgeschriebenes/zerschossenes `_INDEX.md` (bitte
sofort melden, Datei sichern); Themen, die nach dem Speichern in der
Gruppierung nicht auftauchen; die alten Bericht-Themen, die wieder
gruppieren.

---

## 7. Bekannte Grenzen (kein Testfall, nicht wundern)

- **Alte Reports:** Vor dem ersten frischen Scan zeigen Baum und Themen
  benannte Hinweise statt Daten — Absicht, kein Fehler.
- **Word-Original:** hat im Browser keine eingebettete Vorschau, nur den
  Archiv-Link.
- **Baum-Tab** (neben der Werkbank): ist der alte, überholte Tab — die
  Entscheidung, ob er wegkommt, steht noch aus.
- **Voll-Scan-Dauer** (~8 Minuten): bekannte Baustelle
  (OneDrive-Drosselung), eigene Untersuchung, nicht Teil dieses Tests.
- **Frische Verifikationen/Themen** überlagern den Report nur lokal —
  nach dem nächsten Scan stimmen Report und Wirklichkeit wieder überein.

## 8. Rückmeldung

Am Ende bitte drei Listen zurückgeben: **kaputt** (mit Screenshot),
**unerwartet, aber vielleicht Absicht**, **Wünsche fürs nächste Mal**.
Daraus wird der nächste Wellenplan.
