## Ziel

Dieses Datenmodell beschreibt einen rendererunabhängigen digitalen Zwilling für Materialien.

Das Modell dient als zentrale Materialdefinition für:

- Unity
    
- Blender
    
- Babylon.js/Webviewer
    
- zukünftige Renderer
    
- KI-gestützte Materialanalyse
    
- Materialsuche und Klassifikation
    
- Konfiguratoren
    

Das Ziel ist:

- eine einheitliche Materialquelle
    
- rendererunabhängige Materialbeschreibung
    
- konsistente Darstellung über alle Systeme hinweg
    
- zentrale Verwaltung von Materialinformationen und Texturen
    

## Grundprinzipien

**Rendererunabhängig**

Das Kernmodell enthält keine spezifischen Unity-, Blender- oder Babylon-Shaderlogiken.

Renderer-spezifische Daten werden separat unter runtimeAssets gespeichert.

**Semantische Beschreibung statt Dateilogik**

Das Modell beschreibt:

- welche Materialinformationen existieren
    
- wie ein Material visuell wirkt
    
- welche Maps vorhanden sind
    

Das Modell beschreibt bewusst nicht:

- GPU-Kompression
    
- Shaderimplementierungen
    
- Dateispeicheroptimierungen
    

**Ein Material = ein renderbares Material**

Ein Material beschreibt eine konkrete Materialdefinition.

Beispiele:

- „Poso Beige“
    
- „Oak Dark“
    
- „Velvet Green“
    

Materialgruppen (groupId) dienen lediglich zur organisatorischen Gruppierung.

**Gesamtstruktur**

{  
  "material": {}  
}

## Basisinformationen

**id**

Eindeutige technische Material-ID.

"id": "poso_beige_100"

**name**

Anzeigename des Materials.

"name": "Poso Beige 100"

**groupIds**

Referenz auf eine oder mehrere Materialgruppen.

Materialgruppen können verwendet werden für:

- Preisgruppen
    
- Stoffserien
    
- organisatorische Gruppierung
    
- Konfiguratorlogik
    

"groupIds": ["PG1"]  

**materialCategories**

Liste aller Materialkategorien, mit denen das Material kompatibel ist.

Diese Kategorien werden im Konfigurator und in der CatalogXML verwendet, um:

- Materialien
    
- Geometrien
    
- Optionen
    

miteinander zu verknüpfen.

Beispiel

Eine Geometrie definiert:

materialCategory = OPTBE

Dann dürfen nur Materialien verwendet werden, die:

"materialCategories": ["OPTBE"]

enthalten.

### Physische Materialinformationen

**physicalSize**

Beschreibt die reale physische Wiederholungsgröße (Rapport) des Materials.

"physicalSize": {  
  "widthMm": 400,  
  "heightMm": 400  
}

**Bedeutung**

Ein Stoff mit:

- 400 x 400 mm
    

besitzt eine reale Strukturwiederholung von:

- 40 x 40 cm
    

Diese Information wird verwendet für:

- korrektes Tiling
    
- Maßstabsberechnung
    
- Renderer
    
- KI-Analyse
    

### UV Mapping

**mapping**

Beschreibt das finale UV-Mapping innerhalb der DIVA-Pipeline.

"mapping": {  
  "referenceRepeatMm": 10,  
  "scaleU": 0.25,  
  "scaleV": 0.25,  
  "offsetU": 0,  
  "offsetV": 0,  
  "rotationDeg": 0  
}

**Zweck**

Das Mapping beschreibt:

- wie stark eine Textur gekachelt wird
    
- wie sie auf Geometrien angewendet wird
    

Diese Werte sind bereits final berechnet und müssen von Renderern nicht neu berechnet werden.

**Mapping-Felder**

|   |   |
|---|---|
|**Feld**|**Beschreibung**|
|referenceRepeatMm|Referenzgröße der UV-Welt|
|scaleU|horizontales Tiling|
|scaleV|vertikales Tiling|
|offsetU|horizontaler Offset|
|offsetV|vertikaler Offset|
|rotationDeg|optionale Rotation|

### Farbdefinition

dominantColor

Beschreibt die wahrgenommene Hauptfarbe des Materials.

Wird verwendet für:

- Filter
    
- Suche
    
- KI
    
- UI
    
- Materialkategorisierung
    

" dominantColor ": {  
  "family": "beige",  
  "hex": "#C8BFAE",  
  rgb": {  
      "r": 0.78,  
      "g": 0.75,  
      "b": 0.68  
  },  
  "description": "warmes helles Beige"  
}

**Unterschied zu averageColor**

|   |   |
|---|---|
|**Feld**|**Bedeutung**|
|dominantColor|wahrgenommene Hauptfarbe|
|averageColor|mathematischer Durchschnitt der BaseColor, normal, roughness -Textur|

# Materialverfügbarkeit

**availability**

Definiert die Gültigkeit eines Materials innerhalb des Systems.

"availability": {  
  "scope": "basic",  
  "retailerILN": "1234567890123",  
  "catalogId": null  
}

---

**scope**

|   |   |
|---|---|
|**Wert**|**Bedeutung**|
|basic|nicht kataloggebunden|
|catalog|katalogspezifisch|

---

**retailerILN**

Optionaler Bezug zu einem Hersteller/Retailer über ILN/GLN.

**Beispiele**

[[PA7]](#) [[LA8]](#) 

|   |   |   |   |
|---|---|---|---|
|**retailerILN**|**scope**|**Bedeutung**|**Beispiel ort**|
|null|basic|globales DIVA-Material|S:\DivaStandardMaterials\_Standard|
|gesetzt|basic|retailerweit gültig|S:\0000000010429\textures|
|gesetzt|catalog|katalogspezifisch|S:\DivaStandardMaterials\0000999345678\braun_seetal|
|||||
||||| 

# Shading Model

**shadingModel**

Beschreibt die grundsätzliche Materialinterpretation.

"shadingModel": "pbrMetallicRoughness"

---

**Mögliche Werte**

pbrMetallicRoughness  
mirror  
glass  
unlit  
custom

---

**Zweck**

Das Shading Model bestimmt:

- wie Materialinformationen interpretiert werden
    
- welcher Shader geladen wird
    
- wie das Material gerendert wird
    

Das Kernmodell bleibt dabei identisch.

---

# Runtime Assets

**runtimeAssets**

Renderer- oder Engine-spezifische Materialartefakte.

Beispiele:

- Unity AssetBundles
    
- vorkompilierte Materialpakete
    
- optimierte Runtime-Daten
    

"runtimeAssets": [  
  {  
    "type": "unityAssetBundle"  
  }  
]

Beispiel:  
"runtimeAssets": [

       {

           "id": "unity_hdrp_2022_bundle",

           "type": "unityAssetBundle",

           "engine": "unity",

           "engineVersion": "2022.3",

           "renderPipeline": "hdrp",

           "uri": "...",

           "contains": [

             "material",

             "baseColor",

             "normal",

             "roughness",

             "metallic",

             "ambientOcclusion"

           ]

       }

---

# Materialkanäle

Alle Materialkanäle folgen grundsätzlich derselben Struktur.

---

**Allgemeine Kanalstruktur**

{  
  "defined": true,  
  "variants": []  
}

---

**defined**

Beschreibt, ob die Eigenschaft fachlich definiert wurde. Defined false würde bedeuten, dass dieser Kanal gar nicht explizit definiert wurde.

**Beispiel**

"metallic": {  
  "defined": true,  
  "averageValue": 0.0  
}

Bedeutet:

- Material ist bewusst nicht metallisch
    

---

**Unterschied**

|   |   |
|---|---|
|**Zustand**|**Bedeutung**|
|defined: false|keine Information vorhanden|
|defined: true + kein variants|konstanter Wert|
|defined: true + variants|Texturmap vorhanden|

---

**Variants**

Beschreibt konkrete physische Dateien.

{  
  "id": "basecolor_4k",  
  "widthPx": 4096,  
  "heightPx": 4096,  
  "format": "jpg",  
  "uri": "..."  
}

**Variantenfelder**

|   |   |
|---|---|
|**Feld**|**Beschreibung**|
|id|technische ID|
|widthPx|Breite|
|heightPx|Höhe|
|format|Dateiformat|
|uri|Speicherort|

---

## Base Color

**baseColor**

Diffuse/PBR-Basisfarbe.

"baseColor": {  
  "defined": true  
}

---

**averageColor**

Mathematischer Durchschnitt der BaseColor-Textur.

Wird verwendet für:

- Fallbacks
    
- Vorschau
    
- KI
    
- Materialähnlichkeit
    

---

**containsOpacity**

Optionales Flag für RGBA-Dateien.

"containsOpacity": true

Bedeutung:

- der Alpha-Channel enthält Transparenzinformationen
    

---

## Normal

**normal**

Beschreibt Oberflächenrichtungen.

"normal": {  
  "defined": true,  
  "strength": 1.0,

„variants“: []  
}

Besitzt eine Optionale secondaryMap.

---

## Roughness

**roughness**

Beschreibt mikroskopische Rauheit.

"roughness": {  
“defined”: “true”,  
  "averageValue": 0.82,  
  “variants“: []  
}

---

## Metallic

**metallic**

Beschreibt metallisches Verhalten.

"metallic": {  
“defined”: “true”,  
  "averageValue": 0.0,  
  „variants“: []  
}

Besitzt eine Optionale secondaryMap.

---

## Ambient Occlusion

**ambientOcclusion**

Beschreibt lokale Verschattung.

"ambientOcclusion": {

  “defined”: “true”,  
  "averageValue": 0.0,  
  „variants“: []  
}

AO besitzt bewusst keinen averageValue, da der Durchschnitt meist wenig Aussagekraft besitzt.

Besitzt eine Optionale secondaryMap.

## Height

**height**

Height-/Displacement-Map.

"height": {  
  "defined": false  
}

Wird verwendet für:

- Parallax
    
- Displacement
    
- Offline Rendering
    

## Opacity

**opacity**

Beschreibt Transparenzinformationen.

"opacity": {  
  "defined": true  
}

**Transparenzspeicherung**

Opacity kann:

- separat gespeichert werden
    
- im Alpha-Channel der BaseColor-Datei enthalten sein
    

Beides wird unterstützt.

# Secondary Maps

**secondaryMap**

Sekundäre großflächige Modulationsmap.

Diese Maps dienen dazu:

- sichtbare Wiederholungen zu reduzieren
    
- großflächige Variation hinzuzufügen
    
- Makrodetails darzustellen
    

**Typische Anwendungen**

|   |   |
|---|---|
|**Kanal**|**Zweck**|
|roughness|großflächige Glanzvariation|
|ambientOcclusion|Makroschatten, Wischoptik…|
|normal|große Falten/Relief Geometrien abhängig|
|baseColor|Farbvariation,|

**Struktur**

"secondaryMap": {  
  "blendMode": "multiply",  
  "mapping": {},  
  "strength": 0.7,  
  "variants": []  
}

**blendMode**

Beschreibt die mathematische Kombination mit der Hauptmap.

**Werte**

multiply  
add  
overlay  
lerp

# Visual Properties

**visualProperties**

Beschreibt kompakte visuelle Eigenschaften eines Materials.

Diese Informationen werden verwendet für:

- KI-Generierung
    
- Materialsuche
    
- Materialähnlichkeit
    
- automatische Beschreibung
    
- Filterung
    
- Rendering-Kontext
    

**Struktur**

"visualProperties": {  
     "materialClass": "fabric",  
     "materialType": "cord",  
     "surfaceFinish": "matte",  
     "surfaceRelief": "medium",  
     "patternScale": "medium",  
     "directionality": "strong",  
     "perceivedSoftness": "soft",  
     "colorVariation": "subtle",

"materialSpecificProperties": {  
//abhängig von materialClass, siehe Tabelle unten  
   },

   "aiGenerationHints": {  
        "positivePromptTerms": [  
          "matte beige corduroy fabric",  
          "visible vertical ribs",  
          "soft textile texture"  
     ],  
     "negativePromptTerms": [  
          "glossy leather",  
          "smooth plastic",  
             "metallic surface"  
     ],  
     "realismNotes": "Cord fabric should show clear directional ribs and a soft matte textile surface."  
   },

   "confidence": {  
        "materialClassConfidence": 0.95,  
        "materialTypeConfidence": 0.78,  
        "visualPropertiesConfidence": 0.82,  
        "needsHumanReview": false  
   }

}

## Allgemein gültige Materialwerte

`materialClass` bestimmt, welche `materialType`-Werte erlaubt sind.

`materialType` kann zusätzlich bestimmen, welche weiteren Eigenschaften sinnvoll oder erlaubt sind.

**materialClass:** Grobe Materialklasse.Konkrete Ausprägungen siehe weiter unten

**Mögliche Werte:**

fabric  
leather  
wood    
metal    
glass,stone

---

**materialType:** Genauer Materialtyp, abhängig von materialClass.

**Beispiele:** cord,  velvet,  boucle,  chenille, oak, nubuck

---

**surfaceFinish**

Beschreibt den Glanzgrad der Oberfläche.

**Werte**

matte  
semi_gloss  
glossy

---

**surfaceRelief**

Beschreibt die sichtbare Oberflächenstruktur.

**Werte**

flat  
subtle  
medium  
pronounced

---

**patternScale**

Beschreibt die wahrgenommene Größe des Musters oder der Struktur.

**Werte**

fine  
small  
medium  
large

---

**directionality**

Beschreibt, ob das Material eine sichtbare Richtung besitzt.

Wichtig für:

- Cord
    
- Samt
    
- Holz
    
- gebürstete Materialien
    

**Werte**

none  
subtle  
strong

---

**perceivedSoftness**

Beschreibt die wahrgenommene Weichheit.

**Werte**

hard  
firm  
soft  
plush

---

**colorVariation**

Beschreibt die Farbvariation innerhalb des Materials.

**Werte**

uniform  
subtle  
medium  
strong  
multicolor

---

# Gültige Material Klassifikation

## Überblick

Überblick aller gültigen MaterialClasses und materialType

Gültige MaterialClasses

|   |   |   |
|---|---|---|
|MaterialClass|MaterialType|Zusatzattribute abhängig vom Material|
|wood|oak  <br>walnut  <br>beech  <br>ash  <br>pine  <br>spruce  <br>maple  <br>teak  <br>cherry  <br>acacia  <br>elm  <br>birch  <br>bamboo  <br>olive  <br>wenge  <br>zebrano  <br>rosewood  <br>ebony  <br>reclaimed_wood  <br>generic_wood|**constructionType**<br><br>Werte:<br><br>- Solid Wood: massivholz<br>    <br><br>- Veneer: Dünne Echtholzschicht auf Trägerplatte<br>    <br><br>- Engineered Wood: MDF, Spanplatte...<br>    <br><br>- Laminate: Holzoptik gedruckt/beschichtet<br>    <br><br>**grainType**<br><br>Werte:<br><br>- Uniform: Ruhige, gleichmäßige Maserung<br>    <br><br>- Natural: Natürliche sichtbare Maserung<br>    <br><br>- Knotted: Sichtbare Astlöcher<br>    <br><br>- Wild: Sehr lebhaft/auffällige Maserung<br>    <br><br>surfaceTreatment<br><br>Werte:<br><br>- Raw: Unbehandelt<br>    <br><br>- Oiled: Geölt<br>    <br><br>- Lacquered: lackiert<br>    <br><br>- Brushed: Gebürstete Struktur<br>    <br><br>- Stained: Farblich gebeizt<br>    <br><br>- Smoked: Dunkler/geräucherter Look<br>    <br><br>- Distressed: Künstlich gealtert|
|fabric|Flachgewebe / Flat Weave<br><br>Strukturgewebe / Textured Weave<br><br>Chenille / Chenille<br><br>Samt/Velours /Velvet / Velour<br><br>Cord / Corduroy<br><br>Bouclé / Bouclé<br><br>Filz / Felt<br><br>Mikrofaser / Microfiber<br><br>Outdoor/Performance /<br><br>Outdoor Fabric<br><br>Frottee|"fabricProperties": {  <br>"fiberType": []  <br>}<br><br>**fiberType**<br><br>**Zweck**<br><br>Beschreibt die Materialzusammensetzung bzw. Faserart.<br><br>Das ist wichtig für:<br><br>- KI<br>    <br>- Produktsuche<br>    <br>- Materialbeschreibungen<br>    <br>- Haptikverständnis<br>    <br><br>**Werte**<br><br>cotton<br><br>linen<br><br>polyester<br><br>wool<br><br>silk<br><br>viscose<br><br>acrylic<br><br>nylon<br><br>leather<br><br>recycled_pet<br><br>mixed<br><br>unknown|
|leather|Glattleder / Smooth Leather<br><br>Naturleder / Natural Grain Leather / Full-Grain Leather<br><br>Nubuk/Wildleder / Nubuck / Suede<br><br>Geprägtes Leder / Embossed Leather<br><br>Vintage/Distressed Leder / Distressed Leather / Vintage Leather<br><br>Kunstleder/ Faux Leather / Artificial Leather||
|metal|Steel<br><br>Stainless Steel<br><br>Aluminum<br><br>Brass<br><br>Copper<br><br>Bronze<br><br>Iron<br><br>Chrome<br><br>Gold<br><br>Silver<br><br>Metal Alloy<br><br>Unknown Metal|surfaceTreatment:<br><br>- Raw: unbehandelt<br>    <br><br>- Brushed: gebürstet<br>    <br><br>- Polished: poliert<br>    <br><br>- Hammered: gehämmert<br>    <br><br>- Oxidized: oxidiert<br>    <br><br>- Painted: künstlich gealtert/patiniert<br>    <br><br>- Powder_coated: pulverbeschichtet<br>    <br><br>- Painted: lackiert/beschichtet<br>    <br><br>- Plated: metallisch beschichtet/verchromt<br>    <br><br>- Textured: Künstlich strukturiert<br>    <br><br>- perforated: gelocht/perforiert<br>    <br><br>- mesh: Gitter<br>    <br><br>- unknown<br>    <br><br>finishType:<br><br>- matte: matte Oberfläche<br>    <br><br>- sating: leichter seidiger Glanz<br>    <br><br>- glossy: stark glänzend<br>    <br><br>- reflective: spiegelartig<br>    <br><br>- distressed: used/vintage look<br>    <br><br>- textured: sichtbar strukturierte Oberfläche<br>    <br><br>- unknown|
|Stone|marble<br><br>granite<br><br>travertine<br><br>slate<br><br>limestone<br><br>concrete<br><br>quartzstone<br><br>terrazzo<br><br>artificial_stone<br><br>onyx<br><br>basalt<br><br>quartzite<br><br>sintered_stone<br><br>generic_stone|surfaceTreatment:<br><br>- polished: hochglanzpoliert<br>    <br><br>- honed: matt geschliffen<br>    <br><br>- brushed:gebürstete Struktur<br>    <br><br>- sandblasted: sandgestrahlt<br>    <br><br>- texture:strukturierte Oberfläche<br>    <br><br>- flamed: thermisch aufgeraut<br>    <br><br>- tumbled: weich gealterte Kanten/Oberfläche<br>    <br><br>- raw: unbehandelt/natürlich<br>    <br><br>- sealed: versiegelt<br>    <br><br>- distressed: künstlich gealtert<br>    <br><br>- chiseled: grob bearbeitete Kanten<br>    <br><br>- unknown<br>    <br><br>finishType<br><br>- matte: matte Oberfläche<br>    <br><br>- satin: leichter weicher Glanz<br>    <br><br>- glossy: glänzend<br>    <br><br>- reflective: spiegelartig<br>    <br><br>- textured: sichtbar strukturiert<br>    <br><br>- natural: natürliche rohe Wirkung<br>    <br><br>- distressed: vintage/gealtert<br>    <br><br>- unknown<br>    <br><br>patternType<br><br>- uniform: ruhig/einheitlich<br>    <br><br>- veined: starke Aderung<br>    <br><br>- speckled: gesprenkelt<br>    <br><br>- cloudy: wolkige Struktur<br>    <br><br>- fragmented: terrazzoartige Fragmente<br>    <br><br>- layered:schichtartige Struktur<br>    <br><br>- natural_variation: starke natürliche Variation<br>    <br><br>- unknown|
|Ceramic|keine Details||
|Glass|keine Details||
|plastic|keine Details||
|natural_fiber|·          Rattan: Rattan                  <br><br>·         Wicker: Flechtmaterial / Geflecht<br><br>·         Jute<br><br>·         Bamboo: Bambus                   <br><br>·         Rope Fiber: Seilfaser / Tauwerkfaser <br><br>·         Natural Fiber: Naturfaser            <br><br>·          Unknown Natural Fiber \| Unbekannte Naturfaser     \|||
|**Composite**  <br>Verbundwerkstoffe und laminierte Materialien|keine Details||
|**Cork**  <br>Korkmaterialien|keine Details||
|**Paper**<br><br>Papier- und kartonbasierte Materialien.|keine Details||
|**Foam**  <br>Schaum- und Polstermaterialien.|keine Details|| 

# BeispielJSON

|   |
|---|
|{<br><br>  "material": {<br><br>    "id": "poso_beige_100",<br><br>    "name": "Poso Beige 100",<br><br>    "groupIds": ["poso_cord"],<br><br>    "materialCategories": ["OPTBE"],<br><br>    "physicalSize": {<br><br>     "widthMm": 400,<br><br>     "heightMm": 400<br><br>    },<br><br>    "mapping": {<br><br>     "referenceRepeatMm": 10,<br><br>     "scaleU": 0.25,<br><br>     "scaleV": 0.25,<br><br>     "offsetU": 0,<br><br>     "offsetV": 0,<br><br>     "rotationDeg": 0<br><br>    },<br><br>    "color": {<br><br>      "family": "beige",<br><br>           "dominantColor": {<br><br>           "hex": "#C8BFAE",<br><br>           "rgb": {<br><br>                "r": 0.78,<br><br>                "g": 0.75,<br><br>                "b": 0.68<br><br>                }<br><br>           },<br><br>           "description": "warmes helles Beige"<br><br>    },<br><br>  "visualProperties": {<br><br>       "materialClass": "fabric", //fabric, leather,  wood, metal, glass, stone<br><br>       "materialType": "cord", //cord, velvet, boucle, chenille, oak ,nubuck....<br><br>       "surfaceFinish": "matte", //matte, semi_gloss, glossy<br><br>       "surfaceRelief": "medium", //Wie stark Struktur/Tiefe sichtbar ist. flat, subtle,<br><br>       "patternScale": "medium", //Wie groß wirkt die Struktur? fine, small, medium, large<br><br>       "directionality": "strong", //none, subtle, strong<br><br>       "perceivedSoftness": "soft", //hard, firm, soft, plush<br><br>       "colorVariation": "subtle" //uniform, subtle, medium, strong, multicolor<br><br>       "materialSpecificProperties": { //depending on material<br><br>           },<br><br>       "aiGenerationHints": {<br><br>           "positivePromptTerms": [<br><br>                "warm beige corduroy upholstery",<br><br>                 "matte textile surface",<br><br>                "visible vertical ribs",<br><br>                 "soft fabric texture"<br><br>           ],<br><br>           "negativePromptTerms": [<br><br>                "glossy leather",<br><br>                "smooth plastic",<br><br>                "flat cotton canvas"<br><br>           ],<br><br>           "realismNotes": "The material should show soft, directional ribs typical of corduroy upholstery."<br><br>       },<br><br>       "confidence": {<br><br>           "materialClassConfidence": 0.95,<br><br>           "materialTypeConfidence": 0.85,<br><br>           "visualPropertiesConfidence": 0.8,<br><br>           "needsHumanReview": false<br><br>       }<br><br>     }<br><br>     "availability": {<br><br>           "scope": "basic", //"Catalog"<br><br>           "retailerILN": "1234567890123",<br><br>           "catalogId": null //"CatID"<br><br>     },<br><br>     "shadingModel": "pbrMetallicRoughness", //mirror, glass, unlit<br><br>     "runtimeAssets": [<br><br>       {<br><br>           "id": "unity_hdrp_2022_bundle",<br><br>           "type": "unityAssetBundle",<br><br>           "engine": "unity",<br><br>           "engineVersion": "2022.3",<br><br>           "renderPipeline": "hdrp",<br><br>           "uri": "...",<br><br>           "contains": [<br><br>             "material",<br><br>             "baseColor",<br><br>             "normal",<br><br>             "roughness",<br><br>             "metallic",<br><br>             "ambientOcclusion"<br><br>           ]<br><br>       }<br><br>     ],<br><br>    "baseColor": {<br><br>       defined: true,<br><br>      "averageColor": {<br><br>                "hex": "#C8BFAE",<br><br>                "rgb": {<br><br>                      "r": 0.78,<br><br>                      "g": 0.75,<br><br>                       "b": 0.68<br><br>                 }<br><br>           },<br><br>           "variants": [<br><br>            {<br><br>                "id": "basecolor_1k",<br><br>                "resolution": "1k",<br><br>                 "widthPx": 1024,<br><br>                 "heightPx": 1024,<br><br>             "format": "webp",<br><br>                 "uri": "..."<br><br>             },<br><br>           {<br><br>                 "id": "basecolor_4k",<br><br>                "resolution": "4k",<br><br>                "widthPx": 4096,<br><br>                "heightPx": 4096,<br><br>             "format": "jpg",<br><br>                "uri": "...",<br><br>                "isSource": true<br><br>            },<br><br>      {<br><br>          "id": "basecolor_4k_rgba",<br><br>            "resolution": "4k",<br><br>           "widthPx": 4096,<br><br>           "heightPx": 4096,<br><br>           "format": "png",<br><br>           "containsOpacity": true,<br><br>           "uri": "..."<br><br>     }<br><br>      ],<br><br>         "secondaryMap": {<br><br>           "blendMode": "multiply",<br><br>           "mapping": {<br><br>                  "referenceRepeatMm": 10,<br><br>                  "scaleU": 0.05,<br><br>                  "scaleV": 0.05,<br><br>                  "offsetU": 0,<br><br>                  "offsetV": 0,<br><br>                  "rotationDeg": 0<br><br>           },<br><br>           "strength": 0.7,<br><br>           "variants": [<br><br>             ...<br><br>           ]<br><br>       }<br><br>    },<br><br>    "normal": {<br><br>       defined: true,<br><br>      "strength": 1.0,<br><br>      "variants": [],<br><br>         "secondaryMap": {<br><br>                "blendMode": "multiply",<br><br>                "mapping": {<br><br>                  "referenceRepeatMm": 10,<br><br>                  "scaleU": 0.05,<br><br>                  "scaleV": 0.05,<br><br>                  "offsetU": 0,<br><br>                  "offsetV": 0,<br><br>                  "rotationDeg": 0<br><br>                },<br><br>                "strength": 0.7,<br><br>                "variants": [<br><br>                  ...<br><br>                ]<br><br>             }<br><br>    },<br><br>    "roughness": {<br><br>       defined: true,<br><br>         "averageValue": 0.82,<br><br>      "variants": [],<br><br>       "secondaryMap": {<br><br>           "blendMode": "multiply",<br><br>           "mapping": {<br><br>                  "referenceRepeatMm": 10,<br><br>                 "scaleU": 0.05,<br><br>                  "scaleV": 0.05,<br><br>                "offsetU": 0,<br><br>                "offsetV": 0,<br><br>                "rotationDeg": 0<br><br>           },<br><br>           "variants": [<br><br>             ...<br><br>           ]<br><br>       }<br><br>    },<br><br>    "metallic": {<br><br>       defined: true,<br><br>      "averageValue": 0.0,<br><br>           "variants": []<br><br>    },<br><br>    "ambientOcclusion": {<br><br>       defined: true<br><br>      "variants": [],<br><br>         "secondaryMap": {<br><br>                "blendMode": "multiply",<br><br>                "mapping": {<br><br>                  "referenceRepeatMm": 10,<br><br>                  "scaleU": 0.05,<br><br>                  "scaleV": 0.05,<br><br>                  "offsetU": 0,<br><br>                  "offsetV": 0,<br><br>                  "rotationDeg": 0<br><br>                },<br><br>                "strength": 0.7,<br><br>                "variants": [<br><br>                  ...<br><br>                ]<br><br>             }<br><br>    },<br><br>     "height": {<br><br>       "defined": false,<br><br>       "variants": []<br><br>     },<br><br>     "opacity": {<br><br>       "defined": true,<br><br>       "averageValue": 0.85,<br><br>       "variants": [<br><br>           {<br><br>             "id": "opacity_4k",<br><br>             "widthPx": 4096,<br><br>             "heightPx": 4096,<br><br>             "format": "jpg",<br><br>             "uri": "..."<br><br>           }<br><br>       ]<br><br>     }<br><br>}|