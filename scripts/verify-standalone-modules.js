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

// Prüfe, ob alle erforderlichen Module im standalone-Verzeichnis vorhanden sind
function verifyStandaloneModules() {
  console.log('Prüfe Module im standalone-Verzeichnis...');
  
  const standalonePath = path.join(__dirname, '..', '.next', 'standalone');
  const nodeModulesPath = path.join(standalonePath, 'node_modules');
  
  console.log('Standalone-Pfad:', standalonePath);
  console.log('Node modules Pfad:', nodeModulesPath);
  
  if (!fs.existsSync(standalonePath)) {
    console.error('❌ Standalone-Verzeichnis existiert nicht!');
    process.exit(1);
  }
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ node_modules Verzeichnis im standalone-Build existiert nicht!');
    process.exit(1);
  }
  
  let allModulesPresent = true;
  
  for (const moduleName of requiredModules) {
    const modulePath = path.join(nodeModulesPath, moduleName);
    const packageJsonPath = path.join(modulePath, 'package.json');
    
    console.log(`Prüfe ${moduleName}...`);
    console.log('  Pfad:', modulePath);
    
    if (fs.existsSync(modulePath) && fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        console.log(`  ✅ ${moduleName} gefunden (Version: ${packageJson.version})`);
      } catch (error) {
        console.error(`  ❌ Fehler beim Lesen package.json von ${moduleName}:`, error.message);
        allModulesPresent = false;
      }
    } else {
      console.error(`  ❌ ${moduleName} nicht gefunden!`);
      allModulesPresent = false;
    }
  }
  
  // Zeige alle verfügbaren Module an
  console.log('\nVerfügbare Module im standalone/node_modules:');
  try {
    const modules = fs.readdirSync(nodeModulesPath);
    modules.forEach(module => {
      const modulePath = path.join(nodeModulesPath, module);
      const stats = fs.statSync(modulePath);
      console.log(`  ${module} (${stats.isDirectory() ? 'Verzeichnis' : 'Datei'})`);
    });
  } catch (error) {
    console.error('Fehler beim Lesen der Module:', error.message);
  }
  
  if (allModulesPresent) {
    console.log('\n✅ Alle erforderlichen Module sind vorhanden!');
  } else {
    console.error('\n❌ Nicht alle erforderlichen Module sind vorhanden!');
    process.exit(1);
  }
}

// Führe das Skript aus
verifyStandaloneModules(); 