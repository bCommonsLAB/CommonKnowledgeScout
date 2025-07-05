#!/usr/bin/env node

/**
 * Script zum automatischen Kopieren von .next/standalone nach standalone/
 * und von node_modules nach standalone/node_modules
 * 
 * Dieses Script wird nach dem Next.js Build ausgeführt (postbuild hook)
 * und stellt sicher, dass alle notwendigen Dependencies im standalone/ Ordner verfügbar sind.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starte Build-Prozess für Electron-App...');

// Pfade definieren
const standaloneDir = path.join(__dirname, '..', 'standalone');
const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
const standaloneNodeModulesDir = path.join(standaloneDir, 'node_modules');

// Funktion zum sicheren Löschen eines Verzeichnisses
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`🗑️  Lösche Verzeichnis: ${dirPath}`);
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`❌ Fehler beim Löschen von ${dirPath}:`, error.message);
    }
  }
}

// Funktion zum sicheren Erstellen eines Verzeichnisses
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`📁 Erstelle Verzeichnis: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Schritt 1: Standalone-Verzeichnis vorbereiten
console.log('\n📋 Schritt 1: Bereite Standalone-Verzeichnis vor...');
removeDirectory(standaloneDir);
ensureDirectory(standaloneDir);

// Schritt 2: .next/standalone in standalone/ kopieren
console.log('\n📋 Schritt 2: Kopiere .next/standalone...');
const nextStandaloneDir = path.join(__dirname, '..', '.next', 'standalone');
if (fs.existsSync(nextStandaloneDir)) {
  try {
    console.log('📁 Kopiere .next/standalone nach standalone/...');
    execSync(`xcopy "${nextStandaloneDir}" "${standaloneDir}" /E /I /Y`, { stdio: 'inherit' });
    console.log('✅ .next/standalone erfolgreich kopiert!');
  } catch (error) {
    console.error('❌ Fehler beim Kopieren von .next/standalone:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ .next/standalone Verzeichnis nicht gefunden!');
  console.log('💡 Stelle sicher, dass "npm run build" erfolgreich ausgeführt wurde.');
  process.exit(1);
}

// Schritt 3: Nur notwendige Module kopieren
console.log('\n📋 Schritt 3: Kopiere nur notwendige node_modules...');
ensureDirectory(standaloneNodeModulesDir);

// Liste der notwendigen Module (nur die wichtigsten)
const essentialModules = [
  'next',
  '@next',
  'react',
  'react-dom',
  'mongodb',
  'zod',
  'jotai',
  'lucide-react',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'tailwindcss-animate',
  '@radix-ui',
  '@hookform',
  'react-hook-form',
  'date-fns',
  'uuid',
  'lodash',
  'mime-types',
  'jszip',
  'electron-log'
];

console.log('📦 Kopiere nur essentielle Module:');
essentialModules.forEach(module => {
  const sourceModule = path.join(nodeModulesDir, module);
  const targetModule = path.join(standaloneNodeModulesDir, module);
  
  if (fs.existsSync(sourceModule)) {
    try {
      console.log(`  📁 Kopiere ${module}...`);
      execSync(`xcopy "${sourceModule}" "${targetModule}" /E /I /Y`, { stdio: 'pipe' });
    } catch (error) {
      console.log(`  ⚠️  Warnung: Konnte ${module} nicht kopieren: ${error.message}`);
    }
  } else {
    console.log(`  ⚠️  Warnung: Modul ${module} nicht gefunden`);
  }
});

// Schritt 4: package.json für standalone erstellen
console.log('\n📋 Schritt 4: Erstelle package.json für standalone...');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const standalonePackageJsonPath = path.join(standaloneDir, 'package.json');

if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Erstelle eine minimale package.json für standalone
    const standalonePackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: 'server.js',
      dependencies: {}
    };
    
    // Füge nur die notwendigen Dependencies hinzu
    essentialModules.forEach(module => {
      if (packageJson.dependencies && packageJson.dependencies[module]) {
        standalonePackageJson.dependencies[module] = packageJson.dependencies[module];
      }
    });
    
    fs.writeFileSync(standalonePackageJsonPath, JSON.stringify(standalonePackageJson, null, 2));
    console.log('✅ package.json für standalone erstellt!');
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der package.json:', error.message);
  }
}

console.log('\n🚀 Build-Prozess abgeschlossen. Electron-App kann jetzt gebaut werden.');
console.log('📁 Standalone-Verzeichnis erstellt mit minimalen node_modules.'); 