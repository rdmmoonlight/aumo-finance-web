'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model Interfaces
export interface LedgerLineViewModel {
  entryDate: string;
  description?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface LedgerAccountViewModel {
  accountId: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  normalBalanceIsDebit: boolean;
  endingBalance: number;
  lines: LedgerLineViewModel[];
}

export interface Period {
  id: number;
  periodName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

// Format angka biasa tanpa simbol mata uang
const formatNumber = (amount: number) => {
  if (amount === 0) return '-';
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return amount < 0 ? `(${formatted})` : formatted;
};

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function TemporaryGeneralLedgerPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<LedgerAccountViewModel[]>([]);

  // Fetch Data Buku Besar Akun Nominal / Sementara dari API Backend
  const fetchLedgerData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/general-ledger/temporary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Menggunakan Identity Cookie Session
      });

      if (response.status === 404 || response.status === 400) {
        setNoPeriodSelected(true);
        setLedgers([]);
        return;
      }

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setLedgers([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Temporary Accounts General Ledger from the server.');
      }

      const rawData = await response.json();

      // Safe extraction untuk menangani format array langsung atau terbungkus objek
      const data: LedgerAccountViewModel[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData?.ledgers)
        ? rawData.ledgers
        : [];

      setNoPeriodSelected(false);
      setLedgers(data);
    } catch (error: any) {
      console.error('Error fetching temporary ledger:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedgerData();

    // Event listener untuk re-fetch otomatis saat periode di Topbar / Periods page diubah
    const handlePeriodChanged = () => {
      fetchLedgerData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchLedgerData]);

  // Perhitungan Net Income / (Loss) Sebelum Penutupan
  const netTotal = useMemo(() => {
    return ledgers.reduce((sum, l) => {
      return sum + (l.normalBalanceIsDebit ? -l.endingBalance : l.endingBalance);
    }, 0);
  }, [ledgers]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Temporary Accounts General Ledger...</span>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-4 text-white">
      {/* Alert Error */}
      {errorMessage && (
        <div
          className="alert alert-danger alert-dismissible fade show shadow-sm py-2 mb-4 d-flex align-items-center justify-content-between"
          role="alert"
        >
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setErrorMessage(null)}
          ></button>
        </div>
      )}

      {/* State Jika Belum Ada Periode yang Dipilih */}
      {noPeriodSelected ? (
        <div className="text-center py-5 my-4">
          <i
            className="ti ti-eye-off text-secondary mb-3 d-block mx-auto"
            style={{ fontSize: '2.5rem' }}
          ></i>
          <h5 className="fw-bold text-white mb-2">No Period Selected</h5>
          <p className="text-white-50 mb-3">
            This report follows whichever period you&apos;re viewing. Select a period to view its general ledger.
          </p>
          <Link
            href="/periods"
            className="btn btn-primary btn-sm fw-semibold shadow-sm px-4 d-inline-flex align-items-center"
          >
            <i className="ti ti-calendar me-1"></i> Go to Periods
          </Link>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-calculator me-2 text-success fs-2"></i> General Ledger (Temporary Accounts)
              </h2>
              <p className="text-white-50 mb-0">
                Nominal (temporary) accounts &mdash; Income and Expenses (in IDR). Closed to Equity at period end.
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link
                href="/reports/general-journal"
                className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center"
              >
                <i className="ti ti-book me-1"></i> General Journal
              </Link>
            </div>
          </div>

          {/* Net Income Summary Card */}
          {ledgers.length > 0 && (
            <div className="card bg-body-tertiary border-secondary text-white shadow-sm mb-4 border border-secondary border-opacity-25 rounded-4">
              <div className="card-body d-flex justify-content-between align-items-center py-3 px-4 flex-wrap gap-2">
                <span className="fw-semibold text-warning">Net Income / (Loss) before closing</span>
                <span
                  className={`fw-bold fs-5 font-monospace ${
                    netTotal >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatNumber(netTotal)}
                </span>
              </div>
            </div>
          )}

          {/* State Jika Chart of Accounts Kosong */}
          {ledgers.length === 0 && !errorMessage && (
            <div className="alert alert-secondary bg-dark text-white-50 border-secondary">
              No temporary accounts found in the Chart of Accounts for this period.
            </div>
          )}

          {/* Loop Card Per Akun Buku Besar */}
          {ledgers.map((ledger) => {
            const isDebitNormal = ledger.normalBalanceIsDebit;
            const endingBal = ledger.endingBalance;
            const isNormalPositive = isDebitNormal ? endingBal >= 0 : endingBal <= 0;

            return (
              <div
                key={ledger.accountId}
                id={`account-${ledger.accountId}`}
                className="card bg-body-tertiary border-secondary text-white shadow-sm mb-4 border border-secondary border-opacity-25 rounded-4"
              >
                <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3 px-4 flex-wrap gap-2">
                  <h5 className="mb-0 fw-bold text-white d-flex align-items-center">
                    <code className="text-warning me-2">{ledger.referenceNumber}</code>
                    {ledger.accountName}
                    <span className="badge bg-secondary bg-opacity-25 border border-secondary ms-2 small">
                      {ledger.type}
                    </span>
                  </h5>
                  <span
                    className={`fw-semibold font-monospace ${
                      isNormalPositive ? 'text-success' : 'text-danger'
                    }`}
                  >
                    Ending Balance: {formatNumber(endingBal)} (
                    {isDebitNormal ? 'Dr' : 'Cr'})
                  </span>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-dark table-hover align-middle mb-0">
                      <thead className="table-light text-secondary">
                        <tr>
                          <th className="ps-4">Date</th>
                          <th>Description</th>
                          <th className="text-end">Debit</th>
                          <th className="text-end">Credit</th>
                          <th className="text-end pe-4">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.lines && ledger.lines.length > 0 ? (
                          ledger.lines.map((line, idx) => (
                            <tr key={idx}>
                              <td className="text-nowrap ps-4 text-white-50">{line.entryDate}</td>
                              <td className="text-white-50 small">{line.description || '-'}</td>
                              <td className="text-end text-success font-monospace">
                                {line.debit > 0 ? formatNumber(line.debit) : '-'}
                              </td>
                              <td className="text-end text-danger font-monospace">
                                {line.credit > 0 ? formatNumber(line.credit) : '-'}
                              </td>
                              <td className="text-end fw-semibold pe-4 font-monospace">
                                {formatNumber(line.runningBalance)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-white-50">
                              No postings recorded for this account in the selected period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
