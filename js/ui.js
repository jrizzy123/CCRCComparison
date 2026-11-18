/**
 * ui.js
 * All DOM rendering and UI update functions.
 * Reads from global state (config.js) but does not run comparisons.
 * User is able to edit config.js however
 */



function getRegistryCols(sheetName) {
  const rows = registrySheets[sheetName];
  return rows && rows[0] ? Object.keys(rows[0]) : [];
}

function getCrossCols() {
  const sheet = document.getElementById('sel-cross-sheet').value;
  const rows  = crossSheets[sheet];
  return rows && rows[0] ? Object.keys(rows[0]) : [];
}

function getAllRegistrySheets() {
  return Object.keys(registrySheets);
}

function makeOptions(items, selectedVal) {
  return items
    .map(v => `<option value="${v}"${v === selectedVal ? ' selected' : ''}>${v || '-- none --'}</option>`)
    .join('');
}

// ── Sheet / key selects ──────────────────────────────────────

function initSheetSelects() {
  const regSel   = document.getElementById('sel-registry-sheet');
  const crossSel = document.getElementById('sel-cross-sheet');

  regSel.innerHTML   = makeOptions(Object.keys(registrySheets), Object.keys(registrySheets)[0]);
  crossSel.innerHTML = makeOptions(Object.keys(crossSheets),    Object.keys(crossSheets)[0]);

  updateKeySelects();
  regSel.addEventListener('change',   updateKeySelects);
  crossSel.addEventListener('change', updateKeySelects);
}

function updateKeySelects() {
  const regSheet   = document.getElementById('sel-registry-sheet').value;
  const crossSheet = document.getElementById('sel-cross-sheet').value;

  const regCols   = regSheet   ? getRegistryCols(regSheet) : [];
  const crossCols = crossSheet ? getCrossCols()            : [];

  document.getElementById('sel-registry-key').innerHTML = makeOptions(regCols,   'registryid');
  document.getElementById('sel-cross-key').innerHTML    = makeOptions(crossCols, 'registryid');
}

// ── Field mapping table ──────────────────────────────────────

function renderFieldMapTable() {
  const tbody = document.getElementById('field-map-body');
  tbody.innerHTML = '';

  fieldMappings.forEach(m => {
    const tr = document.createElement('tr');

    const sheetOpts = makeOptions(getAllRegistrySheets(), m.srcSheet);
    const regOpts   = makeOptions(['', ...getRegistryCols(m.srcSheet)], m.regCol);
    const crossOpts = makeOptions(['', ...getCrossCols()],               m.crossCol);

    tr.innerHTML = `
      <td>
        <input class="label-input" type="text" value="${m.label}"
               onchange="updateField(${m.id}, 'label', this.value)" />
      </td>
      <td>
        <select onchange="updateField(${m.id}, 'srcSheet', this.value); renderFieldMapTable();">
          ${sheetOpts}
        </select>
      </td>
      <td>
        <select onchange="updateField(${m.id}, 'regCol', this.value)">
          ${regOpts}
        </select>
      </td>
      <td>
        <select onchange="updateField(${m.id}, 'crossCol', this.value)">
          ${crossOpts}
        </select>
      </td>
      <td style="text-align:center">
        <input type="checkbox" ${m.fuzzy ? 'checked' : ''}
               onchange="updateField(${m.id}, 'fuzzy', this.checked)"
               title="Fuzzy / case-insensitive match" />
      </td>
      <td>
        <button class="row-del-btn" onclick="removeField(${m.id})">×</button>
      </td>`;

    tbody.appendChild(tr);
  });
}

// ── Field mapping mutations ──────────────────────────────────

function updateField(id, key, val) {
  const m = fieldMappings.find(x => x.id === id);
  if (m) m[key] = val;
}

function addFieldRow() {
  fieldMappings.push({
    id:        nextId++,
    label:     'New Field',
    srcSheet:  getAllRegistrySheets()[0] || '',
    regCol:    '',
    crossCol:  '',
    fuzzy:     false,
  });
  renderFieldMapTable();
}

function removeField(id) {
  fieldMappings = fieldMappings.filter(x => x.id !== id);
  renderFieldMapTable();
}

// ── Info / mapping summary ───────────────────────────────────

function updateMappingInfo() {
  const regList   = getAllRegistrySheets().join(', ');
  const crossList = Object.keys(crossSheets).join(', ');
  document.getElementById('mapping-info').textContent =
    `Registry sheets: ${regList} | Cross-check sheets: ${crossList}. ` +
    `Adjust the field rows below. Leave "Cross-check Column" blank to skip a field.`;
}

// ── Decode reference cards ───────────────────────────────────

function renderDecodeGrid() {
  const CARDS = [
    {
      title: 'gender',
      body:  '1 → Male &nbsp;|&nbsp; 2 → Female',
    },
    {
      title: 'yes/no fields (most)',
      body:  '0 → No &nbsp;|&nbsp; 1 → Yes',
      note:  'preterm, ethnicity, gestageknown, birthwtknown, additional_imaging, pda_present, birth_length_known, weight_kg_b, palliation_form, preop_arrhythmia, preop_phtn',
    },
    {
      title: 'preop_ple_yn_e_1',
      titleExtra: '<span class="warn">(non-standard)</span>',
      body:  '0 → No &nbsp;|&nbsp; 2 → Yes',
    },
    {
      title: 'race_e',
      body:  '{1}→White &nbsp;{2}→Black &nbsp;{3}→Asian<br>{4}→Native Am. &nbsp;{5}→Native HI &nbsp;{6}→Other &nbsp;{99}→Unknown',
      note:  'Multi-select bitmasks like {1|99} decoded to pipe-separated labels',
    },
    {
      title: 'timing fields',
      body:  '1 → Prenatal &nbsp;|&nbsp; 2 → Postnatal',
      note:  'chrom_microarr, exome, karyotype, fish, genetic_consult, other_test',
    },
    {
      title: 'result fields',
      body:  '1 → Normal &nbsp;|&nbsp; 2 → Abnormal',
      note:  'chrom_microarr, exome, karyotype, fish, genetic_consult, other_test',
    },
    {
      title: 'genetic_eval_perform_e',
      body:  '1→Karyotype &nbsp;2→CMA &nbsp;3→FISH<br>4→WES &nbsp;5→WGS &nbsp;6→Other',
    },
  ];

  document.getElementById('decode-grid').innerHTML = CARDS.map(c => `
    <div class="decode-card">
      <div class="decode-card-title">${c.title} ${c.titleExtra || ''}</div>
      <div class="decode-card-body">${c.body}</div>
      ${c.note ? `<div class="decode-card-note">${c.note}</div>` : ''}
    </div>`).join('');
}

// ── Results rendering ────────────────────────────────────────

function barColor(pct) {
  if (pct === 100) return '#22d3a0';
  if (pct >= 90)   return '#4f9cf9';
  if (pct >= 70)   return '#f97316';
  return '#f43f5e';
}

function pctClass(pct) {
  if (pct === null) return '';
  if (pct === 100)  return 'pct-100';
  if (pct >= 90)    return 'pct-high';
  if (pct >= 70)    return 'pct-mid';
  return 'pct-low';
}

function pctCell(pct) {
  if (pct === null) return `<div class="pct-bar"><span class="pct-val">—</span></div>`;
  const bar = `<div class="bar-bg"><div class="bar-fill" style="width:${pct}%; background:${barColor(pct)}"></div></div>`;
  return `<div class="pct-bar">${bar}<span class="pct-val ${pctClass(pct)}">${pct}</span></div>`;
}

function renderResults(results, matched, unmatched, total) {
  const avgReg  = avg(results.map(r => r.regPct).filter(v => v !== null));
  const below90 = results.filter(r => r.regPct !== null && r.regPct < 90).length;

  document.getElementById('results-area').innerHTML = `
    <div class="results-header">
      <h2>Results</h2>
      <button class="export-btn" onclick="exportResults()">⬇ Export XLSX</button>
    </div>

    <div class="summary-pills">
      ${pill(total,            'Registry Patients')}
      ${pill(matched,          'Matched to aEHR')}
      ${pill(results.length,   'Fields Compared')}
      ${pill(avgReg.toFixed(1) + '%', 'Avg Registry Accuracy')}
      ${pill(below90,          'Fields Below 90%')}
    </div>

    <div class="result-table-wrap">
      <table class="result-table">
        <thead>
          <tr>
            <th>CCRC Field</th>
            <th>Count</th>
            <th>Registry Correct (%)</th>
            <th>aEHR Correct (%)</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td>${r.label}</td>
              <td><span class="count-badge">${r.count}</span></td>
              <td>${pctCell(r.regPct)}</td>
              <td>${pctCell(r.crossPct)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  window._lastResults = results;
}

function showError(msg) {
  document.getElementById('results-area').innerHTML =
    `<div class="error-box">⚠ ${msg}</div>`;
}

// ── Tiny helpers ─────────────────────────────────────────────

function pill(value, label) {
  return `<div class="pill">
    <span class="pill-val">${value}</span>
    <span class="pill-lbl">${label}</span>
  </div>`;
}

function avg(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
