---
title: Batch Session Import
---

# Session Manager: Web Scraping and Batch Import

The Session Manager allows you to scrape content from websites and import it as structured Markdown files. This is particularly useful for events, conferences, workshops, and other structured web content.

## Overview

The Session Manager supports two main functions:
- **Single Import**: Import a single session from a webpage
- **Batch Import**: Bulk import of multiple sessions from an overview page

## Web Scraping Workflow

### 1. Single Session Import

Import a single session from a webpage:

1. **Enter URL**: Enter the URL of the session page
2. **Select Languages**: Choose source and target language
3. **Preview**: Extracted data is displayed
4. **Import**: Confirm the import

**Extracted Data**:
- Session title and description
- Speaker information (name, URL, image)
- Video URLs and transcripts
- Event and track information
- Attachments and additional metadata

### 2. Batch Import from Overview Pages

Import multiple sessions from an event overview page:

1. **Enter Overview URL**: Enter the URL of the event overview page
2. **Select Languages**: Choose source and target language
3. **Load Session List**: System extracts all sessions from the page
4. **Review Sessions**: Review the extracted sessions
5. **Start Batch Import**: Select sessions to import
6. **Monitor Progress**: Track import progress in Event Monitor

## API Templates (Secretary Service)

The Session Manager uses the following Secretary Service templates:

- **`ExtractSessiondataFromWebsite`**: Extracts data from a single session page
- **`ExtractSessionListFromWebsite`**: Extracts a list of sessions from an overview page

## Workflow Details

### Session Extraction

The system automatically extracts:
- **Event Information**: Name, description, date
- **Track Information**: Track name, description
- **Session Details**: Title, description, start/end time
- **Speakers**: Name, URL, image URL
- **Media**: Video URLs, presentation URLs, attachments
- **Transcripts**: Video transcripts (if available)

### Field Priority

Fields are filled with the following priority:
1. **Event**: Global (from list) > Individual (from session page)
2. **Track**: List > Individual (from session page)

### Transformation to Markdown

After extraction, session data is transformed into structured Markdown files:

- **Frontmatter**: YAML frontmatter with all metadata
- **Structure**: Organized sections for title, speakers, description, etc.
- **Links**: Links to original URLs, videos, presentations
- **Transcripts**: Complete video transcripts (if available)

### Storage

Transformed Markdown files are:
- Saved in the selected library
- Organized as "Shadow Twins"
- Made available for search, RAG, and gallery publishing

## Usage for Events

The Session Manager is particularly useful for:

- **Conferences**: Import all talks from a conference website
- **Workshops**: Import workshop sessions
- **Webinars**: Import recorded webinars
- **Events**: Import event sessions with metadata

## Error Handling

- **Error Tolerance**: Individual failed sessions do not stop the entire batch
- **Status Tracking**: Each import job is tracked in the Event Monitor
- **Retry**: Failed jobs can be retried individually

## Best Practices

1. **Before Batch Import**: Test a single import first
2. **URL Format**: Ensure the URL points directly to the session page
3. **Language**: Select the correct source language for better extraction
4. **Review**: Review extracted data before importing
5. **Event Monitor**: Monitor progress in Event Monitor

