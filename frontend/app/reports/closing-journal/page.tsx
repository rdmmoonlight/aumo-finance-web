'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

// Model & ViewModel Interfaces
export interface ClosingJournalLine {
  referenceNumber?: number;
  accountName: string;
  debit: number;
  credit: number;
}

export interface ClosingJournalEntryGroup {
  description: string;
  lines: ClosingJournalLine[];
}

export interface ClosingJournalViewModel {
  netIncome: number;
  retainedEarningsAccountName: string;
  groups: ClosingJournalEntryGroup[];
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

export default function ClosingJournalReportPage() {
  const [noPeriodSelected, setNoPeriodSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vm, setVm] = useState<ClosingJournalViewModel>({
    netIncome: 0,
    retainedEarningsAccountName: 'Retained Earnings',
    groups: [],
  });

  // Memuat Data Jurnal Penutup dari API Backend Web Controller
  const fetchClosingJournalData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/reports/closing-journal`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Identity Cookie Session
      });

      if (response.status === 401) {
        setErrorMessage('Session expired or unauthorized. Please login again.');
        setVm({
          netIncome: 0,
          retainedEarningsAccountName: 'Retained Earnings',
          groups: [],
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Closing Journal data from the server.');
      }

      const data = await response.json();

      if (data?.hasPeriodSelected === false) {
        setNoPeriodSelected(true);
        setVm({
          netIncome: 0,
          retainedEarningsAccountName: 'Retained Earnings',
          groups: [],
        });
        return;
      }

      // Safe extraction dari objek data atau data.closingJournal
      const cjData = data?.closingJournal || data;
      const rawGroups = Array.isArray(cjData?.groups) ? cjData.groups : [];

      const safeGroups: ClosingJournalEntryGroup[] = rawGroups.map((g: any) => ({
        description: g.description || 'Closing Entry',
        lines: Array.isArray(g.lines) ? g.lines : [],
      }));

      const safeVm: ClosingJournalViewModel = {
        netIncome: Number(cjData?.netIncome) || 0,
        retainedEarningsAccountName: cjData?.retainedEarningsAccountName || 'Retained Earnings',
        groups: safeGroups,
      };

      setNoPeriodSelected(false);
      setVm(safeVm);
    } catch (error: any) {
      console.error('Error loading Closing Journal data:', error);
      setErrorMessage(error.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosingJournalData();

    // Event listener untuk memuat ulang data saat periode di Topbar diubah
    const handlePeriodChanged = () => {
      fetchClosingJournalData();
    };

    window.addEventListener('periodChanged', handlePeriodChanged);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodChanged);
    };
  }, [fetchClosingJournalData]);

  // Membantu menghitung total debit dan kredit per grup
  const groupTotals = useMemo(() => {
    return vm.groups.map((group) => {
      const safeLines = Array.isArray(group.lines) ? group.lines : [];
      const totalDebit = safeLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      const totalCredit = safeLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
      return { totalDebit, totalCredit };
    });
  }, [vm.groups]);

  if (loading) {
    return (
      <div className="text-center py-5 my-5 text-white-50">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading closing entries from the server...</span>
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
        /* Closing Journal Content */
        <>
          {/* Header Section (Keterangan mata uang diletakkan di deskripsi header saja) */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="mb-1 fw-bold text-white d-flex align-items-center">
                <i className="ti ti-lock me-2 text-warning fs-2"></i> Closing Journal
              </h2>
              <p className="text-white-50 mb-0">
                Closing entries are calculated automatically based on current nominal account balances &mdash; not yet posted to the General Journal (In IDR, unless otherwise stated).
              </p>
            </div>
            <div>
              <Link href="/reports/post-closing-trial-balance" className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center">
                <i className="ti ti-arrow-right-circle me-1"></i> Post-Closing Trial Balance
              </Link>
            </div>
          </div>

          {/* Empty State Groups */}
          {vm.groups.length === 0 && (
            <div className="alert alert-secondary bg-dark text-white-50 border-secondary">
              There are no nominal accounts with balances to close.
            </div>
          )}

          {/* Journal Entry Groups Cards */}
          {vm.groups.map((group, gIdx) => {
            const totals = groupTotals[gIdx];

            return (
              <div key={`group-${gIdx}`} className="card bg-dark border-secondary text-white shadow-sm mb-4 border border-secondary border-opacity-25 rounded-4">
                <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 fw-semibold text-white py-3 px-4">
                  {group.description}
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-dark table-hover align-middle mb-0">
                      <thead className="table-active border-bottom border-secondary text-secondary">
                        <tr>
                          <th className="text-center ps-4" style={{ width: '15%' }}>Ref.</th>
                          <th style={{ width: '45%' }}>Account</th>
                          <th className="text-end" style={{ width: '20%' }}>Debit</th>
                          <th className="text-end pe-4" style={{ width: '20%' }}>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.lines.map((line, lIdx) => (
                          <tr key={`line-${gIdx}-${lIdx}`}>
                            <td className="text-center ps-4">
                              <code className="text-warning">
                                {line.referenceNumber && line.referenceNumber > 0
                                  ? line.referenceNumber.toString()
                                  : '-'}
                              </code>
                            </td>
                            <td className={line.credit > 0 ? 'ps-4 text-white-50' : 'fw-semibold text-white'}>
                              {line.accountName}
                            </td>
                            <td className="text-end text-success font-monospace">
                              {line.debit > 0 ? formatNumber(line.debit) : '-'}
                            </td>
                            <td className="text-end text-danger pe-4 font-monospace">
                              {line.credit > 0 ? formatNumber(line.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-top border-secondary fw-bold text-white">
                          <td colSpan={2} className="text-end ps-4">
                            Total
                          </td>
                          <td className="text-end text-success font-monospace">
                            {formatNumber(totals?.totalDebit || 0)}
                          </td>
                          <td className="text-end text-danger pe-4 font-monospace">
                            {formatNumber(totals?.totalCredit || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Info Footer Note */}
          {vm.groups.length > 0 && (
            <div className="alert alert-info bg-opacity-10 text-white border-info mb-0 py-2 small d-flex align-items-center shadow-sm">
              <i className="ti ti-info-circle-filled text-info me-2 fs-5 flex-shrink-0"></i>
              <span>
                After closing entries are posted, all nominal accounts will have a zero balance and Net Income of{' '}
                <strong>{formatNumber(vm.netIncome)}</strong> will transfer to{' '}
                <strong>{vm.retainedEarningsAccountName}</strong>.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}