const fs = require('fs');
const path = require('path');

/**
 * Bereitet das Package für die Veröffentlichung vor
 * - Kopiert Build-Artefakte nach dist/
 * - Kopiert Public-Assets
 * - Erstellt package-spezifische package.json
 * - Bereitet alle nötigen Dateien für das pnpm-Package vor
 */
async function preparePackage() {
  console.log('🔧 Bereite Package für Distribution vor...');
  
  try {
    // 1. Build-Artefakte kopieren
    await copyBuildArtifacts();
    
    // 2. Public-Assets kopieren
    await copyPublicAssets();
    
    // 3. Package-spezifische package.json erstellen
    await createPackageJson();
    
    // 4. Index-Datei für Package-Export erstellen
    await createIndexFile();
    
    // 5. pnpm-spezifische Dateien erstellen
    await createPnpmFiles();
    
    console.log('✅ Package erfolgreich vorbereitet!');
    
    // 6. Build-Artefakte auflisten
    await listBuildArtifacts();
    
  } catch (error) {
    console.error('❌ Fehler beim Vorbereiten des Packages:', error);
    process.exit(1);
  }
}

/**
 * Kopiert Build-Artefakte nach dist/
 */
async function copyBuildArtifacts() {
  const nextPath = path.join(__dirname, '..', '.next');
  const distPath = path.join(__dirname, '..', 'dist');
  
  // Dist-Verzeichnis erstellen oder leeren
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath, { recursive: true });
  
  if (fs.existsSync(nextPath)) {
    copyFolderRecursive(nextPath, path.join(distPath, '.next'));
    console.log('✅ Build-Artefakte nach dist/.next kopiert');
  } else {
    throw new Error('Build nicht gefunden. Bitte zuerst "pnpm build" ausführen.');
  }
}

/**
 * Kopiert Public-Assets nach dist/
 */
async function copyPublicAssets() {
  const publicPath = path.join(__dirname, '..', 'public');
  const distPublicPath = path.join(__dirname, '..', 'dist', 'public');
  
  if (fs.existsSync(publicPath)) {
    copyFolderRecursive(publicPath, distPublicPath);
    console.log('✅ Public-Assets kopiert');
  }
}

/**
 * Erstellt package-spezifische package.json
 */
async function createPackageJson() {
  const mainPackageJson = require('../package.json');
  
  // Nur Production-Dependencies (ohne Electron-spezifische)
  const productionDependencies = Object.fromEntries(
    Object.entries(mainPackageJson.dependencies || {})
      .filter(([key]) => !key.startsWith('electron'))
  );
  
  const packageJson = {
    name: mainPackageJson.name,
    version: mainPackageJson.version,
    description: mainPackageJson.description,
    main: 'index.js',
    packageManager: 'pnpm@9.15.3',
    scripts: {
      start: 'node -r @bcommonslab/common-knowledge-scout',
      dev: 'next dev',
      build: 'next build'
    },
    dependencies: productionDependencies,
    keywords: mainPackageJson.keywords,
    repository: mainPackageJson.repository,
    author: mainPackageJson.author,
    license: mainPackageJson.license,
    publishConfig: {
      registry: 'https://npm.pkg.github.com'
    }
  };
  
  const distPath = path.join(__dirname, '..', 'dist');
  fs.writeFileSync(
    path.join(distPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  console.log('✅ Package-spezifische package.json erstellt');
}

/**
 * Erstellt Index-Datei für Package-Export
 */
async function createIndexFile() {
  const indexContent = `// CommonKnowledgeScout Package Export
const path = require('path');

/**
 * Startet den CommonKnowledgeScout Server
 * @param {Object} options - Konfigurationsoptionen
 * @param {number} options.port - Port für den Server (default: 3000)
 * @param {string} options.hostname - Hostname für den Server (default: 'localhost')
 * @returns {Promise<Object>} Server-Instanz
 */
function startServer(options = {}) {
  const { port = 3000, hostname = 'localhost' } = options;
  
  // Setze Umgebungsvariablen
  process.env.PORT = port.toString();
  process.env.HOSTNAME = hostname;
  
  // Importiere und starte Next.js App
  const nextApp = require('./.next/server/app');
  
  return Promise.resolve({
    port,
    hostname,
    url: \`http://\${hostname}:\${port}\`,
    app: nextApp
  });
}

/**
 * Exportiert die Next.js App für direkte Verwendung
 */
function getApp() {
  return require('./.next/server/app');
}

module.exports = {
  startServer,
  getApp
};
`;
  
  const distPath = path.join(__dirname, '..', 'dist');
  fs.writeFileSync(path.join(distPath, 'index.js'), indexContent);
  
  console.log('✅ Index-Datei für Package-Export erstellt');
}

/**
 * Erstellt pnpm-spezifische Dateien
 */
async function createPnpmFiles() {
  const distPath = path.join(__dirname, '..', 'dist');
  
  // pnpm-workspace.yaml für Package-Kompatibilität
  const pnpmWorkspaceContent = `packages:
  - '.'
`;
  
  fs.writeFileSync(
    path.join(distPath, 'pnpm-workspace.yaml'),
    pnpmWorkspaceContent
  );
  
  // .npmrc für GitHub Packages
  const npmrcContent = `@bcommonslab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
`;
  
  fs.writeFileSync(
    path.join(distPath, '.npmrc'),
    npmrcContent
  );
  
  console.log('✅ pnpm-spezifische Dateien erstellt');
}

/**
 * Listet alle Build-Artefakte auf
 */
async function listBuildArtifacts() {
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (fs.existsSync(distPath)) {
    console.log('\n📁 Build-Artefakte:');
    const files = fs.readdirSync(distPath);
    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        console.log(`   📂 ${file}/`);
      } else {
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   📄 ${file} (${size} MB)`);
      }
    });
  }
}

/**
 * Hilfsfunktion zum rekursiven Kopieren von Ordnern
 * Behandelt Symlinks korrekt für pnpm
 */
function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    const stats = fs.statSync(sourcePath);
    
    if (stats.isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath);
    } else if (stats.isSymbolicLink()) {
      // Symlinks überspringen - pnpm-spezifisch
      console.log(`   ⚠️  Symlink übersprungen: ${file}`);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

// Script ausführen, wenn direkt aufgerufen
if (require.main === module) {
  preparePackage().catch(console.error);
}

module.exports = { preparePackage }; 