'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface CashFlowLine {
  description: string;
  amount: number;
}

export interface CashFlowStatementViewModel {
  operatingActivities: CashFlowLine[];
  investingActivities: CashFlowLine[];
  financingActivities: CashFlowLine[];
  beginningCash: number;
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

// Sanitasi URL API
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function CashFlowReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<CashFlowStatementViewModel>({
    operatingActivities: [],
    investingActivities: [],
    financingActivities: [],
    beginningCash: 0,
  });

  // Fetch Cash Flow Statement data dari Web API Controller
  const fetchCashFlowData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/statement-of-cash-flow`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Untuk Identity Cookie Session
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({
          operatingActivities: [],
          investingActivities: [],
          financingActivities: [],
          beginningCash: 0,
        });
        return;
      }

      if (response.status === 404) {
        setErrorMessage('The requested endpoint /web/reports/statement-of-cash-flow was not found on the backend server.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Cash Flow Statement data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({
          operatingActivities: [],
          investingActivities: [],
          financingActivities: [],
          beginningCash: 0,
        });
        return;
      }

      // Safe-extraction DTO
      const safeData: CashFlowStatementViewModel = {
        operatingActivities: Array.isArray(data?.operatingActivities) ? data.operatingActivities : [],
        investingActivities: Array.isArray(data?.investingActivities) ? data.investingActivities : [],
        financingActivities: Array.isArray(data?.financingActivities) ? data.financingActivities : [],
        beginningCash: Number(data?.beginningCash) || 0,
      };

      setNoPeriodSelected(false);
      setVm(safeData);
    } catch (error: any) {
      console.error('Error loading Cash Flow data:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCashFlowData();

    // Event listener untuk memuat ulang data saat periode di Topbar diubah
    const handlePeriodChanged = () => {
      fetchCashFlowData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchCashFlowData]);

  // Totals Calculations
  const netOperating = useMemo(() => {
    return vm.operatingActivities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.operatingActivities]);

  const netInvesting = useMemo(() => {
    return vm.investingActivities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.investingActivities]);

  const netFinancing = useMemo(() => {
    return vm.financingActivities.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [vm.financingActivities]);

  const netChangeInCash = useMemo(() => {
    return netOperating + netInvesting + netFinancing;
  }, [netOperating, netInvesting, netFinancing]);

  const endingCash = useMemo(() => {
    return vm.beginningCash + netChangeInCash;
  }, [vm.beginningCash, netChangeInCash]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading Cash Flow Statement from server...</span>
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
        /* Cash Flow Content */
        <>
          {/* Header Section (Keterangan mata uang diletakkan di deskripsi header saja) */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-cash me-2 text-success fs-2"></i> Cash Flow Statement
              </h2>
              <p className="text-white-50 mb-0">
                Indirect method (IAS 7), derived from Adjusted Trial Balance &amp; Income Statement (In IDR, unless otherwise stated).
              </p>
            </div>
            <div>
              <Link href="/reports/income-statement" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-arrow-right-circle me-1"></i> Income Statement
              </Link>
            </div>
          </div>

          {/* Cash Flow Table Card */}
          <div className="card bg-dark border-secondary text-white shadow-sm border border-secondary border-opacity-25 rounded-4">
            <div className="card-body p-4">
              <div className="table-responsive">
                <table className="table table-dark table-borderless align-middle mb-0">
                  <tbody>
                    {/* OPERATING ACTIVITIES */}
                    <tr>
                      <td colSpan={2} className="fw-bold text-warning text-uppercase small pb-2">
                        Cash Flows from Operating Activities
                      </td>
                    </tr>
                    {vm.operatingActivities.length === 0 ? (
                      <tr>
                        <td className="ps-4 text-white-50 fst-italic">No operating activities.</td>
                        <td className="text-end text-white-50 font-monospace">-</td>
                      </tr>
                    ) : (
                      vm.operatingActivities.map((l, index) => (
                        <tr key={`op-${index}`}>
                          <td className="ps-4">{l.description}</td>
                          <td className={`text-end font-monospace ${l.amount < 0 ? 'text-danger' : 'text-success'}`}>
                            {formatNumber(l.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="border-top border-secondary fw-semibold">
                      <td className="ps-4 pt-2">Net Cash Provided by (Used in) Operating Activities</td>
                      <td className={`text-end pt-2 font-monospace ${netOperating < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatNumber(netOperating)}
                      </td>
                    </tr>

                    {/* INVESTING ACTIVITIES */}
                    <tr>
                      <td colSpan={2} className="pt-4 fw-bold text-warning text-uppercase small pb-2">
                        Cash Flows from Investing Activities
                      </td>
                    </tr>
                    {vm.investingActivities.length === 0 ? (
                      <tr>
                        <td className="ps-4 text-white-50 fst-italic">No investing activities.</td>
                        <td className="text-end text-white-50 font-monospace">-</td>
                      </tr>
                    ) : (
                      vm.investingActivities.map((l, index) => (
                        <tr key={`inv-${index}`}>
                          <td className="ps-4">{l.description}</td>
                          <td className={`text-end font-monospace ${l.amount < 0 ? 'text-danger' : 'text-success'}`}>
                            {formatNumber(l.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="border-top border-secondary fw-semibold">
                      <td className="ps-4 pt-2">Net Cash Provided by (Used in) Investing Activities</td>
                      <td className={`text-end pt-2 font-monospace ${netInvesting < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatNumber(netInvesting)}
                      </td>
                    </tr>

                    {/* FINANCING ACTIVITIES */}
                    <tr>
                      <td colSpan={2} className="pt-4 fw-bold text-warning text-uppercase small pb-2">
                        Cash Flows from Financing Activities
                      </td>
                    </tr>
                    {vm.financingActivities.length === 0 ? (
                      <tr>
                        <td className="ps-4 text-white-50 fst-italic">No financing activities.</td>
                        <td className="text-end text-white-50 font-monospace">-</td>
                      </tr>
                    ) : (
                      vm.financingActivities.map((l, index) => (
                        <tr key={`fin-${index}`}>
                          <td className="ps-4">{l.description}</td>
                          <td className={`text-end font-monospace ${l.amount < 0 ? 'text-danger' : 'text-success'}`}>
                            {formatNumber(l.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="border-top border-secondary fw-semibold">
                      <td className="ps-4 pt-2">Net Cash Provided by (Used in) Financing Activities</td>
                      <td className={`text-end pt-2 font-monospace ${netFinancing < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatNumber(netFinancing)}
                      </td>
                    </tr>

                    {/* SUMMARY SECTION */}
                    <tr className="border-top border-secondary" style={{ borderTopWidth: '3px' }}>
                      <td className="fw-bold fs-5 pt-3">
                        Net Increase (Decrease) in Cash and Cash Equivalents
                      </td>
                      <td
                        className={`text-end fw-bold fs-5 pt-3 font-monospace ${
                          netChangeInCash < 0 ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {formatNumber(netChangeInCash)}
                      </td>
                    </tr>
                    <tr>
                      <td className="ps-3 text-white-50">Cash and Cash Equivalents, Beginning of Period</td>
                      <td className="text-end text-white-50 font-monospace">{formatNumber(vm.beginningCash)}</td>
                    </tr>
                    <tr className="fw-bold border-top border-secondary">
                      <td className="ps-3 pt-2 text-info">Cash and Cash Equivalents, End of Period</td>
                      <td className="text-end pt-2 text-info font-monospace">{formatNumber(endingCash)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Note Footnote */}
          <div className="alert alert-info bg-opacity-10 text-white border-info mt-3 mb-0 py-2 small d-flex align-items-center shadow-sm">
            <i className="ti ti-info-circle-filled text-info me-2 fs-5 flex-shrink-0"></i>
            <span>Prepared using the Indirect Method in accordance with IAS 7 / US GAAP.</span>
          </div>
        </>
      )}
    </div>
  );
}