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
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

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
      const periodsRes = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods`, {
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

      if (periodsRaw?.selectedPeriodId) {
        setSelectedPeriodId(periodsRaw.selectedPeriodId);
      } else {
        const activePeriod = periodsData.find(p => !p.isClosed) || periodsData[0];
        if (activePeriod) {
          setSelectedPeriodId(activePeriod.id);
        } else {
          setSelectedPeriodId(null);
        }
      }

      const openInfoRes = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/open-info`, {
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

  const selectPeriod = async (period: AccountingPeriod) => {
    setErrorMessage(null);
    setSelectedPeriodId(period.id);

    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/select/${period.id}`, {
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
      fetchPeriodsAndAccounts();
    }
  };

  const clearSelection = async () => {
    setErrorMessage(null);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/clear-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
    } catch {
      // Ignore
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
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/close/${period.id}`, {
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

      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods`, {
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
    <div className="periods-container">
      {/* Alert Notifications */}
      {errorMessage && (
        <div className="periods-alert periods-alert-danger">
          <div className="periods-alert-content">
            <i className="ti ti-alert-triangle-filled"></i>
            <span>{errorMessage}</span>
          </div>
          <button type="button" className="periods-alert-close" onClick={() => setErrorMessage(null)}>
            <i className="ti ti-x"></i>
          </button>
        </div>
      )}
      {successMessage && (
        <div className="periods-alert periods-alert-success">
          <div className="periods-alert-content">
            <i className="ti ti-circle-check-filled"></i>
            <span>{successMessage}</span>
          </div>
          <button type="button" className="periods-alert-close" onClick={() => setSuccessMessage(null)}>
            <i className="ti ti-x"></i>
          </button>
        </div>
      )}

      {/* VIEW 1: ACCOUNTING PERIOD LIST */}
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="periods-header">
            <div>
              <h2 className="periods-title">
                <i className="ti ti-calendar periods-title-icon"></i> Accounting Periods
              </h2>
              <p className="periods-subtitle">
                Manage your financial reporting cycles. Click <i className="ti ti-eye"></i> to view a period &mdash; the whole app (Dashboard, journals, reports) will follow it.
              </p>
            </div>
            <div className="periods-header-actions">
              {selectedPeriodId !== null && (
                <button className="btn-secondary-custom" onClick={clearSelection}>
                  <i className="ti ti-eye-off"></i> Stop Viewing
                </button>
              )}
              <button
                className="btn-primary-custom"
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('create');
                }}
              >
                <i className="ti ti-plus"></i> Open New Period
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="periods-card">
            <div className="periods-card-header">
              <h5 className="periods-card-title">Period List</h5>
              <span className="periods-subtitle" style={{ fontWeight: 600 }}>
                Total Periods: {periods.length}
              </span>
            </div>

            <div className="periods-card-body" style={{ padding: 0 }}>
              <div className="periods-table-wrapper">
                <table className="periods-table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '1.5rem' }}>Period Name</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center', paddingRight: '1.5rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: '#ffffff' }}>
                          <span className="periods-spinner" style={{ marginRight: '0.5rem' }}></span>
                          Loading data from server...
                        </td>
                      </tr>
                    ) : periods.length > 0 ? (
                      periods.map((period) => {
                        const isSelected = selectedPeriodId === period.id;
                        return (
                          <tr key={period.id} className={isSelected ? 'selected-row' : ''}>
                            <td style={{ paddingLeft: '1.5rem', fontWeight: 700 }}>
                              {period.periodName}
                              {isSelected && (
                                <span className="badge-custom badge-viewing" style={{ marginLeft: '0.5rem' }}>
                                  <i className="ti ti-eye"></i> Viewing
                                </span>
                              )}
                            </td>
                            <td>{period.startDate}</td>
                            <td>{period.endDate}</td>
                            <td style={{ textAlign: 'center' }}>
                              {period.isClosed ? (
                                <span className="badge-custom badge-closed">
                                  <i className="ti ti-lock"></i> Closed
                                </span>
                              ) : (
                                <span className="badge-custom badge-active">
                                  <i className="ti ti-lock-open"></i> Active
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', paddingRight: '1.5rem' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className={`btn-icon-custom ${isSelected ? 'active' : ''}`}
                                  title="View this period"
                                  onClick={() => selectPeriod(period)}
                                >
                                  <i className="ti ti-eye"></i>
                                </button>
                                {!period.isClosed && (
                                  <button
                                    type="button"
                                    className="btn-warning-custom"
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
                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 0', color: '#ffffff' }}>
                          <i className="ti ti-calendar-off" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}></i>
                          <p style={{ margin: 0 }}>No accounting periods have been initialized yet.</p>
                          <span className="periods-subtitle">Click &quot;Open New Period&quot; to start your first accounting cycle.</span>
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
          <div className="periods-header">
            <div>
              <h2 className="periods-title">
                <i className="ti ti-calendar-plus periods-title-icon"></i> Open New Period
              </h2>
              <p className="periods-subtitle">
                Start a new monthly accounting cycle. The opening balance entry is posted on day 1 of the period and will appear at the top of the General Journal.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={() => {
                setErrorMessage(null);
                setViewMode('list');
              }}
            >
              <i className="ti ti-arrow-left"></i> Back
            </button>
          </div>

          <form onSubmit={handleCreateSubmit}>
            {/* Period Month/Year */}
            <div className="periods-card">
              <div className="periods-card-header">
                <h5 className="periods-card-title">Period</h5>
              </div>
              <div className="periods-card-body">
                <div className="periods-grid grid-col-2">
                  <div className="form-group">
                    <label className="form-label">Month</label>
                    <select
                      className="form-select"
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
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input
                      type="number"
                      className="form-input"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Permanent Accounts Setup */}
            <div className="periods-card">
              <div className="periods-card-header">
                <h5 className="periods-card-title">Permanent Accounts Setup</h5>
              </div>
              <div className="periods-card-body">
                <div className="radio-toggle-group">
                  <div className="radio-toggle-btn">
                    <input
                      type="radio"
                      id="modeLoad"
                      name="setupMode"
                      checked={setupMode === 'LoadExisting'}
                      disabled={!hasExistingPermanentAccounts}
                      onChange={() => setSetupMode('LoadExisting')}
                    />
                    <label className="radio-toggle-label" htmlFor="modeLoad">
                      <i className="ti ti-refresh"></i> Use Existing Accounts
                    </label>
                  </div>

                  <div className="radio-toggle-btn">
                    <input
                      type="radio"
                      id="modeNew"
                      name="setupMode"
                      checked={setupMode === 'CreateNew'}
                      onChange={() => setSetupMode('CreateNew')}
                    />
                    <label className="radio-toggle-label" htmlFor="modeNew">
                      <i className="ti ti-circle-plus"></i> Register New Accounts
                    </label>
                  </div>
                </div>

                {!hasExistingPermanentAccounts && (
                  <div className="periods-alert periods-alert-info" style={{ marginBottom: '1rem' }}>
                    <div className="periods-alert-content">
                      <i className="ti ti-info-circle"></i>
                      <span>No existing Cash/Bank &amp; Retained Earnings accounts found yet &mdash; this looks like your first period, so new accounts are required.</span>
                    </div>
                  </div>
                )}

                {setupMode === 'LoadExisting' ? (
                  <>
                    <p className="periods-subtitle" style={{ marginBottom: '1rem' }}>
                      Balances carry forward automatically from the ledger &mdash; no opening journal entry is posted.
                    </p>
                    <div className="periods-grid grid-col-3">
                      <div className="form-group">
                        <label className="form-label">Cash Account</label>
                        <select
                          className="form-select"
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
                      <div className="form-group">
                        <label className="form-label">Bank Account</label>
                        <select
                          className="form-select"
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
                      <div className="form-group">
                        <label className="form-label">Retained Earnings Account</label>
                        <select
                          className="form-select"
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
                    <p className="periods-subtitle" style={{ marginBottom: '1rem' }}>
                      An opening balance journal entry (General) will be posted on{' '}
                      <strong>01 {MONTH_NAMES[month - 1]} {year}</strong>, debiting Cash &amp; Bank and crediting Retained Earnings.
                    </p>

                    <div className="periods-grid grid-col-12" style={{ marginBottom: '1rem' }}>
                      <div className="form-group" style={{ gridColumn: 'span 3' }}>
                        <label className="form-label">Cash Ref #</label>
                        <input
                          className="form-input"
                          placeholder="101"
                          value={cashAccountCode}
                          onChange={(e) => setCashAccountCode(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 5' }}>
                        <label className="form-label">Cash Account Name</label>
                        <input
                          className="form-input"
                          placeholder="Cash on Hand"
                          value={cashAccountName}
                          onChange={(e) => setCashAccountName(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 4' }}>
                        <label className="form-label">Cash Opening Balance</label>
                        <input
                          type="number"
                          className="form-input"
                          value={cashBalance}
                          onChange={(e) => setCashBalance(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 3' }}>
                        <label className="form-label">Bank Ref #</label>
                        <input
                          className="form-input"
                          placeholder="102"
                          value={bankAccountCode}
                          onChange={(e) => setBankAccountCode(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 5' }}>
                        <label className="form-label">Bank Account Name</label>
                        <input
                          className="form-input"
                          placeholder="Bank Account"
                          value={bankAccountName}
                          onChange={(e) => setBankAccountName(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 4' }}>
                        <label className="form-label">Bank Opening Balance</label>
                        <input
                          type="number"
                          className="form-input"
                          value={bankBalance}
                          onChange={(e) => setBankBalance(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                      </div>

                      <div className="form-group" style={{ gridColumn: 'span 3' }}>
                        <label className="form-label">Retained Earnings Ref #</label>
                        <input
                          className="form-input"
                          placeholder="301"
                          value={retainedAccountCode}
                          onChange={(e) => setRetainedAccountCode(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 9' }}>
                        <label className="form-label">Retained Earnings Account Name</label>
                        <input
                          className="form-input"
                          placeholder="Retained Earnings"
                          value={retainedAccountName}
                          onChange={(e) => setRetainedAccountName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="periods-alert periods-alert-info" style={{ marginBottom: 0 }}>
                      <div className="periods-alert-content">
                        <i className="ti ti-info-circle"></i>
                        <span>
                          Opening credit to Retained Earnings will be:{' '}
                          <strong>Rp {totalOpeningBalance.toLocaleString('en-US')}</strong>
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {permanentAccounts.length > 0 && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid #2a313c', margin: '1.25rem 0' }} />
                    <p className="form-label" style={{ marginBottom: '0.5rem' }}>
                      Existing permanent accounts (for reference):
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {permanentAccounts.map((a) => (
                        <span key={a.id} className="badge-tag">
                          {a.displayLabel}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={() => setViewMode('list')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary-custom"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="periods-spinner"></span>
                ) : (
                  <i className="ti ti-check"></i>
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
