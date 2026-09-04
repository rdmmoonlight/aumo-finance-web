'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface FinancialPositionLine {
  referenceNumber: number;
  accountName: string;
  amount: number;
}

export interface PostClosingTrialBalanceViewModel {
  asOfDate: string;
  assets: FinancialPositionLine[];
  liabilities: FinancialPositionLine[];
  equityExcludingRetainedEarnings: FinancialPositionLine[];
  retainedEarningsEnding: number;
}

export interface Period {
  id: number;
  periodName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

// Format angka standar tanpa simbol mata uang
const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return amount < 0 ? `(${formatted})` : formatted;
};

// Helper format tanggal tampilan (misal: "31 Jan 2026")
const formatDateDisplay = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

// Sanitasi URL API
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function PostClosingTrialBalanceReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<PostClosingTrialBalanceViewModel>({
    asOfDate: '',
    assets: [],
    liabilities: [],
    equityExcludingRetainedEarnings: [],
    retainedEarningsEnding: 0,
  });

  // Memuat data Post-Closing Trial Balance dari API Backend Web Controller
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // Menggunakan endpoint Web Controller
      const response = await fetch(`${API_BASE_URL}/web/reports/statement-of-financial-position?isPostClosing=true`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Cookie Session Identity
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({
          asOfDate: '',
          assets: [],
          liabilities: [],
          equityExcludingRetainedEarnings: [],
          retainedEarningsEnding: 0,
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Post-Closing Trial Balance data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({
          asOfDate: '',
          assets: [],
          liabilities: [],
          equityExcludingRetainedEarnings: [],
          retainedEarningsEnding: 0,
        });
        return;
      }

      // Safe extraction pendukung properti dari DTO Backend
      const assetsList = Array.isArray(data?.assetAccounts)
        ? data.assetAccounts
        : Array.isArray(data?.assets)
        ? data.assets
        : [];

      const liabilitiesList = Array.isArray(data?.liabilityAccounts)
        ? data.liabilityAccounts
        : Array.isArray(data?.liabilities)
        ? data.liabilities
        : [];

      const rawEquityList = Array.isArray(data?.equityAccounts)
        ? data.equityAccounts
        : Array.isArray(data?.equityExcludingRetainedEarnings)
        ? data.equityExcludingRetainedEarnings
        : [];

      const equityExcludingRE = rawEquityList.filter(
        (e: any) => e.accountName !== 'Retained Earnings' && e.referenceNumber !== 0
      );

      const reItem = rawEquityList.find(
        (e: any) => e.accountName === 'Retained Earnings' || e.referenceNumber === 0
      );

      const reEndingValue = reItem
        ? Number(reItem.amount) || 0
        : Number(data?.retainedEarningsEnding) || 0;

      const safeVm: PostClosingTrialBalanceViewModel = {
        asOfDate: data?.asOfDate || '',
        assets: assetsList,
        liabilities: liabilitiesList,
        equityExcludingRetainedEarnings: equityExcludingRE,
        retainedEarningsEnding: reEndingValue,
      };

      setNoPeriodSelected(false);
      setVm(safeVm);
    } catch (error: any) {
      console.error('Error loading Post-Closing Trial Balance data:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData();

    // Event listener untuk memuat ulang data saat periode di Topbar diubah
    const handlePeriodChanged = () => {
      fetchReportData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchReportData]);

  // Calculation for Total Assets (Total Debit)
  const totalAssets = useMemo(() => {
    return vm.assets.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.assets]);

  // Calculation for Total Liabilities and Equity (Total Credit)
  const totalLiabilitiesAndEquity = useMemo(() => {
    const totalLiab = vm.liabilities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalEquity = vm.equityExcludingRetainedEarnings.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    return totalLiab + totalEquity + vm.retainedEarningsEnding;
  }, [vm.liabilities, vm.equityExcludingRetainedEarnings, vm.retainedEarningsEnding]);

  // Check if Trial Balance is Balanced
  const isBalanced = useMemo(() => {
    return Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
  }, [totalAssets, totalLiabilitiesAndEquity]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Post-Closing Trial Balance...</span>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-4 text-white">
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm py-2 mb-4 d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
          <button type="button" className="btn-close ms-auto" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}

      {noPeriodSelected ? (
        /* Empty State: No Period Selected */
        <div className="text-center py-5 my-4">
          <i className="ti ti-eye-off text-secondary mb-3 d-block mx-auto" style={{ fontSize: '2.5rem' }}></i>
          <h5 className="fw-bold text-white mb-2">No Period Selected</h5>
          <p className="text-white-50 mb-3">This report follows whichever period you&apos;re viewing.</p>
          <Link href="/periods" className="btn btn-primary btn-sm fw-semibold shadow-sm px-4 d-inline-flex align-items-center">
            <i className="ti ti-calendar me-1"></i> Go to Periods
          </Link>
        </div>
      ) : (
        /* Report Content */
        <>
          {/* Header Section (Keterangan mata uang diletakkan di deskripsi header saja) */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-shield-check me-2 text-info fs-2"></i> Post-Closing Trial Balance
              </h2>
              <p className="text-white-50 mb-0">
                Displays permanent accounts (Assets, Liabilities, Equity) after closing entries as of{' '}
                <strong>{formatDateDisplay(vm.asOfDate) || 'current period'}</strong> (In IDR, unless otherwise stated) &mdash; all nominal accounts have zero balances.
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link href="/reports/trial-balance/adjusted" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-list-check me-1"></i> Adjusted TB
              </Link>
              <Link href="/reports/cash-flow" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-cash me-1"></i> Cash Flow
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
                    {/* 1. ASSETS (Normal Balance = Debit) */}
                    {vm.assets.map((asset, idx) => (
                      <tr key={`asset-${idx}`}>
                        <td className="text-center ps-4">
                          <code className="text-warning">{asset.referenceNumber}</code>
                        </td>
                        <td className="fw-semibold text-white">{asset.accountName}</td>
                        <td>
                          <span className="badge bg-secondary bg-opacity-25 border border-secondary">
                            Assets
                          </span>
                        </td>
                        <td className="text-end text-success font-monospace">{formatNumber(asset.amount)}</td>
                        <td className="text-end text-danger pe-4 font-monospace">-</td>
                      </tr>
                    ))}

                    {/* 2. LIABILITIES (Normal Balance = Credit) */}
                    {vm.liabilities.map((liab, idx) => (
                      <tr key={`liab-${idx}`}>
                        <td className="text-center ps-4">
                          <code className="text-warning">{liab.referenceNumber}</code>
                        </td>
                        <td className="fw-semibold text-white">{liab.accountName}</td>
                        <td>
                          <span className="badge bg-secondary bg-opacity-25 border border-secondary">
                            Liabilities
                          </span>
                        </td>
                        <td className="text-end text-success font-monospace">-</td>
                        <td className="text-end text-danger pe-4 font-monospace">{formatNumber(liab.amount)}</td>
                      </tr>
                    ))}

                    {/* 3. EQUITY EXCLUDING RETAINED EARNINGS (Normal Balance = Credit) */}
                    {vm.equityExcludingRetainedEarnings.map((eq, idx) => (
                      <tr key={`eq-${idx}`}>
                        <td className="text-center ps-4">
                          <code className="text-warning">{eq.referenceNumber}</code>
                        </td>
                        <td className="fw-semibold text-white">{eq.accountName}</td>
                        <td>
                          <span className="badge bg-secondary bg-opacity-25 border border-secondary">
                            Equity
                          </span>
                        </td>
                        <td className="text-end text-success font-monospace">-</td>
                        <td className="text-end text-danger pe-4 font-monospace">{formatNumber(eq.amount)}</td>
                      </tr>
                    ))}

                    {/* 4. RETAINED EARNINGS (Ending) */}
                    <tr>
                      <td className="text-center ps-4">
                        <code className="text-warning">-</code>
                      </td>
                      <td className="fw-semibold text-white">
                        Retained earnings, {formatDateDisplay(vm.asOfDate) || 'as of date'}
                      </td>
                      <td>
                        <span className="badge bg-secondary bg-opacity-25 border border-secondary">
                          Equity
                        </span>
                      </td>
                      <td className="text-end text-success font-monospace">
                        {vm.retainedEarningsEnding < 0
                          ? formatNumber(vm.retainedEarningsEnding)
                          : '-'}
                      </td>
                      <td className="text-end text-danger pe-4 font-monospace">
                        {vm.retainedEarningsEnding >= 0
                          ? formatNumber(vm.retainedEarningsEnding)
                          : '-'}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-top border-secondary fw-bold text-white">
                      <td colSpan={3} className="text-end pe-3 ps-4">
                        Total
                      </td>
                      <td className="text-end text-success font-monospace">{formatNumber(totalAssets)}</td>
                      <td className="text-end text-danger pe-4 font-monospace">{formatNumber(totalLiabilitiesAndEquity)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Balance Status Alert */}
          <div
            className={`alert ${
              isBalanced ? 'alert-success border-success' : 'alert-danger border-danger'
            } bg-opacity-10 text-white mt-4 mb-0 py-2 small d-flex align-items-center shadow-sm`}
          >
            {isBalanced ? (
              <>
                <i className="ti ti-circle-check-filled text-success me-2 fs-5 flex-shrink-0"></i>
                <span>
                  Total Debit = Total Credit. Post-closing trial balance is in balance; books are ready for the next period.
                </span>
              </>
            ) : (
              <>
                <i className="ti ti-alert-triangle-filled text-danger me-2 fs-5 flex-shrink-0"></i>
                <span>
                  Post-closing trial balance is out of balance. Please check your closing journal entries.
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}