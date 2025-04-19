/**
 * Hilfsfunktion zum Überprüfen der Umgebungsvariablen
 */
export function checkEnvVariables() {
  const variables = [
    'MONGODB_URI',
    'MONGODB_DATABASE_NAME',
    'MONGODB_COLLECTION_NAME'
  ];

  const results: Record<string, string | null> = {};
  
  variables.forEach(varName => {
    const value = process.env[varName];
    results[varName] = value || null;
    
    // Nur die Existenz loggen, nicht den tatsächlichen Wert (Sicherheit)
    console.log(`ENV CHECK: ${varName} ist ${value ? 'definiert' : 'NICHT definiert'}`);
  });
  
  return results;
} 