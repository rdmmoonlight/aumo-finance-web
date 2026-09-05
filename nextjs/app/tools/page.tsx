'use client';

import React, { useState } from 'react';

interface JournalLineImport {
  rowIndex: number;
  refNumber: number;
  accountName: string;
  description: string;
  debit: number | null;
  credit: number | null;
  isNewAccount: boolean;
}

interface JournalTransactionImport {
  date: string;
  journalType: string;
  lines: JournalLineImport[];
}

interface JournalImportResult {
  isSuccess: boolean;
  message?: string;
  totalTransactionsRead: number;
  totalLinesRead: number;
  warnings: string[];
  transactions: JournalTransactionImport[];
}

export default function ToolsPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Periode State (Default: Bulan & Tahun Saat Ini)
  const now = new Date();
  const [targetMonth, setTargetMonth] = useState<number>(now.getMonth() + 1);
  const [targetYear, setTargetYear] = useState<number>(now.getFullYear());

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<JournalImportResult | null>(null);

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setParseResult(null);
      setErrorMessage(null);
    }
  };

  // Helper Pembacaan Tanggal & Penggabungan dengan Periode Pilihan User
  const parseAndCombineDate = (val: any, year: number, month: number): string => {
    if (val === undefined || val === null) return '';
    const strVal = String(val).trim();
    if (!strVal) return '';

    const paddedMonth = String(month).padStart(2, '0');

    // Jika input berupa angka hari (1 s/d 31)
    if (/^\d{1,2}$/.test(strVal)) {
      const dayNum = parseInt(strVal, 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const paddedDay = String(dayNum).padStart(2, '0');
        return `${year}-${paddedMonth}-${paddedDay}`;
      }
    }

    // Jika diisi format full YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
      return strVal;
    }

    // Format DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(strVal)) {
      const parts = strVal.split('-');
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    return strVal;
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an Excel file first.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsBusy(true);

    try {
      if (!(window as any).XLSX) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const XLSX = (window as any).XLSX;
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });

      const parsedTransactions: JournalTransactionImport[] = [];
      let totalLines = 0;

      ['GJ', 'AJ'].forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });

        let currentDate = '';
        const groupedByDate: { [key: string]: JournalLineImport[] } = {};

        rows.forEach((row, index) => {
          const rawDate = row['Date'] ?? row['date'] ?? row['DATE'] ?? '';
          const parsedDateStr = parseAndCombineDate(rawDate, targetYear, targetMonth);

          if (parsedDateStr !== '') {
            currentDate = parsedDateStr;
          }

          if (!currentDate) return;

          const accountName = String(row['Account Name'] ?? row['accountName'] ?? row['ACCOUNT NAME'] ?? '').trim();
          const description = String(row['Description'] ?? row['description'] ?? row['DESCRIPTION'] ?? '').trim();
          const refVal = row['Ref'] ?? row['ref'] ?? row['REF'] ?? 0;

          if (!accountName && !description && !refVal) return;

          const rawDebit = row['Debit'] ?? row['debit'] ?? row['DEBIT'] ?? '';
          const rawCredit = row['Credit'] ?? row['credit'] ?? row['CREDIT'] ?? '';

          const line: JournalLineImport = {
            rowIndex: index + 2,
            refNumber: Number(refVal) || 0,
            accountName: accountName,
            description: description,
            debit: rawDebit !== '' && !isNaN(Number(rawDebit)) ? Number(rawDebit) : null,
            credit: rawCredit !== '' && !isNaN(Number(rawCredit)) ? Number(rawCredit) : null,
            isNewAccount: false,
          };

          if (!groupedByDate[currentDate]) {
            groupedByDate[currentDate] = [];
          }
          groupedByDate[currentDate].push(line);
          totalLines++;
        });

        Object.keys(groupedByDate).forEach((dateKey) => {
          parsedTransactions.push({
            date: dateKey,
            journalType: sheetName === 'GJ' ? 'General' : 'Adjusting',
            lines: groupedByDate[dateKey],
          });
        });
      });

      if (parsedTransactions.length === 0) {
        throw new Error('No valid transaction entries found in GJ or AJ sheets.');
      }

      setParseResult({
        isSuccess: true,
        totalTransactionsRead: parsedTransactions.length,
        totalLinesRead: totalLines,
        warnings: [],
        transactions: parsedTransactions,
      });

      if ((window as any).aumoModal) {
        (window as any).aumoModal.show('indexPreviewModal');
      }
    } catch (err: any) {
      setErrorMessage(`Failed to process file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) {
      setErrorMessage('No valid transactions to import.');
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch('/web/tools/import-journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetMonth: Number(targetMonth),
          targetYear: Number(targetYear),
          transactions: parseResult.transactions.map((tx) => ({
            date: tx.date,
            journalType: tx.journalType,
            lines: tx.lines.map((l) => ({
              refNumber: l.refNumber,
              accountName: l.accountName,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            })),
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save data to database.');
      }

      const reallocInfo = result.reallocatedCount ? ` (${result.reallocatedCount} entries reallocated to master COA)` : '';
      setSuccessMessage(
        `Successfully imported ${parseResult.totalTransactionsRead} journal entries for period ${targetMonth}/${targetYear}.${reallocInfo}`
      );

      if ((window as any).aumoModal) {
        (window as any).aumoModal.hide('indexPreviewModal');
      }

      setParseResult(null);
      setSelectedFile(null);
    } catch (err: any) {
      setErrorMessage(`Failed to save entries: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      if (!(window as any).XLSX) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const XLSX = (window as any).XLSX;
      const headers = [['Date', 'Account Name', 'Description', 'Ref', 'Debit', 'Credit']];

      const sampleGJ = [
        ['1', 'Kas Utama', 'Setoran Modal Awal', 101, 15000000, ''],
        ['', 'Modal Pemilik', 'Setoran Modal Awal', 301, '', 15000000],
        ['3', 'Beban Listrik', 'Pembayaran PLN', 502, 500000, ''],
        ['', 'Kas Utama', 'Pembayaran PLN', 101, '', 500000],
      ];

      const sampleAJ = [
        ['4', 'Beban Sewa Kantor', 'Akrual Sewa', 501, 2500000, ''],
        ['', 'Utang Usaha', 'Akrual Sewa', 201, '', 2500000],
      ];

      const wb = XLSX.utils.book_new();

      const wsGJ = XLSX.utils.aoa_to_sheet([...headers, ...sampleGJ]);
      XLSX.utils.book_append_sheet(wb, wsGJ, 'GJ');

      const wsAJ = XLSX.utils.aoa_to_sheet([...headers, ...sampleAJ]);
      XLSX.utils.book_append_sheet(wb, wsAJ, 'AJ');

      XLSX.writeFile(wb, 'Journal_Import_Template.xlsx');
    } catch (err) {
      setErrorMessage('Gagal mengunduh template. Pastikan koneksi internet stabil.');
    }
  };

  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div 
      className="container-fluid py-4 px-4 text-white"
      style={{ fontFamily: "'Aptos', 'Aptos Display', system-ui, sans-serif" }}
    >
      {/* Alert Messages */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm rounded-3 mb-4 text-white fw-normal" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMessage}
          <button type="button" className="btn-close btn-close-white" onClick={() => setSuccessMessage(null)}></button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm rounded-3 mb-4 text-white fw-normal" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {errorMessage}
          <button type="button" className="btn-close btn-close-white" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-xl-8 mx-auto">
          <div className="card glass-card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 pt-4 pb-3 px-4">
              <h5 className="fw-bold text-white mb-0">
                <i className="bi bi-file-earmark-spreadsheet me-2 text-white"></i> Import Journal Entries
              </h5>
            </div>
            <div className="card-body px-4 py-4 d-flex flex-column">
              <p className="text-white fw-normal small mb-4">
                Upload batch journal entries using standard <code>.xlsx</code> format. Target period will be created automatically if not existing.
              </p>

              {/* Pemilihan Periode Target */}
              <div className="bg-body-tertiary rounded-3 p-3 mb-4 border border-secondary border-opacity-25">
                <label className="form-label fw-bold small text-white d-block mb-2">
                  <i className="bi bi-calendar3 me-1"></i> Target Import Period
                </label>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <select
                      className="form-select bg-dark text-white border-secondary small"
                      value={targetMonth}
                      onChange={(e) => setTargetMonth(Number(e.target.value))}
                    >
                      {monthOptions.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <select
                      className="form-select bg-dark text-white border-secondary small"
                      value={targetYear}
                      onChange={(e) => setTargetYear(Number(e.target.value))}
                    >
                      {[2024, 2025, 2026, 2027, 2028].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Template Info */}
              <div className="bg-body-tertiary rounded-3 p-3 mb-4 border border-secondary border-opacity-25">
                <span className="d-block fw-bold small mb-2 text-white">Required Columns (Row 1 Header):</span>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-secondary text-white fw-normal">Date</span>
                  <span className="badge bg-secondary text-white fw-normal">Account Name</span>
                  <span className="badge bg-secondary text-white fw-normal">Description</span>
                  <span className="badge bg-secondary text-white fw-normal">Ref</span>
                  <span className="badge bg-secondary text-white fw-normal">Debit</span>
                  <span className="badge bg-secondary text-white fw-normal">Credit</span>
                </div>
                <ul className="text-white fw-normal small mb-3 ps-3">
                  <li>2 Worksheets: <strong>GJ</strong> (General Journal) and <strong>AJ</strong> (Adjusting Journal).</li>
                  <li><strong>Ref</strong> and <strong>Account Name</strong> will be automatically mapped to standard Chart of Accounts in the system.</li>
                </ul>
                <button type="button" className="btn btn-sm btn-outline-light text-white fw-normal rounded-3" onClick={handleDownloadTemplate}>
                  <i className="bi bi-download me-1"></i> Download Template (.xlsx)
                </button>
              </div>

              {/* Upload Input */}
              <div className="mb-3 mt-auto">
                <label className="form-label fw-bold small text-white">Select Excel File (.xlsx)</label>
                <input
                  type="file"
                  className="form-control bg-body-tertiary text-white border-secondary fw-normal"
                  accept=".xlsx"
                  onChange={handleFileSelected}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary px-4 fw-bold shadow-sm w-100 rounded-3 text-white"
                disabled={!selectedFile || isBusy}
                onClick={handlePreview}
              >
                {isBusy ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                ) : (
                  <i className="bi bi-eye me-2"></i>
                )}
                Preview Entries
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INSTANT PREVIEW MODAL */}
      <div className="modal fade" id="indexPreviewModal" tabIndex={-1} aria-labelledby="indexPreviewModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content rounded-4 border-0 shadow bg-dark text-white border border-secondary border-opacity-25" style={{ fontFamily: "'Aptos', 'Aptos Display', system-ui, sans-serif" }}>
            <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white" id="indexPreviewModalLabel">
                  <i className="bi bi-file-earmark-check me-2 text-white"></i> Journal Entries Preview
                </h5>
                <small className="text-white fw-normal">
                  Target Period: {monthOptions.find(m => m.value === targetMonth)?.label} {targetYear}
                </small>
              </div>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div className="modal-body p-4 text-white">
              {parseResult && (
                <>
                  {parseResult.transactions.map((tx, txIndex) => (
                    <div key={txIndex} className="card border border-secondary border-opacity-25 mb-3 rounded-3 shadow-sm bg-body-tertiary text-white">
                      <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-2 px-3">
                        <span className="badge bg-primary text-white fw-normal">{tx.journalType} Journal</span>
                        <strong className="text-white fw-bold"><i className="bi bi-calendar-event me-1"></i> Date: {tx.date}</strong>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-dark table-hover table-striped mb-0 align-middle small text-white">
                          <thead>
                            <tr className="text-white fw-bold">
                              <th style={{ width: '50px' }} className="text-center">#</th>
                              <th style={{ width: '100px' }} className="text-center">Ref</th>
                              <th>Account Name</th>
                              <th>Description</th>
                              <th style={{ width: '150px' }} className="text-end">Debit</th>
                              <th style={{ width: '150px' }} className="text-end">Credit</th>
                            </tr>
                          </thead>
                          <tbody className="fw-normal text-white">
                            {tx.lines.map((line, lineIndex) => (
                              <tr key={lineIndex} className="text-white">
                                <td className="text-center text-white">{line.rowIndex}</td>
                                <td className="text-center fw-bold text-white">{line.refNumber}</td>
                                <td className="text-white">{line.accountName}</td>
                                <td className="text-white">{line.description}</td>
                                <td className="text-end fw-bold text-white">
                                  {line.debit !== null ? formatIDR(line.debit) : '-'}
                                </td>
                                <td className="text-end fw-bold text-white">
                                  {line.credit !== null ? formatIDR(line.credit) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-group-divider fw-bold text-white">
                            <tr>
                              <td colSpan={4} className="text-end text-white">Total Amount:</td>
                              <td className="text-end text-white">
                                {formatIDR(tx.lines.reduce((acc, l) => acc + (l.debit || 0), 0))}
                              </td>
                              <td className="text-end text-white">
                                {formatIDR(tx.lines.reduce((acc, l) => acc + (l.credit || 0), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="modal-footer border-top border-secondary border-opacity-25 px-4 py-3">
              <button type="button" className="btn btn-outline-light text-white rounded-3 fw-normal" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn btn-success rounded-3 px-4 fw-bold shadow-sm text-white"
                disabled={!parseResult || parseResult.transactions.length === 0 || isBusy}
                onClick={handleConfirmImport}
              >
                {isBusy ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                ) : (
                  <i className="bi bi-check2-all me-1"></i>
                )}
                Import Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
