## Problem / Beobachtung
Im Dev-Log erscheinen sehr viele Einträge wie:
- `GET /api/external/jobs/stream 200 ...`
- `GET /api/external/jobs?page=... 200 ...`
- sowie zusätzliche Calls zu Clerk (`GET https://api.clerk.com/...`) als Folge davon.

Diese Logs sind in Next.js Dev normal (Request-Logging), werden aber **durch zu häufige Requests** unbenutzbar.

## Ursache (im aktuellen Code)
Im `JobMonitorPanel` existieren zwei Mechanismen:
- **SSE** via `EventSource('/api/external/jobs/stream')` für Live-Updates
- **Polling-Fallback**: wenn 10s keine SSE-Events kommen, wird `refreshNow()` ausgeführt

Der Polling-Fallback prüft alle 2s, ob `idleMs > 10_000` und ruft dann `refreshNow()` auf. Da `lastEventTsRef` beim Polling **nicht** aktualisiert wird, bleibt `idleMs` dauerhaft >10s und der Fallback triggert **alle 2 Sekunden** ein Refresh.

Zusätzlich kann die SSE-Verbindung (aus verschiedenen Gründen in Dev) reconnecten; dann entstehen extra Requests.

## Ziel
- Dev-Logs sollen nicht zugespammt werden.
- Live-Updates sollen weiter funktionieren.
- Bei SSE-Problemen soll es weiterhin Fallback geben, aber **gedrosselt**.

## Varianten (3 Optionen)
### Variante A – Minimaler Fix (empfohlen)
- Beim Fallback-Refresh `lastEventTsRef` sofort aktualisieren, damit danach erst wieder nach 10s ein Refresh passiert.
- Reconnect-Delay bei SSE-Error per Backoff erhöhen (z.B. 1s → 2s → 4s → max 30s).

**Pro:** Minimaler Eingriff, reduziert Requests drastisch, wirkt auch wenn SSE „still“ ist.  
**Contra:** Versteckt die eigentliche Ursache eines instabilen SSE (falls vorhanden) nur teilweise.

### Variante B – Polling komplett entfernen (SSE-only)
**Pro:** Weniger Requests.  
**Contra:** Wenn SSE in Dev/Prod nicht zuverlässig ist, gehen Updates verloren.

### Variante C – Next.js Dev Request Logging deaktivieren
**Pro:** Log wird ruhig.  
**Contra:** Verdeckt echte Probleme; je nach Next-Version nicht sauber steuerbar und hilft nicht bei echter Last.

## Entscheidung
Wir setzen **Variante A** um: Polling wird gedrosselt und SSE-Reconnect bekommt Backoff. Das reduziert den Log-Spam ohne Risiko für die Kernfunktion.

## Testplan
- Dev: Job-Monitor öffnen, 1 Minute warten ohne Events → es sollte **max. ~1 Request / 10s** für `/api/external/jobs` auftreten.
- Dev: SSE-Fehler provozieren (z.B. Logout) → Reconnects sollten mit wachsender Pause stattfinden (kein 1s-Spam).

