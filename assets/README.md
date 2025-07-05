# App Icons

Für die Electron App benötigst du folgende Icon-Dateien:

## Benötigte Icons:

1. **icon.png** (512x512px) - Basis-Icon für Linux und als Fallback
2. **icon.ico** (Windows) - Für Windows .exe Dateien
3. **icon.icns** (macOS) - Für macOS .dmg Dateien

## Erstelle die Icons:

### Option 1: Verwende ein Online-Tool
- Gehe zu https://www.icoconvert.com/
- Lade dein Logo/Icon hoch (mindestens 512x512px)
- Generiere alle drei Formate

### Option 2: Mit ImageMagick (falls installiert)
```bash
# PNG zu ICO
convert icon.png -resize 256x256 icon.ico

# PNG zu ICNS (macOS)
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_64x64.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset
```

## Temporäre Lösung für Tests:

Für die ersten Tests kannst du auch einfach eine beliebige PNG-Datei als `icon.png` verwenden.
Die .ico und .icns Dateien sind nur für die finalen Builds wichtig. 