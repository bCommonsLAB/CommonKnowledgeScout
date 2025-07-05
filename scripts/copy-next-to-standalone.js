const fs = require('fs');
const path = require('path');

// Liste der Module, die Next.js benötigt
const requiredModules = [
  'next',
  'react',
  'react-dom',
  'styled-jsx',
  '@swc/helpers'
];

// Kopiere die erforderlichen Module in das standalone-Verzeichnis
function copyModulesToStandalone() {
  console.log('Kopiere erforderliche Module...');
  
  for (const moduleName of requiredModules) {
    const sourceModulePath = path.join(__dirname, '..', 'node_modules', moduleName);
    const targetModulePath = path.join(__dirname, '..', '.next', 'standalone', 'node_modules', moduleName);
    
    console.log(`Kopiere ${moduleName}...`);
    console.log('Von:', sourceModulePath);
    console.log('Nach:', targetModulePath);
    
    // Prüfe, ob das Quellmodul existiert
    if (!fs.existsSync(sourceModulePath)) {
      console.warn(`⚠️  Warnung: Modul ${moduleName} nicht gefunden in node_modules`);
      continue;
    }
    
    // Erstelle das Zielverzeichnis, falls es nicht existiert
    const targetDir = path.dirname(targetModulePath);
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
      copyDir(sourceModulePath, targetModulePath);
      console.log(`✅ ${moduleName} erfolgreich kopiert!`);
    } catch (error) {
      console.error(`❌ Fehler beim Kopieren von ${moduleName}:`, error);
      // Nicht beenden, sondern weitermachen mit anderen Modulen
    }
  }
  
  console.log('✅ Alle Module kopiert!');
}

// Führe das Skript aus
copyModulesToStandalone(); 