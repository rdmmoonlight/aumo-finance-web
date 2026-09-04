'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface RetainedEarningsViewModel {
  accountName: string;
  startDate: string;
  endDate: string;
  beginningBalance: number;
  netIncome: number;
  dividends: number;
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

// Helper format tanggal tampilan (misal: "01 Jan 2026")
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

export default function RetainedEarningsReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<RetainedEarningsViewModel>({
    accountName: 'Retained Earnings',
    startDate: '',
    endDate: '',
    beginningBalance: 0,
    netIncome: 0,
    dividends: 0,
  });

  // Memuat data Retained Earnings Statement dari API Backend Web Controller
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
    const response = await fetch(`${API_BASE_URL}/web/reports/retained-earnings`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Untuk Identity Cookie Session
        });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({
          accountName: 'Retained Earnings',
          startDate: '',
          endDate: '',
          beginningBalance: 0,
          netIncome: 0,
          dividends: 0,
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Retained Earnings data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({
          accountName: 'Retained Earnings',
          startDate: '',
          endDate: '',
          beginningBalance: 0,
          netIncome: 0,
          dividends: 0,
        });
        return;
      }

      // Safe extraction field dari DTO Web backend
      const safeVm: RetainedEarningsViewModel = {
        accountName: data?.accountName || 'Retained Earnings',
        startDate: data?.startDate || '',
        endDate: data?.endDate || '',
        beginningBalance: Number(data?.beginningRetainedEarnings ?? data?.beginningBalance) || 0,
        netIncome: Number(data?.netIncome) || 0,
        dividends: Number(data?.dividendsOrDraws ?? data?.dividends) || 0,
      };

      setNoPeriodSelected(false);
      setVm(safeVm);
    } catch (error: any) {
      console.error('Error loading Retained Earnings data:', error);
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

  // Perhitungan Saldo Akhir Laba Ditahan
  const endingBalance = useMemo(() => {
    return vm.beginningBalance + vm.netIncome - vm.dividends;
  }, [vm.beginningBalance, vm.netIncome, vm.dividends]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Retained Earnings Statement...</span>
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
                <i className="ti ti-piggy-bank me-2 text-success fs-2"></i> Retained Earnings Statement
              </h2>
              <p className="text-white-50 mb-0">
                Bridges the Income Statement and the Equity section on the Balance Sheet (In IDR, unless otherwise stated).
              </p>
            </div>
            <div>
              <Link href="/reports/statement-of-financial-position" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-arrow-right-circle me-1"></i> Balance Sheet
              </Link>
            </div>
          </div>

          {/* Statement Card */}
          <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4" style={{ maxWidth: '560px' }}>
            <div className="card-body p-4">
              <h5 className="mb-3 fw-bold text-white">{vm.accountName}</h5>
              <div className="table-responsive">
                <table className="table table-dark table-borderless align-middle mb-0">
                  <tbody>
                    {/* Beginning Balance */}
                    <tr>
                      <td>Retained earnings, {formatDateDisplay(vm.startDate) || 'start of period'}</td>
                      <td className="text-end font-monospace">{formatNumber(vm.beginningBalance)}</td>
                    </tr>

                    {/* Net Income / Loss */}
                    <tr>
                      <td className="ps-3">Add: Net Income for the Period</td>
                      <td className={`text-end font-monospace ${vm.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatNumber(vm.netIncome)}
                      </td>
                    </tr>

                    {/* Dividends / Withdrawals (Optional) */}
                    {vm.dividends !== 0 && (
                      <tr>
                        <td className="ps-3">Less: Dividends / Withdrawals</td>
                        <td className="text-end text-danger font-monospace">({formatNumber(vm.dividends)})</td>
                      </tr>
                    )}

                    {/* Ending Balance */}
                    <tr
                      className="border-top border-secondary fw-bold fs-5"
                      style={{ borderTopWidth: '3px' }}
                    >
                      <td className="pt-3">Retained earnings, {formatDateDisplay(vm.endDate) || 'end of period'}</td>
                      <td className="text-end pt-3 text-success font-monospace">{formatNumber(endingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}