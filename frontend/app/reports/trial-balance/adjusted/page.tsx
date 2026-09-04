'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface TrialBalanceRow {
  accountId: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  role?: string;
  normalBalanceIsDebit: boolean;
  netBalance: number;
  debit?: number;
  credit?: number;
}

export interface Period {
  id: number;
  periodName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

const formatNumber = (amount: number) => {
  if (amount === 0) return '-';
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return amount < 0 ? `(${formatted})` : formatted;
};

// Sanitasi URL API tanpa akhiran /api atau slash ganda
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function AdjustedTrialBalancePage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);

  // Memuat data Adjusted Trial Balance dari API Backend Web Controller
  const fetchTrialBalanceData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/trial-balance/adjusted`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Menggunakan Identity Cookie Session
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setRows([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Adjusted Trial Balance data from the server.');
      }

      const rawData = await response.json();

      // Tangani kondisi saat belum ada periode terpilih
      if (rawData?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setRows([]);
        return;
      }

      // Safe extraction untuk menangani format array langsung atau terbungkus objek
      const rawRows: TrialBalanceRow[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData?.rows)
        ? rawData.rows
        : [];

      // Memastikan kalkulasi Debit & Kredit tiap baris konsisten dengan Saldo Normal
      const computedRows = rawRows.map((r) => {
        const net = r.netBalance ?? 0;
        const isDebitNormal = r.normalBalanceIsDebit;

        let debitVal = r.debit ?? 0;
        let creditVal = r.credit ?? 0;

        if (r.debit === undefined && r.credit === undefined) {
          if (isDebitNormal) {
            debitVal = net >= 0 ? net : 0;
            creditVal = net < 0 ? Math.abs(net) : 0;
          } else {
            creditVal = net >= 0 ? net : 0;
            debitVal = net < 0 ? Math.abs(net) : 0;
          }
        }

        return {
          ...r,
          debit: debitVal,
          credit: creditVal,
        };
      });

      setNoPeriodSelected(false);
      setRows(computedRows);
    } catch (error: any) {
      console.error('Error fetching adjusted trial balance:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrialBalanceData();

    // Event listener untuk re-fetch otomatis saat periode di Topbar / Periods page diubah
    const handlePeriodChanged = () => {
      fetchTrialBalanceData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchTrialBalanceData]);

  const totalDebit = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0),
    [rows]
  );
  const totalCredit = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0),
    [rows]
  );
  const isBalanced = useMemo(
    () => Math.abs(totalDebit - totalCredit) < 0.01,
    [totalDebit, totalCredit]
  );

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Adjusted Trial Balance...</span>
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
            This report follows whichever period you&apos;re viewing. Select a period to view its adjusted trial balance.
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
          {/* Header Section */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-list-check me-2 text-info fs-2"></i> Adjusted Trial Balance
              </h2>
              <p className="text-white-50 mb-0">
                Account balances after reflecting adjusting entries &mdash; the foundation for preparing the Income Statement and Balance Sheet.
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link
                href="/reports/trial-balance/unadjusted"
                className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center"
              >
                <i className="ti ti-list me-1"></i> Trial Balance
              </Link>
              <Link
                href="/reports/adjusting-journal"
                className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center"
              >
                <i className="ti ti-notes me-1"></i> Adjusting Journal
              </Link>
            </div>
          </div>

          {/* Trial Balance Table Card */}
          <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead className="table-active border-bottom border-secondary text-secondary">
                    <tr>
                      <th className="text-center ps-4" style={{ width: '10%' }}>
                        Ref.
                      </th>
                      <th style={{ width: '45%' }}>Account Name</th>
                      <th style={{ width: '15%' }}>Type</th>
                      <th className="text-end" style={{ width: '15%' }}>
                        Debit
                      </th>
                      <th className="text-end pe-4" style={{ width: '15%' }}>
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((row) => (
                        <tr key={row.accountId}>
                          <td className="text-center ps-4">
                            <code className="text-warning">{row.referenceNumber}</code>
                          </td>
                          <td className="fw-semibold text-white">{row.accountName}</td>
                          <td>
                            <span className="badge bg-secondary bg-opacity-25 border border-secondary">
                              {row.type}
                            </span>
                          </td>
                          <td className="text-end text-success font-monospace">
                            {(row.debit ?? 0) > 0 ? formatNumber(row.debit!) : '-'}
                          </td>
                          <td className="text-end text-danger pe-4 font-monospace">
                            {(row.credit ?? 0) > 0 ? formatNumber(row.credit!) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-white-50">
                          No accounts with transaction history found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-top border-secondary fw-bold text-white">
                      <td colSpan={3} className="text-end pe-3 ps-4">
                        Total
                      </td>
                      <td className="text-end text-success font-monospace fs-6">
                        {formatNumber(totalDebit)}
                      </td>
                      <td className="text-end text-danger pe-4 font-monospace fs-6">
                        {formatNumber(totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Balance Indicator Alert */}
          {rows.length > 0 && (
            <div
              className={`alert ${
                isBalanced ? 'alert-success border-success' : 'alert-danger border-danger'
              } bg-opacity-10 text-white mt-4 mb-0 py-2 small d-flex align-items-center shadow-sm`}
            >
              {isBalanced ? (
                <>
                  <i className="ti ti-circle-check-filled text-success me-2 fs-5 flex-shrink-0"></i>
                  <span>Total Debit equals Total Credit. The adjusted trial balance is balanced.</span>
                </>
              ) : (
                <>
                  <i className="ti ti-alert-triangle-filled text-danger me-2 fs-5 flex-shrink-0"></i>
                  <span>
                    The adjusted trial balance is unbalanced. Please review your adjusting journal entries.
                  </span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
