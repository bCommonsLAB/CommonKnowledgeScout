import { NextResponse } from 'next/server';
import { checkEnvVariables } from '@/lib/test-env';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

interface EnvFileInfo {
  exists: boolean;
  path: string;
  lineCount?: number;
  keys?: string[];
  error?: string;
}

/**
 * GET /api/env-test
 * Testet die Umgebungsvariablen und gibt ihren Status zurück
 */
export async function GET() {
  // Versuchen, die .env-Datei explizit zu laden
  dotenv.config();
  
  // Umgebungsvariablen überprüfen
  const envStatus = checkEnvVariables();
  
  // Manuell die .env-Datei Inhalt lesen (ohne Werte preiszugeben)
  let envFileStatus: EnvFileInfo = {
    exists: false,
    path: ''
  };
  
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    envFileStatus.path = envPath;
    
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      
      // Nur die Schlüssel zurückgeben, nicht die Werte
      const envKeys = lines
        .map((line: string) => line.trim())
        .filter((line: string) => !line.startsWith('#') && line.includes('='))
        .map((line: string) => line.split('=')[0]);
      
      envFileStatus = {
        exists: true,
        path: envPath,
        lineCount: lines.length,
        keys: envKeys
      };
    } else {
      envFileStatus = {
        exists: false,
        path: envPath
      };
    }
  } catch (error) {
    console.error('Fehler beim Lesen der .env-Datei:', error);
    envFileStatus = {
      exists: false,
      path: '',
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    };
  }
  
  return NextResponse.json({
    envVariables: {
      // Zeige nur, ob die Variablen definiert sind, nicht ihre Werte
      MONGODB_URI: envStatus.MONGODB_URI !== null ? 'Definiert' : 'Nicht definiert',
      MONGODB_DATABASE_NAME: envStatus.MONGODB_DATABASE_NAME !== null ? 'Definiert' : 'Nicht definiert',
      MONGODB_COLLECTION_NAME: envStatus.MONGODB_COLLECTION_NAME !== null ? 'Definiert' : 'Nicht definiert'
    },
    envFile: envFileStatus,
    processEnv: {
      NODE_ENV: process.env.NODE_ENV,
      nextVersion: process.env.NEXT_RUNTIME || 'unknown'
    }
  });
} 