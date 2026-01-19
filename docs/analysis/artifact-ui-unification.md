## Ziel

Wir wollen die Artefakt-Ansicht vereinheitlichen. Heute existieren mehrere UI-Generationen parallel. Das erzeugt doppelte Benutzerfuehrung und widerspruechliche Erwartungen. Die Haupt-UI soll den gesamten Lebenszyklus sichtbar machen und trotzdem leicht bedienbar bleiben.

Die drei Status-Icons in der Toolbar sind bereits ein klares mentales Modell. Dieses Modell soll in Tabs uebersetzt werden. So erkennt man schnell, welches Artefakt existiert und kann es direkt oeffnen. Bearbeiten bleibt moeglich, aber als gezieltes Modal pro Artefakt.

Wir wollen moeglichst wenig neu programmieren. Wir nutzen vorhandene Bausteine wie `StoryView`, `JobReportTab`, `ArtifactInfoPanel` und `SourceAndTranscriptPane`. Das reduziert Risiko, spart Zeit und bleibt konsistent mit der Pipeline-Logik.

## Varianten

### Variante A: Haupt-UI erweitern (bevorzugt)
- Haupt-UI bekommt Tabs: Original, Transcript, Transformation, Story, Uebersicht.
- Icons aus der Toolbar erscheinen als Tab-Icons.
- Legacy-Dialog wird entfernt oder umgeleitet.
- Bearbeiten oeffnet ein Modal aus dem jeweiligen Tab.

**Pro:** Minimal-invasive Aenderung, beste Wiederverwendung, klare Navigation.  
**Contra:** Anpassungen in `FilePreview` notwendig.

### Variante B: Legacy-Dialog als Haupt-UI
- Datei-Dialog wird zur Haupt-UI ausgebaut.
- Aktuelle Haupt-UI wird reduziert oder entfernt.

**Pro:** Wenig Umbau im Dialog selbst.  
**Contra:** Bricht bestehende Navigationspfade und Status-Icons, hohes Risiko.

### Variante C: Hybrid mit zwei Ebenen
- Haupt-UI bleibt schlank, Legacy-Dialog bleibt fuer Experten.
- Klare Rollenverteilung, z.B. "Standard" vs. "Debug".

**Pro:** Niedriges Risiko.  
**Contra:** Doppelfuehrung bleibt bestehen.

## Entscheidung

Wir waehlen Variante A. Sie konsolidiert die UX, nutzt vorhandene Komponenten und respektiert das Artefaktmodell. Das Risiko ist gering, weil wir keine neue Datenlogik bauen.

## Konsequenzen

- `FilePreview` wird zentral erweitert.  
- Der Legacy-Dialog wird entfernt oder nur noch als technischer Fallback verwendet.  
- Bearbeiten wird als Modal pro Artefakt angeboten.

