/**
 * js/exportService.js
 *
 * Export & Share Engine (Excel .xlsx, CSV, ODS, JSON, PDF & Native Mobile Sharing).
 * Extracted from app.js (Phase 3 Architectural Domain Extraction).
 *
 * Fully autonomous with platform-aware download (Capacitor Filesystem/Share plugins,
 * Web Share API, and browser Blob download fallbacks).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node / CommonJS
    module.exports = factory();
  } else {
    // Browser: attach to root (window)
    var exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var windowObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});

  /**
   * Helper: build CSV string from rows with RFC-4180 escaping and UTF-8 BOM.
   */
  function buildCsvString(rows) {
    if (!rows || !rows.length) return '\uFEFF';
    const headers = Object.keys(rows[0] || {});
    const escapeCell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(escapeCell).join(',')];
    rows.forEach(r => {
      lines.push(headers.map(h => escapeCell(r[h])).join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

function updateExportSheetDateLabels() {
  const now = new Date();

  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const curMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const curMonthEl = document.getElementById('export-range-current-month');
  if (curMonthEl) curMonthEl.textContent = `(${formatShortDate(curMonthStart)} ~ ${formatShortDate(curMonthEnd)})`;

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const prevMonthEl = document.getElementById('export-range-prev-month');
  if (prevMonthEl) prevMonthEl.textContent = `(${formatShortDate(prevMonthStart)} ~ ${formatShortDate(prevMonthEnd)})`;

  const curYearStart = new Date(now.getFullYear(), 0, 1);
  const curYearEnd = now;
  const curYearEl = document.getElementById('export-range-current-year');
  if (curYearEl) curYearEl.textContent = `(${formatShortDate(curYearStart)} ~ ${formatShortDate(curYearEnd)})`;

  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  const prevYearEl = document.getElementById('export-range-prev-year');
  if (prevYearEl) prevYearEl.textContent = `(${formatShortDate(prevYearStart)} ~ ${formatShortDate(prevYearEnd)})`;
}

let selectedExportPeriod = 'current-month';
let selectedExportFormat = 'xlsx';

function openExportPeriodSheet() {
  if (typeof closeSearchBottomSheet === 'function') {
    closeSearchBottomSheet(true);
  }

  updateExportSheetDateLabels();

  const backdrop = document.getElementById('export-period-backdrop');
  if (backdrop) backdrop.classList.add('active');

  const sheet = document.getElementById('export-period-bottom-sheet');
  if (sheet) sheet.classList.add('active');

  // Reset to step 1
  const step1 = document.getElementById('export-step-1');
  const step2 = document.getElementById('export-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';

  selectExportOption('current-month', false);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  const displayStr = `${dd}/${mm}/${yyyy}`;

  const fromEl = document.getElementById('export-custom-from');
  const toEl = document.getElementById('export-custom-to');
  const fromLabel = document.getElementById('export-custom-from-label');
  const toLabel = document.getElementById('export-custom-to-label');

  if (fromEl) fromEl.value = todayStr;
  if (toEl) toEl.value = todayStr;
  if (fromLabel) fromLabel.textContent = displayStr;
  if (toLabel) toLabel.textContent = displayStr;
}

function closeExportPeriodSheet() {
  const sheet = document.getElementById('export-period-bottom-sheet');
  if (sheet) sheet.classList.remove('active');

  const backdrop = document.getElementById('export-period-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

function goToExportStep1() {
  const step1 = document.getElementById('export-step-1');
  const step2 = document.getElementById('export-step-2');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
}
windowObj.goToExportStep1 = goToExportStep1;

function updateStep2Summary() {
  const now = new Date();
  let startDate = null;
  let endDate = null;
  let periodText = '';

  if (selectedExportPeriod === 'current-month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periodText = (state.lang === 'en' ? 'Current Month' : 'Τρέχων Μήνας') + ` (${formatShortDate(startDate)} ~ ${formatShortDate(endDate)})`;
  } else if (selectedExportPeriod === 'prev-month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    periodText = (state.lang === 'en' ? 'Previous Month' : 'Προηγούμενος Μήνας') + ` (${formatShortDate(startDate)} ~ ${formatShortDate(endDate)})`;
  } else if (selectedExportPeriod === 'current-year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
    periodText = (state.lang === 'en' ? 'Current Year' : 'Τρέχων Έτος') + ` (${formatShortDate(startDate)} ~ ${formatShortDate(endDate)})`;
  } else if (selectedExportPeriod === 'prev-year') {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
    periodText = (state.lang === 'en' ? 'Previous Year' : 'Προηγούμενο Έτος') + ` (${formatShortDate(startDate)} ~ ${formatShortDate(endDate)})`;
  } else if (selectedExportPeriod === 'all') {
    periodText = state.lang === 'en' ? 'All Data' : 'Όλα τα δεδομένα';
  } else if (selectedExportPeriod === 'custom') {
    const fromStr = document.getElementById('export-custom-from')?.value;
    const toStr = document.getElementById('export-custom-to')?.value;
    if (fromStr && toStr) {
      const fParts = fromStr.split('-');
      const tParts = toStr.split('-');
      periodText = `${fParts[2]}/${fParts[1]}/${fParts[0]} ~ ${tParts[2]}/${tParts[1]}/${tParts[0]}`;
      startDate = new Date(fromStr);
      endDate = new Date(toStr);
    } else {
      periodText = state.lang === 'en' ? 'Custom Date Range' : 'Συγκεκριμένες Ημερομηνίες';
    }
  }

  let count = 0;
  if (state.transactions && state.transactions.length) {
    const startStr = startDate ? formatISODateLocal(startDate) : null;
    const endStr = endDate ? formatISODateLocal(endDate) : null;
    count = state.transactions.filter(t => {
      if (!t.date) return false;
      const tDate = t.date.split('T')[0].split(' ')[0];
      if (startStr && tDate < startStr) return false;
      if (endStr && tDate > endStr) return false;
      return true;
    }).length;
  }

  const periodLabelEl = document.getElementById('export-step2-period-label');
  const countBadgeEl = document.getElementById('export-step2-count-badge');
  if (periodLabelEl) periodLabelEl.textContent = periodText;
  if (countBadgeEl) {
    const unit = state.lang === 'en' ? (count === 1 ? 'transaction' : 'transactions') : (count === 1 ? 'συναλλαγή' : 'συναλλαγές');
    countBadgeEl.textContent = `${count} ${unit}`;
  }
}

function goToExportStep2() {
  if (selectedExportPeriod === 'custom') {
    const fromStr = document.getElementById('export-custom-from')?.value;
    const toStr = document.getElementById('export-custom-to')?.value;
    if (!fromStr || !toStr) {
      window.showAlert(state.lang === 'en' ? 'Please select both start and end dates!' : 'Παρακαλώ επιλέξτε ημερομηνία έναρξης και λήξης!');
      return;
    }
    if (fromStr > toStr) {
      window.showAlert(state.lang === 'en' ? 'Start date must be before end date!' : 'Η ημερομηνία έναρξης πρέπει να είναι προγενέστερη της ημερομηνίας λήξης!');
      return;
    }
  }

  updateStep2Summary();

  const step1 = document.getElementById('export-step-1');
  const step2 = document.getElementById('export-step-2');
  if (step1) step1.style.display = 'none';
  if (step2) step2.style.display = 'block';
}
windowObj.goToExportStep2 = goToExportStep2;

function selectExportOption(option, userInitiated = true) {
  selectedExportPeriod = option;

  const options = ['current-month', 'prev-month', 'current-year', 'prev-year', 'all', 'custom'];
  options.forEach(opt => {
    const el = document.getElementById(`export-opt-${opt}`);
    if (el) {
      el.classList.toggle('active', opt === option);
    }
  });

  const customContainer = document.getElementById('export-custom-range-container');
  const nextBtnContainer = document.getElementById('export-next-btn-container');

  if (option === 'custom') {
    if (customContainer) customContainer.style.display = 'flex';
    if (nextBtnContainer) nextBtnContainer.style.display = 'block';
  } else {
    if (customContainer) customContainer.style.display = 'none';
    if (nextBtnContainer) nextBtnContainer.style.display = 'none';

    if (userInitiated) {
      setTimeout(() => goToExportStep2(), 150);
    }
  }
}

function selectExportFormat(format) {
  selectedExportFormat = format;

  const formats = ['xlsx', 'csv', 'ods', 'json', 'pdf'];
  formats.forEach(f => {
    const el = document.getElementById(`export-format-${f}`);
    if (el) {
      el.classList.toggle('active', f === format);
    }
  });
}

function confirmExcelExport() {
  const now = new Date();
  let startDate = null;
  let endDate = null;

  if (selectedExportPeriod === 'current-month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (selectedExportPeriod === 'prev-month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (selectedExportPeriod === 'current-year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else if (selectedExportPeriod === 'prev-year') {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
  } else if (selectedExportPeriod === 'custom') {
    const fromStr = document.getElementById('export-custom-from').value;
    const toStr = document.getElementById('export-custom-to').value;
    if (!fromStr || !toStr) {
      window.showAlert(state.lang === 'en' ? 'Please select both start and end dates!' : 'Παρακαλώ επιλέξτε ημερομηνία έναρξης και λήξης!');
      return;
    }
    if (fromStr > toStr) {
      window.showAlert(state.lang === 'en' ? 'Start date must be before end date!' : 'Η ημερομηνία έναρξης πρέπει να είναι προγενέστερη της ημερομηνίας λήξης!');
      return;
    }
    exportToExcel(fromStr, toStr);
    return;
  }

  const startStr = startDate ? formatISODateLocal(startDate) : null;
  const endStr = endDate ? formatISODateLocal(endDate) : null;

  exportToExcel(startStr, endStr);
}

function exportToExcel(startDate = null, endDate = null) {
  if (!state.transactions.length) {
    const msg = state.lang === 'en' ? 'No transactions to export!' : 'Δεν υπάρχουν συναλλαγές!';
    window.showAlert(msg);
    return;
  }

  let transactionsToExport = state.transactions;
  if (startDate || endDate) {
    transactionsToExport = state.transactions.filter(t => {
      if (!t.date) return false;
      const tDate = t.date.split('T')[0].split(' ')[0];
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      return true;
    });
  }

  if (!transactionsToExport.length) {
    const msg = TRANSLATIONS[state.lang]['export_no_data_range'] || 'Δεν υπάρχουν συναλλαγές σε αυτή την περίοδο!';
    window.showAlert(msg);
    return;
  }

  const rows = transactionsToExport.map(t => ({
    'Ημερομηνία': t.date, 'Τύπος': t.type === 'expense' ? 'Expense' : (t.type === 'income' ? 'Income' : 'Transfer'),
    'Ποσό': t.amount, 'Κατηγορία': t.category, 'Υποκατηγορία': t.subcategory || '',
    'Λογαριασμός': t.account_from, 'Σημείωση': t.note || '',
  }));

  const format = selectedExportFormat || 'xlsx';
  const baseName = `Budget_Assistant_Export_${new Date().toISOString().split('T')[0]}`;

  // JSON export does not require the SheetJS library.
  if (format === 'json') {
    try {
      const jsonStr = JSON.stringify(transactionsToExport, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      downloadBlob(blob, `${baseName}.json`);
      closeExportPeriodSheet();
      return;
    } catch (err) {
      console.error('[export] JSON export failed.', err);
      window.showAlert(state.lang === 'en' ? 'JSON export failed!' : 'Η εξαγωγή JSON απέτυχε!');
      return;
    }
  }

  // PDF export: generate a simple, readable table-based PDF without external libs.
  if (format === 'pdf') {
    try {
      const blob = generatePdfBlob(rows, baseName);
      downloadBlob(blob, `${baseName}.pdf`);
      closeExportPeriodSheet();
      return;
    } catch (err) {
      console.error('[export] PDF export failed.', err);
      window.showAlert(state.lang === 'en' ? 'PDF export failed!' : 'Η εξαγωγή PDF απέτυχε!');
      return;
    }
  }

  // Guard: if the SheetJS library is not loaded, fall back to CSV so the export still works.
  if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
    console.warn('[export] XLSX library not available, falling back to CSV export.');
    exportRowsAsCSV(rows, `${baseName}.csv`);
    closeExportPeriodSheet();
    return;
  }

  try {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Συναλλαγές');
    // Generate the file as a Blob instead of using XLSX.writeFile, because
    // writeFile relies on an <a>.click() download which silently fails inside
    // the Capacitor/Android WebView. We route the Blob through downloadBlob()
    // which uses the native Share sheet on mobile.
    if (format === 'csv') {
      const csvStr = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${baseName}.csv`);
    } else {
      const bookType = format === 'ods' ? 'ods' : 'xlsx';
      const wbout = XLSX.write(wb, { bookType: bookType, type: 'array' });
      const mime = bookType === 'ods'
        ? 'application/vnd.oasis.opendocument.spreadsheet'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([wbout], { type: mime });
      downloadBlob(blob, `${baseName}.${bookType}`);
    }
  } catch (err) {
    console.error('[export] Spreadsheet export failed, falling back to CSV export.', err);
    exportRowsAsCSV(rows, `${baseName}.csv`);
  }
  closeExportPeriodSheet();
}

// Generate a valid, dependency-free PDF document from the export rows.
// Uses PDF content-stream text operators (BT/Tf/Td/Tj) to draw a simple table.
function generatePdfBlob(rows, baseName) {
  const headers = Object.keys(rows[0] || {});
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const fontSize = 8;
  const lineHeight = 12;
  const colWidth = Math.floor((pageWidth - margin * 2) / Math.max(headers.length, 1));

  // Escape a string for a PDF literal string (parentheses and backslashes).
  const escPdf = (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  // Truncate text to fit the column width (approx 5.5 chars per 8pt char per 44px col).
  const fit = (v) => {
    const s = String(v == null ? '' : v);
    const maxChars = Math.max(1, Math.floor(colWidth / 4.8));
    return s.length > maxChars ? s.substring(0, maxChars - 1) + '…' : s;
  };

  let content = '';
  let y = pageHeight - margin;

  const drawLine = (cells, bold) => {
    if (y < margin) return; // skip overflow (single page)
    content += 'BT /F' + (bold ? '2' : '1') + ' ' + fontSize + ' Tf ' + margin + ' ' + y + ' Td\n';
    cells.forEach((c, i) => {
      const x = i * colWidth;
      content += '1 0 0 1 ' + x + ' 0 Tm (' + escPdf(fit(c)) + ') Tj\n';
    });
    content += 'ET\n';
    y -= lineHeight;
  };

  // Title
  content += 'BT /F2 14 Tf ' + margin + ' ' + y + ' Td (' + escPdf(baseName) + ') Tj ET\n';
  y -= 20;

  // Header row
  drawLine(headers, true);
  // Separator line
  content += '0.7 w ' + margin + ' ' + (y + 3) + ' m ' + (pageWidth - margin) + ' ' + (y + 3) + ' l S\n';
  y -= 4;

  // Data rows
  rows.forEach(r => {
    drawLine(headers.map(h => r[h]), false);
  });

  const objects = [];
  const addObj = (body) => {
    objects.push(body);
    return objects.length;
  };
  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageWidth + ' ' + pageHeight + '] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>');
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  addObj('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += (i + 1) + ' 0 obj\n' + body + '\nendobj\n';
  });
  const xrefPos = pdf.length;
  pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
  pdf += '0000000000 65535 f \n';
  offsets.forEach(off => {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  });
  pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF';

  return new Blob([pdf], { type: 'application/pdf' });
}

// Convert a Blob to a base64 data URL string (needed by the Capacitor
// Filesystem plugin, which cannot write raw Blob objects directly).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      // Strip the "data:<mime>;base64," prefix to get the raw base64 payload.
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Robust download helper that works in browsers AND Capacitor/Android WebViews.
// On native (Capacitor) platforms, <a>.click() blob downloads are silently
// blocked, so we write the file to the app cache via the Capacitor Filesystem
// plugin and open the native share sheet via the Capacitor Share plugin. This
// is the most reliable mechanism on Android WebView.
function downloadBlob(blob, fileName) {
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  // 1) Native / WebView: Capacitor Filesystem + Share plugins.
  if (isNative) {
    const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    const Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    if (Filesystem && Share && typeof Filesystem.writeFile === 'function' && typeof Share.share === 'function') {
      try {
        blobToBase64(blob).then(async (base64) => {
          const safeName = fileName.replace(/[^\w.\-]+/g, '_');
          const result = await Filesystem.writeFile({
            path: safeName,
            data: base64,
            directory: 'CACHE',
            recursive: true
          });
          const fileUri = result && result.uri ? result.uri : safeName;
          // ANTI-FLICKER: The native share sheet fires visibilitychange->hidden
          // + visualViewport resize, causing layout re-flow and visible flash.
          if (typeof window.stabilizeLayoutBeforeNativePicker === 'function') {
            window.stabilizeLayoutBeforeNativePicker();
          }
          await Share.share({
            title: fileName,
            files: [fileUri],
            dialogTitle: fileName
          });
        }).catch(err => {
          console.warn('[export] Capacitor Filesystem/Share failed, falling back to Web Share API.', err);
          shareViaWebApi(blob, fileName);
        });
        return true;
      } catch (err) {
        console.warn('[export] Capacitor Filesystem/Share threw, falling back to Web Share API.', err);
      }
    }
  }

  // 2) Native / WebView fallback: Web Share API with a File object.
  if (isNative && navigator.share) {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: fileName }).catch(err => {
          console.warn('[export] Web Share API canceled or failed:', err);
        });
        return true;
      }
    } catch (err) {
      console.warn('[export] Web Share API failed, falling back to anchor download.', err);
    }
  }

  // 3) Standard browser / fallback: anchor element download.
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('[export] downloadBlob failed.', err);
    return false;
  }
}

// Web Share API fallback used when the Capacitor plugins are unavailable.
function shareViaWebApi(blob, fileName) {
  if (navigator.share) {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: fileName }).catch(err => {
          console.warn('[export] Web Share API canceled or failed:', err);
        });
        return;
      }
    } catch (err) {
      console.warn('[export] Web Share API failed:', err);
    }
  }
  // Last-resort anchor download.
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('[export] shareViaWebApi anchor download failed.', err);
  }
}

// Fallback CSV export used when the XLSX library is unavailable or fails.
function exportRowsAsCSV(rows, fileName) {
  const headers = Object.keys(rows[0] || {});
  const escapeCell = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach(r => {
    lines.push(headers.map(h => escapeCell(r[h])).join(','));
  });
  const csv = '\uFEFF' + lines.join('\r\n'); // BOM for Excel compatibility
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, fileName);
}


  // CommonJS / Node exports for testing
  return {
    updateExportSheetDateLabels,
    get selectedExportPeriod() { return selectedExportPeriod; },
    set selectedExportPeriod(val) { selectedExportPeriod = val; },
    get selectedExportFormat() { return selectedExportFormat; },
    set selectedExportFormat(val) { selectedExportFormat = val; },
    openExportPeriodSheet,
    closeExportPeriodSheet,
    goToExportStep1,
    goToExportStep2,
    updateStep2Summary,
    selectExportOption,
    selectExportFormat,
    confirmExcelExport,
    exportToExcel,
    generatePdfBlob,
    blobToBase64,
    downloadBlob,
    shareViaWebApi,
    exportRowsAsCSV,
    buildCsvString
  };
});
