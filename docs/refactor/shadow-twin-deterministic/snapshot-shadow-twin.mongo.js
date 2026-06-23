/**
 * Read-only Snapshot fuer Phase 0c (Shadow-Twin Deterministik-Refactor).
 *
 * NUR LESEN. Schreibt nichts in die DB. Scannt alle `shadow_twins__*`-Collections
 * der verbundenen DB nach einer Quelldatei (Default-Needle: "konomie" = _Ökoniomie_…)
 * und gibt pro Treffer die Form/Groesse aller Markdown-Artefakte + Binaer-Fragmente aus.
 *
 * Aufruf (DB-Name steckt in der URI):
 *   mongosh "$MONGODB_URI/$MONGODB_DATABASE_NAME" --quiet \
 *     --file docs/refactor/shadow-twin-deterministic/snapshot-shadow-twin.mongo.js
 *
 * Anderen Suchbegriff setzen:
 *   mongosh "..." --eval "var NEEDLE='dateiname'" \
 *     --file docs/refactor/shadow-twin-deterministic/snapshot-shadow-twin.mongo.js
 */

const needle = typeof NEEDLE !== 'undefined' ? NEEDLE : 'konomie';
const target = (typeof TARGET_DB !== 'undefined' && TARGET_DB) ? db.getSiblingDB(TARGET_DB) : db;

function pageMarkerCount(md) {
  if (!md || typeof md !== 'string') return 0;
  const m = md.match(/page_\d+|---\s*Seite\s*\d+|(^|\n)\s*Seite\s*[:\-]?\s*\d+/gi);
  return m ? m.length : 0;
}

function recordInfo(r) {
  if (!r || typeof r !== 'object') return 'MISSING';
  const len = typeof r.markdown === 'string' ? r.markdown.length : 0;
  const pages = r.frontmatter ? r.frontmatter.pages : undefined;
  return 'len=' + len + ' markers=' + pageMarkerCount(r.markdown) +
    ' updatedAt=' + r.updatedAt + (pages !== undefined ? ' fm.pages=' + pages : '');
}

print('DB: ' + target.getName());
const cols = target.getCollectionNames().filter(function (n) { return n.indexOf('shadow_twins__') === 0; });
print('shadow_twins-Collections: ' + cols.length);

let total = 0;
for (const c of cols) {
  const docs = target.getCollection(c).find({ sourceName: { $regex: needle, $options: 'i' } }).toArray();
  for (const d of docs) {
    total++;
    print('\n=== ' + c + '  sourceId=' + d.sourceId + ' ===');
    print('sourceName : ' + d.sourceName);
    print('updatedAt  : ' + d.updatedAt + '   (doc-level)');
    print('filesystemSync: ' + JSON.stringify(d.filesystemSync || null));

    const t = d.artifacts && d.artifacts.transcript;
    if (!t) {
      print('transcript : MISSING');
    } else if (typeof t.markdown === 'string') {
      print('transcript : single-record  ' + recordInfo(t));
    } else {
      print('transcript : LEGACY-MAP (sprach-gekeyt!) — "neuester gewinnt" greift hier:');
      for (const k of Object.keys(t)) print('   [lang=' + k + '] ' + recordInfo(t[k]));
    }

    const tf = d.artifacts && d.artifacts.transformation;
    if (tf) {
      for (const tpl of Object.keys(tf)) {
        for (const lang of Object.keys(tf[tpl])) {
          print('transformation[' + tpl + '][' + lang + '] ' + recordInfo(tf[tpl][lang]));
        }
      }
    } else {
      print('transformation: none');
    }

    const bf = d.binaryFragments || [];
    const byVariant = {};
    for (const b of bf) { const v = (b && b.variant) || 'unknown'; byVariant[v] = (byVariant[v] || 0) + 1; }
    print('binaryFragments: ' + bf.length + '  byVariant=' + JSON.stringify(byVariant));
  }
}
print('\nTreffer gesamt fuer /' + needle + '/i: ' + total);
