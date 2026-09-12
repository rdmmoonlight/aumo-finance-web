'use client';

import React, { useState, useEffect } from 'react';

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

interface DbAccount {
  id: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  role: string;
  isActive: boolean;
  balance: number;
}

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://aumonext-api.onrender.com';

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

  const [dbMasterAccounts, setDbMasterAccounts] = useState<DbAccount[]>([]);
  const [isLoadingCoa, setIsLoadingCoa] = useState<boolean>(false);

  const fetchDbAccounts = async () => {
    setIsLoadingCoa(true);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.accounts)) {
          setDbMasterAccounts(data.accounts);
        }
      }
    } catch (err) {
      console.error('Error fetching COA:', err);
    } finally {
      setIsLoadingCoa(false);
    }
  };

  useEffect(() => {
    fetchDbAccounts();
  }, []);

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

  // PERBAIKAN: PAKSA TAHUN DAN BULAN MENGIKUTI SELEKSI DROPDOWN UI (SEPTEMBER 2026)
  const parseAndCombineDate = (val: any, year: number, month: number): string => {
    if (val === undefined || val === null) return '';
    const strVal = String(val).trim();
    if (!strVal) return '';

    const paddedMonth = String(month).padStart(2, '0');

    let dayNum = 1;
    if (/^\d{1,2}$/.test(strVal)) {
      dayNum = parseInt(strVal, 10);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
      dayNum = parseInt(strVal.split('-')[2], 10);
    } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(strVal)) {
      dayNum = parseInt(strVal.split('-')[0], 10);
    }

    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      dayNum = 1;
    }

    const paddedDay = String(dayNum).padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
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

          const mapKey = `${refNum}|||${accountName}`;
          if (!tempMappings[mapKey]) {
            tempMappings[mapKey] = {
              excelRef: refNum,
              excelAccountName: accountName,
              mappedRef: 0,
              mappedAccountName: '',
              status: 'UNMAPPED',
              reason: 'Silakan pilih akun pelimpahan COA DB secara manual',
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

      const finalMappings = Object.values(tempMappings);
      setAccountMappings(finalMappings);

      const unmappedCount = finalMappings.filter((m) => m.status === 'UNMAPPED' || m.mappedRef === 0).length;

      setMappingSummary({
        totalUniqueAccounts: finalMappings.length,
        exactMatchCount: 0,
        reallocatedCount: 0,
        unmappedCount,
        isPerfectMatch: unmappedCount === 0,
      });

      setParseResult({
        isSuccess: true,
        totalTransactionsRead: parsedTransactions.length,
        totalLinesRead: totalLines,
        warnings: [],
        transactions: parsedTransactions,
      });

    } catch (err: any) {
      setErrorMessage(`Failed to process file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleInlineReallocationChange = (excelRef: number, excelName: string, selectedTargetRef: number) => {
    const selectedOption = dbMasterAccounts.find((o) => o.referenceNumber === selectedTargetRef);

    const updated = accountMappings.map((m) => {
      if (m.excelRef === excelRef && m.excelAccountName === excelName) {
        if (!selectedOption || selectedTargetRef === 0) {
          return {
            ...m,
            mappedRef: 0,
            mappedAccountName: '',
            status: 'UNMAPPED',
            reason: 'Belum dipetakan ke COA DB',
          };
        }

        const isMatchExact =
          m.excelRef === selectedOption.referenceNumber &&
          m.excelAccountName.toLowerCase() === selectedOption.accountName.toLowerCase();

        return {
          ...m,
          mappedRef: selectedOption.referenceNumber,
          mappedAccountName: selectedOption.accountName,
          status: isMatchExact ? 'EXACT_MATCH' : 'REALLOCATED_REF',
          reason: `Dilimpahkan ke [${selectedOption.referenceNumber}] ${selectedOption.accountName}`,
        };
      }
      return m;
    });

    setAccountMappings([...updated]);

    const unmappedCount = updated.filter((m) => m.status === 'UNMAPPED' || m.mappedRef === 0).length;
    const reallocatedCount = updated.filter((m) => m.status.includes('REALLOCATED')).length;
    const exactMatchCount = updated.filter((m) => m.status === 'EXACT_MATCH').length;

    setMappingSummary({
      totalUniqueAccounts: updated.length,
      exactMatchCount,
      reallocatedCount,
      unmappedCount,
      isPerfectMatch: unmappedCount === 0,
    });
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) {
      setErrorMessage('No valid transactions to import.');
      return;
    }

    setIsBusy(true);
    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/tools/import-journal-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetMonth: Number(targetMonth),
          targetYear: Number(targetYear),
          customMappings: accountMappings,
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

  return (
    <div
      className="container-fluid py-4 px-4 text-white"
      style={{ fontFamily: "'Aptos', 'Aptos Display', system-ui, -apple-system, sans-serif" }}
    >
      {/* Alert Messages */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm rounded-3 mb-4 text-white fw-normal" role="alert">
          <i className="ti ti-circle-check fs-5 me-2 align-middle text-white"></i> {successMessage}
          <button type="button" className="btn-close btn-close-white" onClick={() => setSuccessMessage(null)}></button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm rounded-3 mb-4 text-white fw-normal" role="alert">
          <i className="ti ti-alert-triangle fs-5 me-2 align-middle text-white"></i> {errorMessage}
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
                  <i className="ti ti-calendar me-1 align-middle text-white"></i> Target Import Period
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
                  className="btn btn-sm btn-link text-white text-decoration-none p-0 fw-normal small d-inline-flex align-items-center"
                  onClick={handleDownloadTemplate}
                >
                  <i className="ti ti-download me-1 fs-6 text-white"></i> Download Excel Template (.xlsx)
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
                    <i className="ti ti-eye me-2 fs-5 text-white"></i>
                  )}
                  Preview Entries
                </button>

                {parseResult && (
                  <button
                    type="button"
                    className="btn btn-success fw-bold rounded-3 text-white shadow-sm d-inline-flex align-items-center justify-content-center"
                    disabled={Boolean(isBusy || (mappingSummary && mappingSummary.unmappedCount > 0))}
                    onClick={handleConfirmImport}
                  >
                    <i className="ti ti-check-all me-1 fs-5 text-white"></i> Submit & Import Data
                  </button>
                )}

                {mappingSummary && mappingSummary.unmappedCount > 0 && (
                  <div className="mt-2 text-danger small text-center fw-bold">
                    <i className="ti ti-alert-circle me-1"></i>Terdapat akun yang belum dipetakan. Silakan pelimpahkan akun terlebih dahulu.
                  </div>
                )}
              </div>
            </div>
          </div>

          {accountMappings.length > 0 && (
            <div className="card border-0 glass-card text-white rounded-4 shadow-sm mb-4">
              <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3 px-4 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-white small d-flex align-items-center">
                  <i className="ti ti-list-check me-2 fs-5 text-info"></i> Account Mapping Status
                </h6>
                <span className="badge bg-primary text-white fw-bold">
                  {accountMappings.length} Akun Unik
                </span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive" style={{ maxHeight: '420px' }}>
                  <table className="table table-dark table-hover mb-0 align-middle style-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr className="text-white fw-bold border-bottom border-secondary border-opacity-25 bg-secondary bg-opacity-20">
                        <th className="ps-3 text-white" style={{ width: '45%' }}>Input Excel</th>
                        <th className="pe-3 text-white" style={{ width: '55%' }}>Master COA DB (Pilih Manual)</th>
                      </tr>
                    </thead>
                    <tbody className="fw-normal text-white">
                      {accountMappings.map((m, i) => {
                        const isMapped = m.mappedRef > 0;

                        return (
                          <tr key={i} className={`border-bottom border-secondary border-opacity-25 ${isMapped ? 'bg-warning bg-opacity-10' : ''}`}>
                            <td className="ps-3">
                              <span className="badge bg-secondary text-white me-1 font-monospace">{m.excelRef}</span>
                              <span className="text-white fw-bold">{m.excelAccountName}</span>
                            </td>
                            <td className="pe-3">
                              <select
                                className={`form-select form-select-sm text-white fw-bold ${
                                  isMapped
                                    ? 'bg-warning bg-opacity-20 border-warning text-warning'
                                    : 'bg-danger bg-opacity-20 border-danger'
                                }`}
                                value={m.mappedRef || 0}
                                onChange={(e) => handleInlineReallocationChange(m.excelRef, m.excelAccountName, Number(e.target.value))}
                                style={{ fontSize: '0.8rem' }}
                                disabled={isLoadingCoa}
                              >
                                <option value={0}>-- Pilih Pelimpahan Akun COA --</option>
                                {dbMasterAccounts.map((opt) => (
                                  <option key={opt.id} value={opt.referenceNumber} className="bg-dark text-white">
                                    [{opt.referenceNumber}] {opt.accountName} ({opt.type})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
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
                  <i className="ti ti-file-text me-2 fs-5 text-white"></i> Preview Transactions Stream
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
                          <i className="ti ti-hash me-1 fs-6 text-info"></i>{tx.transactionNumber}
                        </span>
                      )}
                    </div>
                    <strong className="text-white fw-bold d-inline-flex align-items-center">
                      <i className="ti ti-calendar-event me-1 fs-5 text-white"></i> Date: {tx.date}
                    </strong>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-dark table-hover table-striped mb-0 align-middle small text-white">
                      <thead>
                        <tr className="text-white fw-bold">
                          <th style={{ width: '40px' }} className="text-center text-white">#</th>
                          <th style={{ width: '90px' }} className="text-center text-white">Ref Excel</th>
                          <th className="text-white">Account Name (Excel vs DB Target)</th>
                          <th className="text-white">Description</th>
                          <th style={{ width: '130px' }} className="text-end text-white">Debit</th>
                          <th style={{ width: '130px' }} className="text-end text-white">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="fw-normal text-white">
                        {tx.lines.map((line, lineIndex) => {
                          const mapping = accountMappings.find(
                            (m) => m.excelRef === line.refNumber && m.excelAccountName === line.accountName
                          );

                          const currentMappedRef = mapping?.mappedRef ?? 0;
                          
                          const matchedDbAcc = dbMasterAccounts.find((a) => a.referenceNumber === currentMappedRef);
                          const currentMappedName = mapping?.mappedAccountName || matchedDbAcc?.accountName || '';

                          const isUnmapped = currentMappedRef === 0;

                          return (
                            <tr key={`tx-${txIndex}-line-${lineIndex}-ref-${currentMappedRef}`} className={isUnmapped ? 'bg-danger bg-opacity-20 text-white' : 'text-white'}>
                              <td className="text-center text-white">{line.rowIndex}</td>
                              <td className="text-center fw-bold font-monospace text-white">
                                <span className="badge bg-secondary text-white">{line.refNumber}</span>
                              </td>
                              <td>
                                <span className="text-white fw-bold me-2">{line.accountName}</span>

                                {!isUnmapped ? (
                                  <span className="badge bg-warning text-dark fw-bold">
                                    <i className="ti ti-arrow-right me-1 text-dark"></i>[{currentMappedRef}] {currentMappedName}
                                  </span>
                                ) : (
                                  <span className="badge bg-danger text-white fw-normal">
                                    <i className="ti ti-alert-triangle me-1"></i>Belum Dipetakan
                                  </span>
                                )}
                              </td>
                              <td className="text-white">{line.description}</td>
                              <td className="text-end fw-bold text-white">
                                {line.debit !== null ? formatIDR(line.debit) : '-'}
                              </td>
                              <td className="text-end fw-bold text-white">
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
                <i className="ti ti-file-upload display-3 d-block mb-3 opacity-50 text-white"></i>
                <h6 className="fw-bold text-white mb-2">No Preview Generated Yet</h6>
                <p className="small mb-0 text-white fw-normal">
                  Select an Excel file on the left panel and click <strong className="text-white">Preview Entries</strong> to inspect data before importing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
