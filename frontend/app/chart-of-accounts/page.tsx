'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import './chart-of-accounts.css';

// Chart of Account Data Model
export interface ChartOfAccount {
  id: number;
  referenceNumber: number;
  accountName: string;
  type: string;
  role: string;
  balance: number;
  isActive: boolean;
}

// Category Constants & Account Coding Utilities
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

// Target base URL untuk Web API
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-authentic-web-api.onrender.com';
const API_BASE_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

function ChartOfAccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPeriodName, setSelectedPeriodName] = useState<string | null>(null);

  // Filter & Search State
  const [searchText, setSearchText] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Notification State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Form Modals State
  const [newAccount, setNewAccount] = useState<Partial<ChartOfAccount>>({
    type: '',
    referenceNumber: 0,
    accountName: '',
    role: 'Default',
  });

  const [editAccount, setEditAccount] = useState<ChartOfAccount | null>(null);

  // Redirect handler untuk 401 Unauthorized
  const handleUnauthorized = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      router.push('/');
    }
  };

  // Fetch / Sync Data from Backend Web API (/web/chart-of-accounts)
  const fetchAccounts = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/web/chart-of-accounts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Mengirim Cookie Session
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

  // Filtered Accounts list computation
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

  // Handle Action: Create Account via Web API (POST /web/chart-of-accounts)
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

      const response = await fetch(`${API_BASE_URL}/web/chart-of-accounts`, {
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
      
      const addModalCloseBtn = document.getElementById('addAccountModalClose');
      addModalCloseBtn?.click();

      // Refresh data
      await fetchAccounts();
    } catch (err: any) {
      setCreateError(err.message || 'An error occurred while creating the account.');
    }
  };

  // Handle Action: Open Edit Modal
  const openEditModal = (account: ChartOfAccount) => {
    setEditError(null);
    setEditAccount({ ...account });
  };

  // Handle Action: Update Account via Web API (PUT /web/chart-of-accounts/{id})
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

      const response = await fetch(`${API_BASE_URL}/web/chart-of-accounts/${editAccount.id}`, {
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

      const editModalCloseBtn = document.getElementById('editAccountModalClose');
      editModalCloseBtn?.click();

      // Refresh data
      await fetchAccounts();
    } catch (err: any) {
      setEditError(err.message || 'An error occurred while updating the account.');
    }
  };

  // Handle Action: Delete Account via Web API (DELETE /web/chart-of-accounts/{id})
  const confirmAndDelete = async (account: ChartOfAccount) => {
    if (!window.confirm(`Delete account "${account.accountName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/web/chart-of-accounts/${account.id}`, {
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
    <div className="container-fluid py-4 px-4 text-white">
      {/* Page Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-bold mb-1 text-white d-flex align-items-center">
            <i className="ti ti-sitemap me-2 text-warning fs-2"></i> Chart of Accounts
          </h2>
          <p className="text-white-50 mb-0">
            Master list of financial accounts {selectedPeriodName ? `(Viewing Period: ${selectedPeriodName})` : ''}.
          </p>
        </div>
        <div>
          <button
            className="btn btn-warning fw-semibold shadow-sm d-inline-flex align-items-center"
            data-bs-toggle="modal"
            data-bs-target="#addAccountModal"
          >
            <i className="ti ti-plus me-1"></i> New Account
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMessage && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-alert-triangle-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setErrorMessage(null)}
          ></button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm d-flex align-items-center justify-content-between" role="alert">
          <div className="d-flex align-items-center">
            <i className="ti ti-circle-check-filled me-2 fs-5 flex-shrink-0"></i>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setSuccessMessage(null)}
          ></button>
        </div>
      )}

      {/* COA Table Card */}
      <div className="card border-0 shadow-sm rounded-4 bg-body-tertiary">
        <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex gap-2 flex-wrap">
            <input
              type="text"
              className="form-control form-control-sm bg-dark text-white border-secondary"
              style={{ width: '250px' }}
              placeholder="Search accounts..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <select
              className="form-select form-select-sm bg-dark text-white border-secondary"
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
          <span className="text-white-50 small fw-semibold">
            Total Accounts: {filteredAccounts.length}
          </span>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0">
              <thead className="table-light text-secondary">
                <tr>
                  <th className="ps-4" style={{ width: '120px' }}>Ref No.</th>
                  <th>Account Name</th>
                  <th>Category</th>
                  <th>Role</th>
                  <th className="text-end">Current Balance</th>
                  <th className="text-center" style={{ width: '100px' }}>Status</th>
                  <th className="text-center pe-4" style={{ width: '130px' }}>Action</th>
                </tr>
              </thead>
              <tbody className="border-top-0">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-white-50">
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                      Loading account data from server...
                    </td>
                  </tr>
                ) : filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <tr
                      key={account.id}
                      id={`account-${account.id}`}
                      className={highlightId === String(account.id) ? 'table-warning' : ''}
                    >
                      <td className="ps-4">
                        <code className="text-info">{account.referenceNumber}</code>
                      </td>
                      <td className="fw-bold text-white">{account.accountName}</td>
                      <td>
                        <span className="badge bg-secondary text-light">{account.type}</span>
                      </td>
                      <td>
                        {account.role !== 'Default' ? (
                          <span className="badge bg-info text-dark">{account.role}</span>
                        ) : (
                          <span className="text-white-50 small">Standard</span>
                        )}
                      </td>
                      <td
                        className={`text-end fw-semibold ${
                          account.balance >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        Rp {account.balance.toLocaleString('en-US')}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${account.isActive ? 'bg-success' : 'bg-danger'}`}
                        >
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-center pe-4">
                        <div className="btn-group shadow-sm">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            title="Edit Account"
                            data-bs-toggle="modal"
                            data-bs-target="#editAccountModal"
                            onClick={() => openEditModal(account)}
                          >
                            <i className="ti ti-pencil"></i>
                          </button>
                          <Link
                            href={getLedgerUrl(account)}
                            className="btn btn-sm btn-outline-info"
                            title="View General Ledger"
                          >
                            <i className="ti ti-notebook"></i>
                          </Link>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
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
                    <td colSpan={7} className="text-center py-5 text-white-50">
                      <i className="ti ti-sitemap mb-3 d-block mx-auto text-white-50" style={{ fontSize: '2.5rem' }}></i>
                      No accounts found. Add a new account to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: ADD ACCOUNT */}
      <div className="modal fade" id="addAccountModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow bg-dark text-white border border-secondary border-opacity-25">
            <div className="modal-header border-bottom border-secondary border-opacity-25">
              <h5 className="modal-title fw-bold text-white d-flex align-items-center">
                <i className="ti ti-circle-plus me-2 text-warning fs-4"></i> Add New Account
              </h5>
              <button
                id="addAccountModalClose"
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body p-4">
                {createError && <div className="alert alert-danger py-2 small">{createError}</div>}

                <div className="mb-3">
                  <label className="form-label fw-semibold small text-white-50">Account Category</label>
                  <select
                    className="form-select bg-dark text-white border-secondary"
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

                <div className="mb-3">
                  <label className="form-label fw-semibold small text-white-50">
                    Reference Number (Account Code)
                  </label>
                  <input
                    type="number"
                    className="form-control bg-dark text-white border-secondary"
                    value={newAccount.referenceNumber || ''}
                    disabled={!newAccount.type}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, referenceNumber: Number(e.target.value) })
                    }
                    required
                  />
                  {newAccount.type ? (
                    <div className="form-text text-info d-flex align-items-center mt-1">
                      <i className="ti ti-info-circle me-1"></i> Valid range for this category:{' '}
                      <strong className="ms-1">
                        {ACCOUNT_RANGES[newAccount.type]?.start} -{' '}
                        {ACCOUNT_RANGES[newAccount.type]?.end}
                      </strong>
                    </div>
                  ) : (
                    <div className="form-text text-white-50">
                      Please select an account category to see the valid numbering range.
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small text-white-50">Account Name</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="e.g. Rent Expense"
                    value={newAccount.accountName || ''}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, accountName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small text-white-50">
                    System Role (Special Calculations)
                  </label>
                  <select
                    className="form-select bg-dark text-white border-secondary"
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
              <div className="modal-footer border-top border-secondary border-opacity-25 bg-dark">
                <button type="button" className="btn btn-outline-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary fw-semibold px-4">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL: EDIT ACCOUNT */}
      <div className="modal fade" id="editAccountModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow bg-dark text-white border border-secondary border-opacity-25">
            <div className="modal-header border-bottom border-secondary border-opacity-25">
              <h5 className="modal-title fw-bold text-white d-flex align-items-center">
                <i className="ti ti-edit me-2 text-warning fs-4"></i> Edit Account
              </h5>
              <button
                id="editAccountModalClose"
                type="button"
                className="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            {editAccount && (
              <form onSubmit={handleEdit}>
                <div className="modal-body p-4">
                  {editError && <div className="alert alert-danger py-2 small">{editError}</div>}

                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-white-50">Account Category</label>
                    <select
                      className="form-select bg-dark text-white border-secondary"
                      value={editAccount.type}
                      onChange={(e) =>
                        setEditAccount({ ...editAccount, type: e.target.value })
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

                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-white-50">
                      Reference Number (Account Code)
                    </label>
                    <input
                      type="number"
                      className="form-control bg-dark text-white border-secondary"
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
                      <div className="form-text text-info d-flex align-items-center mt-1">
                        <i className="ti ti-info-circle me-1"></i> Valid range for this category:{' '}
                        <strong className="ms-1">
                          {ACCOUNT_RANGES[editAccount.type]?.start} -{' '}
                          {ACCOUNT_RANGES[editAccount.type]?.end}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-white-50">Account Name</label>
                    <input
                      type="text"
                      className="form-control bg-dark text-white border-secondary"
                      value={editAccount.accountName}
                      onChange={(e) =>
                        setEditAccount({ ...editAccount, accountName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small text-white-50">
                      System Role (Special Calculations)
                    </label>
                    <select
                      className="form-select bg-dark text-white border-secondary"
                      value={editAccount.role}
                      onChange={(e) =>
                        setEditAccount({ ...editAccount, role: e.target.value })
                      }
                    >
                      <option value="Default">Standard / Default</option>
                      <option value="CashAndEquivalents">Cash &amp; Equivalents</option>
                      <option value="RetainedEarnings">Retained Earnings</option>
                      <option value="TaxPayable">Tax Payable</option>
                    </select>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="editIsActive"
                      checked={editAccount.isActive}
                      onChange={(e) =>
                        setEditAccount({ ...editAccount, isActive: e.target.checked })
                      }
                    />
                    <label className="form-check-label fw-semibold small text-white-50" htmlFor="editIsActive">
                      Active Account
                    </label>
                  </div>
                </div>
                <div className="modal-footer border-top border-secondary border-opacity-25 bg-dark">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-semibold px-4">
                    Update Account
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChartOfAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-5 my-5 text-white-50">
          <div className="spinner-border text-primary me-2" role="status"></div>
          <span>Loading chart of accounts...</span>
        </div>
      }
    >
      <ChartOfAccountsContent />
    </Suspense>
  );
}
