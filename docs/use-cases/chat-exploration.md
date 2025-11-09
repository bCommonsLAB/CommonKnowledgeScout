# Chat & Story Mode

## What is achieved?

Explore your knowledge base using natural language queries. The Chat interface uses RAG (Retrieval-Augmented Generation) to find relevant content and generate answers based on your library's documents.

## Prerequisites

- Active library selected
- Documents transformed and ingested into the library

## Steps

1. Open the **Library** view
2. Click the **Chat** icon or open the chat panel
3. Configure chat settings (optional):
   - **Answer Length**: Short, medium, or long answers
   - **Retriever**: Chunk-based or summary-based retrieval
   - **Target Language**: Language for responses
   - **Character**: Perspective for answers (e.g., expert, beginner)
   - **Social Context**: Context for answer generation
4. Type your question in the chat input
5. The system will:
   - Analyze your question
   - Retrieve relevant documents
   - Generate an answer based on your library content
   - Display sources used for the answer
6. Continue the conversation with follow-up questions
7. Use **Story Mode** for narrative-style exploration

## Result

You receive answers based on your library's content with source citations. The chat history is saved for future reference.

## Tips

- Use specific questions for better results
- Check source citations to verify information
- Story Mode provides narrative-style exploration
- Chat history is saved automatically
- Filter by facets/metadata for focused queries

## Further Information

- [Chat System Documentation](../reference/modules/chat.md)
- [Chat Orchestration](../reference/file-index.md#chat-system)

