# Offizielle SDG-Icons (von Hand abzulegen)

Das SDG-Rad in der Detailansicht (`SdgWheelLabeled`) lädt die offiziellen
UN-SDG-Icons aus diesem Ordner. Solange die Dateien fehlen, zeigt die UI einen
sauberen Fallback: eine farbige Kachel mit der Ziel-Nummer (kein Crash, kein
leeres Rad).

## Benötigte Dateien

17 offizielle Icon-Dateien mit den **unveränderten** UN-Originalnamen
(zweistellig, führende Null):

```
public/sdg-icons/E-WEB-Goal-01.png
public/sdg-icons/E-WEB-Goal-02.png
...
public/sdg-icons/E-WEB-Goal-17.png
```

Der Pfad wird zentral in `src/lib/gallery/sdg-meta.ts` (`sdgIconPath`) erzeugt —
falls du eine andere Benennung/ein anderes Format brauchst, dort anpassen.

## Quelle

Offizielles UN-Material:
<https://www.un.org/sustainabledevelopment/news/communications-material/>
(„SDG icons" / „Colour wheel and icons", verfügbar als EPS/SVG/PNG je Sprache).
Die Goal-Icons heißen dort bereits `E-WEB-Goal-01` … `E-WEB-Goal-17` und werden
ohne Umbenennen direkt verwendet (hier als PNG abgelegt).

## Lizenz / Nutzungshinweis

Die SDG-Logos und -Icons dürfen gemäß den UN-Richtlinien zu **informativen und
bildungsbezogenen** Zwecken verwendet werden. Sie dürfen **nicht verändert**
werden und dürfen **keine Unterstützung/Endorsement der Vereinten Nationen**
suggerieren. Verwende ausschließlich die offiziellen, unveränderten Asset-
Dateien. Details: UN SDG Guidelines for the use of the SDG logo (inkl. the
colour wheel and the 17 icons).
