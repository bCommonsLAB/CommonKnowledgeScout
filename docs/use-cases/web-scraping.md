# Web Scraping & Event Import

## What is achieved?

Scrape web content and import event data (conferences, workshops, talks) into your library. Extract structured data from web pages, convert them to Markdown format, and organize them by events and tracks.

## Prerequisites

- Active library selected
- Event Monitor access
- Event URL or web page with structured content

## Steps

1. Navigate to **Event Monitor** page
2. Click **"Create Track"** to start a new batch
3. Enter event information:
   - **Event Name**: Name of the event/conference
   - **Track Name**: Track or session category
   - **Source URL**: URL of the web page to scrape
4. Configure scraping options:
   - Select **target language** for transformation
   - Choose **template** for structured output (optional)
5. Start the scraping process
6. Monitor progress in the Event Monitor:
   - View job status (pending, running, completed, failed)
   - Filter by event name
   - Check individual job details
7. After completion: Sessions are transformed to Markdown files in your library

## Result

Event sessions are imported as structured Markdown files organized by event and track. Each session contains metadata, transcripts (if available), and associated media files.

## Tips

- Use the Event Filter to focus on specific events
- Batch operations allow processing multiple tracks simultaneously
- Failed jobs can be retried individually
- Archive completed batches for organization

## Further Information

- [Event Job System Documentation](../reference/file-index.md#event-job-system)
- [Batch Operations](batch-operations.md) for multiple files















