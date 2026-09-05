'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './periods.css';

export interface AccountingPeriod {
  id: number;
  periodName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

interface AccountOption {
  id: string;
  displayLabel: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function PeriodsMainPage() {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [setupMode, setSetupMode] = useState<'LoadExisting' | 'CreateNew'>('LoadExisting');

  const [hasExistingPermanentAccounts, setHasExistingPermanentAccounts] = useState<boolean>(false);
  const [availableCashAccounts, setAvailableCashAccounts] = useState<AccountOption[]>([]);
  const [availableRetainedAccounts, setAvailableRetainedAccounts] = useState<AccountOption[]>([]);
  const [permanentAccounts, setPermanentAccounts] = useState<AccountOption[]>([]);

  const [cashAccountId, setCashAccountId] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState<string>('');

  const [cashAccountCode, setCashAccountCode] = useState<string>('101');
  const [cashAccountName, setCashAccountName] = useState<string>('Cash on Hand');
  const [cashBalance, setCashBalance] = useState<number | ''>('');

  const [bankAccountCode, setBankAccountCode] = useState<string>('102');
  const [bankAccountName, setBankAccountName] = useState<string>('Bank Account');
  const [bankBalance, setBankBalance] = useState<number | ''>('');

  const [retainedAccountCode, setRetainedAccountCode] = useState<string>('301');
  const [retainedAccountName, setRetainedAccountName] = useState<string>('Retained Earnings');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleUnauthorized = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      router.push('/');
    }
  };

  const notifyPeriodChanged = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('periodChanged'));
    }
  };

  const fetchPeriodsAndAccounts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const periodsRes = await fetch(`${API_BASE_URL}/web/periods`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (periodsRes.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!periodsRes.ok) throw new Error('Failed to load accounting periods data.');

      const periodsRaw = await periodsRes.json();

      const periodsData: AccountingPeriod[] = Array.isArray(periodsRaw)
        ? periodsRaw
        : Array.isArray(periodsRaw?.periods)
        ? periodsRaw.periods
        : Array.isArray(periodsRaw?.data)
        ? periodsRaw.data
        : [];

      setPeriods(periodsData);

      // SINKRONISASI DATABASE: Ambil id yang dipilih dari DB (selectedPeriodId)
      if (periodsRaw?.selectedPeriodId) {
        setSelectedPeriodId(periodsRaw.selectedPeriodId);
      } else {
        // Jika DB mengembalikan null, baru gunakan default active/first
        const activePeriod = periodsData.find(p => !p.isClosed) || periodsData[0];
        if (activePeriod) {
          setSelectedPeriodId(activePeriod.id);
        } else {
          setSelectedPeriodId(null);
        }
      }

      const openInfoRes = await fetch(`${API_BASE_URL}/web/periods/open-info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (openInfoRes.status === 401) {
        handleUnauthorized();
        return;
      }

      if (openInfoRes.ok) {
        const info = await openInfoRes.json();

        const cashBankOptions: AccountOption[] = (info.availableCashAndBankAccounts || []).map((acc: any) => ({
          id: acc.id.toString(),
          displayLabel: acc.displayLabel || `${acc.referenceNumber} - ${acc.accountName}`,
        }));

        const retainedOptions: AccountOption[] = (info.availableRetainedEarningsAccounts || []).map((acc: any) => ({
          id: acc.id.toString(),
          displayLabel: acc.displayLabel || `${acc.referenceNumber} - ${acc.accountName}`,
        }));

        const permAccounts: AccountOption[] = (info.permanentAccounts || []).map((acc: any) => ({
          id: acc.id.toString(),
          displayLabel: acc.displayLabel || `${acc.referenceNumber} - ${acc.accountName}`,
        }));

        setAvailableCashAccounts(cashBankOptions);
        setAvailableRetainedAccounts(retainedOptions);
        setPermanentAccounts(permAccounts);

        const exists = info.hasExistingPermanentAccounts ?? (cashBankOptions.length > 0 && retainedOptions.length > 0);
        setHasExistingPermanentAccounts(exists);
        setSetupMode(exists ? 'LoadExisting' : 'CreateNew');

        if (exists) {
          setCashAccountId(cashBankOptions[0]?.id || '');
          setBankAccountId(cashBankOptions[1]?.id || cashBankOptions[0]?.id || '');
          setRetainedEarningsAccountId(retainedOptions[0]?.id || '');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to the backend server.');
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriodsAndAccounts();
  }, []);

  // Memilih periode (Mengubah kolom IsSelected di DB)
  const selectPeriod = async (period: AccountingPeriod) => {
    setErrorMessage(null);

    // Ubah state UI lokal agar cepat merespons
    setSelectedPeriodId(period.id);

    try {
      const response = await fetch(`${API_BASE_URL}/web/periods/select/${period.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        throw new Error(resData.message || 'Failed to select period in database.');
      }

      setSuccessMessage(`Now viewing ${period.periodName}${period.isClosed ? ' (Closed & Read-Only).' : '.'}`);
      notifyPeriodChanged();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while updating the selected period in database.');
      // Kembalikan/Re-fetch dari DB jika gagal
      fetchPeriodsAndAccounts();
    }
  };

  const clearSelection = async () => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/web/periods/clear-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
    } catch {
      // Ignore network errors
    } finally {
      setSelectedPeriodId(null);
      setSuccessMessage('No period selected. Reports and journals are hidden until you view a period.');
      notifyPeriodChanged();
    }
  };

  const confirmAndClosePeriod = async (period: AccountingPeriod) => {
    const confirmed = window.confirm(
      `Are you sure you want to close ${period.periodName}? No further edits will be allowed.`
    );
    if (!confirmed) return;

    setErrorMessage(null);

    if (period.isClosed) {
      setErrorMessage(`Period ${period.periodName} is already closed.`);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/web/periods/close/${period.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to close the accounting period.');
      }

      setPeriods((prev) =>
        prev.map((p) => (p.id === period.id ? { ...p, isClosed: true } : p))
      );
      setSuccessMessage(`Period ${period.periodName} has been closed. Transactions in this period are now locked.`);
      notifyPeriodChanged();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while closing the period.');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (month < 1 || month > 12) {
      setErrorMessage('Please select a valid month.');
      return;
    }
    if (year < 2000 || year > 2100) {
      setErrorMessage('Please provide a valid year.');
      return;
    }

    if (setupMode === 'LoadExisting') {
      if (!cashAccountId || !bankAccountId || !retainedEarningsAccountId) {
        setErrorMessage('Please select the Cash, Bank, and Retained Earnings accounts to carry forward.');
        return;
      }
      if (cashAccountId === bankAccountId) {
        setErrorMessage('Cash Account and Bank Account cannot be the same account.');
        return;
      }
    } else {
      if (
        !cashAccountCode ||
        !cashAccountName ||
        !bankAccountCode ||
        !bankAccountName ||
        !retainedAccountCode ||
        !retainedAccountName
      ) {
        setErrorMessage('Please complete all new account fields (reference code & name).');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        month,
        year,
        setupMode,
        cashAccountId: setupMode === 'LoadExisting' ? parseInt(cashAccountId) : null,
        bankAccountId: setupMode === 'LoadExisting' ? parseInt(bankAccountId) : null,
        retainedEarningsAccountId: setupMode === 'LoadExisting' ? parseInt(retainedEarningsAccountId) : null,
        cashAccountCode: setupMode === 'CreateNew' ? cashAccountCode : null,
        cashAccountName: setupMode === 'CreateNew' ? cashAccountName : null,
        cashBalance: setupMode === 'CreateNew' ? (Number(cashBalance) || 0) : null,
        bankAccountCode: setupMode === 'CreateNew' ? bankAccountCode : null,
        bankAccountName: setupMode === 'CreateNew' ? bankAccountName : null,
        bankBalance: setupMode === 'CreateNew' ? (Number(bankBalance) || 0) : null,
        retainedEarningsAccountCode: setupMode === 'CreateNew' ? retainedAccountCode : null,
        retainedEarningsAccountName: setupMode === 'CreateNew' ? retainedAccountName : null,
      };

      const response = await fetch(`${API_BASE_URL}/web/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to open the new period on the server.');
      }

      const resData = await response.json();
      setSuccessMessage(resData.message || `Successfully opened new period.`);
      setViewMode('list');
      fetchPeriodsAndAccounts();
      notifyPeriodChanged();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while creating the new period.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOpeningBalance = (Number(cashBalance) || 0) + (Number(bankBalance) || 0);

  return (
    <div className="container-fluid py-4 px-4 text-white">
      {/* Alert Notifications */}
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm py-2 d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
          <button type="button" className="btn-close ms-auto" onClick={() => setErrorMessage(null)}></button>
        </div>
      )}
      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm py-2 d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-circle-check-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{successMessage}</span>
          </div>
          <button type="button" className="btn-close ms-auto" onClick={() => setSuccessMessage(null)}></button>
        </div>
      )}

      {/* VIEW 1: ACCOUNTING PERIOD LIST */}
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="fw-bold text-white mb-1 d-flex align-items-center">
                <i className="ti ti-calendar me-2 text-primary fs-2"></i> Accounting Periods
              </h2>
              <p className="text-white-50 mb-0 d-flex align-items-center flex-wrap gap-1">
                Manage your financial reporting cycles. Click <i className="ti ti-eye mx-1"></i> to view a period &mdash; the whole app (Dashboard, journals, reports) will follow it.
              </p>
            </div>
            <div className="d-flex gap-2">
              {selectedPeriodId !== null && (
                <button className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center" onClick={clearSelection}>
                  <i className="ti ti-eye-off me-1"></i> Stop Viewing
                </button>
              )}
              <button
                className="btn btn-primary fw-semibold shadow-sm d-inline-flex align-items-center"
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('create');
                }}
              >
                <i className="ti ti-plus me-1"></i> Open New Period
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="card border-0 shadow-sm rounded-4 bg-body-tertiary">
            <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center px-4">
              <h5 className="mb-0 fw-bold text-white">Period List</h5>
              <span className="text-white-50 small fw-semibold">Total Periods: {periods.length}</span>
            </div>

            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0 periods-table">
                  <thead className="table-light text-secondary">
                    <tr>
                      <th className="ps-4">Period Name</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th className="text-center">Status</th>
                      <th className="text-center pe-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="border-top-0">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-white-50">
                          <div className="spinner-border spinner-border-sm me-2" role="status"></div> Loading data from server...
                        </td>
                      </tr>
                    ) : periods.length > 0 ? (
                      periods.map((period) => {
                        const isSelected = selectedPeriodId === period.id;
                        return (
                          <tr key={period.id} className={isSelected ? 'table-primary' : ''}>
                            <td className="ps-4 fw-bold text-white">
                              {period.periodName}
                              {isSelected && (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle ms-2 small d-inline-flex align-items-center">
                                  <i className="ti ti-eye me-1"></i>Viewing
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="text-white-50">{period.startDate}</span>
                            </td>
                            <td>
                              <span className="text-white-50">{period.endDate}</span>
                            </td>
                            <td className="text-center">
                              {period.isClosed ? (
                                <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-3 py-1 d-inline-flex align-items-center">
                                  <i className="ti ti-lock me-1"></i> Closed
                                </span>
                              ) : (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 d-inline-flex align-items-center">
                                  <i className="ti ti-lock-open me-1"></i> Active
                                </span>
                              )}
                            </td>
                            <td className="text-center pe-4">
                              <div className="btn-group shadow-sm">
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                                  title="View this period"
                                  onClick={() => selectPeriod(period)}
                                >
                                  <i className="ti ti-eye"></i>
                                </button>
                                {!period.isClosed && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning"
                                    title="Close Period"
                                    onClick={() => confirmAndClosePeriod(period)}
                                  >
                                    <i className="ti ti-lock"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-white-50">
                          <i className="ti ti-calendar-off mb-3 d-block mx-auto text-white-50" style={{ fontSize: '2.5rem' }}></i>
                          <p className="mb-0">No accounting periods have been initialized yet.</p>
                          <small>Click &quot;Open New Period&quot; to start your first accounting cycle.</small>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: OPEN NEW PERIOD FORM */}
      {viewMode === 'create' && (
        <div className="create-period-container">
          {/* Form Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="fw-bold text-white mb-1 d-flex align-items-center">
                <i className="ti ti-calendar-plus me-2 text-primary fs-2"></i> Open New Period
              </h2>
              <p className="text-white-50 mb-0">
                Start a new monthly accounting cycle. The opening balance entry is posted on day 1 of the period and will appear at the top of the General Journal.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary fw-semibold shadow-sm d-inline-flex align-items-center"
              onClick={() => {
                setErrorMessage(null);
                setViewMode('list');
              }}
            >
              <i className="ti ti-arrow-left me-1"></i> Back
            </button>
          </div>

          <form onSubmit={handleCreateSubmit}>
            {/* Period Month/Year */}
            <div className="card border-0 shadow-sm rounded-4 bg-body-tertiary mb-3 border border-secondary border-opacity-25">
              <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3 px-4">
                <h5 className="mb-0 fw-bold text-white">Period</h5>
              </div>
              <div className="card-body p-4 text-white">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-white-50">Month</label>
                    <select
                      className="form-select bg-dark text-white border-secondary"
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-white-50">Year</label>
                    <input
                      type="number"
                      className="form-control bg-dark text-white border-secondary"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Permanent Accounts Setup */}
            <div className="card border-0 shadow-sm rounded-4 bg-body-tertiary mb-3 border border-secondary border-opacity-25">
              <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3 px-4">
                <h5 className="mb-0 fw-bold text-white">Permanent Accounts Setup</h5>
              </div>
              <div className="card-body p-4 text-white">
                <div className="btn-group w-100 mb-3" role="group">
                  <input
                    type="radio"
                    className="btn-check"
                    name="setupMode"
                    id="modeLoad"
                    checked={setupMode === 'LoadExisting'}
                    disabled={!hasExistingPermanentAccounts}
                    onChange={() => setSetupMode('LoadExisting')}
                  />
                  <label className="btn btn-outline-primary d-inline-flex align-items-center justify-content-center" htmlFor="modeLoad">
                    <i className="ti ti-refresh me-1"></i> Use Existing Accounts
                  </label>

                  <input
                    type="radio"
                    className="btn-check"
                    name="setupMode"
                    id="modeNew"
                    checked={setupMode === 'CreateNew'}
                    onChange={() => setSetupMode('CreateNew')}
                  />
                  <label className="btn btn-outline-primary d-inline-flex align-items-center justify-content-center" htmlFor="modeNew">
                    <i className="ti ti-circle-plus me-1"></i> Register New Accounts
                  </label>
                </div>

                {!hasExistingPermanentAccounts && (
                  <div className="alert alert-info py-2 small mb-3 d-flex align-items-center">
                    <i className="ti ti-info-circle me-2 fs-5 flex-shrink-0"></i>
                    <span>No existing Cash/Bank &amp; Retained Earnings accounts found yet &mdash; this looks like your first period, so new accounts are required.</span>
                  </div>
                )}

                {setupMode === 'LoadExisting' ? (
                  <>
                    <p className="text-white-50 small mb-3">
                      Balances carry forward automatically from the ledger &mdash; no opening journal entry is posted.
                    </p>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold text-white-50">Cash Account</label>
                        <select
                          className="form-select bg-dark text-white border-secondary"
                          value={cashAccountId}
                          onChange={(e) => setCashAccountId(e.target.value)}
                        >
                          {availableCashAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold text-white-50">Bank Account</label>
                        <select
                          className="form-select bg-dark text-white border-secondary"
                          value={bankAccountId}
                          onChange={(e) => setBankAccountId(e.target.value)}
                        >
                          {availableCashAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold text-white-50">Retained Earnings Account</label>
                        <select
                          className="form-select bg-dark text-white border-secondary"
                          value={retainedEarningsAccountId}
                          onChange={(e) => setRetainedEarningsAccountId(e.target.value)}
                        >
                          {availableRetainedAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.displayLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-white-50 small mb-3">
                      An opening balance journal entry (General) will be posted on{' '}
                      <strong>01 {MONTH_NAMES[month - 1]} {year}</strong>, debiting Cash &amp; Bank and crediting Retained Earnings.
                    </p>
                    <div className="row g-3 mb-3">
                      <div className="col-md-3">
                        <label className="form-label fw-semibold text-white-50">Cash Ref #</label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="101"
                          value={cashAccountCode}
                          onChange={(e) => setCashAccountCode(e.target.value)}
                        />
                      </div>
                      <div className="col-md-5">
                        <label className="form-label fw-semibold text-white-50">Cash Account Name</label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="Cash on Hand"
                          value={cashAccountName}
                          onChange={(e) => setCashAccountName(e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold text-white-50">Cash Opening Balance</label>
                        <input
                          type="number"
                          className="form-control bg-dark text-white border-secondary"
                          value={cashBalance}
                          onChange={(e) => setCashBalance(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label fw-semibold text-white-50">Bank Ref #</label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="102"
                          value={bankAccountCode}
                          onChange={(e) => setBankAccountCode(e.target.value)}
                        />
                      </div>
                      <div className="col-md-5">
                        <label className="form-label fw-semibold text-white-50">Bank Account Name</label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="Bank Account"
                          value={bankAccountName}
                          onChange={(e) => setBankAccountName(e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold text-white-50">Bank Opening Balance</label>
                        <input
                          type="number"
                          className="form-control bg-dark text-white border-secondary"
                          value={bankBalance}
                          onChange={(e) => setBankBalance(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label fw-semibold text-white-50">Retained Earnings Ref #</label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="301"
                          value={retainedAccountCode}
                          onChange={(e) => setRetainedAccountCode(e.target.value)}
                        />
                      </div>
                      <div className="col-md-9">
                        <label className="form-label fw-semibold text-white-50">Retained Earnings Account Name</label>
                        <input
                          className="form-control bg-dark text-white border-secondary"
                          placeholder="Retained Earnings"
                          value={retainedAccountName}
                          onChange={(e) => setRetainedAccountName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="alert alert-secondary py-2 small mb-0 bg-dark text-white border border-secondary">
                      Opening credit to Retained Earnings will be:{' '}
                      <strong>Rp {totalOpeningBalance.toLocaleString('en-US')}</strong>
                    </div>
                  </>
                )}

                {permanentAccounts.length > 0 && (
                  <>
                    <hr className="my-3 border-secondary" />
                    <p className="fw-semibold small text-white-50 mb-2">
                      Existing permanent accounts (for reference):
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      {permanentAccounts.map((a) => (
                        <span key={a.id} className="badge bg-dark text-info border border-secondary px-2 py-1">
                          {a.displayLabel}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary fw-semibold"
                onClick={() => setViewMode('list')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary fw-semibold shadow-sm d-inline-flex align-items-center"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                ) : (
                  <i className="ti ti-check me-1"></i>
                )}
                Open Period
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
