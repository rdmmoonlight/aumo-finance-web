import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconCalendar,
  IconCalendarPlus,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconLock,
  IconLockOpen,
  IconArrowLeft,
  IconCheck,
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconX,
  IconInfoCircle,
  IconRefresh,
  IconCirclePlus,
  IconCalendarOff,
} from '@tabler/icons-react';

import apiClient from '@/services/apiClient';

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

export default function PeriodsPage() {
  const navigate = useNavigate();

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
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    navigate('/auth');
  };

  const notifyPeriodChanged = () => {
    window.dispatchEvent(new Event('periodChanged'));
  };

  const fetchPeriodsAndAccounts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch Periods
      const periodsRes = await apiClient.get('/api/v1/periods');
      const periodsRaw = periodsRes.data;

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
        const activePeriod = periodsData.find((p) => !p.isClosed) || periodsData[0];
        setSelectedPeriodId(activePeriod ? activePeriod.id : null);
      }

      // 2. Fetch Open Info
      const openInfoRes = await apiClient.get('/api/v1/periods/open-info');
      const info = openInfoRes.data;

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
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to connect to backend server.');
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
      await apiClient.post(`/api/v1/periods/select/${period.id}`);
      setSuccessMessage(`Now viewing ${period.periodName}${period.isClosed ? ' (Closed & Read-Only).' : '.'}`);
      notifyPeriodChanged();
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to select period in database.');
      fetchPeriodsAndAccounts();
    }
  };

  const clearSelection = async () => {
    setErrorMessage(null);
    try {
      await apiClient.post('/api/v1/periods/clear-selection');
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
    } finally {
      setSelectedPeriodId(null);
      setSuccessMessage('No period selected. Reports and journals are hidden until you view a period.');
      notifyPeriodChanged();
    }
  };

  const confirmAndClosePeriod = async (period: AccountingPeriod) => {
    if (!window.confirm(`Are you sure you want to close ${period.periodName}? No further edits will be allowed.`)) {
      return;
    }

    setErrorMessage(null);

    if (period.isClosed) {
      setErrorMessage(`Period ${period.periodName} is already closed.`);
      return;
    }

    try {
      await apiClient.post(`/api/v1/periods/close/${period.id}`);
      setPeriods((prev) =>
        prev.map((p) => (p.id === period.id ? { ...p, isClosed: true } : p))
      );
      setSuccessMessage(`Period ${period.periodName} has been closed. Transactions in this period are now locked.`);
      notifyPeriodChanged();
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to close the accounting period.');
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
        cashAccountId: setupMode === 'LoadExisting' ? parseInt(cashAccountId, 10) : null,
        bankAccountId: setupMode === 'LoadExisting' ? parseInt(bankAccountId, 10) : null,
        retainedEarningsAccountId: setupMode === 'LoadExisting' ? parseInt(retainedEarningsAccountId, 10) : null,
        cashAccountCode: setupMode === 'CreateNew' ? cashAccountCode : null,
        cashAccountName: setupMode === 'CreateNew' ? cashAccountName : null,
        cashBalance: setupMode === 'CreateNew' ? (Number(cashBalance) || 0) : null,
        bankAccountCode: setupMode === 'CreateNew' ? bankAccountCode : null,
        bankAccountName: setupMode === 'CreateNew' ? bankAccountName : null,
        bankBalance: setupMode === 'CreateNew' ? (Number(bankBalance) || 0) : null,
        retainedEarningsAccountCode: setupMode === 'CreateNew' ? retainedAccountCode : null,
        retainedEarningsAccountName: setupMode === 'CreateNew' ? retainedAccountName : null,
      };

      const res = await apiClient.post('/api/v1/periods', payload);
      setSuccessMessage(res.data?.message || 'Successfully opened new period.');
      setViewMode('list');
      fetchPeriodsAndAccounts();
      notifyPeriodChanged();
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.response?.data?.message || err.message || 'An error occurred while creating the new period.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOpeningBalance = (Number(cashBalance) || 0) + (Number(bankBalance) || 0);

  return (
    <div className="periods-container">
      {/* Alert Notifications */}
      {errorMessage && (
        <div className="periods-alert periods-alert-danger flex items-center justify-between p-3 mb-4 rounded bg-red-900/30 border border-red-800 text-red-200">
          <div className="periods-alert-content flex items-center gap-2">
            <IconAlertTriangleFilled className="shrink-0 text-red-400" size={20} />
            <span className="text-sm">{errorMessage}</span>
          </div>
          <button type="button" className="periods-alert-close p-1 hover:bg-red-800/40 rounded" onClick={() => setErrorMessage(null)}>
            <IconX size={16} />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="periods-alert periods-alert-success flex items-center justify-between p-3 mb-4 rounded bg-emerald-900/30 border border-emerald-800 text-emerald-200">
          <div className="periods-alert-content flex items-center gap-2">
            <IconCircleCheckFilled className="shrink-0 text-emerald-400" size={20} />
            <span className="text-sm">{successMessage}</span>
          </div>
          <button type="button" className="periods-alert-close p-1 hover:bg-emerald-800/40 rounded" onClick={() => setSuccessMessage(null)}>
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* VIEW 1: ACCOUNTING PERIOD LIST */}
      {viewMode === 'list' && (
        <>
          {/* Header */}
          <div className="periods-header flex items-center justify-between mb-6">
            <div>
              <h2 className="periods-title text-xl font-bold flex items-center gap-2">
                <IconCalendar className="periods-title-icon text-primary" size={24} /> Accounting Periods
              </h2>
              <p className="periods-subtitle text-xs text-muted-foreground mt-1 flex items-center gap-1">
                Manage your financial reporting cycles. Click <IconEye size={14} className="inline" /> to view a period — the whole app will follow it.
              </p>
            </div>
            <div className="periods-header-actions flex gap-2">
              {selectedPeriodId !== null && (
                <button className="btn-secondary-custom flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200" onClick={clearSelection}>
                  <IconEyeOff size={16} /> Stop Viewing
                </button>
              )}
              <button
                className="btn-primary-custom flex items-center gap-2 px-3 py-1.5 text-xs rounded bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('create');
                }}
              >
                <IconPlus size={16} /> Open New Period
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="periods-card border border-zinc-800 bg-zinc-900/50 rounded-lg overflow-hidden">
            <div className="periods-card-header p-4 border-b border-zinc-800 flex items-center justify-between">
              <h5 className="periods-card-title font-semibold text-sm">Period List</h5>
              <span className="periods-subtitle text-xs text-muted-foreground font-semibold">
                Total Periods: {periods.length}
              </span>
            </div>

            <div className="periods-card-body p-0">
              <div className="periods-table-wrapper overflow-x-auto">
                <table className="periods-table w-full text-xs text-left">
                  <thead className="bg-zinc-800/50 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="py-3 pl-6">Period Name</th>
                      <th className="py-3">Start Date</th>
                      <th className="py-3">End Date</th>
                      <th className="py-3 text-center">Status</th>
                      <th className="py-3 text-center pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-zinc-300">
                          <span className="inline-block animate-spin mr-2">⏳</span>
                          Loading data from server...
                        </td>
                      </tr>
                    ) : periods.length > 0 ? (
                      periods.map((period) => {
                        const isSelected = selectedPeriodId === period.id;
                        return (
                          <tr key={period.id} className={isSelected ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/20'}>
                            <td className="py-3 pl-6 font-bold flex items-center gap-2">
                              {period.periodName}
                              {isSelected && (
                                <span className="badge-custom bg-blue-950 text-blue-300 border border-blue-800 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                  <IconEye size={12} /> Viewing
                                </span>
                              )}
                            </td>
                            <td className="py-3">{period.startDate}</td>
                            <td className="py-3">{period.endDate}</td>
                            <td className="py-3 text-center">
                              {period.isClosed ? (
                                <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-[10px]">
                                  <IconLock size={12} /> Closed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px]">
                                  <IconLockOpen size={12} /> Active
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-center pr-6">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className={`p-1.5 rounded border ${isSelected ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'}`}
                                  title="View this period"
                                  onClick={() => selectPeriod(period)}
                                >
                                  <IconEye size={16} />
                                </button>
                                {!period.isClosed && (
                                  <button
                                    type="button"
                                    className="p-1.5 bg-amber-950 border border-amber-800 text-amber-300 hover:bg-amber-900 rounded"
                                    title="Close Period"
                                    onClick={() => confirmAndClosePeriod(period)}
                                  >
                                    <IconLock size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-zinc-300">
                          <IconCalendarOff className="mx-auto mb-2 text-zinc-500" size={32} />
                          <p className="m-0 font-medium">No accounting periods have been initialized yet.</p>
                          <span className="text-xs text-zinc-500">Click &quot;Open New Period&quot; to start your first accounting cycle.</span>
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
        <div className="create-period-container max-w-4xl mx-auto">
          {/* Form Header */}
          <div className="periods-header flex items-center justify-between mb-6">
            <div>
              <h2 className="periods-title text-xl font-bold flex items-center gap-2">
                <IconCalendarPlus className="text-primary" size={24} /> Open New Period
              </h2>
              <p className="periods-subtitle text-xs text-muted-foreground mt-1">
                Start a new monthly accounting cycle. The opening balance entry is posted on day 1 of the period.
              </p>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5"
              onClick={() => {
                setErrorMessage(null);
                setViewMode('list');
              }}
            >
              <IconArrowLeft size={16} /> Back
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            {/* Period Month/Year */}
            <div className="border border-zinc-800 bg-zinc-900/50 rounded-lg p-4">
              <h5 className="font-semibold text-sm border-b border-zinc-800 pb-2 mb-4">Period</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-xs font-medium block mb-1">Month</label>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200"
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
                  <label className="text-xs font-medium block mb-1">Year</label>
                  <input
                    type="number"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Permanent Accounts Setup */}
            <div className="border border-zinc-800 bg-zinc-900/50 rounded-lg p-4">
              <h5 className="font-semibold text-sm border-b border-zinc-800 pb-2 mb-4">Permanent Accounts Setup</h5>
              
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="setupMode"
                    checked={setupMode === 'LoadExisting'}
                    disabled={!hasExistingPermanentAccounts}
                    onChange={() => setSetupMode('LoadExisting')}
                  />
                  <span className="flex items-center gap-1"><IconRefresh size={14} /> Use Existing Accounts</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="setupMode"
                    checked={setupMode === 'CreateNew'}
                    onChange={() => setSetupMode('CreateNew')}
                  />
                  <span className="flex items-center gap-1"><IconCirclePlus size={14} /> Register New Accounts</span>
                </label>
              </div>

              {!hasExistingPermanentAccounts && (
                <div className="p-3 mb-4 rounded bg-blue-950/40 border border-blue-800 text-blue-200 text-xs flex items-center gap-2">
                  <IconInfoCircle size={16} className="shrink-0 text-blue-400" />
                  <span>No existing Cash/Bank &amp; Retained Earnings accounts found — new accounts required.</span>
                </div>
              )}

              {setupMode === 'LoadExisting' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium block mb-1">Cash Account</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200"
                      value={cashAccountId}
                      onChange={(e) => setCashAccountId(e.target.value)}
                    >
                      {availableCashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.displayLabel}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Bank Account</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200"
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                    >
                      {availableCashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.displayLabel}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Retained Earnings Account</label>
                    <select
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200"
                      value={retainedEarningsAccountId}
                      onChange={(e) => setRetainedEarningsAccountId(e.target.value)}
                    >
                      {availableRetainedAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.displayLabel}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs font-medium block mb-1">Cash Ref #</label>
                      <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs" value={cashAccountCode} onChange={(e) => setCashAccountCode(e.target.value)} />
                    </div>
                    <div className="col-span-5">
                      <label className="text-xs font-medium block mb-1">Cash Account Name</label>
                      <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs" value={cashAccountName} onChange={(e) => setCashAccountName(e.target.value)} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs font-medium block mb-1">Cash Opening Balance</label>
                      <input type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs" value={cashBalance} onChange={(e) => setCashBalance(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs font-medium block mb-1">Bank Ref #</label>
                      <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs" value={bankAccountCode} onChange={(e) => setBankAccountCode(e.target.value)} />
                    </div>
                    <div className="col-span-5">
                      <label className="text-xs font-medium block mb-1">Bank Account Name</label>
                      <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs font-medium block mb-1">Bank Opening Balance</label>
                      <input type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs" value={bankBalance} onChange={(e) => setBankBalance(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-blue-950/30 border border-blue-900 text-xs text-blue-200 flex items-center gap-2">
                    <IconInfoCircle size={16} />
                    <span>
                      Opening credit to Retained Earnings will be: <strong>Rp {totalOpeningBalance.toLocaleString('id-ID')}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-xs rounded border border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                onClick={() => setViewMode('list')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex items-center gap-1.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : <><IconCheck size={16} /> Open Period</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}