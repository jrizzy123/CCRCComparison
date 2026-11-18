/**
 * compare.js
 * Pure comparison logic — no DOM access.
 * Takes data objects and returns structured result arrays.
 */

// ── Value normalisation ──────────────────────────────────────

/**
 * Normalise a raw cell value to a comparable string.
 * Always lowercases; collapses whitespace when fuzzy=true.
 */
function normalizeVal(v, fuzzy = false) {
  if (v === null || v === undefined || v === '') return '';

  // Handle JS Date objects (from XLSX cellDates:true)
  if (v instanceof Date || (typeof v === 'object' && typeof v.getTime === 'function')) {
    return v.toISOString().split('T')[0];
  }

  let s = String(v).trim().toLowerCase();
  if (fuzzy) s = s.replace(/\s+/g, ' ');

  // Try to normalise date strings (YYYY-MM-DD or MM/DD/YYYY etc.)
  if (s.includes('-') || s.includes('/')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  return s;
}

// ── Match logic ──────────────────────────────────────────────

/**
 * Returns true when the registry value matches the cross-check value,
 * after decoding and normalising, within the given tolerances.
 */
function valsMatch(regVal, crossVal, crossColName, fuzzy, dateTolDays, numTolPct) {
  const decoded = decodeCrossVal(crossColName, crossVal);
  const na      = normalizeVal(regVal,  fuzzy);
  const nb      = normalizeVal(decoded, fuzzy);

  if (na === nb) return true;

  // Date tolerance
  if (dateTolDays > 0) {
    const da = new Date(na);
    const db = new Date(nb);
    if (!isNaN(da) && !isNaN(db)) {
      return Math.abs(da - db) / 86_400_000 <= dateTolDays;
    }
  }

  // Numeric tolerance
  if (numTolPct > 0) {
    const fa = parseFloat(na);
    const fb = parseFloat(nb);
    if (!isNaN(fa) && !isNaN(fb) && fb !== 0) {
      return (Math.abs(fa - fb) / Math.abs(fb)) * 100 <= numTolPct;
    }
  }

  return false;
}

// ── Main comparison ──────────────────────────────────────────

/**
 * Run field-level comparison between registry and cross-check data.
 *
 * @param {object} opts
 * @param {string} opts.regKeyCol      - Column name used as patient ID in registry sheets
 * @param {string} opts.crossKeyCol    - Column name used as patient ID in cross-check sheet
 * @param {string} opts.crossSheetName - Which cross-check sheet to use
 * @param {number} opts.dateTol        - Date tolerance in days
 * @param {number} opts.numTol         - Numeric tolerance in percent
 * @returns {{ results, matchedIds, unmatchedReg, allRegIds }}
 */
function runCompare({ regKeyCol, crossKeyCol, crossSheetName, dateTol, numTol }) {
  const crossData = crossSheets[crossSheetName];
  if (!crossData) throw new Error(`Cross-check sheet "${crossSheetName}" not found.`);

  // Build cross-check lookup: id -> row
  const crossLookup = {};
  crossData.forEach(row => {
    const k = String(row[crossKeyCol]).trim();
    crossLookup[k] = row;
  });

  // Build per-sheet registry lookups: sheetName -> id -> [rows]
  const regLookups = {};
  Object.keys(registrySheets).forEach(sheetName => {
    regLookups[sheetName] = {};
    registrySheets[sheetName].forEach(row => {
      const k = String(row[regKeyCol]).trim();
      if (!regLookups[sheetName][k]) regLookups[sheetName][k] = [];
      regLookups[sheetName][k].push(row);
    });
  });

  // Gather all registry IDs
  const allRegIds = new Set(
    Object.values(regLookups).flatMap(lk => Object.keys(lk))
  );
  const matchedIds   = [...allRegIds].filter(k =>  crossLookup[k]);
  const unmatchedReg = [...allRegIds].filter(k => !crossLookup[k]);

  // Compare each mapped field
  const results = [];

  fieldMappings.forEach(mapping => {
    if (!mapping.regCol || !mapping.crossCol) return; // skip unmapped fields

    const sheetLookup = regLookups[mapping.srcSheet];
    if (!sheetLookup) return;

    // IDs that have a non-empty value for this field in the registry
    const presentIds = Object.keys(sheetLookup).filter(k =>
      sheetLookup[k].some(r => r[mapping.regCol] !== '' && r[mapping.regCol] != null)
    );

    let count = 0, regCorrect = 0, crossCorrect = 0;

    presentIds.forEach(k => {
      const crossRow = crossLookup[k];
      if (!crossRow) return; // patient not in cross-check

      const regVal   = sheetLookup[k][0][mapping.regCol]; // first row per patient
      const crossVal = crossRow[mapping.crossCol];

      count++;

      if (valsMatch(regVal, crossVal, mapping.crossCol, mapping.fuzzy, dateTol, numTol)) {
        regCorrect++;
      }

      // aEHR correct = cross-check has a value at all (source completeness)
      if (crossVal !== '' && crossVal != null) {
        crossCorrect++;
      }
    });

    const regPct   = count > 0 ? round1(regCorrect   / count * 100) : null;
    const crossPct = count > 0 ? round1(crossCorrect / count * 100) : null;

    results.push({ label: mapping.label, count, regCorrect, regPct, crossCorrect, crossPct });
  });

  return { results, matchedIds, unmatchedReg, allRegIds };
}

// ── Helpers ──────────────────────────────────────────────────

function round1(n) {
  return Math.round(n * 10) / 10;
}
