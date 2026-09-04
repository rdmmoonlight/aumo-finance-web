'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Model Interface
export interface Account {
  id: number;
  referenceNumber: number;
  accountName: string;
}

export interface JournalLine {
  id: number;
  lineOrder: number;
  debit: number;
  credit: number;
  lineDescription?: string;
  accountId?: number;
  accountName?: string;
  referenceNumber?: number;
  account?: Account;
}

export interface JournalEntry {
  id: number;
  transactionNumber: string;
  journalType: string;
  entryDate: string;
  createdAt: string;
  updatedAt?: string;
  lines: JournalLine[];
}

const formatNumber = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

const formatDateDisplay = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatDateTimeDisplay = (dateTimeString?: string) => {
  if (!dateTimeString) return null;
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) return dateTimeString;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function AdjustingJournalPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedPeriodName, setSelectedPeriodName] = useState<string | null>(null);
  const [isPeriodClosed, setIsPeriodClosed] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      router.push('/');
    }
  }, [router]);

  // Fetch Daftar Jurnal Penyesuaian dari Endpoint (/web/reports/adjusting-journal)
  const fetchJournalData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/adjusting-journal`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load adjusting journal data from the server.');
      }

      const resData = await response.json();

      if (resData.success) {
        setSelectedPeriodName(resData.selectedPeriodName || null);
        setIsPeriodClosed(resData.isPeriodClosed || false);
        setEntries(Array.isArray(resData.entries) ? resData.entries : []);
      } else {
        throw new Error(resData.message || 'Failed to parse adjusting journal data.');
      }
    } catch (error: any) {
      console.error('Error fetching adjusting journal entries:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    fetchJournalData();
  }, [fetchJournalData]);

  const toggleEditMode = () => {
    setEditMode((prev) => !prev);
  };

  const deleteEntry = async (entry: JournalEntry) => {
    if (isPeriodClosed) {
      alert(
        `Journal entry ${entry.transactionNumber} is in a closed period and cannot be deleted.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete adjusting journal entry ${entry.transactionNumber}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/adjusting-journal/${entry.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to delete adjusting journal entry from the server.');
      }

      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (error: any) {
      setErrorMessage(error.message || 'An error occurred while deleting the entry.');
    }
  };

  let currentDateTracker = '';
  let groupIndexTracker = 0;

  return (
    <div className="container-fluid py-4 px-4 text-white" style={{ fontFamily: 'Aptos, sans-serif' }}>
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm py-2 mb-4 d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle-filled me-2 fs-5 flex-shrink-0"></i>
            <span className="fw-regular">{errorMessage}</span>
          </div>
          <button type="button" className="btn-close ms-auto" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      {/* Page Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
            <i className="ti ti-adjustments-horizontal me-2 text-warning fs-2"></i> Adjusting Journal
          </h2>
          <p className="text-white-50 mb-0 fw-regular">
            Adjusting entries to align revenues and expenses with the current accounting period {selectedPeriodName ? `(Viewing Period: ${selectedPeriodName})` : ''}.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/adjusting-journal-entry" className="btn btn-primary fw-bold shadow-sm d-inline-flex align-items-center">
            <i className="ti ti-plus me-1 fs-5"></i> Add Entry
          </Link>
          <button
            type="button"
            className={`btn btn-outline-secondary fw-bold shadow-sm d-inline-flex align-items-center ${editMode ? 'active' : ''}`}
            onClick={toggleEditMode}
            disabled={entries.length === 0}
          >
            <i className="ti ti-pencil me-1 fs-5"></i> Edit
          </button>
        </div>
      </div>

      {/* Adjusting Journal Table Card */}
      <div className="card bg-dark border-secondary text-white shadow-sm mb-4 border border-secondary border-opacity-25 rounded-4">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead className="table-active border-bottom border-secondary text-secondary">
                <tr>
                  <th className="ps-4 fw-bold" style={{ width: '14%' }}>
                    Date &amp; Ref
                  </th>
                  <th className="fw-bold" style={{ width: '26%' }}>Account</th>
                  <th className="fw-bold" style={{ width: '28%' }}>Description</th>
                  <th className="text-center fw-bold" style={{ width: '8%' }}>
                    Ref #
                  </th>
                  <th className="text-end fw-bold" style={{ width: '12%' }}>
                    Debit
                  </th>
                  <th className="text-end pe-4 fw-bold" style={{ width: '12%' }}>
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="fw-regular">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-white-50">
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      <span>Loading adjusting journal from the server...</span>
                    </td>
                  </tr>
                ) : entries.length > 0 ? (
                  entries.map((entry) => {
                    const sortedLines = [...(entry.lines || [])].sort(
                      (a, b) => a.lineOrder - b.lineOrder
                    );

                    const currentDateStr = formatDateDisplay(entry.entryDate);
                    const showDateHeader = currentDateStr !== currentDateTracker;
                    if (showDateHeader) {
                      currentDateTracker = currentDateStr;
                      groupIndexTracker++;
                    }

                    const entryShade = groupIndexTracker % 2 === 0 ? '' : 'bg-black bg-opacity-25';

                    return sortedLines.map((line, i) => {
                      const isFirstRow = i === 0;
                      const isDebit = line.debit > 0;
                      const accountName = line.accountName || line.account?.accountName || 'Unknown Account';
                      const referenceNumber = line.referenceNumber || line.account?.referenceNumber || '-';

                      return (
                        <tr key={`${entry.id}-${line.id || i}`} className={entryShade}>
                          <td className="ps-4 text-nowrap align-top py-2">
                            {isFirstRow && showDateHeader && (
                              <div className="mb-1">
                                <span className="badge bg-secondary bg-opacity-25 border border-secondary text-white fw-bold px-2 py-1">
                                  {currentDateStr}
                                </span>
                              </div>
                            )}
                            {isFirstRow && (
                              <div className="d-flex flex-column align-items-start mt-1">
                                <small className="text-warning fw-bold">{entry.transactionNumber}</small>
                                {entry.createdAt && (
                                  <span
                                    className="text-white-50 fw-regular"
                                    style={{ fontSize: '0.70rem' }}
                                    title="Input Date & Time"
                                  >
                                    {formatDateTimeDisplay(entry.createdAt)}
                                  </span>
                                )}
                                {entry.updatedAt && (
                                  <span
                                    className="text-info d-inline-flex align-items-center fw-regular"
                                    style={{ fontSize: '0.70rem' }}
                                    title="Last Edited Date & Time"
                                  >
                                    <i className="ti ti-pencil me-1"></i>
                                    {formatDateTimeDisplay(entry.updatedAt)}
                                  </span>
                                )}

                                {editMode && (
                                  <div className="d-flex gap-1 mt-1">
                                    <Link
                                      href={`/adjusting-journal-entry?id=${entry.id}`}
                                      className="btn btn-sm btn-dark text-warning border border-secondary shadow-sm py-0 px-1 d-inline-flex align-items-center"
                                      title="Edit this entry"
                                    >
                                      <i className="ti ti-pencil" style={{ fontSize: '0.85rem' }}></i>
                                    </Link>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-dark text-danger border border-secondary shadow-sm py-0 px-1 d-inline-flex align-items-center"
                                      title="Delete this entry"
                                      onClick={() => deleteEntry(entry)}
                                    >
                                      <i className="ti ti-trash" style={{ fontSize: '0.85rem' }}></i>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td
                            className={`align-top py-2 ${
                              isDebit ? 'fw-bold text-white' : 'ps-4 text-white-50 fw-regular'
                            }`}
                          >
                            {accountName}
                          </td>
                          <td className="small align-top py-2 text-white-50 fw-regular">
                            {line.lineDescription || '-'}
                          </td>
                          <td className="text-center align-top py-2">
                            <code className="text-warning fw-bold">
                              {referenceNumber}
                            </code>
                          </td>
                          <td className="text-end align-top py-2 text-success fw-bold">
                            {line.debit > 0 ? formatNumber(line.debit) : '-'}
                          </td>
                          <td className="text-end pe-4 align-top py-2 text-danger fw-bold">
                            {line.credit > 0 ? formatNumber(line.credit) : '-'}
                          </td>
                        </tr>
                      );
                    });
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-5 text-muted">
                      {selectedPeriodName === null ? (
                        <div className="py-3">
                          <i
                            className="ti ti-eye-off mb-2 d-block mx-auto text-secondary"
                            style={{ fontSize: '2.5rem' }}
                          ></i>
                          <h6 className="fw-bold text-white">No Period Selected</h6>
                          <p className="mb-0 small text-white-50 fw-regular">
                            Go to{' '}
                            <Link href="/periods" className="text-decoration-none fw-bold text-primary">
                              Periods
                            </Link>{' '}
                            to select one.
                          </p>
                        </div>
                      ) : (
                        <div className="py-3">
                          <i
                            className="ti ti-file-x mb-2 d-block mx-auto text-secondary"
                            style={{ fontSize: '2.5rem' }}
                          ></i>
                          <h6 className="fw-bold text-white">No Adjusting Entries Found</h6>
                          <p className="mb-0 small text-white-50 fw-regular">
                            No adjusting entries recorded in{' '}
                            <strong>{selectedPeriodName}</strong>.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
