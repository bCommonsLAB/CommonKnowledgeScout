# Analyse: Chat-Cache-Key berücksichtigt `llmModel` nicht (Story-Mode / Explore)

## Kontext & beobachtetes Verhalten

Auf der Seite `explore/<slug>?mode=story` kann im Chat das LLM-Modell gewechselt werden. Aktuell wird beim Cache-Check dennoch **immer derselbe Cache-Eintrag** gefunden, wenn sich nur das Modell ändert. Das führt zu inkorrekten Cache-Treffern (Antworten stammen vom „alten“ Modell), obwohl die UI/UX eindeutig suggeriert, dass die Modellwahl die Antwort beeinflusst.

## Technische Ursache (Code-Eingrenzung)

Im Frontend wird `llmModel` bereits als Teil des Cache-Key-Vergleichs verwendet (`compareCacheKeys` via `createCacheKey`). Im Backend passiert der eigentliche Cache-Lookup jedoch über einen SHA-256-Hash (`cacheHash`). Dieser Hash wird in `createCacheHash()` gebildet, berücksichtigt aber **kein** `llmModel`. Zusätzlich kennt `findQueryByQuestionAndContext()` (DB-Lookup für Cache) bisher keinen `llmModel`-Parameter und kann ihn folglich nicht in die Hash-Berechnung einspeisen.

Konsequenz: Zwei Requests, die sich nur im Modell unterscheiden, erzeugen den **gleichen** `cacheHash` → die DB findet denselben Cache-Eintrag.

## Lösungsvarianten (3 Optionen)

### Variante A (minimal, korrekt): `llmModel` in Hash + Lookup + Persistenz aufnehmen

- **Änderung**: `llmModel` wird in `createCacheHash()` normalisiert und in den Hash-Input aufgenommen. `findQueryByQuestionAndContext()` bekommt `llmModel` als optionales Feld und leitet es an `buildCacheHashParams()` weiter. Der Stream-Route-Handler übergibt `llmModel` beim Cache-Check ebenfalls.
- **Pro**: Minimaler Eingriff, korrekte Semantik, konsistent zum Frontend-Dedupe-Key.
- **Contra**: Cache-Hit-Rate sinkt (pro Modell separate Cache-Linien).

### Variante B (erweitert): zusätzlich `temperature`/Sampling-Parameter in den Cache-Key aufnehmen

- **Änderung**: Neben `llmModel` wird auch `temperature` Teil des Hashes.
- **Pro**: Streng korrekt, da Temperatur die Ausgabe beeinflusst.
- **Contra**: Noch stärkere Cache-Fragmentierung; benötigt API-/Schema-Erweiterung (weil Temperatur derzeit nicht im Hash-Contract steckt).

### Variante C (Explizit „Cache ignorieren“ bei Modellwechsel im Client)

- **Änderung**: Client hängt z.B. `cacheBuster=<modelId>` an oder sendet Header, um Cache-Check zu umgehen.
- **Pro**: Kein DB-/Hash-Schema anfassen.
- **Contra**: Unsauber (Backend bleibt inkorrekt), dupliziert Logik, leichter regressionsanfällig.

## Entscheidung

Ich entscheide mich für **Variante A**, weil sie **die Backend-Semantik repariert** und gleichzeitig minimal-invasiv ist. Temperatur (Variante B) ist diskutabel; wir lassen sie bewusst draußen, solange das Produktverhalten nicht explizit „Temperaturwechsel muss Cache trennen“ fordert.


