/**
 * Generiert .next/required-server-files.json fuer next-electron-rsc.
 *
 * Diese Datei wird normalerweise nur bei `output: 'standalone'` erzeugt.
 * Da wir auf Windows kein standalone verwenden (EPERM-Symlink-Problem),
 * erstellen wir sie manuell.
 *
 * Verwendet Next.js's eigene loadConfig-Funktion, um die vollstaendig
 * aufgeloeste Konfiguration (inkl. aller Defaults) zu erhalten.
 * next-electron-rsc liest daraus den `config`-Key und setzt ihn als
 * __NEXT_PRIVATE_STANDALONE_CONFIG.
 */

const path = require('path');
const fs = require('fs');

const projectDir = path.join(__dirname, '..');
const outputPath = path.join(projectDir, '.next', 'required-server-files.json');

async function generate() {
  // Next.js's interne Config-Ladung verwendet, die alle Defaults setzt
  const loadConfig = require('next/dist/server/config').default;
  const config = await loadConfig('production', projectDir);

  const requiredServerFiles = {
    version: 1,
    config,
    appDir: projectDir,
    files: [],
    ignore: [],
  };

  fs.writeFileSync(outputPath, JSON.stringify(requiredServerFiles, null, 2));
  console.log('[generate-required-server-files] Erstellt:', outputPath);
}

generate().catch((err) => {
  console.error('[generate-required-server-files] Fehler:', err.message);
  process.exit(1);
});
