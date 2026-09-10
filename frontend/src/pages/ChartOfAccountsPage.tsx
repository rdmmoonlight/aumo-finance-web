import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconSitemap,
  IconPlus,
  IconPencil,
  IconNotebook,
  IconTrash,
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';

import apiClient from '@/services/apiClient';
import { Button } from '@/components/ui/button';

export interface ChartOfAccount {
  id: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  role: string;
  balance: number;
  isActive: boolean;
}

const ACCOUNT_TYPES = [
  'Assets',
  'Liabilities',
  'Equity',
  'OperatingIncome',
  'OperatingExpenses',
  'OtherIncome',
  'OtherExpenses',
];

const ACCOUNT_RANGES: Record<string, { start: number; end: number; label: string }> = {
  Assets: { start: 100, end: 199, label: 'Assets (100 - 199)' },
  Liabilities: { start: 200, end: 299, label: 'Liabilities (200 - 299)' },
  Equity: { start: 300, end: 399, label: 'Equity (300 - 399)' },
  OperatingIncome: { start: 400, end: 499, label: 'Operating Income (400 - 499)' },
  OperatingExpenses: { start: 500, end: 599, label: 'Operating Expenses (500 - 599)' },
  OtherIncome: { start: 600, end: 799, label: 'Other Income (600 - 799)' },
  OtherExpenses: { start: 800, end: 999, label: 'Other Expenses (800 - 999)' },
};

const formatCategoryLabel = (type: string) => ACCOUNT_RANGES[type]?.label || type;

const validateReferenceNumber = (type: string, refNum: number) => {
  const range = ACCOUNT_RANGES[type];
  if (!range) return false;
  return refNum >= range.start && refNum <= range.end;
};

function ChartOfAccountsContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPeriodName, setSelectedPeriodName] = useState<string | null>(null);

  const [searchText, setSearchText] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const [newAccount, setNewAccount] = useState<Partial<ChartOfAccount>>({
    type: '',
    referenceNumber: 0,
    accountName: '',
    role: 'Default',
  });

  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);

  const handleUnauthorized = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      navigate('/auth');
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get('/api/v1/chart-of-accounts');
      const rawData = response.data;
      const loadedAccounts: ChartOfAccount[] = rawData?.accounts || [];
      setSelectedPeriodName(rawData?.selectedPeriodName || null);

      setAccounts(loadedAccounts.sort((a, b) => a.referenceNumber - b.referenceNumber));
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to connect to the backend server.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        !searchText ||
        acc.accountName.toLowerCase().includes(searchText.toLowerCase()) ||
        acc.referenceNumber.toString().includes(searchText);

      const matchCategory = !categoryFilter || acc.type === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [accounts, searchText, categoryFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newAccount.type) {
      setCreateError('Please select an account category.');
      return;
    }

    const refNum = Number(newAccount.referenceNumber);
    if (!validateReferenceNumber(newAccount.type, refNum)) {
      setCreateError(`Reference number ${refNum} is not valid for category ${newAccount.type}.`);
      return;
    }

    const isCodeTaken = accounts.some((a) => a.referenceNumber === refNum);
    if (isCodeTaken) {
      setCreateError(`Account code ${refNum} is already in use!`);
      return;
    }

    try {
      const payload = {
        referenceNumber: refNum,
        accountName: newAccount.accountName || 'Untitled Account',
        type: newAccount.type,
        role: newAccount.role || 'Default',
      };

      const response = await apiClient.post('/api/v1/chart-of-accounts', payload);
      const resData = response.data || {};

      setSuccessMessage(resData.message || `Account '${payload.accountName}' was successfully created.`);
      setNewAccount({ type: '', referenceNumber: 0, accountName: '', role: 'Default' });
      setIsAddModalOpen(false);

      await fetchAccounts();
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setCreateError(err.response?.data?.message || err.message || 'An error occurred while creating the account.');
    }
  };

  const openEditModal = (account: ChartOfAccount) => {
    setEditError(null);
    setEditAccount({ ...account });
    setIsEditModalOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccount) return;

    setEditError(null);

    if (!validateReferenceNumber(editAccount.type, editAccount.referenceNumber)) {
      setEditError(`Reference number ${editAccount.referenceNumber} is not valid for category ${editAccount.type}.`);
      return;
    }

    const isCodeTaken = accounts.some(
      (a) => a.referenceNumber === editAccount.referenceNumber && a.id !== editAccount.id
    );
    if (isCodeTaken) {
      setEditError(`Account code ${editAccount.referenceNumber} is already in use by another account!`);
      return;
    }

    try {
      const payload = {
        referenceNumber: editAccount.referenceNumber,
        accountName: editAccount.accountName,
        type: editAccount.type,
        role: editAccount.role || 'Default',
        isActive: editAccount.isActive,
      };

      const response = await apiClient.put(`/api/v1/chart-of-accounts/${editAccount.id}`, payload);
      const resData = response.data || {};

      setSuccessMessage(resData.message || `Account '${editAccount.accountName}' was successfully updated.`);
      setIsEditModalOpen(false);

      await fetchAccounts();
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setEditError(err.response?.data?.message || err.message || 'An error occurred while updating the account.');
    }
  };

  const confirmAndDelete = async (account: ChartOfAccount) => {
    if (!window.confirm(`Delete account "${account.accountName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/api/v1/chart-of-accounts/${account.id}`);
      const resData = response.data || {};

      setSuccessMessage(resData.message || `Account '${account.accountName}' was successfully deleted.`);
      await fetchAccounts();
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.response?.data?.message || err.message || 'An error occurred while deleting the account.');
    }
  };

  const getLedgerUrl = (account: ChartOfAccount) => {
    return `/reports/general-ledger/permanent#account-${account.id}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <IconSitemap className="text-amber-500" size={28} /> Chart of Accounts
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Master list of financial accounts {selectedPeriodName ? `(Viewing Period: ${selectedPeriodName})` : ''}.
          </p>
        </div>
        <div>
          <Button
            onClick={() => {
              setCreateError(null);
              setIsAddModalOpen(true);
            }}
            className="bg-amber-600 hover:bg-amber-500 text-white gap-2 font-medium text-xs h-9"
          >
            <IconPlus size={16} /> New Account
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconAlertTriangleFilled size={18} className="text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-200">
            <IconX size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconCircleCheckFilled size={18} className="text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* COA Table Card */}
      <div className="border border-zinc-800 bg-zinc-950 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="h-9 w-60 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="Search accounts..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <select
              className="h-9 w-44 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatCategoryLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs font-semibold text-zinc-400">
            Total Accounts: {filteredAccounts.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 uppercase text-[10px] font-semibold text-zinc-400 tracking-wider">
              <tr>
                <th className="pl-6 py-3 w-28">Ref No.</th>
                <th className="py-3">Account Name</th>
                <th className="py-3">Category</th>
                <th className="py-3">Role</th>
                <th className="py-3 text-right">Current Balance</th>
                <th className="py-3 text-center w-24">Status</th>
                <th className="py-3 text-center pr-6 w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-zinc-400">
                    <span className="inline-block animate-spin mr-2">⏳</span> Loading account data from server...
                  </td>
                </tr>
              ) : filteredAccounts.length > 0 ? (
                filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    id={`account-${account.id}`}
                    className={`hover:bg-zinc-900/40 transition-colors ${
                      highlightId === String(account.id) ? 'bg-amber-950/30' : ''
                    }`}
                  >
                    <td className="pl-6 py-3 font-mono text-sky-400 font-medium">
                      {account.referenceNumber}
                    </td>
                    <td className="py-3 font-semibold text-zinc-100">{account.accountName}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                        {account.type}
                      </span>
                    </td>
                    <td className="py-3">
                      {account.role !== 'Default' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-sky-950 text-sky-300 border border-sky-800/50">
                          {account.role}
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">Standard</span>
                      )}
                    </td>
                    <td
                      className={`py-3 text-right font-medium ${
                        account.balance >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      Rp {account.balance.toLocaleString('en-US')}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          account.isActive
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                        }`}
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-center pr-6">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          title="Edit Account"
                          onClick={() => openEditModal(account)}
                        >
                          <IconPencil size={15} />
                        </Button>
                        <Link
                          to={getLedgerUrl(account)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-sky-400 hover:bg-sky-950/50 transition-colors"
                          title="View General Ledger"
                        >
                          <IconNotebook size={15} />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                          title="Delete Account"
                          onClick={() => confirmAndDelete(account)}
                        >
                          <IconTrash size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-400">
                    <IconSitemap className="mx-auto text-zinc-600 mb-2" size={36} />
                    No accounts found. Add a new account to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD ACCOUNT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <IconPlus className="text-amber-500" size={18} /> Add New Account
              </h3>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-100"
                onClick={() => setIsAddModalOpen(false)}
              >
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-xs">
                  {createError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Account Category</label>
                <select
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={newAccount.type}
                  onChange={(e) =>
                    setNewAccount({
                      ...newAccount,
                      type: e.target.value,
                      referenceNumber: ACCOUNT_RANGES[e.target.value]?.start || 0,
                    })
                  }
                  required
                >
                  <option value="">-- Select Category --</option>
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatCategoryLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Reference Number (Account Code)</label>
                <input
                  type="number"
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                  value={newAccount.referenceNumber || ''}
                  disabled={!newAccount.type}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, referenceNumber: Number(e.target.value) })
                  }
                  required
                />
                {newAccount.type ? (
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1">
                    <IconInfoCircle size={14} className="text-amber-500" /> Valid range: {ACCOUNT_RANGES[newAccount.type]?.start} - {ACCOUNT_RANGES[newAccount.type]?.end}
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Please select a category to view the valid numbering range.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Account Name</label>
                <input
                  type="text"
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="e.g. Rent Expense"
                  value={newAccount.accountName || ''}
                  onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">System Role (Special Calculations)</label>
                <select
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={newAccount.role}
                  onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                >
                  <option value="Default">Standard / Default</option>
                  <option value="CashAndEquivalents">Cash &amp; Equivalents</option>
                  <option value="RetainedEarnings">Retained Earnings</option>
                  <option value="TaxPayable">Tax Payable</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-zinc-400 hover:text-zinc-100"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                  Save Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ACCOUNT */}
      {isEditModalOpen && editAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <IconPencil className="text-amber-500" size={18} /> Edit Account
              </h3>
              <button
                type="button"
                className="text-zinc-400 hover:text-zinc-100"
                onClick={() => setIsEditModalOpen(false)}
              >
                <IconX size={18} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-xs">
                  {editError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Account Category</label>
                <select
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={editAccount.type}
                  onChange={(e) => setEditAccount({ ...editAccount, type: e.target.value })}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatCategoryLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Reference Number (Account Code)</label>
                <input
                  type="number"
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={editAccount.referenceNumber}
                  onChange={(e) =>
                    setEditAccount({
                      ...editAccount,
                      referenceNumber: Number(e.target.value),
                    })
                  }
                  required
                />
                {editAccount.type && (
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1">
                    <IconInfoCircle size={14} className="text-amber-500" /> Valid range: {ACCOUNT_RANGES[editAccount.type]?.start} - {ACCOUNT_RANGES[editAccount.type]?.end}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Account Name</label>
                <input
                  type="text"
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={editAccount.accountName}
                  onChange={(e) => setEditAccount({ ...editAccount, accountName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">System Role (Special Calculations)</label>
                <select
                  className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={editAccount.role}
                  onChange={(e) => setEditAccount({ ...editAccount, role: e.target.value })}
                >
                  <option value="Default">Standard / Default</option>
                  <option value="CashAndEquivalents">Cash &amp; Equivalents</option>
                  <option value="RetainedEarnings">Retained Earnings</option>
                  <option value="TaxPayable">Tax Payable</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  className="rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                  checked={editAccount.isActive}
                  onChange={(e) => setEditAccount({ ...editAccount, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="text-xs font-medium text-zinc-300 cursor-pointer">
                  Active Account
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-zinc-400 hover:text-zinc-100"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                  Update Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-zinc-400 text-xs">
          <span className="inline-block animate-spin mr-2">⏳</span> Loading chart of accounts...
        </div>
      }
    >
      <ChartOfAccountsContent />
    </Suspense>
  );
}
