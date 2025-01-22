
http://127.0.0.1:5001/api/

Processing Service API
 1.0 
[ Base URL: /api ]
/api/swagger.json
API für verschiedene Verarbeitungsdienste

default
Default namespace



GET
/
API Willkommensseite

DELETE
/manage-audio-cache
Löscht Cache-Verzeichnisse für Audio-Verarbeitungen

POST
/process-audio
Audio-Datei verarbeiten
Verarbeitet eine Audio-Datei

Parameters
Try it out
Name	Description
file *
file
(formData)
Audio file (MP3, WAV, or M4A)

Keine ausgewählt
target_language
string
(formData)
Target language (e.g., "en", "de")

Default value : en

en
template
string
(formData)
Vorlage für die Verarbeitung

Default value :

template
Responses
Response content type

application/json
Code	Description
200	
Erfolg

Example Value
Model
{
  "duration": 0,
  "detected_language": "string",
  "output_text": "string",
  "original_text": "string",
  "translated_text": "string",
  "llm_model": "string",
  "translation_model": "string",
  "token_count": 0,
  "segments": [
    {}
  ],
  "process_id": "string",
  "process_dir": "string",
  "args": {}
}
400	
Validierungsfehler

Example Value
Model
{
  "error": "string"
}

POST
/process-image
Bild verarbeiten
Verarbeitet ein Bild und extrahiert Informationen

Parameters
Try it out
Name	Description
file *
file
(formData)
Die zu verarbeitende Datei

Keine ausgewählt
target_language
string
(formData)
Sprache der Audio-Datei

Default value : en

en
template
string
(formData)
Vorlage für die Verarbeitung

Default value :

template
Responses
Response content type

application/json
Code	Description
200	
Erfolg

Example Value
Model
{
  "dimensions": {},
  "format": "string",
  "metadata": {},
  "process_id": "string"
}
400	
Validierungsfehler

Example Value
Model
{
  "error": "string"
}

POST
/process-pdf
Verarbeitet eine PDF-Datei und extrahiert Informationen

Parameters
Try it out
Name	Description
file *
file
(formData)
Die zu verarbeitende Datei

Keine ausgewählt
target_language
string
(formData)
Sprache der Audio-Datei

Default value : en

en
template
string
(formData)
Vorlage für die Verarbeitung

Default value :

template
Responses
Response content type

application/json
Code	Description
200	
Erfolg

Example Value
Model
{
  "page_count": 0,
  "text_content": "string",
  "metadata": {},
  "process_id": "string"
}
400	
Validierungsfehler

Example Value
Model
{
  "error": "string"
}

POST
/process-youtube
Verarbeitet ein Youtube-Video
Parameters
Try it out
Name	Description
payload *
object
(body)
Example Value
Model
{
  "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "target_language": "de",
  "template": "Youtube"
}
Parameter content type

application/json
Responses
Response content type

application/json
Code	Description
200	
Success


POST
/transform-template
Text mit Template transformieren
Parameters
Try it out
Name	Description
payload *
object
(body)
Example Value
Model
{
  "text": "string",
  "target_language": "de",
  "template": "string",
  "context": "string"
}
Parameter content type

application/json
Responses
Response content type

application/json
Code	Description
200	
Erfolg

Example Value
Model
{
  "text": "string",
  "source_text": "string",
  "template_used": "string",
  "translation_model": "string",
  "token_count": 0,
  "structured_data": {},
  "process_id": "string"
}

POST
/transform-text
Text transformieren
Parameters
Try it out
Name	Description
payload *
object
(body)
Example Value
Model
{
  "text": "string",
  "source_language": "en",
  "target_language": "en",
  "summarize": false,
  "target_format": "text"
}
Parameter content type

application/json
Responses
Response content type

application/json
Code	Description
200	
Erfolg

Example Value
Model
{
  "text": "string",
  "source_text": "string",
  "translation_model": "string",
  "token_count": 0,
  "format": "string",
  "process_id": "string"
}

Models