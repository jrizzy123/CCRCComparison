/**
 * main.js
 * Entry point. Wires up file upload events, triggers the comparison,
 * and handles XLSX export.
 */

// ── File upload ──────────────────────────────────────────────

document.getElementById('file-registry').addEventListener('change', e => {
  loadFile(e.target.files[0], 'registry');
});

document.getElementById('file-crosscheck').addEventListener('change', e => {
  loadFile(e.target.files[0], 'crosscheck');
});

// Drag-and-drop support
['registry', 'crosscheck'].forEach(which => {
  const card = document.getElementById(`card-${which}`);
  card.addEventListener('dragover',  e => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', ()  => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f, which);
  });
});

/**
 * Parse an uploaded XLSX file and store it in the global state.
 * When both files are loaded, initialise the config panel.
 */
function loadFile(file, which) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const data = new Uint8Array(ev.target.result);
    const wb   = XLSX.read(data, { type: 'array', cellDates: true });

    if (which === 'registry') {
      registryWorkbook = wb;
      registrySheets   = {};
      wb.SheetNames.forEach(n => {
        registrySheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' });
      });
      document.getElementById('fn-registry').textContent = file.name;
      document.getElementById('card-registry').classList.add('loaded');
    } else {
      crossWorkbook = wb;
      crossSheets   = {};
      wb.SheetNames.forEach(n => {
        crossSheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' });
      });
      document.getElementById('fn-crosscheck').textContent = file.name;
      document.getElementById('card-crosscheck').classList.add('loaded');
    }

    if (registryWorkbook && crossWorkbook) initApp();
  };

  reader.readAsArrayBuffer(file);
}

// ── App init (runs after both files are loaded) ──────────────

function initApp() {
  document.getElementById('config-section').style.display = 'block';
  document.getElementById('run-btn').disabled = false;

  initSheetSelects();
  buildDefaultMappings();   // dynamically build rows from registry columns
  renderFieldMapTable();
  updateMappingInfo();
  renderDecodeGrid();
}

// ── Run comparison ───────────────────────────────────────────

function runComparison() {
  try {
    const { results, matchedIds, unmatchedReg, allRegIds } = runCompare({
      regKeyCol:     document.getElementById('sel-registry-key').value,
      crossKeyCol:   document.getElementById('sel-cross-key').value,
      crossSheetName: document.getElementById('sel-cross-sheet').value,
      dateTol:       parseFloat(document.getElementById('date-tol').value) || 0,
      numTol:        parseFloat(document.getElementById('num-tol').value)  || 0,
    });

    renderResults(results, matchedIds.length, unmatchedReg.length, allRegIds.size);
  } catch (err) {
    showError(err.message);
  }
}

// ── XLSX export ──────────────────────────────────────────────

function exportResults() {
  if (!window._lastResults) return;

  const rows = [['CCRC Field', 'Count', 'Registry Correct (%)', 'aEHR Correct (%)']];
  window._lastResults.forEach(r => rows.push([r.label, r.count, r.regPct, r.crossPct]));

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 22 }, { wch: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CCRC Comparison');
  XLSX.writeFile(wb, 'CCRC_Comparison_Results.xlsx');
}
