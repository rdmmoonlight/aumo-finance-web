'use client';

import React, { useState } from 'react';
import Link from 'next/link';

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
  isSuccess: bool;
  message?: string;
  totalTransactionsRead: number;
  totalLinesRead: number;
  warnings: string[];
  transactions: JournalTransactionImport[];
}

// Type alias untuk bool di TypeScript
type bool = boolean;

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

  // Handler Simulasi Preview Excel
  const handlePreview = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an Excel file first.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsBusy(true);

    try {
      // Simulasi Parsing Excel di sisi klien / API
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Mock Data Preview Hasil Parsing Excel Template
      const mockResult: JournalImportResult = {
        isSuccess: true,
        totalTransactionsRead: 2,
        totalLinesRead: 4,
        warnings: ['Row 5: Account reference 102 presumed as new COA automatically.'],
        transactions: [
          {
            date: '2026-06-01',
            journalType: 'General',
            lines: [
              { rowIndex: 2, refNumber: 101, accountName: 'Kas Utama', description: 'Setoran Modal Awal', debit: 15000000, credit: null, isNewAccount: false },
              { rowIndex: 3, refNumber: 301, accountName: 'Modal Pemilik', description: 'Setoran Modal Awal', debit: null, credit: 15000000, isNewAccount: false },
            ],
          },
          {
            date: '2026-06-02',
            journalType: 'Adjusting',
            lines: [
              { rowIndex: 5, refNumber: 501, accountName: 'Beban Sewa Kantor', description: 'Akrual Sewa Bulan Juni', debit: 2500000, credit: null, isNewAccount: true },
              { rowIndex: 6, refNumber: 201, accountName: 'Utang Usaha', description: 'Akrual Sewa Bulan Juni', debit: null, credit: 2500000, isNewAccount: false },
            ],
          },
        ],
      };

      setParseResult(mockResult);

      // Tampilkan Modal Preview menggunakan Bootstrap Modal Helper global
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

  // System Maintenance Handlers
  const handleRecalculateLedger = async () => {
    if (!window.confirm('This will rebuild all running ledger balances. Continue?')) return;

    setIsBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccessMessage('Ledger balances recalculated successfully.');
    } catch (err: any) {
      setErrorMessage(`Failed to recalculate ledger: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/Tools/DownloadJournalTemplate';
  };

  const handleBackupDatabase = () => {
    window.location.href = '/api/Tools/BackupDatabase';
  };

  return (
    <div className="container-fluid py-4 px-4 text-white">
      {/* Header & Breadcrumb */}
      <div className="mb-4">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-1 text-white-50">
            <li className="breadcrumb-item">
              <Link href="/tools" className="text-decoration-none text-info">Tools &amp; Utilities</Link>
            </li>
            <li className="breadcrumb-item active text-white" aria-current="page">Management Hub</li>
          </ol>
        </nav>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h2 className="fw-bold text-white mb-1">
              <i className="bi bi-tools me-2 text-warning"></i> Tools &amp; Utilities
            </h2>
            <p className="text-white-50 mb-0">System operations, batch data processing, and ledger integrity tools.</p>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm rounded-3 mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMessage}
          <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm rounded-3 mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {errorMessage}
          <button type="button" className="btn-close" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      <div className="row g-4">
        {/* ========================================== */}
        {/* 1. IMPORT JOURNAL ENTRIES (.XLSX)          */}
        {/* ========================================== */}
        <div className="col-12 col-lg-6">
          <div className="card glass-card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 pt-4 pb-3 px-4">
              <h5 className="fw-bold text-white mb-0">
                <i className="bi bi-file-earmark-spreadsheet text-success me-2"></i> Import Journal Entries
              </h5>
            </div>
            <div className="card-body px-4 py-4 d-flex flex-column">
              <p className="text-white-50 small mb-4">
                Upload batch journal entries using the standard <code>.xlsx</code> format. Strict validation will be applied to verify debit/credit balance before committing records to the ledger.
              </p>

              {/* Template Format Info */}
              <div className="bg-body-tertiary rounded-3 p-3 mb-4 border border-secondary border-opacity-25">
                <span className="d-block fw-semibold small mb-2 text-white">Required Columns (Row 1 Header):</span>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className="badge bg-secondary">Date</span>
                  <span className="badge bg-secondary">Account Name</span>
                  <span className="badge bg-secondary">Description</span>
                  <span className="badge bg-secondary">Ref</span>
                  <span className="badge bg-secondary">Debit</span>
                  <span className="badge bg-secondary">Credit</span>
                </div>
                <ul className="text-white-50 small mb-3 ps-3">
                  <li>2 Worksheets: <strong>GJ</strong> (General Journal) and <strong>AJ</strong> (Adjusting Journal).</li>
                  <li>Rows sharing the same <strong>Date</strong> will be grouped as a single entry.</li>
                  <li><strong>Ref</strong> corresponds to Chart of Accounts (COA) numbers. Missing accounts will be created automatically.</li>
                </ul>
                <button type="button" className="btn btn-sm btn-outline-success rounded-3" onClick={handleDownloadTemplate}>
                  <i className="bi bi-download me-1"></i> Download Template (.xlsx)
                </button>
              </div>

              {/* Upload & Preview Form */}
              <div className="mb-3 mt-auto">
                <label className="form-label fw-semibold small text-white">Select Excel File (.xlsx)</label>
                <input
                  type="file"
                  className="form-control bg-body-tertiary text-white border-secondary"
                  accept=".xlsx"
                  onChange={handleFileSelected}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary px-4 fw-semibold shadow-sm w-100 rounded-3"
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

        {/* ========================================== */}
        {/* 2. SYSTEM MAINTENANCE & UTILITIES          */}
        {/* ========================================== */}
        <div className="col-12 col-lg-6">
          <div className="card glass-card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body p-4 d-flex flex-column">
              <div className="mb-3">
                <i className="bi bi-database-gear text-info" style={{ fontSize: '2.5rem' }}></i>
              </div>
              <h5 className="fw-bold text-white mb-2">System Maintenance</h5>
              <p className="text-white-50 small mb-4">
                Utilities to verify structural integrity and safeguard financial records across all ledgers.
              </p>

              <div className="d-grid gap-3 mt-auto">
                <button
                  type="button"
                  className="btn btn-outline-info text-start rounded-3 py-3 px-3 d-flex align-items-center gap-3"
                  onClick={handleRecalculateLedger}
                  disabled={isBusy}
                >
                  <i className="bi bi-arrow-repeat fs-5 text-info"></i>
                  <div>
                    <div className="fw-bold text-white">Recalculate Ledger Balances</div>
                    <small className="text-white-50">Rebuild running balance across general ledger accounts.</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary text-start rounded-3 py-3 px-3 d-flex align-items-center gap-3"
                  onClick={handleBackupDatabase}
                  disabled={isBusy}
                >
                  <i className="bi bi-file-earmark-excel fs-5 text-warning"></i>
                  <div>
                    <div className="fw-bold text-white">Export All Data (.xlsx)</div>
                    <small className="text-white-50">Download full ledger backup sheets for offline audits.</small>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* INSTANT PREVIEW MODAL */}
      <div className="modal fade" id="indexPreviewModal" tabIndex={-1} aria-labelledby="indexPreviewModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content rounded-4 border-0 shadow bg-dark text-white border border-secondary border-opacity-25">
            <div className="modal-header border-bottom border-secondary border-opacity-25 px-4 py-3">
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white" id="indexPreviewModalLabel">
                  <i className="bi bi-file-earmark-check me-2 text-success"></i> Journal Entries Preview
                </h5>
                <small className="text-white-50">
                  {parseResult
                    ? `Found ${parseResult.totalTransactionsRead} transactions with ${parseResult.totalLinesRead} line entries.`
                    : 'Review entries below before importing.'}
                </small>
              </div>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div className="modal-body p-4">
              {parseResult && (
                <>
                  {parseResult.warnings.length > 0 && (
                    <div className="alert alert-warning rounded-3 mb-4">
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
                        <span className="badge bg-primary">{tx.journalType} Journal</span>
                        <strong><i className="bi bi-calendar-event me-1"></i> {tx.date}</strong>
                      </div>
                      <div className="table-responsive">
                        <table className="table table-dark table-hover table-striped mb-0 align-middle small">
                          <thead>
                            <tr className="text-secondary">
                              <th style={{ width: '50px' }} className="text-center">#</th>
                              <th style={{ width: '100px' }} className="text-center">Ref</th>
                              <th>Account Name</th>
                              <th>Description</th>
                              <th style={{ width: '150px' }} className="text-end">Debit</th>
                              <th style={{ width: '150px' }} className="text-end">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tx.lines.map((line, lineIndex) => (
                              <tr key={lineIndex}>
                                <td className="text-center text-white-50">{line.rowIndex}</td>
                                <td className="text-center fw-semibold text-info">{line.refNumber}</td>
                                <td>
                                  {line.accountName}
                                  {line.isNewAccount && (
                                    <span className="badge bg-info-subtle text-info border border-info-subtle ms-1">New COA</span>
                                  )}
                                </td>
                                <td className="text-white-50">{line.description}</td>
                                <td className="text-end fw-semibold text-success">
                                  {line.debit !== null ? formatIDR(line.debit) : '-'}
                                </td>
                                <td className="text-end fw-semibold text-danger">
                                  {line.credit !== null ? formatIDR(line.credit) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-group-divider fw-bold">
                            <tr>
                              <td colSpan={4} className="text-end">Total Amount:</td>
                              <td className="text-end text-success">
                                {formatIDR(tx.lines.reduce((acc, l) => acc + (l.debit || 0), 0))}
                              </td>
                              <td className="text-end text-danger">
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
              <button type="button" className="btn btn-outline-secondary rounded-3" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn btn-success rounded-3 px-4 fw-semibold shadow-sm"
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
