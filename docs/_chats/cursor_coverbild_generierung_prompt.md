# Coverbild generierung prompt
_Exported on 2/6/2026 at 17:09:37 GMT+1 from Cursor (2.4.27)_

---

**User**

wie wird das Coverbild mit welchem Prompt generiert?


---

**Cursor**

Ich kläre das, indem ich im Code nach der Coverbild-Generierung (UI-Button „Bild generieren“, Felder wie `coverImageUrl`) suche, dann die dazugehörige Server-/Job-Logik (API Route / External Job) öffne und den tatsächlich verwendeten Prompt auslese.

Ich hatte gerade einen Tool-Fehler (Pfad/Parameter). Ich suche jetzt erneut repo-weit nach `coverImageUrl`/„Coverbild“/„Bild generieren“ und springe dann in die Stellen, wo der Prompt gebaut wird.

Ich habe die relevanten Einstiegsstellen gefunden: UI/Workflow hängt an `src/components/library/cover-image-generator-dialog.tsx` und wird vom `job-report-tab` aus geöffnet. Als nächstes lese ich den Dialog und die zugehörige Server-Route/Secretary-Adapter, um den **konkret gesendeten Prompt** zu extrahieren.

Jetzt ist klar: der Prompt kommt **direkt aus dem Dialog** (oder als `defaultPrompt` aus `title`/`summary`). Ich lese als nächstes die Proxy-Route `src/app/api/secretary/text2image/generate/route.ts` und die Secretary-Doku, um zu sehen, ob serverseitig noch Prompt-Teile ergänzt/überschrieben werden.

## Antwort (aus dem Code abgeleitet, nicht „getestet“)

Das **generierte Coverbild** nutzt **genau den Text**, der im Dialog „Coverbild generieren“ im Feld **Prompt** steht (nur `trim()`), ohne dass serverseitig noch Stil-/System-Promptteile ergänzt werden. Der Prompt wird **standardmäßig vorbefüllt** aus Metadaten: **`title`** (Priorität) oder **`summary`** (auf 100 Zeichen gekürzt).

### 1) Woher kommt der (Default-)Prompt?
In `job-report-tab.tsx` wird `defaultPrompt` so abgeleitet und an den Generator-Dialog übergeben:

```1040:1136:C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\library\job-report-tab.tsx
              // Default-Prompt aus Metadaten ableiten (z.B. aus title oder summary)
              const defaultPrompt = (() => {
                const base: Record<string, unknown> = sourceMode === 'frontmatter'
                  ? {}
                  : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
                const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
                const title = cm.title as string | undefined
                const summary = cm.summary as string | undefined
                if (title && typeof title === 'string' && title.trim().length > 0) {
                  return title.trim()
                }
                if (summary && typeof summary === 'string' && summary.trim().length > 0) {
                  // Kürze Summary auf max. 100 Zeichen für Prompt
                  return summary.trim().substring(0, 100)
                }
                return ''
              })()
...
                  <CoverImageGeneratorDialog
                    open={isGeneratorDialogOpen}
                    onOpenChange={setIsGeneratorDialogOpen}
                    onGenerated={handleGeneratedImage}
                    defaultPrompt={defaultPrompt}
                  />
```

### 2) Was wird tatsächlich an die Bildgenerierung geschickt?
Im Dialog wird der Prompt-State initial mit `defaultPrompt` gesetzt und beim Klick an `/api/secretary/text2image/generate` gesendet:

```34:105:C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\components\library\cover-image-generator-dialog.tsx
export function CoverImageGeneratorDialog({
  open,
  onOpenChange,
  onGenerated,
  defaultPrompt = ''
}: CoverImageGeneratorDialogProps) {
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [size, setSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024')
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard')
...
  const handleGenerate = async (variantCount: 1 | 4 = 4) => {
...
      const requestBody: Record<string, unknown> = {
        prompt: prompt.trim(),
        size,
        quality,
        useCache: variantCount === 1
      }

      if (variantCount === 4) {
        const seeds = [101, 102, 103, 104]
        requestBody.n = 4
        requestBody.seeds = seeds
        requestBody.useCache = false
      } else {
        requestBody.n = 1
      }

      const response = await fetch('/api/secretary/text2image/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
```

### 3) Wird serverseitig noch etwas am Prompt geändert?
Die Proxy-Route validiert nur „nicht leer“ und leitet **denselben** `prompt.trim()` an den Secretary Service weiter:

```43:113:C:\Users\peter.aichner\projects\CommonKnowledgeScout\src\app\api\secretary\text2image\generate\route.ts
    const body = await request.json().catch(() => ({}))
    const { prompt, size = '1024x1024', quality = 'standard', n = 1, seed, seeds, useCache = true } = body as {
      prompt?: string
      size?: string
      quality?: 'standard' | 'hd'
      n?: number
      seed?: number
      seeds?: number[] | string
      useCache?: boolean
    }

    // Validierung
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt darf nicht leer sein', code: 'MISSING_PROMPT' },
        { status: 400 }
      )
    }
...
    const requestBody: Record<string, unknown> = {
      prompt: prompt.trim(),
      size,
      quality,
      n,
      useCache
    }
...
    if (seeds) {
      if (Array.isArray(seeds)) {
        requestBody.seeds = seeds
      } else if (typeof seeds === 'string') {
        requestBody.seeds = seeds.split(',').map(s => Number.parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n))
      }
    } else if (seed !== undefined) {
      requestBody.seed = seed
    }
```

**Kurzfassung:** Prompt = (voreingestellt `title` bzw. `summary[0..100]`) → Nutzer kann editieren → gesendet wird **genau dieser Text**, nur getrimmt.

---

**User**

Bitte Default Text zusammenstellen aus title + teaser 
und vorangestellt durch metafeld: coverImagePrompt 
getrennt durch zeilenumbruch.

Textfeld auf mehrzeiliges Feld erweitern.

---

**Cursor**

Anpassen des Default-Prompts: `coverImagePrompt` (falls vorhanden) voranstellen, dann `title` + `teaser`, durch Zeilenumbrüche getrennt. Das Eingabefeld auf ein mehrzeiliges Textarea erweitern.


Anpassen der Default-Prompt-Logik und Ersetzen des Input-Felds durch ein mehrzeiliges Textarea.


Ersetzen des Input-Felds durch ein mehrzeiliges Textarea:


Prüfe auf Linter-Fehler:


## Änderungen

### 1. Default-Prompt-Logik angepasst (`job-report-tab.tsx`)
- Zusammensetzung: `coverImagePrompt` (falls vorhanden) + `title` + `teaser`
- Getrennt durch Zeilenumbrüche (`\n`)
- Reihenfolge: `coverImagePrompt` → `title` → `teaser`

### 2. Eingabefeld erweitert (`cover-image-generator-dialog.tsx`)
- `Input` durch `Textarea` ersetzt
- Mehrzeilig, min. Höhe 100px, 4 Zeilen
- Enter erzeugt eine neue Zeile (keine automatische Generierung)

### Beispiel für den Default-Prompt:
```
[coverImagePrompt-Wert, falls vorhanden]
[Titel]
[Teaser]
```

Alle drei Teile werden nur hinzugefügt, wenn sie vorhanden und nicht leer sind.

Keine Linter-Fehler gefunden. Die Änderungen sind bereit zum Testen.

---

**User**

title und teaser sind kleingeschrieben

---

**Cursor**

Suche nach den tatsächlichen Feldnamen in den Metadaten:


Prüfe die tatsächlichen Feldnamen im Frontmatter:


Prüfe, wie die Metadaten im Code gelesen werden, um die tatsächlichen Feldnamen zu ermitteln:


Prüfe, ob die Feldnamen im Frontmatter anders geschrieben sind. Suche nach Varianten:


Anpassen der Feldnamen auf `Title` und `Teaser` (großgeschrieben):


Feldnamen angepasst: Unterstützung für `Title` und `Teaser` (großgeschrieben) mit Fallback auf `title` und `teaser` (kleingeschrieben) für Kompatibilität.


Änderung abgeschlossen. Die Default-Prompt-Logik unterstützt jetzt:

- `Title` und `Teaser` (großgeschrieben) – Priorität
- `title` und `teaser` (kleingeschrieben) – Fallback für Kompatibilität

Die Reihenfolge bleibt: `coverImagePrompt` → `Title`/`title` → `Teaser`/`teaser`, getrennt durch Zeilenumbrüche.

Keine Linter-Fehler gefunden. Die Änderung ist bereit zum Testen.

---

**User**

@Next.js: Debug Server-Side (954-1010) 

Warum hat das nicht geklappt?

Secretaryservice war erfolgreich:
2026-01-20 12:35:56,411 - DEBUG - [base_processor.py:init_logger:386] - [Text2ImageProcessor] Process[a04b3be3-483f-46b8-b4e6-661dcd0c2cd3] - Logger initialisiert
2026-01-20 12:35:56,427 - WARNING - [base_processor.py:load_processor_config:427] - [Text2ImageProcessor] Process[a04b3be3-483f-46b8-b4e6-661dcd0c2cd3] - Keine Konfiguration für Processor 'text2image' gefunden
2026-01-20 12:35:56,498 - DEBUG - [text2image_processor.py:__init__:156] - [Text2ImageProcessor] Process[a04b3be3-483f-46b8-b4e6-661dcd0c2cd3] - Text2Image Processor initialisiert - Args: {"model": "black-forest-labs/flux.2-max", "provider": "openrouter", "default_size": "1024x1024", "default_quality": "standard", "init_time_ms": 86.53}
2026-01-20 12:35:56,500 - INFO - [text2image_processor.py:process:412] - [Text2ImageProcessor] Process[a04b3be3-483f-46b8-b4e6-661dcd0c2cd3] - Starte Bildgenerierung - Args: {"prompt_length": 369, "size": "1024x1024", "quality": "standard", "model": "black-forest-labs/flux.2-max"}
2026-01-20 12:37:57,871 - INFO - [text2image_processor.py:process:505] - [Text2ImageProcessor] Process[a04b3be3-483f-46b8-b4e6-661dcd0c2cd3] - Bildgenerierung erfolgreich - Args: {"prompt_length": 369, "image_count": 4, "image_size_bytes": 2153883, "duration_ms": 121369.71735954285, "tokens": 388}
127.0.0.1 - - [20/Jan/2026 12:37:57] "POST /api/text2image/generate HTTP/1.1" 200 -

---

**Cursor**

Der Secretary Service hat erfolgreich geantwortet (200 OK nach ~121 Sekunden), aber der Next.js-Client hat nach 120 Sekunden einen Timeout. Prüfe den Timeout-Wert und erhöhe ihn:


Der Timeout liegt bei 120 Sekunden, die Generierung dauerte ~121 Sekunden. Erhöhe den Timeout auf 180 Sekunden (3 Minuten) für einen Puffer:


Aktualisiere die Fehlermeldung auf 3 Minuten:


## Problem

Der Secretary Service hat erfolgreich geantwortet (200 OK nach ~121 Sekunden), aber der Next.js-Client hat nach 120 Sekunden einen Timeout ausgelöst, bevor die Antwort ankam.

## Lösung

- Timeout von 120 Sekunden (2 Minuten) auf 180 Sekunden (3 Minuten) erhöht
- Fehlermeldung aktualisiert (von "max. 2 Minuten" auf "max. 3 Minuten")

**Grund:** Bei 4 Varianten kann die Generierung länger dauern (im Beispiel ~121 Sekunden). Mit 3 Minuten bleibt ein Puffer.

Die Änderung ist bereit. Beim nächsten Versuch sollte die Bildgenerierung erfolgreich sein, auch wenn sie etwas länger dauert.

---

**User**

Bild wird so gespeichert: cover_generated.png 
Sollte nicht datum und uhrzeit ergänzt werden?

---

**Cursor**

Suche die Stelle, an der der Dateiname gesetzt wird, und füge Datum und Uhrzeit hinzu:


Erweitere den Dateinamen um Datum und Uhrzeit:


Dateiname erweitert: Der generierte Dateiname enthält jetzt Datum und Uhrzeit.

**Änderung:**
- Vorher: `cover_generated.png`
- Jetzt: `cover_generated_2026-01-20_12-35-45.png` (Format: `cover_generated_YYYY-MM-DD_HH-MM-SS.png`)

**Vorteile:**
- Eindeutig: Jede Generierung erhält einen eigenen Dateinamen
- Chronologisch sortierbar
- Dateisystem-kompatibel (keine problematischen Zeichen wie Doppelpunkte)

Keine Linter-Fehler gefunden. Die Änderung ist bereit zum Testen.

---

**User**

coverImagePrompt möchte ich in library config pflegen.
Wo könnten wir das einbauen? 

---

**Cursor**

Suche nach der Library-Konfiguration und deren Verwendung:


Prüfe die Library-Konfiguration und die Stelle, an der der Default-Prompt zusammengestellt wird:


Erweitere die Type-Definitionen und passe die Default-Prompt-Logik an:


Erweitere die Type-Definitionen und passe die Default-Prompt-Logik an:


Erweitere auch die ClientLibrary-Type-Definition:


Prüfe die Settings-Seite, um das Feld dort hinzuzufügen:


Hinzufügen des Felds zur Settings-Form:


## Änderungen

### 1. Type-Definitionen erweitert (`src/types/library.ts`)
- `coverImagePrompt?: string` zu `secretaryService` hinzugefügt (sowohl in `StorageConfig` als auch `ClientLibrary`)

### 2. Default-Prompt-Logik erweitert (`src/components/library/job-report-tab.tsx`)
- Priorität: Library-Config `coverImagePrompt` → Frontmatter `coverImagePrompt` → `Title` → `Teaser`
- Der Library-Config-Wert wird vorangestellt, wenn vorhanden

### 3. Settings-Form erweitert (`src/components/settings/secretary-service-form.tsx`)
- Neues mehrzeiliges Textfeld für `coverImagePrompt`
- Wird in der Secretary-Service-Konfiguration gespeichert
- Beschreibung erklärt die Verwendung

## Verwendung

1. In den Settings: Secretary-Service → "Coverbild-Prompt (Standard)" eintragen
2. Beim Generieren: Der Library-Config-Prompt wird automatisch vorangestellt, gefolgt von Frontmatter `coverImagePrompt` (falls vorhanden), `Title` und `Teaser`

Keine Linter-Fehler gefunden. Die Änderungen sind bereit zum Testen.

