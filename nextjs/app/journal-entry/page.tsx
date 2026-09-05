'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import './journal-entry.css';

// Data Model Interfaces
export interface ChartOfAccountOption {
  id: number;
  referenceNumber: number;
  accountName: string;
}

export interface LineItem {
  id: string; // Unique temporary ID for list keys
  accountId: number;
  lineDescription: string;
  debit: string; // Stored as formatted string for text input (e.g. "1.000.000")
  credit: string;
  suggestions: string[];
  showSuggestions: boolean;
}

// Helpers Format Angka
const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

// Format angka mentah/string ke format berpemisah titik
const formatNumberWithDots = (val: string | number): string => {
  if (val === '' || val === null || val === undefined) return '';
  const cleanStr = val.toString().replace(/\D/g, '');
  if (!cleanStr) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(cleanStr, 10));
};

// Mengubah format string berpemisah titik kembali ke number murni
const parseFormattedNumber = (val: string): number => {
  if (!val) return 0;
  const cleanStr = val.replace(/\D/g, '');
  return cleanStr ? parseInt(cleanStr, 10) : 0;
};

// Helper Generate Next Transaction Number (Format: PREFIX + YYMM + 0001)
const generateTxNumber = (journalType: string, dateStr: string): string => {
  const prefix = journalType === 'Adjusting' ? 'AJ' : 'GJ';
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const yy = dateObj.getFullYear().toString().slice(-2);
  const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  return `${prefix}${yy}${mm}0001`;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

function JournalEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entryIdParam = searchParams.get('id');
  const isEdit = Boolean(entryIdParam);

  // Form State Metadata
  const [journalType, setJournalType] = useState<string>('General');
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [transactionNumber, setTransactionNumber] = useState<string>('');
  const [availableAccounts, setAvailableAccounts] = useState<ChartOfAccountOption[]>([]);

  // Lines State
  const [lines, setLines] = useState<LineItem[]>([]);

  // Alert & Lock Message States
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Helper Authorization JWT Header
  const getAuthHeaders = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const resetForm = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    setJournalType('General');
    setEntryDate(defaultDate);
    setTransactionNumber(generateTxNumber('General', defaultDate));
    setLines([
      {
        id: Date.now().toString() + '-1',
        accountId: 0,
        lineDescription: '',
        debit: '',
        credit: '',
        suggestions: [],
        showSuggestions: false,
      },
      {
        id: Date.now().toString() + '-2',
        accountId: 0,
        lineDescription: '',
        debit: '',
        credit: '',
        suggestions: [],
        showSuggestions: false,
      },
    ]);
    setValidationErrors([]);
    setSuccessMessage(null);
  };

  // Auto Generate Nomor Transaksi jika bukan mode edit
  useEffect(() => {
    if (!isEdit) {
      setTransactionNumber(generateTxNumber(journalType, entryDate));
    }
  }, [journalType, entryDate, isEdit]);

  // Data Initialization: Fetch Accounts & Journal Entry
  useEffect(() => {
    const initPage = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();

        // 1. Fetch Chart of Accounts
        const accountsRes = await fetch(`${API_BASE_URL}/chart-of-accounts`, {
          method: 'GET',
          headers,
        });

        if (accountsRes.ok) {
          const rawAccounts = await accountsRes.json();
          const accountsData = Array.isArray(rawAccounts)
            ? rawAccounts
            : Array.isArray(rawAccounts?.data)
            ? rawAccounts.data
            : Array.isArray(rawAccounts?.accounts)
            ? rawAccounts.accounts
            : [];

          setAvailableAccounts(
            accountsData.map((acc: any) => ({
              id: acc.id,
              referenceNumber: acc.referenceNumber,
              accountName: acc.accountName,
            }))
          );
        }

        // 2. Fetch data jika Edit Mode
        if (isEdit && entryIdParam) {
          const journalRes = await fetch(`${API_BASE_URL}/journals/${entryIdParam}`, {
            method: 'GET',
            headers,
          });

          if (!journalRes.ok) {
            throw new Error('Failed to retrieve journal entry data from the server.');
          }

          const journalData = await journalRes.json();

          if (journalData.isClosedPeriod) {
            setLockedMessage(
              `Journal entry ${journalData.transactionNumber} belongs to a closed period and cannot be edited. View it from the Periods page instead.`
            );
          } else {
            setTransactionNumber(journalData.transactionNumber);
            setJournalType(journalData.journalType || 'General');
            setEntryDate(
              journalData.entryDate
                ? journalData.entryDate.split('T')[0]
                : new Date().toISOString().split('T')[0]
            );

            const rawLines = Array.isArray(journalData.lines) ? journalData.lines : [];
            if (rawLines.length > 0) {
              setLines(
                rawLines.map((l: any, idx: number) => ({
                  id: l.id ? l.id.toString() : `${Date.now()}-${idx}`,
                  accountId: l.accountId,
                  lineDescription: l.lineDescription || '',
                  debit: l.debit > 0 ? formatNumberWithDots(l.debit) : '',
                  credit: l.credit > 0 ? formatNumberWithDots(l.credit) : '',
                  suggestions: [],
                  showSuggestions: false,
                }))
              );
            }
          }
        } else {
          resetForm();
        }
      } catch (err: any) {
        setValidationErrors([err.message || 'Failed to load data from the server.']);
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [isEdit, entryIdParam]);

  // Total Debit & Credit Calculation
  const totalDebit = useMemo(() => {
    return lines.reduce((sum, line) => sum + parseFormattedNumber(line.debit), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce((sum, line) => sum + parseFormattedNumber(line.credit), 0);
  }, [lines]);

  const isBalanced = useMemo(() => {
    return totalDebit > 0 && totalCredit > 0 && totalDebit === totalCredit;
  }, [totalDebit, totalCredit]);

  // Line Items Management Handlers
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        accountId: 0,
        lineDescription: '',
        debit: '',
        credit: '',
        suggestions: [],
        showSuggestions: false,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      alert('A journal entry must have at least two line items (Debit & Credit).');
      return;
    }
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const updateLineField = (id: string, field: keyof LineItem, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        // Auto Clear debit/credit yang berseberangan
        if (field === 'debit' && value !== '') {
          return { ...line, debit: formatNumberWithDots(value), credit: '' };
        }
        if (field === 'credit' && value !== '') {
          return { ...line, credit: formatNumberWithDots(value), debit: '' };
        }

        return { ...line, [field]: value };
      })
    );
  };

  // Description Search Autocomplete
  const handleDescriptionInput = (id: string, text: string) => {
    updateLineField(id, 'lineDescription', text);

    if (text.trim().length < 2) {
      setLines((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, showSuggestions: false, suggestions: [] } : l
        )
      );
      return;
    }

    const historicalNotes = [
      'Payroll Disbursement',
      'Office Rent Payment',
      'Accounts Receivable Collection',
      'Supplies Purchase',
      'Owner Capital Contribution',
    ];

    const filtered = historicalNotes.filter((n) =>
      n.toLowerCase().includes(text.toLowerCase())
    );

    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, suggestions: filtered, showSuggestions: filtered.length > 0 }
          : l
      )
    );
  };

  const selectSuggestion = (id: string, suggestionText: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, lineDescription: suggestionText, showSuggestions: false }
          : l
      )
    );
  };

  // Submit Journal Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setSuccessMessage(null);

    const errors: string[] = [];

    const effectiveLines = lines.filter(
      (l) =>
        l.accountId !== 0 &&
        (parseFormattedNumber(l.debit) > 0 || parseFormattedNumber(l.credit) > 0)
    );

    if (effectiveLines.length < 2) {
      errors.push(
        'A journal entry must have at least two valid line items with accounts and amounts.'
      );
    }

    if (!isBalanced) {
      errors.push('Total debit must equal total credit before posting.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const payload = {
        journalType,
        entryDate,
        transactionNumber,
        lines: effectiveLines.map((l) => ({
          accountId: l.accountId,
          lineDescription: l.lineDescription,
          debit: parseFormattedNumber(l.debit),
          credit: parseFormattedNumber(l.credit),
        })),
      };

      const url = isEdit
        ? `${API_BASE_URL}/journals/${entryIdParam}`
        : `${API_BASE_URL}/journals`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || 'Failed to save journal transaction to server.'
        );
      }

      const result = await response.json();

      if (isEdit) {
        setSuccessMessage(`Journal entry ${transactionNumber} has been updated.`);
        setTimeout(() => {
          router.push('/reports/general-journal');
        }, 1200);
      } else {
        const postedTxNum = result.transactionNumber || transactionNumber;
        setSuccessMessage(
          `Journal entry ${postedTxNum} has been posted successfully.`
        );
        resetForm();
      }
    } catch (err: any) {
      setValidationErrors([
        err.message || 'An error occurred while processing the journal entry.',
      ]);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading journal data from server...</span>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-4 text-white">
      {/* Page Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          {isEdit ? (
            <>
              <h2 className="fw-bold text-white mb-1 d-flex align-items-center">
                <i className="ti ti-edit me-2 text-warning fs-2"></i> Edit Journal Entry
                <span className="badge bg-secondary-subtle text-white border border-secondary-subtle ms-2">
                  {transactionNumber}
                </span>
              </h2>
              <p className="text-white-50 mb-0">
                Update this double-entry transaction for Aumo Finance.
              </p>
            </>
          ) : (
            <>
              <h2 className="fw-bold text-white mb-1 d-flex align-items-center">
                <i className="ti ti-notebook me-2 text-warning fs-2"></i> Create Journal Entry
              </h2>
              <p className="text-white-50 mb-0">
                Record double-entry financial transactions or adjusting entries for Aumo Finance.
              </p>
            </>
          )}
        </div>
        <div>
          <Link
            href="/reports/general-journal"
            className="btn btn-outline-secondary shadow-sm d-inline-flex align-items-center"
          >
            <i className="ti ti-arrow-left me-1"></i> Back to Journal
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          className="alert alert-success alert-dismissible fade show shadow-sm py-2 d-flex align-items-center justify-content-between"
          role="alert"
        >
          <div className="d-flex align-items-center">
            <i className="ti ti-circle-check me-2 fs-5 flex-shrink-0"></i>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setSuccessMessage(null)}
          ></button>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div
          className="alert alert-danger alert-dismissible fade show shadow-sm py-2 d-flex align-items-center justify-content-between"
          role="alert"
        >
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle me-2 fs-5 flex-shrink-0"></i>
            <ul className="mb-0 small fw-semibold list-unstyled">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setValidationErrors([])}
          ></button>
        </div>
      )}

      {lockedMessage ? (
        <div
          className="alert alert-warning shadow-sm py-2 d-flex align-items-center"
          role="alert"
        >
          <i className="ti ti-lock me-2 fs-5 flex-shrink-0"></i>
          <span>{lockedMessage}</span>
          <Link href="/reports/general-journal" className="alert-link ms-2">
            Back to General Journal
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Transaction Header Metadata */}
          <div className="card border-0 shadow-sm rounded-4 bg-body-tertiary mb-4 border border-secondary border-opacity-25">
            <div className="card-body p-4 text-white">
              <div className="row g-3">
                {/* Transaction Number Input (Uneditable, Disamakan Style-nya) */}
                <div className="col-md-4">
                  <label className="form-label fw-semibold small text-white-50 d-flex align-items-center gap-1">
                    <i className="ti ti-hash"></i> Transaction No.
                  </label>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary fw-semibold"
                    value={transactionNumber}
                    readOnly
                    tabIndex={-1}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small text-white-50 d-flex align-items-center gap-1">
                    <i className="ti ti-category"></i> Journal Type
                  </label>
                  <select
                    className="form-select bg-dark text-white border-secondary fw-semibold"
                    value={journalType}
                    onChange={(e) => setJournalType(e.target.value)}
                  >
                    <option value="General">General Journal (GJ)</option>
                    <option value="Adjusting">Adjusting Entry (AJ)</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small text-white-50 d-flex align-items-center gap-1">
                    <i className="ti ti-calendar"></i> Transaction Date
                  </label>
                  <input
                    type="date"
                    className="form-control bg-dark text-white border-secondary"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Journal Lines Table */}
          <div className="card border-0 shadow-sm rounded-4 bg-body-tertiary mb-4 border border-secondary border-opacity-25">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3 px-4">
              <h5 className="mb-0 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-list-details me-2 text-warning fs-4"></i> Journal Lines
              </h5>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center"
                onClick={addLine}
              >
                <i className="ti ti-plus me-1"></i> Add Line
              </button>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0 journal-line-table">
                  <thead className="table-light text-secondary">
                    <tr>
                      <th style={{ width: '10%' }} className="ps-4">
                        Ref No.
                      </th>
                      <th style={{ width: '25%' }}>Account Name</th>
                      <th style={{ width: '25%' }}>Description</th>
                      <th style={{ width: '15%' }} className="text-end">
                        Debit
                      </th>
                      <th style={{ width: '15%' }} className="text-end">
                        Credit
                      </th>
                      <th style={{ width: '10%' }} className="text-center pe-4">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                    {lines.map((line) => {
                      const accountRef = availableAccounts.find(
                        (a) => a.id === line.accountId
                      )?.referenceNumber;

                      return (
                        <tr key={line.id}>
                          {/* Ref No. */}
                          <td className="ps-4">
                            <input
                              type="text"
                              className="form-control text-center bg-dark text-info border-secondary"
                              readOnly
                              tabIndex={-1}
                              placeholder="---"
                              value={accountRef ? accountRef.toString() : ''}
                            />
                          </td>

                          {/* Account Selection */}
                          <td>
                            <select
                              className="form-select bg-dark text-white border-secondary"
                              value={line.accountId}
                              onChange={(e) =>
                                updateLineField(line.id, 'accountId', Number(e.target.value))
                              }
                            >
                              <option value={0} disabled>
                                Select Account...
                              </option>
                              {availableAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.referenceNumber} - {acc.accountName}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Description */}
                          <td className="journal-line-description-container">
                            <input
                              type="text"
                              className="form-control bg-dark text-white border-secondary"
                              placeholder="Note..."
                              autoComplete="off"
                              value={line.lineDescription}
                              onChange={(e) =>
                                handleDescriptionInput(line.id, e.target.value)
                              }
                              onBlur={() => {
                                setTimeout(
                                  () => updateLineField(line.id, 'showSuggestions', false),
                                  200
                                );
                              }}
                            />
                            {line.showSuggestions && line.suggestions.length > 0 && (
                              <div className="list-group journal-suggestions-menu bg-dark border border-secondary">
                                {lines
                                  .find((l) => l.id === line.id)
                                  ?.suggestions.map((suggestion, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      className="list-group-item list-group-item-action bg-dark text-white border-secondary small py-1"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectSuggestion(line.id, suggestion);
                                      }}
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </td>

                          {/* Debit Input (Tipe text, format titik otomatis, tanpa spinner) */}
                          <td>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-control bg-dark text-white border-secondary text-end"
                              placeholder="0"
                              value={line.debit}
                              onChange={(e) =>
                                updateLineField(line.id, 'debit', e.target.value)
                              }
                            />
                          </td>

                          {/* Credit Input (Tipe text, format titik otomatis, tanpa spinner) */}
                          <td>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-control bg-dark text-white border-secondary text-end"
                              placeholder="0"
                              value={line.credit}
                              onChange={(e) =>
                                updateLineField(line.id, 'credit', e.target.value)
                              }
                            />
                          </td>

                          {/* Remove Line Action */}
                          <td className="text-center pe-4">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeLine(line.id)}
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light text-secondary border-top fw-bold">
                    <tr>
                      <td colSpan={3} className="text-end py-3 text-white">
                        Total Balance:
                      </td>
                      <td className="text-end text-success fs-6 py-3">
                        Rp {formatIDR(totalDebit)}
                      </td>
                      <td className="text-end text-danger fs-6 py-3">
                        Rp {formatIDR(totalCredit)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="text-end pb-3 border-bottom-0 text-white">
                        Status:
                      </td>
                      <td colSpan={2} className="text-center pb-3 border-bottom-0">
                        {isBalanced ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 d-inline-flex align-items-center">
                            <i className="ti ti-circle-check me-1"></i> Balanced
                          </span>
                        ) : (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 d-inline-flex align-items-center">
                            <i className="ti ti-alert-triangle me-1"></i> Unbalanced (Rp{' '}
                            {formatIDR(Math.abs(totalDebit - totalCredit))})
                          </span>
                        )}
                      </td>
                      <td className="border-bottom-0"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Form Controls */}
          <div className="d-flex justify-content-end gap-2">
            {isEdit ? (
              <Link
                href="/reports/general-journal"
                className="btn btn-outline-secondary px-4"
              >
                Cancel
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-outline-secondary px-4"
                onClick={resetForm}
              >
                Reset Form
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary fw-semibold px-4 shadow-sm d-inline-flex align-items-center"
              disabled={!isBalanced}
            >
              <i className="ti ti-device-floppy me-1"></i>{' '}
              {isEdit ? 'Save Changes' : 'Post Journal Entry'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function JournalEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-5 my-5 text-white-50">
          <div className="spinner-border text-primary me-2" role="status"></div>
          <span>Loading journal entry page...</span>
        </div>
      }
    >
      <JournalEntryContent />
    </Suspense>
  );
}
