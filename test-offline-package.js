#!/usr/bin/env node

/**
 * Test-Script für das Offline-Package
 * Prüft, ob das Package ohne Clerk-Abhängigkeiten funktioniert
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Teste Offline-Package...\n');

// Prüfe, ob das Offline-Package existiert
const offlinePath = path.join(__dirname, 'dist', 'offline');
if (!fs.existsSync(offlinePath)) {
  console.error('❌ Offline-Package nicht gefunden. Bitte zuerst "pnpm run build:package" ausführen.');
  process.exit(1);
}

// Prüfe package.json des Offline-Packages
const offlinePackageJsonPath = path.join(offlinePath, 'package.json');
if (!fs.existsSync(offlinePackageJsonPath)) {
  console.error('❌ package.json im Offline-Package nicht gefunden.');
  process.exit(1);
}

const offlinePackageJson = JSON.parse(fs.readFileSync(offlinePackageJsonPath, 'utf8'));

console.log('📦 Offline-Package Details:');
console.log(`   Name: ${offlinePackageJson.name}`);
console.log(`   Version: ${offlinePackageJson.version}`);
console.log(`   Beschreibung: ${offlinePackageJson.description}`);

// Prüfe, ob Clerk-Abhängigkeiten entfernt wurden
const hasClerkDependencies = Object.keys(offlinePackageJson.dependencies || {})
  .some(dep => dep.startsWith('@clerk'));

if (hasClerkDependencies) {
  console.error('❌ Clerk-Abhängigkeiten wurden nicht entfernt!');
  console.log('   Gefundene Clerk-Abhängigkeiten:');
  Object.keys(offlinePackageJson.dependencies || {})
    .filter(dep => dep.startsWith('@clerk'))
    .forEach(dep => console.log(`   - ${dep}`));
  process.exit(1);
} else {
  console.log('✅ Keine Clerk-Abhängigkeiten gefunden');
}

// Prüfe, ob wichtige Dateien vorhanden sind
const requiredFiles = [
  'index.js',
  'README.md',
  '.next/server/app',
  'public'
];

console.log('\n📁 Prüfe erforderliche Dateien:');
let allFilesPresent = true;

requiredFiles.forEach(file => {
  const filePath = path.join(offlinePath, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - nicht gefunden`);
    allFilesPresent = false;
  }
});

if (!allFilesPresent) {
  console.error('\n❌ Nicht alle erforderlichen Dateien sind vorhanden.');
  process.exit(1);
}

// Prüfe, ob Auth-Abstraktionsschicht vorhanden ist
const authFiles = [
  'lib/auth/types.js',
  'lib/auth/mock.jsx',
  'lib/auth/server.js',
  'lib/auth/client.jsx'
];

console.log('\n🔐 Prüfe Auth-Abstraktionsschicht:');
let allAuthFilesPresent = true;

authFiles.forEach(file => {
  const filePath = path.join(offlinePath, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - nicht gefunden`);
    allAuthFilesPresent = false;
  }
});

if (!allAuthFilesPresent) {
  console.error('\n❌ Auth-Abstraktionsschicht ist unvollständig.');
  process.exit(1);
}

// Prüfe Package-Größe
const getDirectorySize = (dirPath) => {
  let totalSize = 0;
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      totalSize += getDirectorySize(filePath);
    } else {
      totalSize += stats.size;
    }
  });
  
  return totalSize;
};

const packageSize = getDirectorySize(offlinePath);
const packageSizeMB = (packageSize / (1024 * 1024)).toFixed(2);

console.log(`\n📊 Package-Größe: ${packageSizeMB} MB`);

// Prüfe Dependencies-Anzahl
const dependencyCount = Object.keys(offlinePackageJson.dependencies || {}).length;
console.log(`📦 Anzahl Dependencies: ${dependencyCount}`);

// Simuliere Package-Installation
console.log('\n🔧 Simuliere Package-Installation...');

try {
  // Prüfe, ob das Package gültig ist
  const { startServer } = require(path.join(offlinePath, 'index.js'));
  
  if (typeof startServer === 'function') {
    console.log('✅ startServer-Funktion ist verfügbar');
  } else {
    console.error('❌ startServer-Funktion ist nicht verfügbar');
    process.exit(1);
  }
  
  console.log('✅ Package-Export ist gültig');
  
} catch (error) {
  console.error('❌ Fehler beim Laden des Package-Exports:', error.message);
  process.exit(1);
}

// Erfolgreicher Test
console.log('\n🎉 Offline-Package-Test erfolgreich!');
console.log('\n📋 Zusammenfassung:');
console.log('   ✅ Keine Clerk-Abhängigkeiten');
console.log('   ✅ Alle erforderlichen Dateien vorhanden');
console.log('   ✅ Auth-Abstraktionsschicht vollständig');
console.log('   ✅ Package-Export funktioniert');
console.log(`   ✅ Package-Größe: ${packageSizeMB} MB`);
console.log(`   ✅ Dependencies: ${dependencyCount}`);

console.log('\n🚀 Das Offline-Package ist bereit für die Veröffentlichung!');
console.log('\n💡 Verwendung:');
console.log('   npm install @bcommonslab/common-knowledge-scout-offline');
console.log('   const { startServer } = require("@bcommonslab/common-knowledge-scout-offline");');
console.log('   startServer({ authMode: "offline" });'); 