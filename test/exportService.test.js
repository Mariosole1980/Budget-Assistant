const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Ensure Blob is polyfilled if running in older Node versions (Node 18+ has global Blob)
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = class MockBlob {
    constructor(parts, opts = {}) {
      this.parts = parts;
      this.type = opts.type || '';
    }
  };
}

describe('ExportService Module Tests', () => {
  let exportService;

  before(() => {
    exportService = require('../js/exportService.js');
  });

  it('exports all expected functions and getters', () => {
    assert.strictEqual(typeof exportService.buildCsvString, 'function');
    assert.strictEqual(typeof exportService.generatePdfBlob, 'function');
    assert.strictEqual(typeof exportService.exportRowsAsCSV, 'function');
    assert.strictEqual(typeof exportService.selectExportFormat, 'function');
    assert.strictEqual(typeof exportService.selectExportOption, 'function');
    assert.strictEqual(typeof exportService.exportToExcel, 'function');
    assert.strictEqual(typeof exportService.confirmExcelExport, 'function');
    assert.strictEqual(typeof exportService.openExportPeriodSheet, 'function');
    assert.strictEqual(typeof exportService.closeExportPeriodSheet, 'function');
    assert.strictEqual(typeof exportService.downloadBlob, 'function');
  });

  describe('1. CSV Building & RFC 4180 Escaping', () => {
    it('returns BOM for empty rows', () => {
      const csv = exportService.buildCsvString([]);
      assert.strictEqual(csv, '\uFEFF');
    });

    it('formats headers and data rows correctly with UTF-8 BOM', () => {
      const rows = [
        { Date: '2026-09-01', Type: 'Expense', Amount: 42.50, Category: 'Groceries' },
        { Date: '2026-09-02', Type: 'Income', Amount: 1500.00, Category: 'Salary' }
      ];
      const csv = exportService.buildCsvString(rows);
      assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
      assert.ok(csv.includes('Date,Type,Amount,Category'));
      assert.ok(csv.includes('2026-09-01,Expense,42.5,Groceries'));
      assert.ok(csv.includes('2026-09-02,Income,1500,Salary'));
    });

    it('escapes cells containing commas, quotes, and newlines', () => {
      const rows = [
        {
          Note: 'Bought apples, oranges and milk',
          Desc: 'Quoted "value" here',
          Multi: 'Line 1\nLine 2'
        }
      ];
      const csv = exportService.buildCsvString(rows);
      // Comma escaped in quotes
      assert.ok(csv.includes('"Bought apples, oranges and milk"'), 'Comma must be wrapped in quotes');
      // Double quotes escaped
      assert.ok(csv.includes('"Quoted ""value"" here"'), 'Inner quotes must be doubled');
      // Newlines wrapped in quotes
      assert.ok(csv.includes('"Line 1\nLine 2"'), 'Multiline cell must be wrapped in quotes');
    });
  });

  describe('2. Dependency-Free PDF Generation', () => {
    it('generates a valid PDF blob with PDF-1.4 header, xref, and %%EOF', async () => {
      const rows = [
        {
          'Ημερομηνία': '2026-09-01',
          'Τύπος': 'Expense',
          'Ποσό': 25.00,
          'Κατηγορία': 'Food',
          'Υποκατηγορία': 'Supermarket',
          'Λογαριασμός': 'Cash',
          'Σημείωση': 'Weekly shopping'
        }
      ];

      const blob = exportService.generatePdfBlob(rows, 'Budget_Assistant_Test_Report');
      assert.ok(blob, 'generatePdfBlob should return a Blob');
      assert.strictEqual(blob.type, 'application/pdf');

      // If text() is available on Blob, inspect raw content
      if (typeof blob.text === 'function') {
        const text = await blob.text();
        assert.ok(text.startsWith('%PDF-1.4'), 'Must start with PDF 1.4 header');
        assert.ok(text.includes('/Type /Catalog'), 'Must contain PDF Catalog object');
        assert.ok(text.includes('/Type /Pages'), 'Must contain PDF Pages object');
        assert.ok(text.includes('/BaseFont /Helvetica'), 'Must embed Helvetica font');
        assert.ok(text.includes('Budget_Assistant_Test_Report'), 'Must include title');
        assert.ok(text.includes('%%EOF'), 'Must end with %%EOF marker');
      }
    });

    it('handles empty or special character rows in PDF generation without crashing', () => {
      const rows = [
        { Col1: 'Parentheses (and) backslashes \\ text', Col2: null, Col3: undefined }
      ];
      const blob = exportService.generatePdfBlob(rows, 'Special_Chars_Test');
      assert.ok(blob, 'Should handle escaping gracefully');
      assert.strictEqual(blob.type, 'application/pdf');
    });
  });

  describe('3. Format and Option State Management', () => {
    it('updates selectedExportFormat correctly', () => {
      exportService.selectedExportFormat = 'csv';
      assert.strictEqual(exportService.selectedExportFormat, 'csv');

      exportService.selectedExportFormat = 'xlsx';
      assert.strictEqual(exportService.selectedExportFormat, 'xlsx');

      exportService.selectedExportFormat = 'pdf';
      assert.strictEqual(exportService.selectedExportFormat, 'pdf');
    });

    it('updates selectedExportPeriod correctly', () => {
      exportService.selectedExportPeriod = 'prev-month';
      assert.strictEqual(exportService.selectedExportPeriod, 'prev-month');

      exportService.selectedExportPeriod = 'all';
      assert.strictEqual(exportService.selectedExportPeriod, 'all');

      exportService.selectedExportPeriod = 'current-month';
      assert.strictEqual(exportService.selectedExportPeriod, 'current-month');
    });
  });
});
