/**
 * @fileoverview Structured Output Schemas für LLM-Chat
 * 
 * @description
 * Manuelle JSON Schema Draft-07 Definitionen für strukturierte LLM-Ausgaben.
 * Diese Schemas werden an den Secretary Transformer übergeben, um deterministische JSON-Ausgaben zu garantieren.
 * 
 * @module chat
 * 
 * @exports
 * - chatAnswerSchemaJson: JSON Schema für Chat-Antworten (answer, suggestedQuestions, usedReferences)
 * - chatAnswerZodSchema: Zod Schema für Validierung
 * - storyTopicsSchemaJson: JSON Schema für TOC/StoryTopicsData
 * - storyTopicsZodSchema: Zod Schema für Validierung
 * - questionAnalysisSchemaJson: JSON Schema für Question Analysis
 * - questionAnalysisZodSchema: Zod Schema für Validierung
 */

import * as z from 'zod'

/**
 * Zod Schema für Chat-Antworten
 */
export const chatAnswerZodSchema = z.object({
  answer: z.string().min(1),
  suggestedQuestions: z.array(z.string()).length(7),
  usedReferences: z.array(z.number().int().positive()),
})

/**
 * JSON Schema Draft-07 für Chat-Antworten
 * 
 * Struktur:
 * - answer: Markdown-formatieter Text mit Referenzen [1], [2], etc.
 * - suggestedQuestions: Array mit genau 7 Follow-up-Fragen
 * - usedReferences: Array von Referenznummern (positive integers)
 */
export const chatAnswerSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['answer', 'suggestedQuestions', 'usedReferences'],
  properties: {
    answer: {
      type: 'string',
      description: 'Markdown-formatted text with reference numbers [1], [2], etc.',
    },
    suggestedQuestions: {
      type: 'array',
      minItems: 7,
      maxItems: 7,
      items: {
        type: 'string',
      },
      description: 'Array with exactly 7 meaningful follow-up questions based on the context covered',
    },
    usedReferences: {
      type: 'array',
      items: {
        type: 'integer',
        minimum: 1,
      },
      description: 'Array of numbers containing the reference numbers of all sources actually used in the answer',
    },
  },
  additionalProperties: false,
})

/**
 * Zod Schema für StoryTopicsData (TOC)
 */
export const storyTopicsZodSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  intro: z.string(),
  topics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string().optional(),
      questions: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          intent: z.enum(['what', 'why', 'how', 'compare', 'recommend']).optional(),
          retriever: z.enum(['summary', 'chunk', 'auto']).optional(),
        })
      ).min(1),
    })
  ).min(1),
})

/**
 * JSON Schema Draft-07 für StoryTopicsData (TOC)
 */
export const storyTopicsSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'title', 'tagline', 'intro', 'topics'],
  properties: {
    id: {
      type: 'string',
      description: 'Unique library ID',
    },
    title: {
      type: 'string',
      description: 'Short title for topic overview',
    },
    tagline: {
      type: 'string',
      description: 'Short, concise tagline',
    },
    intro: {
      type: 'string',
      description: 'Introductory text describing how the topic overview is structured',
    },
    topics: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'title', 'questions'],
        properties: {
          id: {
            type: 'string',
            pattern: '^topic-\\d+$',
            description: 'Unique topic ID (e.g., "topic-1", "topic-2")',
          },
          title: {
            type: 'string',
            description: 'Title of the topic',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of the topic (max. 200 characters)',
          },
          questions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'text'],
              properties: {
                id: {
                  type: 'string',
                  pattern: '^q-\\d+-\\d+$',
                  description: 'Unique question ID (e.g., "q-1-1", "q-1-2")',
                },
                text: {
                  type: 'string',
                  description: 'Concrete question about this topic',
                },
                intent: {
                  type: 'string',
                  enum: ['what', 'why', 'how', 'compare', 'recommend'],
                  description: 'Question intent (optional)',
                },
                retriever: {
                  type: 'string',
                  enum: ['summary', 'chunk', 'auto'],
                  description: 'Recommended retriever mode (optional, default: "auto")',
                },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
})

/**
 * Zod Schema für Question Analysis
 */
export const questionAnalysisZodSchema = z.object({
  recommendation: z.enum(['chunk', 'summary', 'unclear']),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().min(10),
  suggestedQuestionChunk: z.string().nullish(),
  suggestedQuestionSummary: z.string().nullish(),
  explanation: z.string().min(20),
  chatTitle: z.string().optional(),
})

/**
 * JSON Schema Draft-07 für Question Analysis
 */
export const questionAnalysisSchemaJson = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['recommendation', 'confidence', 'reasoning', 'explanation'],
  properties: {
    recommendation: {
      type: 'string',
      enum: ['chunk', 'summary', 'unclear'],
      description: 'Recommended retriever mode or "unclear" if question is ambiguous',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Confidence level of the recommendation',
    },
    reasoning: {
      type: 'string',
      minLength: 10,
      description: 'Justification for the recommendation (for internal analysis)',
    },
    suggestedQuestionChunk: {
      type: 'string',
      description: 'Refined question for Chunk mode (only if recommendation="unclear")',
    },
    suggestedQuestionSummary: {
      type: 'string',
      description: 'Refined question for Summary mode (only if recommendation="unclear")',
    },
    explanation: {
      type: 'string',
      minLength: 20,
      description: 'User-friendly explanation why this mode is recommended or what is unclear',
    },
    chatTitle: {
      type: 'string',
      maxLength: 60,
      description: 'Concise chat title based on the question (max. 60 characters)',
    },
  },
  additionalProperties: false,
})

