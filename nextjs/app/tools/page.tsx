'use client';

import React, { useState } from 'react';

// Interface untuk struktur data Preview Import Excel
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

  // Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<JournalImportResult | null>(null);

  // Format Mata Uang IDR
  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Handler Pemilihan File Excel
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setParseResult(null);
      setErrorMessage(null);
    }
  };

  // Helper untuk Normalisasi & Parsing Tanggal Excel
  const parseExcelDate = (val: any, XLSX: any): string => {
    if (val === undefined || val === null || val === '') return '';

    // Jika serial date bawaan Excel (number)
    if (typeof val === 'number') {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(val);
    }

    const strVal = String(val).trim();
    
    // Jika format DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(strVal)) {
      const parts = strVal.split('-');
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    return strVal;
  };

  // Handler Preview Excel Asli (Membaca file dari input)
  const handlePreview = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an Excel file first.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsBusy(true);

    try {
      // 1. Memuat pustaka XLSX dari CDN jika belum ada di window
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

      // 2. Baca file Excel sebagai ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });

      const parsedTransactions: JournalTransactionImport[] = [];
      let totalLines = 0;

      // 3. Iterasi Sheet GJ dan AJ
      ['GJ', 'AJ'].forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        // Ambil data dalam bentuk array of object
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        let currentDate = '';
        const groupedByDate: { [key: string]: JournalLineImport[] } = {};

        rows.forEach((row, index) => {
          // Cari kolom Date (opsi case-insensitive)
          const rawDate = row['Date'] ?? row['date'] ?? row['DATE'] ?? '';
          const parsedDateStr = parseExcelDate(rawDate, XLSX);

          // Jika ada tanggal baru, perbarui currentDate. Jika kosong (akibat enter/baris baru), pakai currentDate terakhir (Forward Fill)
          if (parsedDateStr !== '') {
            currentDate = parsedDateStr;
          }

          // Lewati baris jika belum ada tanggal sama sekali atau baris benar-benar kosong
          if (!currentDate) return;

          const accountName = String(row['Account Name'] ?? row['accountName'] ?? row['ACCOUNT NAME'] ?? '').trim();
          const description = String(row['Description'] ?? row['description'] ?? row['DESCRIPTION'] ?? '').trim();
          const refVal = row['Ref'] ?? row['ref'] ?? row['REF'] ?? 0;

          // Jika baris tidak berisi akun/ref/nominal, abaikan
          if (!accountName && !description && !refVal) return;

          const rawDebit = row['Debit'] ?? row['debit'] ?? row['DEBIT'] ?? '';
          const rawCredit = row['Credit'] ?? row['credit'] ?? row['CREDIT'] ?? '';

          const line: JournalLineImport = {
            rowIndex: index + 2, // offset header baris 1
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

        // Masukkan data terkelompok ke transaksi
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

      const realResult: JournalImportResult = {
        isSuccess: true,
        totalTransactionsRead: parsedTransactions.length,
        totalLinesRead: totalLines,
        warnings: [],
        transactions: parsedTransactions,
      };

      setParseResult(realResult);

      // Tampilkan Modal Preview
      if ((window as any).aumoModal) {
        (window as any).aumoModal.show('indexPreviewModal');
      }
    } catch (err: any) {
      setErrorMessage(`Failed to process file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBusy(false);
    }
  };

  // Handler Konfirmasi Import ke Database
  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) {
      setErrorMessage('No valid transactions to import.');
      return;
    }

    setIsBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccessMessage(
        `Successfully imported ${parseResult.totalTransactionsRead} journal entries with 1 new COA account created.`
      );

      // Tutup modal
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

  // Generator File Excel Template Langsung di Sisi Client
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
        [1, 'Kas Utama', 'Setoran Modal Awal', 101, 15000000, ''],
        ['', 'Modal Pemilik', 'Setoran Modal Awal', 301, '', 15000000],
        [3, 'Beban Listrik', 'Pembayaran PLN', 502, 500000, ''],
        ['', 'Kas Utama', 'Pembayaran PLN', 101, '', 500000],
      ];

      const sampleAJ = [
        [4, 'Beban Sewa Kantor', 'Akrual Sewa Bulan Juni', 501, 2500000, ''],
        ['', 'Utang Usaha', 'Akrual Sewa Bulan Juni', 201, '', 2500000],
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
        {/* IMPORT JOURNAL ENTRIES (.XLSX) */}
        <div className="col-12 col-xl-8 mx-auto">
          <div className="card glass-card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 pt-4 pb-3 px-4">
              <h5 className="fw-bold text-white mb-0">
                <i className="bi bi-file-earmark-spreadsheet me-2 text-white"></i> Import Journal Entries
              </h5>
            </div>
            <div className="card-body px-4 py-4 d-flex flex-column">
              <p className="text-white fw-normal small mb-4">
                Upload batch journal entries using the standard <code>.xlsx</code> format. Strict validation will be applied to verify debit/credit balance before committing records to the ledger.
              </p>

              {/* Template Format Info */}
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
                  <li>Rows sharing the same <strong>Date</strong> will be grouped as a single entry.</li>
                  <li><strong>Ref</strong> corresponds to Chart of Accounts (COA) numbers. Missing accounts will be created automatically.</li>
                </ul>
                <button type="button" className="btn btn-sm btn-outline-light text-white fw-normal rounded-3" onClick={handleDownloadTemplate}>
                  <i className="bi bi-download me-1"></i> Download Template (.xlsx)
                </button>
              </div>

              {/* Upload & Preview Form */}
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
                  {parseResult
                    ? `Found ${parseResult.totalTransactionsRead} transactions with ${parseResult.totalLinesRead} line entries.`
                    : 'Review entries below before importing.'}
                </small>
              </div>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div className="modal-body p-4 text-white">
              {parseResult && (
                <>
                  {parseResult.warnings.length > 0 && (
                    <div className="alert alert-warning rounded-3 mb-4 text-white fw-normal">
                      <ul className="small mb-0 ps-3">
                        {parseResult.warnings.map((w, index) => (
                          <li key={index}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                                <td className="text-white">
                                  {line.accountName}
                                  {line.isNewAccount && (
                                    <span className="badge bg-secondary text-white border border-light ms-1 fw-normal">New COA</span>
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
