const fs = require('fs');
const path = require('path');

// Liste der wirklich erforderlichen Module (ohne optionale/peer dependencies)
const requiredModules = [
  'next',
  'react',
  'react-dom',
  'styled-jsx',
  '@swc/helpers',
  '@next/env',
  'postcss',
  'sharp'
];

// Kopiere die erforderlichen Module in das standalone-Verzeichnis
function copyNextDependencies() {
  console.log('Kopiere Next.js Abhängigkeiten...');
  
  for (const moduleName of requiredModules) {
    const sourceModulePath = path.join(__dirname, '..', 'node_modules', moduleName);
    const targetModulePath = path.join(__dirname, '..', '.next', 'standalone', 'node_modules', moduleName);
    
    if (fs.existsSync(sourceModulePath)) {
      copyModule(moduleName, sourceModulePath, targetModulePath);
    } else {
      console.warn(`⚠️  Modul ${moduleName} nicht gefunden in node_modules`);
    }
  }
  
  console.log('✅ Alle erforderlichen Module kopiert!');
}

// Kopiere ein einzelnes Modul
function copyModule(moduleName, sourcePath, targetPath) {
  console.log(`Kopiere ${moduleName}...`);
  console.log('  Von:', sourcePath);
  console.log('  Nach:', targetPath);
  
  // Erstelle das Zielverzeichnis, falls es nicht existiert
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Kopiere das Verzeichnis rekursiv
  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  
  try {
    copyDir(sourcePath, targetPath);
    console.log(`  ✅ ${moduleName} erfolgreich kopiert!`);
  } catch (error) {
    console.error(`  ❌ Fehler beim Kopieren von ${moduleName}:`, error.message);
  }
}

// Führe das Skript aus
copyNextDependencies(); 