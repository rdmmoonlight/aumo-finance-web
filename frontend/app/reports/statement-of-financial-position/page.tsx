'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface FinancialPositionLine {
  referenceNumber: number;
  accountName: string;
  amount: number;
}

export interface StatementOfFinancialPositionViewModel {
  asOfDate: string;
  isPostClosing: boolean;
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

export default function StatementOfFinancialPositionReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<StatementOfFinancialPositionViewModel>({
    asOfDate: '',
    isPostClosing: false,
    assets: [],
    liabilities: [],
    equityExcludingRetainedEarnings: [],
    retainedEarningsEnding: 0,
  });

  // Memuat data Statement of Financial Position dari Web Controller
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/statement-of-financial-position`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Cookie Session Identity
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({
          asOfDate: '',
          isPostClosing: false,
          assets: [],
          liabilities: [],
          equityExcludingRetainedEarnings: [],
          retainedEarningsEnding: 0,
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Statement of Financial Position data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({
          asOfDate: '',
          isPostClosing: false,
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

      // Ekstraksi akun Ekuitas selain Retained Earnings jika dikirim terpisah
      const rawEquityList = Array.isArray(data?.equityAccounts)
        ? data.equityAccounts
        : Array.isArray(data?.equityExcludingRetainedEarnings)
        ? data.equityExcludingRetainedEarnings
        : [];

      // Memisahkan Retained Earnings dari array ekuitas umum jika tercampur
      const equityExcludingRE = rawEquityList.filter(
        (e: any) => e.accountName !== 'Retained Earnings' && e.referenceNumber !== 0
      );

      const reItem = rawEquityList.find(
        (e: any) => e.accountName === 'Retained Earnings' || e.referenceNumber === 0
      );

      const reEndingValue = reItem
        ? Number(reItem.amount) || 0
        : Number(data?.retainedEarningsEnding) || 0;

      const safeVm: StatementOfFinancialPositionViewModel = {
        asOfDate: data?.asOfDate || '',
        isPostClosing: Boolean(data?.isPostClosing),
        assets: assetsList,
        liabilities: liabilitiesList,
        equityExcludingRetainedEarnings: equityExcludingRE,
        retainedEarningsEnding: reEndingValue,
      };

      setNoPeriodSelected(false);
      setVm(safeVm);
    } catch (error: any) {
      console.error('Error loading Statement of Financial Position data:', error);
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

  // Perhitungan Subtotal dan Total
  const totalAssets = useMemo(() => {
    return vm.assets.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.assets]);

  const totalLiabilities = useMemo(() => {
    return vm.liabilities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.liabilities]);

  const totalEquity = useMemo(() => {
    const otherEquity = vm.equityExcludingRetainedEarnings.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    return otherEquity + vm.retainedEarningsEnding;
  }, [vm.equityExcludingRetainedEarnings, vm.retainedEarningsEnding]);

  const totalLiabilitiesAndEquity = useMemo(() => {
    return totalLiabilities + totalEquity;
  }, [totalLiabilities, totalEquity]);

  const isBalanced = useMemo(() => {
    return Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
  }, [totalAssets, totalLiabilitiesAndEquity]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Statement of Financial Position...</span>
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
                <i className="ti ti-building-bank me-2 text-info fs-2"></i> Statement of Financial Position
              </h2>
              <p className="text-white-50 mb-0">
                In accordance with IAS 1, as of <strong>{formatDateDisplay(vm.asOfDate) || 'current period'}</strong> (In IDR, unless otherwise stated).
              </p>
            </div>
            <div>
              <Link href="/reports/closing-journal" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-arrow-right-circle me-1"></i> Closing Journal
              </Link>
            </div>
          </div>

          {/* Main Balance Sheet Content */}
          <div className="row g-4 align-items-stretch">
            {/* Left Column: Assets */}
            <div className="col-lg-6 d-flex flex-column">
              <div className="card bg-dark border-secondary text-white shadow-sm flex-grow-1 border border-secondary border-opacity-25 rounded-4">
                <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 fw-bold text-uppercase small text-warning py-3 px-4">
                  Assets
                </div>
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  <div className="table-responsive">
                    <table className="table table-dark table-borderless align-middle mb-0">
                      <tbody>
                        {vm.assets.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="ps-0 text-white-50 fst-italic">No asset accounts recorded.</td>
                          </tr>
                        ) : (
                          vm.assets.map((l, idx) => (
                            <tr key={`asset-${idx}`}>
                              <td className="ps-0">
                                <code className="text-white-50 me-2">{l.referenceNumber}</code>
                                {l.accountName}
                              </td>
                              <td className="text-end pe-0 font-monospace">{formatNumber(l.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-top border-secondary pt-3 mt-3">
                    <div className="d-flex justify-content-between align-items-center fw-bold fs-5">
                      <span>Total Assets</span>
                      <span className="text-info font-monospace">{formatNumber(totalAssets)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div className="col-lg-6 d-flex flex-column gap-4">
              {/* Liabilities Card */}
              <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4">
                <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 fw-bold text-uppercase small text-warning py-3 px-4">
                  Liabilities
                </div>
                <div className="card-body p-4">
                  <div className="table-responsive">
                    <table className="table table-dark table-borderless align-middle mb-0">
                      <tbody>
                        {vm.liabilities.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="ps-0 text-white-50 fst-italic">No liability accounts recorded.</td>
                          </tr>
                        ) : (
                          vm.liabilities.map((l, idx) => (
                            <tr key={`liab-${idx}`}>
                              <td className="ps-0">
                                <code className="text-white-50 me-2">{l.referenceNumber}</code>
                                {l.accountName}
                              </td>
                              <td className="text-end pe-0 font-monospace">{formatNumber(l.amount)}</td>
                            </tr>
                          ))
                        )}
                        <tr className="border-top border-secondary fw-semibold">
                          <td className="pt-3 ps-0">Total Liabilities</td>
                          <td className="text-end pt-3 pe-0 font-monospace">{formatNumber(totalLiabilities)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Equity Card */}
              <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4">
                <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 fw-bold text-uppercase small text-warning py-3 px-4">
                  Equity
                </div>
                <div className="card-body p-4">
                  <div className="table-responsive">
                    <table className="table table-dark table-borderless align-middle mb-0">
                      <tbody>
                        {vm.equityExcludingRetainedEarnings.map((l, idx) => (
                          <tr key={`eq-${idx}`}>
                            <td className="ps-0">
                              <code className="text-white-50 me-2">{l.referenceNumber}</code>
                              {l.accountName}
                            </td>
                            <td className="text-end pe-0 font-monospace">{formatNumber(l.amount)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="ps-0">Retained earnings, {formatDateDisplay(vm.asOfDate) || 'as of date'}</td>
                          <td className="text-end pe-0 font-monospace">{formatNumber(vm.retainedEarningsEnding)}</td>
                        </tr>
                        <tr className="border-top border-secondary fw-semibold">
                          <td className="pt-3 ps-0">Total Equity</td>
                          <td className="text-end pt-3 pe-0 font-monospace">{formatNumber(totalEquity)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Total Liabilities & Equity Summary Card */}
              <div className="card bg-dark border-secondary text-white shadow-sm mt-auto border border-secondary border-opacity-25 rounded-4">
                <div className="card-body d-flex justify-content-between align-items-center py-3 px-4">
                  <span className="fw-bold fs-5">Total Liabilities &amp; Equity</span>
                  <span className="fw-bold fs-5 text-info font-monospace">{formatNumber(totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Balance Indicator Alert */}
          <div
            className={`alert ${
              isBalanced ? 'alert-success border-success' : 'alert-danger border-danger'
            } bg-opacity-10 text-white mt-4 mb-0 py-2 small d-flex align-items-center shadow-sm`}
          >
            {isBalanced ? (
              <>
                <i className="ti ti-circle-check-filled text-success me-2 fs-5 flex-shrink-0"></i>
                <span>
                  Total Assets = Total Liabilities + Equity. The Statement of Financial Position is balanced.
                </span>
              </>
            ) : (
              <>
                <i className="ti ti-alert-triangle-filled text-danger me-2 fs-5 flex-shrink-0"></i>
                <span>
                  Total Assets does not equal Total Liabilities + Equity. Please check your journal entries.
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}