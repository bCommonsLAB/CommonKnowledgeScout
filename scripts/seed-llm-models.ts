/**
 * Seed-Script für initiale LLM-Modell-Konfigurationen
 * 
 * Führt die Modelle in MongoDB ein:
 * - google/gemini-2.5-flash
 * - x-ai/grok-4-fast
 * - openai/gpt-oss-120b
 * - mistralai/mistral-small-3.2-24b-instruct
 * - deepseek/deepseek-v3.2
 * - openai/gpt-5.2
 * - anthropic/claude-3-haiku
 * 
 * Usage: pnpm tsx scripts/seed-llm-models.ts
 */

import { connectToDatabase } from '../src/lib/mongodb-service'
import type { TargetLanguage } from '../src/lib/chat/constants'

interface LlmModel {
  _id: string
  name: string
  provider: string
  modelId: string
  supportedLanguages: TargetLanguage[]
  strengths: string
  url?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}

const models: LlmModel[] = [
  {
    _id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    modelId: 'google/gemini-2.5-flash',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Schnell, kostengünstig, gut für einfache Fragen',
    url: 'https://openrouter.ai/models/google/gemini-2.5-flash',
    isActive: true,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'x-ai',
    modelId: 'x-ai/grok-4-fast',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Sehr schnell, optimiert für schnelle Antworten',
    url: 'https://openrouter.ai/models/x-ai/grok-4-fast',
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    provider: 'openai',
    modelId: 'openai/gpt-oss-120b',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Großes Modell mit hoher Qualität, gut für komplexe Fragen',
    url: 'https://openrouter.ai/models/openai/gpt-oss-120b',
    isActive: true,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'mistralai/mistral-small-3.2-24b-instruct',
    name: 'Mistral Small 3.2 24B Instruct',
    provider: 'mistralai',
    modelId: 'mistralai/mistral-small-3.2-24b-instruct',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Ausgewogenes Verhältnis zwischen Geschwindigkeit und Qualität',
    url: 'https://openrouter.ai/models/mistralai/mistral-small-3.2-24b-instruct',
    isActive: true,
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    modelId: 'deepseek/deepseek-v3.2',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Sehr gute Qualität, besonders für technische Fragen',
    url: 'https://openrouter.ai/models/deepseek/deepseek-v3.2',
    isActive: true,
    order: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'openai/gpt-5.2',
    name: 'GPT 5.2',
    provider: 'openai',
    modelId: 'openai/gpt-5.2',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Höchste Qualität, ideal für komplexe und anspruchsvolle Fragen',
    url: 'https://openrouter.ai/models/openai/gpt-5.2',
    isActive: true,
    order: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    modelId: 'anthropic/claude-3-haiku',
    supportedLanguages: [
      'global', 'de', 'en', 'it', 'fr', 'es', 'pt', 'nl', 'no', 'da', 'sv', 'fi',
      'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'tr', 'ru', 'uk', 'zh', 'ko', 'ja',
      'hr', 'sr', 'bs', 'sl', 'sk', 'lt', 'lv', 'et', 'id', 'ms', 'hi', 'sw', 'yo', 'zu'
    ],
    strengths: 'Schnell und kostengünstig, gut für einfache bis mittlere Fragen',
    url: 'https://openrouter.ai/models/anthropic/claude-3-haiku',
    isActive: true,
    order: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

async function seedLlmModels() {
  try {
    console.log('Verbinde mit MongoDB...')
    const db = await connectToDatabase()
    const collection = db.collection<LlmModel>('llm_models')
    
    console.log('Seede LLM-Modelle...')
    for (const model of models) {
      await collection.updateOne(
        { _id: model._id },
        { $set: model },
        { upsert: true }
      )
      console.log(`✓ ${model.name} (${model.modelId})`)
    }
    
    console.log(`\n✅ ${models.length} Modelle erfolgreich gespeichert!`)
    process.exit(0)
  } catch (error) {
    console.error('Fehler beim Seeden:', error)
    process.exit(1)
  }
}

seedLlmModels()










