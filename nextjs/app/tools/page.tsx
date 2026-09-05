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

interface ReallocationDetail {
  excelRef: number;
  excelAccountName: string;
  mappedRef: number;
  mappedAccountName: string;
  reason: string;
}

export default function ToolsPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Periode State
  const now = new Date();
  const [targetMonth, setTargetMonth] = useState<number>(now.getMonth() + 1);
  const [targetYear, setTargetYear] = useState<number>(now.getFullYear());

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<JournalImportResult | null>(null);
  const [reallocations, setReallocations] = useState<ReallocationDetail[]>([]);

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
      setReallocations([]);
    }
  };

  const parseAndCombineDate = (val: any, year: number, month: number): string => {
    if (val === undefined || val === null) return '';
    const strVal = String(val).trim();
    if (!strVal) return '';

    const paddedMonth = String(month).padStart(2, '0');

    if (/^\d{1,2}$/.test(strVal)) {
      const dayNum = parseInt(strVal, 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const paddedDay = String(dayNum).padStart(2, '0');
        return `${year}-${paddedMonth}-${paddedDay}`;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
      return strVal;
    }

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
    setReallocations([]);
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

      // Safe Request ke Backend untuk Evaluasi Pelimpahan COA
      let displayTransactions = parsedTransactions;

      try {
        const previewRes = await fetch('/web/tools/preview-journal-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetMonth: Number(targetMonth),
            targetYear: Number(targetYear),
            transactions: parsedTransactions.map((tx) => ({
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

        const contentType = previewRes.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const previewData = await previewRes.json();
          if (previewRes.ok) {
            if (previewData.reallocations && previewData.reallocations.length > 0) {
              setReallocations(previewData.reallocations);
            }
            if (previewData.transactions && previewData.transactions.length > 0) {
              displayTransactions = previewData.transactions;
            }
          }
        }
      } catch (e) {
        // Fallback jika API preview belum tersedia di server
        console.warn('Backend preview endpoint unreachable, displaying client-parsed preview.');
      }

      setParseResult({
        isSuccess: true,
        totalTransactionsRead: parsedTransactions.length,
        totalLinesRead: totalLines,
        warnings: [],
        transactions: displayTransactions,
      });
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

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const rawErrText = await response.text();
        throw new Error(`Server returned HTML error (${response.status}). Ensure endpoint route exists & user is authenticated.`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save data to database.');
      }

      setSuccessMessage(
        `Successfully imported ${parseResult.totalTransactionsRead} journal entries for period ${targetMonth}/${targetYear}.`
      );

      setParseResult(null);
      setSelectedFile(null);
      setReallocations([]);
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

      {/* SPLIT SCREEN LAYOUT */}
      <div className="row g-4">
        {/* PANEL KIRI: FORM KONTROL & SUMMARY PELIMPAHAN */}
        <div className="col-12 col-lg-5 col-xl-4">
          <div className="card glass-card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 pt-4 pb-3 px-4">
              <h5 className="fw-bold text-white mb-0">
                <i className="bi bi-file-earmark-spreadsheet me-2 text-white"></i> Import Journal Entries
              </h5>
            </div>
            <div className="card-body px-4 py-4">
              {/* Target Import Period */}
              <div className="bg-body-tertiary rounded-3 p-3 mb-4 border border-secondary border-opacity-25">
                <label className="form-label fw-bold small text-white d-block mb-2">
                  <i className="bi bi-calendar3 me-1"></i> Target Import Period
                </label>
                <div className="row g-2">
                  <div className="col-6">
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
                  <div className="col-6">
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

              {/* Upload Input & Template */}
              <div className="mb-3">
                <label className="form-label fw-bold small text-white">Select Excel File (.xlsx)</label>
                <input
                  type="file"
                  className="form-control bg-body-tertiary text-white border-secondary fw-normal mb-2"
                  accept=".xlsx"
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-link text-white-50 text-decoration-none p-0 fw-normal small"
                  onClick={handleDownloadTemplate}
                >
                  <i className="bi bi-download me-1"></i> Download Excel Template (.xlsx)
                </button>
              </div>

              {/* Action Buttons */}
              <div className="d-grid gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-primary fw-bold rounded-3 text-white shadow-sm"
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

                {parseResult && (
                  <button
                    type="button"
                    className="btn btn-success fw-bold rounded-3 text-white shadow-sm"
                    disabled={isBusy}
                    onClick={handleConfirmImport}
                  >
                    <i className="bi bi-check2-all me-1"></i> Submit & Import Data
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* METADATA SUMMARY CARD */}
          {parseResult && (
            <div className="card border-0 glass-card rounded-4 shadow-sm mb-4">
              <div className="card-body p-4">
                <h6 className="fw-bold text-white mb-3">
                  <i className="bi bi-bar-chart-line me-2"></i> Import Metadata Summary
                </h6>
                <div className="d-flex justify-content-between border-bottom border-secondary border-opacity-25 pb-2 mb-2 small">
                  <span className="text-secondary">Total Transactions:</span>
                  <strong className="text-white">{parseResult.totalTransactionsRead} Entries</strong>
                </div>
                <div className="d-flex justify-content-between border-bottom border-secondary border-opacity-25 pb-2 mb-2 small">
                  <span className="text-secondary">Total Lines Read:</span>
                  <strong className="text-white">{parseResult.totalLinesRead} Lines</strong>
                </div>
                <div className="d-flex justify-content-between small">
                  <span className="text-secondary">Target Period:</span>
                  <strong className="text-info">
                    {monthOptions.find((m) => m.value === targetMonth)?.label} {targetYear}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* SUMMARY PELIMPAHAN AKUN (DI KIRI) */}
          {reallocations.length > 0 && (
            <div className="card border-warning bg-dark text-white rounded-4 shadow-sm">
              <div className="card-header bg-warning bg-opacity-10 border-bottom border-warning border-opacity-25 py-3 px-4">
                <h6 className="fw-bold mb-0 text-warning small">
                  <i className="bi bi-arrow-left-right me-2"></i> Account Reallocations ({reallocations.length})
                </h6>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ maxHeight: '350px' }}>
                  <table className="table table-dark table-hover mb-0 align-middle extra-small style-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr className="text-secondary">
                        <th>Original Excel</th>
                        <th>Mapped Master COA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reallocations.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <span className="badge bg-secondary me-1">{r.excelRef}</span>
                            <span className="text-white-50">{r.excelAccountName}</span>
                          </td>
                          <td>
                            <span className="badge bg-primary me-1">{r.mappedRef}</span>
                            <strong className="text-white">{r.mappedAccountName}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANEL KANAN: PREVIEW TRANSAKSI STREAM (SCROLLABLE) */}
        <div className="col-12 col-lg-7 col-xl-8">
          {parseResult ? (
            <div className="d-flex flex-column gap-3" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: '4px' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <h6 className="fw-bold text-white mb-0">
                  <i className="bi bi-journal-text me-2"></i> Preview Transactions Stream
                </h6>
                <span className="badge bg-info text-dark fw-bold">
                  {parseResult.transactions.length} Transactions Loaded
                </span>
              </div>

              {parseResult.transactions.map((tx, txIndex) => (
                <div key={txIndex} className="card border border-secondary border-opacity-25 rounded-3 shadow-sm bg-body-tertiary text-white">
                  <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-2 px-3">
                    <span className="badge bg-primary text-white fw-normal">{tx.journalType} Journal</span>
                    <strong className="text-white fw-bold"><i className="bi bi-calendar-event me-1"></i> Date: {tx.date}</strong>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-dark table-hover table-striped mb-0 align-middle small text-white">
                      <thead>
                        <tr className="text-white fw-bold">
                          <th style={{ width: '40px' }} className="text-center">#</th>
                          <th style={{ width: '80px' }} className="text-center">Ref</th>
                          <th>Account Name</th>
                          <th>Description</th>
                          <th style={{ width: '130px' }} className="text-end">Debit</th>
                          <th style={{ width: '130px' }} className="text-end">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="fw-normal text-white">
                        {tx.lines.map((line, lineIndex) => (
                          <tr key={lineIndex} className="text-white">
                            <td className="text-center text-white-50">{line.rowIndex}</td>
                            <td className="text-center fw-bold text-white">{line.refNumber}</td>
                            <td className="text-white">{line.accountName}</td>
                            <td className="text-white-50">{line.description}</td>
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
            </div>
          ) : (
            <div className="card glass-card border-0 rounded-4 shadow-sm h-100 d-flex align-items-center justify-content-center p-5 text-center text-secondary">
              <div>
                <i className="bi bi-file-earmark-arrow-up display-3 d-block mb-3 opacity-50"></i>
                <h6 className="fw-bold text-white mb-2">No Preview Generated Yet</h6>
                <p className="small mb-0 text-white-50">
                  Select an Excel file on the left panel and click <strong>Preview Entries</strong> to inspect data before importing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
