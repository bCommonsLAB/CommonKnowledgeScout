# PDF Transformation

## What is achieved?

Transform PDF files into structured Markdown documents. Text, images, and structure are extracted and saved as a searchable Markdown file.

## Prerequisites

- Active library selected
- PDF file available in Library Browser

## Steps

1. Open the **Library** view
2. Navigate to the folder containing the PDF file
3. Select the PDF file (single file or multiple for batch processing)
4. Click the **Transformation icon** or use the context menu
5. In the transformation dialog:
   - Select the **target language** for transformation
   - Optional: Choose a **template** for structured output
   - Optional: Enable **"Extract images"** for image archive
6. Click **"Start Transformation"**
7. Monitor progress in the dialog
8. After completion: The transformed Markdown file (Shadow Twin) appears next to the original

## Result

A new Markdown file named `[OriginalName].md` is created. It contains the extracted text, metadata in frontmatter, and optionally images in a separate folder.

## Tips

- Shadow Twins are automatically linked with the original
- Transformation runs in the background - you can continue working
- Errors are displayed in an error message

## Further Information

- [Transform Service Documentation](../reference/file-index.md#transform--processing)
- [Batch Operations](batch-operations.md) for multiple files
