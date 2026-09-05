'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface IncomeStatementLine {
  referenceNumber: number;
  accountName: string;
  amount: number;
}

export interface IncomeStatementViewModel {
  asOfDate: string;
  revenues: IncomeStatementLine[];
  operatingExpenses: IncomeStatementLine[];
  otherIncome: IncomeStatementLine[];
  otherExpenses: IncomeStatementLine[];
}

export interface Period {
  id: number;
  periodName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

// Format angka standar tanpa tanda Rp / IDR
const formatNumber = (amount: number) => {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return amount < 0 ? `(${formatted})` : formatted;
};

// Sanitasi URL API
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function IncomeStatementReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<IncomeStatementViewModel>({
    asOfDate: '',
    revenues: [],
    operatingExpenses: [],
    otherIncome: [],
    otherExpenses: [],
  });

  // Memuat data Laporan Laba Rugi dari API Backend Web Controller
  const fetchIncomeStatementData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/income-statement`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Cookie Session Identity
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({
          asOfDate: '',
          revenues: [],
          operatingExpenses: [],
          otherIncome: [],
          otherExpenses: [],
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Income Statement data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({
          asOfDate: '',
          revenues: [],
          operatingExpenses: [],
          otherIncome: [],
          otherExpenses: [],
        });
        return;
      }

      // Safe extraction pendukung properti tunggal/jamak dari DTO backend Web
      const revenuesList = Array.isArray(data?.revenueAccounts)
        ? data.revenueAccounts
        : Array.isArray(data?.revenues)
        ? data.revenues
        : [];

      const operatingExpensesList = Array.isArray(data?.expenseAccounts)
        ? data.expenseAccounts
        : Array.isArray(data?.operatingExpenses)
        ? data.operatingExpenses
        : [];

      const otherIncomeList = Array.isArray(data?.otherIncomeAccounts)
        ? data.otherIncomeAccounts
        : Array.isArray(data?.otherIncome)
        ? data.otherIncome
        : [];

      const otherExpensesList = Array.isArray(data?.otherExpenseAccounts)
        ? data.otherExpenseAccounts
        : Array.isArray(data?.otherExpenses)
        ? data.otherExpenses
        : [];

      const safeVm: IncomeStatementViewModel = {
        asOfDate: data?.asOfDate || '',
        revenues: revenuesList,
        operatingExpenses: operatingExpensesList,
        otherIncome: otherIncomeList,
        otherExpenses: otherExpensesList,
      };

      setNoPeriodSelected(false);
      setVm(safeVm);
    } catch (error: any) {
      console.error('Error loading Income Statement data:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncomeStatementData();

    // Event listener untuk memuat ulang data saat periode di Topbar diubah
    const handlePeriodChanged = () => {
      fetchIncomeStatementData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchIncomeStatementData]);

  // Perhitungan Subtotal dan Net Income
  const totalRevenue = useMemo(() => {
    return vm.revenues.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.revenues]);

  const totalOperatingExpenses = useMemo(() => {
    return vm.operatingExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.operatingExpenses]);

  const operatingIncome = useMemo(() => {
    return totalRevenue - totalOperatingExpenses;
  }, [totalRevenue, totalOperatingExpenses]);

  const totalOtherIncome = useMemo(() => {
    return vm.otherIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.otherIncome]);

  const totalOtherExpenses = useMemo(() => {
    return vm.otherExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.otherExpenses]);

  const netIncome = useMemo(() => {
    return operatingIncome + totalOtherIncome - totalOtherExpenses;
  }, [operatingIncome, totalOtherIncome, totalOtherExpenses]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Income Statement...</span>
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
        /* Income Statement Content */
        <>
          {/* Header Section (Keterangan mata uang diletakkan di deskripsi header saja) */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-trending-up me-2 text-success fs-2"></i> Income Statement
              </h2>
              <p className="text-white-50 mb-0">
                Statement of Profit or Loss (IAS 1) for the period ending {vm.asOfDate ? new Date(vm.asOfDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'current period'} (In IDR, unless otherwise stated).
              </p>
            </div>
            <div>
              <Link href="/reports/retained-earnings" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-arrow-right-circle me-1"></i> Retained Earnings
              </Link>
            </div>
          </div>

          {/* Income Statement Table Card */}
          <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4">
            <div className="card-body p-4">
              <div className="table-responsive">
                <table className="table table-dark table-borderless align-middle mb-0">
                  <tbody>
                    {/* REVENUE */}
                    <tr>
                      <td colSpan={2} className="fw-bold text-warning text-uppercase small pb-2">
                        Revenue
                      </td>
                    </tr>
                    {vm.revenues.length === 0 ? (
                      <tr>
                        <td className="ps-4 text-white-50 fst-italic">No revenue accounts recorded.</td>
                        <td className="text-end text-white-50 font-monospace">-</td>
                      </tr>
                    ) : (
                      vm.revenues.map((l, idx) => (
                        <tr key={`rev-${idx}`}>
                          <td className="ps-4">
                            <code className="text-white-50 me-2">{l.referenceNumber}</code>
                            {l.accountName}
                          </td>
                          <td className="text-end font-monospace">{formatNumber(l.amount)}</td>
                        </tr>
                      ))
                    )}
                    <tr className="border-top border-secondary fw-semibold">
                      <td className="ps-4 pt-2">Total Revenue</td>
                      <td className="text-end pt-2 font-monospace">{formatNumber(totalRevenue)}</td>
                    </tr>

                    {/* OPERATING EXPENSES */}
                    <tr>
                      <td colSpan={2} className="pt-4 fw-bold text-warning text-uppercase small pb-2">
                        Operating Expenses
                      </td>
                    </tr>
                    {vm.operatingExpenses.length === 0 ? (
                      <tr>
                        <td className="ps-4 text-white-50 fst-italic">No operating expense accounts recorded.</td>
                        <td className="text-end text-white-50 font-monospace">-</td>
                      </tr>
                    ) : (
                      vm.operatingExpenses.map((l, idx) => (
                        <tr key={`opex-${idx}`}>
                          <td className="ps-4">
                            <code className="text-white-50 me-2">{l.referenceNumber}</code>
                            {l.accountName}
                          </td>
                          <td className="text-end font-monospace">({formatNumber(l.amount)})</td>
                        </tr>
                      ))
                    )}
                    <tr className="border-top border-secondary fw-semibold">
                      <td className="ps-4 pt-2">Total Operating Expenses</td>
                      <td className="text-end pt-2 font-monospace">({formatNumber(totalOperatingExpenses)})</td>
                    </tr>

                    {/* OPERATING INCOME */}
                    <tr className="border-top border-bottom border-secondary fw-bold fs-5">
                      <td className="pt-3 pb-3">Operating Income</td>
                      <td
                        className={`text-end pt-3 pb-3 font-monospace ${
                          operatingIncome >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatNumber(operatingIncome)}
                      </td>
                    </tr>

                    {/* OTHER INCOME & EXPENSES */}
                    {(vm.otherIncome.length > 0 || vm.otherExpenses.length > 0) && (
                      <>
                        <tr>
                          <td colSpan={2} className="pt-4 fw-bold text-warning text-uppercase small pb-2">
                            Other Income &amp; Expenses
                          </td>
                        </tr>
                        {vm.otherIncome.map((l, idx) => (
                          <tr key={`oth-inc-${idx}`}>
                            <td className="ps-4">
                              <code className="text-white-50 me-2">{l.referenceNumber}</code>
                              {l.accountName}
                            </td>
                            <td className="text-end font-monospace">{formatNumber(l.amount)}</td>
                          </tr>
                        ))}
                        {vm.otherExpenses.map((l, idx) => (
                          <tr key={`oth-exp-${idx}`}>
                            <td className="ps-4">
                              <code className="text-white-50 me-2">{l.referenceNumber}</code>
                              {l.accountName}
                            </td>
                            <td className="text-end font-monospace">({formatNumber(l.amount)})</td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* NET INCOME */}
                    <tr
                      className="border-top border-secondary"
                      style={{ borderTopWidth: '3px' }}
                    >
                      <td className="fw-bold fs-5 pt-3">Net Income</td>
                      <td
                        className={`text-end fw-bold fs-5 pt-3 font-monospace ${
                          netIncome >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatNumber(netIncome)}
                      </td>
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