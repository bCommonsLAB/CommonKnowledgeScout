const fs = require('fs');
const path = require('path');

/**
 * Bereitet das reine Offline-Package für die Veröffentlichung vor
 * - Kopiert Build-Artefakte nach dist/
 * - Kopiert Public-Assets
 * - Erstellt package-spezifische package.json (ohne Clerk)
 * - Bereitet alle nötigen Dateien für das pnpm-Package vor
 * - Nur Offline-Modus, keine Clerk-Option
 */
async function preparePackage() {
  console.log('🔧 Bereite reines Offline-Package für Distribution vor...');
  
  try {
    console.log('📁 Schritt 1: Build-Artefakte kopieren...');
    await copyBuildArtifacts();
    
    console.log('📁 Schritt 2: Public-Assets kopieren...');
    await copyPublicAssets();
    
    console.log('📁 Schritt 3: Package-spezifische package.json erstellen...');
    await createPackageJson();
    
    console.log('📁 Schritt 4: Index-Datei für Package-Export erstellen...');
    await createIndexFile();
    
    console.log('📁 Schritt 5: pnpm-spezifische Dateien erstellen...');
    await createPnpmFiles();
    
    console.log('✅ Offline-Package erfolgreich vorbereitet!');
    
    console.log('📁 Schritt 6: Build-Artefakte auflisten...');
    await listBuildArtifacts();
    
  } catch (error) {
    console.error('❌ Fehler beim Vorbereiten des Packages:', error);
    console.error('Stack Trace:', error.stack);
    process.exit(1);
  }
}

/**
 * Kopiert Build-Artefakte nach dist/
 */
async function copyBuildArtifacts() {
  const nextPath = path.join(__dirname, '..', '.next');
  const standalonePath = path.join(__dirname, '..', '.next', 'standalone');
  const distPath = path.join(__dirname, '..', 'dist');
  
  // Dist-Verzeichnis erstellen oder leeren
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath, { recursive: true });
  
  // Prüfe ob Standalone-Build existiert
  if (fs.existsSync(standalonePath)) {
    // Kopiere Standalone-Build (enthält server.js)
    copyFolderRecursive(standalonePath, distPath);
    console.log('✅ Standalone-Build nach dist/ kopiert');
  } else if (fs.existsSync(nextPath)) {
    // Fallback: Normales Next.js Build
    copyFolderRecursive(nextPath, path.join(distPath, '.next'));
    console.log('✅ Build-Artefakte nach dist/.next kopiert (kein Standalone)');
  } else {
    throw new Error('Build nicht gefunden. Bitte zuerst "pnpm build:package" ausführen.');
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
 * Erstellt package-spezifische package.json (ohne Clerk)
 */
async function createPackageJson() {
  const mainPackageJson = require('../package.json');
  
  // Nur Production-Dependencies, ohne Clerk
  const productionDependencies = Object.fromEntries(
    Object.entries(mainPackageJson.dependencies || {})
      .filter(([key]) =>
        !key.startsWith('electron') &&
        !key.startsWith('@clerk') &&
        !key.startsWith('clerk')
      )
  );
  
  const packageJson = {
    name: mainPackageJson.name + '-offline',
    version: mainPackageJson.version,
    description: mainPackageJson.description + ' (Nur Offline-Modus, keine Clerk-Abhängigkeiten)',
    main: 'index.js',
    packageManager: 'pnpm@9.15.3',
    scripts: {
      start: 'node index.js',
      dev: 'next dev',
      build: 'next build'
    },
    dependencies: productionDependencies,
    keywords: [...mainPackageJson.keywords, 'offline', 'no-auth'],
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
  
  console.log('✅ Package-spezifische package.json (ohne Clerk) erstellt');
}

/**
 * Erstellt Index-Datei für Package-Export (nur Offline-Modus)
 */
async function createIndexFile() {
  const indexContent = `// CommonKnowledgeScout Offline-Package Export\nconst path = require('path');\nconst { createServer } = require('http');\nconst next = require('next');\n\n/**\n * Startet den CommonKnowledgeScout Server im Offline-Modus\n * @param {Object} options - Konfigurationsoptionen\n * @param {number} options.port - Port für den Server (default: 3000)\n * @param {string} options.hostname - Hostname für den Server (default: 'localhost')\n * @param {boolean} options.dev - Entwicklungsmodus (default: false)\n * @returns {Promise<Object>} Server-Instanz\n */\nasync function startServer(options = {}) {\n  const { \n    port = 3000, \n    hostname = 'localhost', \n    dev = false\n  } = options;\n  \n  // Setze Umgebungsvariablen\n  process.env.PORT = port.toString();\n  process.env.HOSTNAME = hostname;\n  process.env.NEXT_PUBLIC_AUTH_MODE = 'offline';\n  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'dummy_pk_test_placeholder';\n  process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';\n  \n  try {\n    // Erstelle Next.js App\n    const app = next({ \n      dev,\n      dir: __dirname,\n      conf: {\n        distDir: '.next'\n      }\n    });\n    \n    await app.prepare();\n    \n    // Erstelle HTTP Server\n    const server = createServer(app.getRequestHandler());\n    \n    return new Promise((resolve, reject) => {\n      server.listen(port, hostname, (err) => {\n        if (err) {\n          reject(err);\n          return;\n        }\n        \n        resolve({\n          port,\n          hostname,\n          url: \`http://\${hostname}:\${port}\`,\n          server,\n          app,\n          authMode: 'offline'\n        });\n      });\n    });\n  } catch (error) {\n    throw new Error(\`Fehler beim Starten des Servers: \${error.message}\`);\n  }\n}\n\nmodule.exports = { startServer };\n`;

  const distPath = path.join(__dirname, '..', 'dist');
  fs.writeFileSync(path.join(distPath, 'index.js'), indexContent);
  
  // README für Offline-Package
  const offlineReadme = `# CommonKnowledgeScout Offline-Version

Diese Version des CommonKnowledgeScout funktioniert **nur** im Offline-Modus und enthält keinerlei Clerk-Abhängigkeiten.

## Installation

    npm install @bcommonslab/common-knowledge-scout-offline

## Verwendung

    const { startServer } = require('@bcommonslab/common-knowledge-scout-offline');

    // Starte Server im Offline-Modus
    startServer({
      port: 3000
    }).then(({ url }) => {
      console.log('Server läuft auf', url, '(Offline-Modus)');
    });

## Konfiguration

Setzen Sie folgende Umgebungsvariablen für den Offline-Modus:

- NEXT_PUBLIC_AUTH_MODE=offline
- NEXT_PUBLIC_OFFLINE_USER_EMAIL=ihre-email@example.com (optional)
- NEXT_PUBLIC_OFFLINE_USER_FIRST_NAME=Name (optional)
- NEXT_PUBLIC_OFFLINE_USER_LAST_NAME=Nachname (optional)

## Features

- Lokales Filesystem als Storage-Provider
- Keine externen Auth-Abhängigkeiten
- Vollständig offline-fähig
- Gleiche API wie die Hauptversion (ohne Auth)
`;
  fs.writeFileSync(path.join(distPath, 'README.md'), offlineReadme);

  console.log('✅ Index-Datei und README für Offline-Package erstellt');
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
//npm.pkg.github.com/:_authToken=${process.env.NODE_AUTH_TOKEN || ''}
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
    
    console.log('\n🚀 Offline-Package bereit für Distribution!');
    console.log('   - Nur Offline-Modus (keine Clerk-Abhängigkeiten)');
    console.log('   - Authentifizierung ist immer offline-mock');
  }
}

/**
 * Hilfsfunktion zum rekursiven Kopieren von Ordnern
 * Behandelt Symlinks korrekt für pnpm
 */
function copyFolderRecursive(source, target, excludeFiles = []) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  
  files.forEach(file => {
    // Überspringe ausgeschlossene Dateien
    if (excludeFiles.includes(file)) {
      return;
    }
    
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    const stats = fs.statSync(sourcePath);
    
    if (stats.isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath, excludeFiles);
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