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
  transactionNumber?: string;
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

interface AccountMappingDetail {
  excelRef: number;
  excelAccountName: string;
  mappedRef: number;
  mappedAccountName: string;
  status: 'EXACT_MATCH' | 'REALLOCATED_NAME' | 'REALLOCATED_REF' | 'UNMAPPED' | string;
  reason: string;
}

interface MappingSummary {
  totalUniqueAccounts: number;
  exactMatchCount: number;
  reallocatedCount: number;
  unmappedCount: number;
  isPerfectMatch: boolean;
}

export default function ToolsPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const now = new Date();
  const [targetMonth, setTargetMonth] = useState<number>(now.getMonth() + 1);
  const [targetYear, setTargetYear] = useState<number>(now.getFullYear());

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<JournalImportResult | null>(null);
  const [accountMappings, setAccountMappings] = useState<AccountMappingDetail[]>([]);
  const [mappingSummary, setMappingSummary] = useState<MappingSummary | null>(null);

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
      setAccountMappings([]);
      setMappingSummary(null);
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
    setAccountMappings([]);
    setMappingSummary(null);
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
      const tempMappings: Record<string, AccountMappingDetail> = {};
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

          const refNum = Number(refVal) || 0;

          // Membangun fallback mapping untuk sisi client jika backend gagal
          const mapKey = `${refNum}-${accountName}`;
          if (!tempMappings[mapKey]) {
            tempMappings[mapKey] = {
              excelRef: refNum,
              excelAccountName: accountName,
              mappedRef: refNum,
              mappedAccountName: accountName,
              status: 'PENDING',
              reason: 'Menunggu verifikasi backend...',
            };
          }

          const line: JournalLineImport = {
            rowIndex: index + 2,
            refNumber: refNum,
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

      let displayTransactions = parsedTransactions;
      let finalMappings = Object.values(tempMappings);

      // Set fallback mapping sebelum memanggil backend
      setAccountMappings(finalMappings);

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
            // Override dengan data valid dari backend
            if (previewData.accountMappings && previewData.accountMappings.length > 0) {
              finalMappings = previewData.accountMappings;
              setAccountMappings(finalMappings);
            }
            if (previewData.summary) {
              setMappingSummary(previewData.summary);
            }
            if (previewData.transactions && previewData.transactions.length > 0) {
              displayTransactions = previewData.transactions;
            }
          }
        }
      } catch (e) {
        console.warn('Backend preview endpoint unreachable, displaying client-parsed preview.');
        // Jika gagal, ubah status fallback menjadi unverified
        finalMappings = finalMappings.map(m => ({ ...m, status: 'UNVERIFIED', reason: 'Gagal terhubung ke server.' }));
        setAccountMappings(finalMappings);
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
        throw new Error(`Server returned error (${response.status}). Ensure API route exists.`);
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
      setAccountMappings([]);
      setMappingSummary(null);
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

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'EXACT_MATCH':
        return <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25"><i className="ti ti-check me-1"></i>Presisi 100%</span>;
      case 'REALLOCATED_NAME':
      case 'REALLOCATED_REF':
        return <span className="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25"><i className="ti ti-arrow-right-circle me-1"></i>Dilimpahkan</span>;
      case 'UNMAPPED':
        return <span className="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25"><i className="ti ti-x me-1"></i>Tdk Terdaftar</span>;
      case 'UNVERIFIED':
        return <span className="badge bg-secondary bg-opacity-20 text-secondary border border-secondary border-opacity-25">Offline</span>;
      default:
        return <span className="badge bg-info bg-opacity-20 text-info border border-info border-opacity-25">Diproses</span>;
    }
  };

  return (
    <div 
      className="container-fluid py-4 px-4 text-white"
      style={{ fontFamily: "'Aptos', 'Aptos Display', system-ui, -apple-system, sans-serif" }}
    >
      {/* Alert Messages */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm rounded-3 mb-4 text-white fw-normal" role="alert">
          <i className="ti ti-circle-check fs-5 me-2 align-middle"></i> {successMessage}
          <button type="button" className="btn-close btn-close-white" onClick={() => setSuccessMessage(null)}></button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm rounded-3 mb-4 text-white fw-normal" role="alert">
          <i className="ti ti-alert-triangle fs-5 me-2 align-middle"></i> {errorMessage}
          <button type="button" className="btn-close btn-close-white" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      {/* SPLIT SCREEN LAYOUT */}
      <div className="row g-4">
        {/* PANEL KIRI: FORM KONTROL & DETAIL PEMETAAN COA */}
        <div className="col-12 col-lg-5 col-xl-4">
          <div className="card glass-card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 pt-4 pb-3 px-4">
              <h5 className="fw-bold text-white mb-0 d-flex align-items-center">
                <i className="ti ti-file-spreadsheet me-2 fs-4 text-white"></i> Import Journal Entries
              </h5>
            </div>
            <div className="card-body px-4 py-4">
              {/* Target Import Period */}
              <div className="bg-body-tertiary rounded-3 p-3 mb-4 border border-secondary border-opacity-25">
                <label className="form-label fw-bold small text-white d-block mb-2">
                  <i className="ti ti-calendar me-1 align-middle"></i> Target Import Period
                </label>
                <div className="row g-2">
                  <div className="col-6">
                    <select
                      className="form-select bg-dark text-white border-secondary small fw-normal"
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
                      className="form-select bg-dark text-white border-secondary small fw-normal"
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
                  className="btn btn-sm btn-link text-white-50 text-decoration-none p-0 fw-normal small d-inline-flex align-items-center"
                  onClick={handleDownloadTemplate}
                >
                  <i className="ti ti-download me-1 fs-6"></i> Download Excel Template (.xlsx)
                </button>
              </div>

              {/* Action Buttons */}
              <div className="d-grid gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-primary fw-bold rounded-3 text-white shadow-sm d-inline-flex align-items-center justify-content-center"
                  disabled={!selectedFile || isBusy}
                  onClick={handlePreview}
                >
                  {isBusy ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  ) : (
                    <i className="ti ti-eye me-2 fs-5"></i>
                  )}
                  Preview Entries
                </button>

                {parseResult && (
                  <button
                    type="button"
                    className="btn btn-success fw-bold rounded-3 text-white shadow-sm d-inline-flex align-items-center justify-content-center"
                    disabled={isBusy || (mappingSummary && mappingSummary.unmappedCount > 0)}
                    onClick={handleConfirmImport}
                  >
                    <i className="ti ti-check-all me-1 fs-5"></i> Submit & Import Data
                  </button>
                )}
                
                {/* Peringatan Jika Ada Akun Tdk Terdaftar */}
                {mappingSummary && mappingSummary.unmappedCount > 0 && (
                  <div className="mt-2 text-danger small text-center fw-bold">
                    <i className="ti ti-alert-circle me-1"></i>Terdapat akun yang tidak terdaftar. Perbaiki Master COA sebelum import.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TABEL LENGKAP PEMETAAN DAN PELIMPAHAN AKUN SELALU MUNCUL */}
          {accountMappings.length > 0 && (
            <div className="card border-0 glass-card text-white rounded-4 shadow-sm mb-4">
              <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-white small d-flex align-items-center">
                  <i className="ti ti-list-check me-2 fs-5 text-info"></i> Account Mapping Status
                </h6>
                <span className="badge bg-primary text-white fw-bold">
                  {accountMappings.length} Akun
                </span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ maxHeight: '380px' }}>
                  <table className="table table-dark table-hover mb-0 align-middle style-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr className="text-secondary fw-bold border-bottom border-secondary border-opacity-25">
                        <th className="ps-4">Input Excel</th>
                        <th>Master COA Baku</th>
                        <th className="text-center pe-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="fw-normal">
                      {accountMappings.map((m, i) => (
                        <tr key={i} className="border-bottom border-secondary border-opacity-10">
                          <td className="ps-4">
                            <span className="badge bg-secondary me-2 font-monospace">{m.excelRef}</span>
                            <span className="text-white-50">{m.excelAccountName}</span>
                          </td>
                          <td>
                            {m.mappedRef > 0 ? (
                              <>
                                <span className="badge bg-primary me-2 font-monospace">{m.mappedRef}</span>
                                <strong className="text-white fw-bold">{m.mappedAccountName}</strong>
                              </>
                            ) : (
                              <span className="text-danger fst-italic">Menunggu Registrasi...</span>
                            )}
                          </td>
                          <td className="text-center pe-4">
                            {renderStatusBadge(m.status)}
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

        {/* PANEL KANAN: PREVIEW TRANSAKSI STREAM */}
        <div className="col-12 col-lg-7 col-xl-8">
          {parseResult ? (
            <div className="d-flex flex-column gap-3" style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: '4px' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <h6 className="fw-bold text-white mb-0 d-flex align-items-center">
                  <i className="ti ti-file-text me-2 fs-5"></i> Preview Transactions Stream
                </h6>
                <span className="badge bg-info text-dark fw-bold">
                  {parseResult.transactions.length} Transactions Loaded
                </span>
              </div>

              {parseResult.transactions.map((tx, txIndex) => (
                <div key={txIndex} className="card border border-secondary border-opacity-25 rounded-3 shadow-sm bg-body-tertiary text-white">
                  <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-2 px-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-primary text-white fw-normal">{tx.journalType} Journal</span>
                      {tx.transactionNumber && (
                        <span className="badge bg-dark border border-secondary text-info font-monospace d-inline-flex align-items-center">
                          <i className="ti ti-hash me-1 fs-6"></i>{tx.transactionNumber}
                        </span>
                      )}
                    </div>
                    <strong className="text-white fw-bold d-inline-flex align-items-center">
                      <i className="ti ti-calendar-event me-1 fs-5"></i> Date: {tx.date}
                    </strong>
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
                        {tx.lines.map((line, lineIndex) => {
                          const mapping = accountMappings.find(m => m.excelRef === line.refNumber || m.excelAccountName === line.accountName);
                          const isUnmapped = mapping?.status === 'UNMAPPED';
                          
                          return (
                            <tr key={lineIndex} className={isUnmapped ? 'bg-danger bg-opacity-10 text-danger' : 'text-white'}>
                              <td className="text-center text-white-50">{line.rowIndex}</td>
                              <td className="text-center fw-bold font-monospace">{line.refNumber}</td>
                              <td>
                                {line.accountName}
                                {isUnmapped && <i className="ti ti-alert-triangle ms-2 text-danger" title="Akun ini tidak terdaftar di sistem"></i>}
                              </td>
                              <td className="text-white-50">{line.description}</td>
                              <td className="text-end fw-bold">
                                {line.debit !== null ? formatIDR(line.debit) : '-'}
                              </td>
                              <td className="text-end fw-bold">
                                {line.credit !== null ? formatIDR(line.credit) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-group-divider fw-bold text-white">
                        <tr>
                          <td colSpan={4} className="text-end text-white fw-bold">Total Amount:</td>
                          <td className="text-end text-white fw-bold">
                            {formatIDR(tx.lines.reduce((acc, l) => acc + (l.debit || 0), 0))}
                          </td>
                          <td className="text-end text-white fw-bold">
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
                <i className="ti ti-file-upload display-3 d-block mb-3 opacity-50"></i>
                <h6 className="fw-bold text-white mb-2">No Preview Generated Yet</h6>
                <p className="small mb-0 text-white-50 fw-normal">
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
