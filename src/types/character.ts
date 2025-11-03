/**
 * Zentraler Character-Typ für Chat-Perspektiven.
 * Definiert verschiedene Rollen/Perspektiven, aus denen der Chatbot antworten kann.
 */
export type Character =
  | 'developer'
  | 'technical'
  | 'open-source'
  | 'scientific'
  | 'eco-social'
  | 'social'
  | 'civic'
  | 'policy'
  | 'cultural'
  | 'business'
  | 'entrepreneurial'
  | 'legal'
  | 'educational'
  | 'creative';

/**
 * Cluster-Definition für Filter/Legende.
 * Gruppiert Characters thematisch in drei Hauptbereiche.
 */
export const clusters: Record<string, Character[]> = {
  'Knowledge & Innovation': [
    'developer',
    'technical',
    'open-source',
    'scientific',
  ],
  'Society & Impact': [
    'eco-social',
    'social',
    'civic',
    'policy',
    'cultural',
  ],
  'Economy & Practice': [
    'business',
    'entrepreneurial',
    'legal',
    'educational',
    'creative',
  ],
};

/**
 * Farbzuordnung für Characters (Hintergrund und Border).
 * Knowledge & Innovation → kühle Blau-/Indigo-/Cyan-Töne
 * Society & Impact → grüne/teal/lime Töne (leicht erdig)
 * Economy & Practice → warme Amber/Orange/Rose/Stone Töne
 */
export const characterColors: Record<Character, string> = {
  // Knowledge & Innovation (cool)
  developer: 'bg-blue-50 border-blue-200',
  technical: 'bg-cyan-50 border-cyan-200',
  'open-source': 'bg-sky-50 border-sky-200',
  scientific: 'bg-indigo-50 border-indigo-200',
  // Society & Impact (greens)
  'eco-social': 'bg-green-50 border-green-200',
  social: 'bg-teal-50 border-teal-200',
  civic: 'bg-lime-50 border-lime-200',
  policy: 'bg-emerald-50 border-emerald-200',
  cultural: 'bg-green-50 border-green-200/70', // leicht variiert – bleibt im grünen Spektrum
  // Economy & Practice (warm)
  business: 'bg-amber-50 border-amber-200',
  entrepreneurial: 'bg-orange-50 border-orange-200',
  legal: 'bg-stone-50 border-stone-200', // seriös/warm-neutral
  educational: 'bg-yellow-50 border-yellow-200',
  creative: 'bg-rose-50 border-rose-200',
};

/**
 * Icon-Farbzuordnung für Characters (Hintergrund und Text).
 * Folgt demselben Farbschema wie characterColors, jedoch mit stärkerer Intensität.
 */
export const characterIconColors: Record<Character, string> = {
  // Knowledge & Innovation (cool)
  developer: 'bg-blue-100 text-blue-600',
  technical: 'bg-cyan-100 text-cyan-600',
  'open-source': 'bg-sky-100 text-sky-600',
  scientific: 'bg-indigo-100 text-indigo-600',
  // Society & Impact (greens)
  'eco-social': 'bg-green-100 text-green-600',
  social: 'bg-teal-100 text-teal-600',
  civic: 'bg-lime-100 text-lime-600',
  policy: 'bg-emerald-100 text-emerald-600',
  cultural: 'bg-green-100 text-green-600',
  // Economy & Practice (warm)
  business: 'bg-amber-100 text-amber-600',
  entrepreneurial: 'bg-orange-100 text-orange-600',
  legal: 'bg-stone-100 text-stone-600',
  educational: 'bg-yellow-100 text-yellow-600',
  creative: 'bg-rose-100 text-rose-600',
};

