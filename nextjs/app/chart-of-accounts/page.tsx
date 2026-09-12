'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import './chart-of-accounts.css';

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

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-authentic-web-api.onrender.com';
const NEXT_PUBLIC_API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

function ChartOfAccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      router.push('/');
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load Chart of Accounts data from the server.');
      }

      const rawData = await response.json();
      const loadedAccounts: ChartOfAccount[] = rawData?.accounts || [];
      setSelectedPeriodName(rawData?.selectedPeriodName || null);

      setAccounts(loadedAccounts.sort((a, b) => a.referenceNumber - b.referenceNumber));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to the backend server.');
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

      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to save the new account.');
      }

      setSuccessMessage(resData.message || `Account '${payload.accountName}' was successfully created.`);
      setNewAccount({ type: '', referenceNumber: 0, accountName: '', role: 'Default' });
      setIsAddModalOpen(false);

      await fetchAccounts();
    } catch (err: any) {
      setCreateError(err.message || 'An error occurred while creating the account.');
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

      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts/${editAccount.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to update the account.');
      }

      setSuccessMessage(resData.message || `Account '${editAccount.accountName}' was successfully updated.`);
      setIsEditModalOpen(false);

      await fetchAccounts();
    } catch (err: any) {
      setEditError(err.message || 'An error occurred while updating the account.');
    }
  };

  const confirmAndDelete = async (account: ChartOfAccount) => {
    if (!window.confirm(`Delete account "${account.accountName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/chart-of-accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const resData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resData.message || 'Failed to delete the account.');
      }

      setSuccessMessage(resData.message || `Account '${account.accountName}' was successfully deleted.`);
      await fetchAccounts();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while deleting the account.');
    }
  };

  const getLedgerUrl = (account: ChartOfAccount) => {
    return `/reports/general-ledger#account-${account.id}`;
  };

  return (
    <div className="coa-container">
      {/* Page Header */}
      <div className="coa-header">
        <div>
          <h2 className="coa-title">
            <i className="ti ti-sitemap coa-title-icon"></i> Chart of Accounts
          </h2>
          <p className="coa-subtitle">
            Master list of financial accounts {selectedPeriodName ? `(Viewing Period: ${selectedPeriodName})` : ''}.
          </p>
        </div>
        <div>
          <button
            className="btn-warning-custom"
            onClick={() => {
              setCreateError(null);
              setIsAddModalOpen(true);
            }}
          >
            <i className="ti ti-plus"></i> New Account
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="coa-alert coa-alert-danger">
          <div className="coa-alert-content">
            <i className="ti ti-alert-triangle-filled"></i>
            <span>{errorMessage}</span>
          </div>
          <button type="button" className="coa-alert-close" onClick={() => setErrorMessage(null)}>
            <i className="ti ti-x"></i>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="coa-alert coa-alert-success">
          <div className="coa-alert-content">
            <i className="ti ti-circle-check-filled"></i>
            <span>{successMessage}</span>
          </div>
          <button type="button" className="coa-alert-close" onClick={() => setSuccessMessage(null)}>
            <i className="ti ti-x"></i>
          </button>
        </div>
      )}

      {/* COA Table Card */}
      <div className="coa-card">
        <div className="coa-card-header">
          <div className="coa-controls">
            <input
              type="text"
              className="coa-input"
              style={{ width: '240px' }}
              placeholder="Search accounts..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <select
              className="coa-select"
              style={{ width: '180px' }}
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
          <span className="coa-subtitle" style={{ fontWeight: 600 }}>
            Total Accounts: {filteredAccounts.length}
          </span>
        </div>

        <div className="coa-card-body">
          <div className="coa-table-wrapper">
            <table className="coa-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '1.5rem', width: '120px' }}>Ref No.</th>
                  <th>Account Name</th>
                  <th>Category</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'right' }}>Current Balance</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                  <th style={{ textAlign: 'center', paddingRight: '1.5rem', width: '130px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 0', color: '#ffffff' }}>
                      <span className="coa-spinner" style={{ marginRight: '0.5rem' }}></span>
                      Loading account data from server...
                    </td>
                  </tr>
                ) : filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <tr
                      key={account.id}
                      id={`account-${account.id}`}
                      className={highlightId === String(account.id) ? 'highlight-row' : ''}
                    >
                      <td style={{ paddingLeft: '1.5rem' }}>
                        <code style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{account.referenceNumber}</code>
                      </td>
                      <td style={{ fontWeight: 700 }}>{account.accountName}</td>
                      <td>
                        <span className="badge-custom badge-sec">{account.type}</span>
                      </td>
                      <td>
                        {account.role !== 'Default' ? (
                          <span className="badge-custom badge-info">{account.role}</span>
                        ) : (
                          <span className="coa-subtitle" style={{ fontSize: '0.75rem' }}>Standard</span>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: account.balance >= 0 ? '#4ade80' : '#fca5a5',
                        }}
                      >
                        Rp {account.balance.toLocaleString('en-US')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-custom ${account.isActive ? 'badge-active' : 'badge-inactive'}`}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', paddingRight: '1.5rem' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn-icon-custom"
                            title="Edit Account"
                            onClick={() => openEditModal(account)}
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                          <Link
                            href={getLedgerUrl(account)}
                            className="btn-icon-custom btn-icon-info"
                            title="View General Ledger"
                          >
                            <i className="ti ti-notebook"></i>
                          </Link>
                          <button
                            type="button"
                            className="btn-icon-custom btn-icon-danger"
                            title="Delete Account"
                            onClick={() => confirmAndDelete(account)}
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 0', color: '#ffffff' }}>
                      <i className="ti ti-sitemap" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}></i>
                      No accounts found. Add a new account to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* REACT MODAL: ADD ACCOUNT */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h5 className="modal-title-custom">
                <i className="ti ti-circle-plus" style={{ color: '#f59e0b' }}></i> Add New Account
              </h5>
              <button
                type="button"
                className="coa-alert-close"
                onClick={() => setIsAddModalOpen(false)}
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body-custom">
                {createError && <div className="coa-alert coa-alert-danger">{createError}</div>}

                <div className="form-group-custom">
                  <label className="form-label-custom">Account Category</label>
                  <select
                    className="coa-select"
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

                <div className="form-group-custom">
                  <label className="form-label-custom">Reference Number (Account Code)</label>
                  <input
                    type="number"
                    className="coa-input"
                    value={newAccount.referenceNumber || ''}
                    disabled={!newAccount.type}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, referenceNumber: Number(e.target.value) })
                    }
                    required
                  />
                  {newAccount.type ? (
                    <div className="form-hint-custom">
                      <i className="ti ti-info-circle"></i> Valid range: {ACCOUNT_RANGES[newAccount.type]?.start} - {ACCOUNT_RANGES[newAccount.type]?.end}
                    </div>
                  ) : (
                    <div className="coa-subtitle" style={{ fontSize: '0.75rem' }}>
                      Please select a category to view the valid numbering range.
                    </div>
                  )}
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Account Name</label>
                  <input
                    type="text"
                    className="coa-input"
                    placeholder="e.g. Rent Expense"
                    value={newAccount.accountName || ''}
                    onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">System Role (Special Calculations)</label>
                  <select
                    className="coa-select"
                    value={newAccount.role}
                    onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                  >
                    <option value="Default">Standard / Default</option>
                    <option value="CashAndEquivalents">Cash &amp; Equivalents</option>
                    <option value="RetainedEarnings">Retained Earnings</option>
                    <option value="TaxPayable">Tax Payable</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer-custom">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-custom">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REACT MODAL: EDIT ACCOUNT */}
      {isEditModalOpen && editAccount && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h5 className="modal-title-custom">
                <i className="ti ti-edit" style={{ color: '#f59e0b' }}></i> Edit Account
              </h5>
              <button
                type="button"
                className="coa-alert-close"
                onClick={() => setIsEditModalOpen(false)}
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body-custom">
                {editError && <div className="coa-alert coa-alert-danger">{editError}</div>}

                <div className="form-group-custom">
                  <label className="form-label-custom">Account Category</label>
                  <select
                    className="coa-select"
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

                <div className="form-group-custom">
                  <label className="form-label-custom">Reference Number (Account Code)</label>
                  <input
                    type="number"
                    className="coa-input"
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
                    <div className="form-hint-custom">
                      <i className="ti ti-info-circle"></i> Valid range: {ACCOUNT_RANGES[editAccount.type]?.start} - {ACCOUNT_RANGES[editAccount.type]?.end}
                    </div>
                  )}
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Account Name</label>
                  <input
                    type="text"
                    className="coa-input"
                    value={editAccount.accountName}
                    onChange={(e) => setEditAccount({ ...editAccount, accountName: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">System Role (Special Calculations)</label>
                  <select
                    className="coa-select"
                    value={editAccount.role}
                    onChange={(e) => setEditAccount({ ...editAccount, role: e.target.value })}
                  >
                    <option value="Default">Standard / Default</option>
                    <option value="CashAndEquivalents">Cash &amp; Equivalents</option>
                    <option value="RetainedEarnings">Retained Earnings</option>
                    <option value="TaxPayable">Tax Payable</option>
                  </select>
                </div>

                <label className="form-switch-custom">
                  <input
                    type="checkbox"
                    checked={editAccount.isActive}
                    onChange={(e) => setEditAccount({ ...editAccount, isActive: e.target.checked })}
                  />
                  <span className="form-label-custom">Active Account</span>
                </label>
              </div>
              <div className="modal-footer-custom">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-custom">
                  Update Account
                </button>
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
        <div style={{ textAlign: 'center', padding: '5rem 0', color: '#ffffff' }}>
          <span className="coa-spinner" style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.5rem' }}></span>
          <span>Loading chart of accounts...</span>
        </div>
      }
    >
      <ChartOfAccountsContent />
    </Suspense>
  );
}
