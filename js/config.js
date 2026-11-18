/**
 * config.js
 * Workbook state + dynamic field mapping builder.
 *
 * On load, buildDefaultMappings() is called (from main.js initApp) to
 * iterate every registry sheet, take every column from that sheet, and
 * attempt to find the matching column in the selected cross-check sheet.
 * Matching logic (in priority order):
 *   1. Exact column name match
 *   2. Column name + '_1' suffix  (palliation fields)
 *   3. Column name + '_2' suffix  (repair fields)
 *   4. Column name + '_3' suffix  (complete-repair fields)
 *   5. Leave crossCol blank so the user can map it manually
 *
 * Columns that are clearly not data fields (MRN, names, abstractor notes)
 * are skipped automatically.
 */

// ── Workbook data (populated after file upload) ──────────────
let registryWorkbook = null;
let crossWorkbook    = null;
let registrySheets   = {};
let crossSheets      = {};

// ── Field mapping state ──────────────────────────────────────
let nextId        = 0;
let fieldMappings = [];   // populated dynamically by buildDefaultMappings()

// ── Columns to always skip (not real data fields) ─────────────
const SKIP_COL_PATTERNS = [
  /^mrn/i,
  /not_in_export/i,
  /^first_name/i,
  /^last_name/i,
  /\*\*/,           // abstractor-note columns like "Weight recorded **not a variable**"
];

function shouldSkipCol(colName) {
  if (!colName) return true;
  return SKIP_COL_PATTERNS.some(re => re.test(colName));
}

// Return true if every value in `colName` is empty/whitespace in the given rows
function isColumnEmpty(rows, colName) {
  if (!rows || rows.length === 0) return true;
  return !rows.some(r => {
    const v = r[colName];
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
}

/**
 * Build fieldMappings dynamically from whatever sheets/columns are in the
 * loaded registry workbook, cross-referencing the active cross-check sheet.
 * Called by initApp() in main.js each time both files are loaded.
 */
function buildDefaultMappings() {
  nextId        = 0;
  fieldMappings = [];

  // Build a Set of all column names in the cross-check sheet for O(1) lookup
  const crossSheetName = Object.keys(crossSheets)[0] || '';
  const crossRows      = crossSheets[crossSheetName] || [];
  const crossCols      = crossRows.length ? new Set(Object.keys(crossRows[0])) : new Set();

  Object.keys(registrySheets).forEach(sheetName => {
    const rows = registrySheets[sheetName];
    if (!rows || rows.length === 0) return;

    const regCols = Object.keys(rows[0]);

    regCols.forEach(col => {
      if (shouldSkipCol(col)) return;
      if (isColumnEmpty(rows, col)) return; // skip columns that contain no data

      // Try to find best cross-check column
      let crossCol = '';
      for (const candidate of [col, col + '_1', col + '_2', col + '_3']) {
        if (crossCols.has(candidate)) { crossCol = candidate; break; }
      }

      // Human-readable label: replace underscores, trim trailing suffix like _1
      const label = col
        .replace(/_\d+$/, '')          // strip trailing _1 / _2 / _3
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      fieldMappings.push({
        id:       nextId++,
        label,
        srcSheet: sheetName,
        regCol:   col,
        crossCol,
        fuzzy:    false,
      });
    });
  });
}
