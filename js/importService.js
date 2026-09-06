// ============================================================
// EXCEL & CSV DATA IMPORT SERVICE
// Autonomous UMD Module (Phase 11B Architectural Extraction)
// ============================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ImportService = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var rootObj = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {})));
  var window = rootObj;
  var windowObj = rootObj;

// ============================================================
// EXCEL / CSV DATA IMPORT (Restore)
// ============================================================
// Holds the parsed rows from the selected file, keyed by column header.
let _importRows = [];
let _importHeaders = [];

// Populate a mapping <select> with the file's column headers plus a "—" empty option.
function populateMappingSelect(selectId, headers, required) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = required ? '— (απαιτείται)' : '—';
  sel.appendChild(emptyOpt);
  headers.forEach((h, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = h;
    sel.appendChild(opt);
  });
}

// Called when the user selects a file in the import modal.
function handleExcelUpload(event) {
  const fileInput = event && event.target ? event.target : document.getElementById('excel-file-input');
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (!file) return;

  const isCsv = /\.csv$/i.test(file.name);
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  if (!isCsv && !isExcel) {
    const msg = state.lang === 'en'
      ? 'Please select an Excel (.xlsx, .xls) or CSV file.'
      : 'Παρακαλώ επιλέξτε αρχείο Excel (.xlsx, .xls) ή CSV.';
    window.showAlert(msg);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      let rows = [];
      let headers = [];

      if (isCsv) {
        const text = String(evt.target.result || '');
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          headers = parsed[0].map(h => String(h == null ? '' : h).trim());
          rows = parsed.slice(1);
        }
      } else {
        if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
          const msg = state.lang === 'en'
            ? 'The Excel library is not loaded. Please try a CSV file instead.'
            : 'Η βιβλιοθήκη Excel δεν φορτώθηκε. Δοκιμάστε αρχείο CSV.';
          window.showAlert(msg);
          return;
        }
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          window.showAlert(state.lang === 'en' ? 'The file contains no sheets.' : 'Το αρχείο δεν περιέχει φύλλα εργασίας.');
          return;
        }
        const sheetRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        if (sheetRows.length > 0) {
          headers = sheetRows[0].map(h => String(h == null ? '' : h).trim());
          rows = sheetRows.slice(1);
        }
      }

      if (headers.length === 0) {
        window.showAlert(state.lang === 'en' ? 'The file appears to be empty.' : 'Το αρχείο φαίνεται να είναι κενό.');
        return;
      }

      _importHeaders = headers;
      _importRows = rows;

      // Populate all mapping dropdowns.
      const mapIds = ['map-date', 'map-account', 'map-category', 'map-subcategory', 'map-note',
        'map-amount', 'map-inflow', 'map-outflow', 'map-type', 'map-description'];
      mapIds.forEach(id => {
        populateMappingSelect(id, headers, id === 'map-date');
      });

      // Auto-guess sensible defaults based on header names.
      autoMapColumns(headers);

      const mappingSection = document.getElementById('excel-mapping-section');
      if (mappingSection) mappingSection.style.display = 'block';

      const progressSection = document.getElementById('import-progress-section');
      if (progressSection) progressSection.style.display = 'none';

      const msg = state.lang === 'en'
        ? `File loaded: ${rows.length} data rows found. Please map the columns and press "Start Import".`
        : `Το αρχείο φορτώθηκε: βρέθηκαν ${rows.length} γραμμές δεδομένων. Αντιστοιχίστε τις στήλες και πατήστε "Έναρξη Εισαγωγής".`;
      if (typeof showToast === 'function') showToast(msg, 'info');
    } catch (err) {
      console.error('[import] Failed to parse file:', err);
      window.showAlert(state.lang === 'en'
        ? 'Failed to read the file. Please check that it is a valid Excel or CSV file.'
        : 'Αποτυχία ανάγνωσης του αρχείου. Βεβαιωθείτε ότι είναι έγκυρο αρχείο Excel ή CSV.');
    }
  };

  if (isCsv) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}
window.handleExcelUpload = handleExcelUpload;
// parseCSV → extracted to js/importParsers.js (Phase 2, Extraction 4)

// Best-effort automatic column mapping based on common header names.
function autoMapColumns(headers) {
  const lower = headers.map(h => h.toLowerCase());
  const findIdx = (patterns) => {
    for (let i = 0; i < lower.length; i++) {
      for (const p of patterns) {
        if (lower[i].includes(p)) return i;
      }
    }
    return -1;
  };
  const setMap = (id, idx) => {
    if (idx < 0) return;
    const sel = document.getElementById(id);
    if (sel) sel.value = String(idx);
  };
  setMap('map-date', findIdx(['ημερομηνία', 'date', 'ημερομηνια', 'ημ/νια', 'data']));
  setMap('map-amount', findIdx(['ποσό', 'ποσο', 'amount', 'poso', 'sum']));
  setMap('map-inflow', findIdx(['εισροή', 'εισροη', 'inflow', 'credit', 'income']));
  setMap('map-outflow', findIdx(['εκροή', 'εκροη', 'outflow', 'debit', 'expense']));
  setMap('map-type', findIdx(['τύπος', 'τυπος', 'type', 'kind', 'κατηγορία', 'κατηγορια']));
  setMap('map-category', findIdx(['κατηγορία', 'κατηγορια', 'category', 'cat']));
  setMap('map-subcategory', findIdx(['υποκατηγορία', 'υποκατηγορια', 'subcategory', 'sub']));
  setMap('map-account', findIdx(['λογαριασμός', 'λογαριασμος', 'account', 'τρόπος', 'τροπος', 'payment']));
  setMap('map-note', findIdx(['σημείωση', 'σημειωση', 'note', 'σχόλιο', 'σχολιο']));
  setMap('map-description', findIdx(['περιγραφή', 'περιγραφη', 'description', 'desc']));
}
// normalizeImportDate → extracted to js/importParsers.js (Phase 2, Extraction 4)
// normalizeImportAmount → extracted to js/importParsers.js (Phase 2, Extraction 4)
// resolveImportType → extracted to js/importParsers.js (Phase 2, Extraction 4)

// Main import routine: reads mapping, builds transactions, saves them.
async function importExcelData() {
  if (!_importRows.length) {
    window.showAlert(state.lang === 'en' ? 'No file loaded. Please select a file first.' : 'Δεν φορτώθηκε αρχείο. Επιλέξτε πρώτα ένα αρχείο.');
    return;
  }

  const getMap = (id) => {
    const sel = document.getElementById(id);
    const v = sel ? sel.value : '';
    return v === '' ? null : parseInt(v, 10);
  };

  const map = {
    date: getMap('map-date'),
    account: getMap('map-account'),
    category: getMap('map-category'),
    subcategory: getMap('map-subcategory'),
    note: getMap('map-note'),
    amount: getMap('map-amount'),
    inflow: getMap('map-inflow'),
    outflow: getMap('map-outflow'),
    type: getMap('map-type'),
    description: getMap('map-description')
  };

  if (map.date == null) {
    window.showAlert(state.lang === 'en' ? 'Please map the Date column (required).' : 'Παρακαλώ αντιστοιχίστε τη στήλη Ημερομηνία (απαιτείται).');
    return;
  }

  const clearBefore = document.getElementById('clear-before-import');
  const shouldClear = clearBefore ? clearBefore.checked : false;

  // Show progress UI.
  const progressSection = document.getElementById('import-progress-section');
  const progressBar = document.getElementById('import-progress-bar');
  const progressPct = document.getElementById('import-progress-pct');
  const phaseLabel = document.getElementById('import-phase-label');
  if (progressSection) progressSection.style.display = 'block';
  if (phaseLabel) phaseLabel.textContent = state.lang === 'en' ? 'Importing...' : 'Εισαγωγή...';

  // Optional: clear old data before import.
  if (shouldClear) {
    if (phaseLabel) phaseLabel.textContent = state.lang === 'en' ? 'Clearing old data...' : 'Διαγραφή παλιών δεδομένων...';
    try {
      if (state.isSupabaseEnabled && state.supabaseClient && state.currentUser) {
        await state.supabaseClient.from('transactions').delete().eq('user_id', state.currentUser.id);
      }
      state.transactions = [];
      localStorage.setItem('offline_transactions', JSON.stringify([]));
    } catch (err) {
      console.warn('[import] Failed to clear old data:', err);
    }
  }

  let imported = 0;
  let skipped = 0;
  const total = _importRows.length;

  for (let i = 0; i < total; i++) {
    const row = _importRows[i];
    const dateStr = normalizeImportDate(map.date != null ? row[map.date] : '');
    if (!dateStr) { skipped++; continue; }

    const type = resolveImportType(row, map);
    let amount = 0;
    if (map.amount != null) {
      amount = normalizeImportAmount(row[map.amount]);
    } else {
      const inflow = map.inflow != null ? normalizeImportAmount(row[map.inflow]) : 0;
      const outflow = map.outflow != null ? normalizeImportAmount(row[map.outflow]) : 0;
      amount = type === 'income' ? inflow : outflow;
    }
    if (amount <= 0) { skipped++; continue; }

    const tx = {
      date: dateStr,
      type: type,
      amount: amount,
      currency: 'EUR',
      category: map.category != null ? String(row[map.category] || '').trim() : 'Γενικά',
      subcategory: map.subcategory != null ? String(row[map.subcategory] || '').trim() : '',
      account_from: map.account != null ? String(row[map.account] || '').trim() : '',
      note: map.note != null ? String(row[map.note] || '').trim() : ''
    };

    try {
      computeCurrencyFields(tx);
      await saveTransaction(tx);
      imported++;
    } catch (err) {
      console.warn('[import] Failed to save row', i, err);
      skipped++;
    }

    // Update progress.
    const pct = Math.round(((i + 1) / total) * 100);
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressPct) progressPct.textContent = pct + '%';
  }

  if (phaseLabel) phaseLabel.textContent = state.lang === 'en' ? 'Done!' : 'Ολοκληρώθηκε!';
  if (progressBar) progressBar.style.width = '100%';
  if (progressPct) progressPct.textContent = '100%';

  const msg = state.lang === 'en'
    ? `Import complete: ${imported} transactions added, ${skipped} skipped.`
    : `Η εισαγωγή ολοκληρώθηκε: προστέθηκαν ${imported} συναλλαγές, παραλείφθηκαν ${skipped}.`;
  window.showAlert(msg);

  // Refresh UI.
  calculateInitialBalances();
  updateUI();

  // Reset the file input so the same file can be re-selected.
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) fileInput.value = '';
  _importRows = [];
  _importHeaders = [];

  closeModal('excel-modal');
}
window.importExcelData = importExcelData;

function processExcelImport() {
  if (typeof importExcelData === 'function') {
    importExcelData();
  } else if (typeof handleExcelUpload === 'function') {
    handleExcelUpload();
  }
}
window.processExcelImport = processExcelImport;


  // UMD Exports & Window Binding
  window.populateMappingSelect = populateMappingSelect;
  window.handleExcelUpload = handleExcelUpload;
  window.autoMapColumns = autoMapColumns;
  window.importExcelData = importExcelData;
  window.processExcelImport = processExcelImport;

  return {
    populateMappingSelect: populateMappingSelect,
    handleExcelUpload: handleExcelUpload,
    autoMapColumns: autoMapColumns,
    importExcelData: importExcelData,
    processExcelImport: processExcelImport,
    getImportRows: function () { return _importRows; },
    getImportHeaders: function () { return _importHeaders; },
    setImportRows: function (rows) { _importRows = rows; },
    setImportHeaders: function (headers) { _importHeaders = headers; }
  };
}));
