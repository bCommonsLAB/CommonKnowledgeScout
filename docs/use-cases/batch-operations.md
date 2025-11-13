# Batch Operations

## What is achieved?

Process multiple files simultaneously for transformation, transcription, or ingestion. Save time by handling multiple operations in parallel.

## Prerequisites

- Active library selected
- Multiple files available in Library Browser

## Steps

1. Open the **Library** view
2. Navigate to the folder containing files
3. Select multiple files:
   - Use checkboxes to select individual files
   - Or select all files in a folder
4. Choose the operation:
   - **Transformation**: Transform PDFs to Markdown
   - **Transcription**: Transcribe audio/video files
   - **Ingestion**: Ingest documents into RAG system
5. Configure options:
   - Select **target language**
   - Choose **template** (if applicable)
   - Set processing options
6. Click **"Start Batch Processing"**
7. Monitor progress:
   - View overall progress bar
   - See individual file status
   - Check success/failure counts
8. Review results:
   - Successful transformations appear as Shadow Twins
   - Failed files show error messages
   - Retry failed operations if needed

## Result

Multiple files are processed in parallel. Results appear as they complete, with success/failure status for each file.

## Tips

- Batch operations run in the background
- You can continue working while processing
- Failed files can be retried individually
- Progress is saved - you can refresh without losing state
- Large batches may take time - be patient

## Further Information

- [Transform Service Documentation](../reference/file-index.md#transform--processing)
- [PDF Transformation](file-transformation-pdf.md) for single files
- [Media Transformation](file-transformation-media.md) for single files








