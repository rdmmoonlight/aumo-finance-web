'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface WorksheetRow {
  accountId: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  normalBalanceIsDebit: boolean;
  unadjustedDebit: number;
  unadjustedCredit: number;
  adjustmentDebit: number;
  adjustmentCredit: number;
  adjustedDebit: number;
  adjustedCredit: number;
  incomeStatementDebit: number;
  incomeStatementCredit: number;
  financialPositionDebit: number;
  financialPositionCredit: number;
}

export interface WorksheetViewModel {
  rows: WorksheetRow[];
  netIncome: number;
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

// Sanitasi URL API tanpa /api
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function WorksheetReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<WorksheetViewModel>({ rows: [], netIncome: 0 });

  // Memuat data Worksheet 10-Kolom dari API Backend Web (/web/reports/worksheet)
  const fetchWorksheetData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/worksheet`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Menggunakan Session Cookie
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({ rows: [], netIncome: 0 });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Worksheet data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({ rows: [], netIncome: 0 });
        return;
      }

      // Pemetaan field dari DTO Backend ke ViewModel Frontend
      const rawRows = Array.isArray(data?.rows) ? data.rows : [];
      const mappedRows: WorksheetRow[] = rawRows.map((r: any) => ({
        accountId: r.accountId,
        referenceNumber: r.referenceNumber,
        accountName: r.accountName,
        type: r.type,
        normalBalanceIsDebit: r.normalBalanceIsDebit ?? true,
        unadjustedDebit: Number(r.tbDebit) || 0,
        unadjustedCredit: Number(r.tbCredit) || 0,
        adjustmentDebit: Number(r.adjDebit) || 0,
        adjustmentCredit: Number(r.adjCredit) || 0,
        adjustedDebit: Number(r.adjTbDebit) || 0,
        adjustedCredit: Number(r.adjTbCredit) || 0,
        incomeStatementDebit: Number(r.isDebit) || 0,
        incomeStatementCredit: Number(r.isCredit) || 0,
        financialPositionDebit: Number(r.bsDebit) || 0,
        financialPositionCredit: Number(r.bsCredit) || 0,
      }));

      const safeVm: WorksheetViewModel = {
        rows: mappedRows,
        netIncome: Number(data?.totals?.netIncome) || 0,
      };

      setNoPeriodSelected(false);
      setVm(safeVm);
    } catch (error: any) {
      console.error('Error fetching worksheet data:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
      setVm({ rows: [], netIncome: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorksheetData();

    // Re-fetch otomatis jika periode diubah di Topbar/Navbar
    const handlePeriodChanged = () => {
      fetchWorksheetData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchWorksheetData]);

  // Total Per Kolom
  const totals = useMemo(() => {
    const safeRows = Array.isArray(vm.rows) ? vm.rows : [];
    return safeRows.reduce(
      (acc, r) => {
        acc.unadjustedDebit += Number(r.unadjustedDebit) || 0;
        acc.unadjustedCredit += Number(r.unadjustedCredit) || 0;
        acc.adjustmentDebit += Number(r.adjustmentDebit) || 0;
        acc.adjustmentCredit += Number(r.adjustmentCredit) || 0;
        acc.adjustedDebit += Number(r.adjustedDebit) || 0;
        acc.adjustedCredit += Number(r.adjustedCredit) || 0;
        acc.incomeStatementDebit += Number(r.incomeStatementDebit) || 0;
        acc.incomeStatementCredit += Number(r.incomeStatementCredit) || 0;
        acc.financialPositionDebit += Number(r.financialPositionDebit) || 0;
        acc.financialPositionCredit += Number(r.financialPositionCredit) || 0;
        return acc;
      },
      {
        unadjustedDebit: 0,
        unadjustedCredit: 0,
        adjustmentDebit: 0,
        adjustmentCredit: 0,
        adjustedDebit: 0,
        adjustedCredit: 0,
        incomeStatementDebit: 0,
        incomeStatementCredit: 0,
        financialPositionDebit: 0,
        financialPositionCredit: 0,
      }
    );
  }, [vm.rows]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading 10-Column Worksheet...</span>
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
                <i className="ti ti-grid-dots me-2 text-info fs-2"></i> Worksheet
              </h2>
              <p className="text-white-50 mb-0">
                10-column worksheet: Trial Balance, Adjustments, Adjusted Trial Balance, Income Statement, and Balance Sheet (In IDR, unless otherwise stated).
              </p>
            </div>
            <div>
              <Link href="/reports/income-statement" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-trending-up me-1"></i> Income Statement
              </Link>
            </div>
          </div>

          {/* Worksheet 10-Column Table Card */}
          <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0 small">
                  <thead className="table-active border-bottom border-secondary text-center text-secondary">
                    <tr>
                      <th rowSpan={2} className="align-middle text-start ps-4">
                        Account
                      </th>
                      <th colSpan={2}>Trial Balance</th>
                      <th colSpan={2}>Adjustments</th>
                      <th colSpan={2}>Adjusted Trial Balance</th>
                      <th colSpan={2}>Income Statement</th>
                      <th colSpan={2} className="pe-4">Balance Sheet</th>
                    </tr>
                    <tr>
                      <th className="text-end">Dr</th>
                      <th className="text-end">Cr</th>
                      <th className="text-end">Dr</th>
                      <th className="text-end">Cr</th>
                      <th className="text-end">Dr</th>
                      <th className="text-end">Cr</th>
                      <th className="text-end">Dr</th>
                      <th className="text-end">Cr</th>
                      <th className="text-end">Dr</th>
                      <th className="text-end pe-4">Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.rows.length > 0 ? (
                      vm.rows.map((row) => (
                        <tr key={row.accountId}>
                          <td className="text-nowrap ps-4">
                            <code className="text-warning me-2">{row.referenceNumber}</code>
                            {row.accountName}
                          </td>
                          <td className="text-end font-monospace">
                            {row.unadjustedDebit > 0 ? formatNumber(row.unadjustedDebit) : '-'}
                          </td>
                          <td className="text-end font-monospace">
                            {row.unadjustedCredit > 0 ? formatNumber(row.unadjustedCredit) : '-'}
                          </td>
                          <td className="text-end text-warning font-monospace">
                            {row.adjustmentDebit > 0 ? formatNumber(row.adjustmentDebit) : '-'}
                          </td>
                          <td className="text-end text-warning font-monospace">
                            {row.adjustmentCredit > 0 ? formatNumber(row.adjustmentCredit) : '-'}
                          </td>
                          <td className="text-end font-monospace">
                            {row.adjustedDebit > 0 ? formatNumber(row.adjustedDebit) : '-'}
                          </td>
                          <td className="text-end font-monospace">
                            {row.adjustedCredit > 0 ? formatNumber(row.adjustedCredit) : '-'}
                          </td>
                          <td className="text-end text-success font-monospace">
                            {row.incomeStatementDebit > 0 ? formatNumber(row.incomeStatementDebit) : '-'}
                          </td>
                          <td className="text-end text-success font-monospace">
                            {row.incomeStatementCredit > 0 ? formatNumber(row.incomeStatementCredit) : '-'}
                          </td>
                          <td className="text-end text-info font-monospace">
                            {row.financialPositionDebit > 0 ? formatNumber(row.financialPositionDebit) : '-'}
                          </td>
                          <td className="text-end text-info pe-4 font-monospace">
                            {row.financialPositionCredit > 0 ? formatNumber(row.financialPositionCredit) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11} className="text-center py-4 text-white-50">
                          No worksheet rows found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    {/* Subtotal Row */}
                    <tr className="border-top border-secondary fw-bold text-white">
                      <td className="text-end ps-4">Total</td>
                      <td className="text-end font-monospace">{formatNumber(totals.unadjustedDebit)}</td>
                      <td className="text-end font-monospace">{formatNumber(totals.unadjustedCredit)}</td>
                      <td className="text-end text-warning font-monospace">{formatNumber(totals.adjustmentDebit)}</td>
                      <td className="text-end text-warning font-monospace">{formatNumber(totals.adjustmentCredit)}</td>
                      <td className="text-end font-monospace">{formatNumber(totals.adjustedDebit)}</td>
                      <td className="text-end font-monospace">{formatNumber(totals.adjustedCredit)}</td>
                      <td className="text-end text-success font-monospace">{formatNumber(totals.incomeStatementDebit)}</td>
                      <td className="text-end text-success font-monospace">{formatNumber(totals.incomeStatementCredit)}</td>
                      <td className="text-end text-info font-monospace">{formatNumber(totals.financialPositionDebit)}</td>
                      <td className="text-end text-info pe-4 font-monospace">{formatNumber(totals.financialPositionCredit)}</td>
                    </tr>

                    {/* Net Income Plug Row */}
                    <tr className="fw-bold text-white">
                      <td className="text-end ps-4" colSpan={7}>
                        Net Income (plug Income Statement &rarr; Balance Sheet)
                      </td>
                      {vm.netIncome >= 0 ? (
                        <>
                          <td className="text-end text-success font-monospace">{formatNumber(vm.netIncome)}</td>
                          <td className="text-end font-monospace">-</td>
                          <td className="text-end font-monospace">-</td>
                          <td className="text-end text-info pe-4 font-monospace">{formatNumber(vm.netIncome)}</td>
                        </>
                      ) : (
                        <>
                          <td className="text-end font-monospace">-</td>
                          <td className="text-end text-success font-monospace">{formatNumber(Math.abs(vm.netIncome))}</td>
                          <td className="text-end text-info font-monospace">{formatNumber(Math.abs(vm.netIncome))}</td>
                          <td className="text-end pe-4 font-monospace">-</td>
                        </>
                      )}
                    </tr>

                    {/* Final Balanced Total Row */}
                    <tr className="border-top border-secondary fw-bold text-white">
                      <td className="text-end ps-4" colSpan={7}>
                        Total (after plug)
                      </td>
                      <td className="text-end text-success font-monospace">
                        {formatNumber(totals.incomeStatementDebit + (vm.netIncome >= 0 ? vm.netIncome : 0))}
                      </td>
                      <td className="text-end text-success font-monospace">
                        {formatNumber(totals.incomeStatementCredit + (vm.netIncome < 0 ? Math.abs(vm.netIncome) : 0))}
                      </td>
                      <td className="text-end text-info font-monospace">
                        {formatNumber(totals.financialPositionDebit + (vm.netIncome < 0 ? Math.abs(vm.netIncome) : 0))}
                      </td>
                      <td className="text-end text-info pe-4 font-monospace">
                        {formatNumber(totals.financialPositionCredit + (vm.netIncome >= 0 ? vm.netIncome : 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Info Alert */}
          <div className="alert alert-info bg-opacity-10 text-white border-info mt-4 mb-0 py-2 small d-flex align-items-center shadow-sm">
            <i className="ti ti-info-circle-filled me-2 fs-5 text-info flex-shrink-0"></i>
            <span>
              Net Income / (Loss): <strong>{formatNumber(vm.netIncome)}</strong> &mdash; plugged from the Income Statement column to the Balance Sheet column to balance both sections.
            </span>
          </div>
        </>
      )}
    </div>
  );
}