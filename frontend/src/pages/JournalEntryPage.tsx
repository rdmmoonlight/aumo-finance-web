import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconEdit,
  IconNotebook,
  IconArrowLeft,
  IconCircleCheck,
  IconAlertTriangle,
  IconLock,
  IconHash,
  IconCategory,
  IconCalendar,
  IconListDetails,
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconLoader2,
} from '@tabler/icons-react';

import apiClient from '@/services/apiClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Data Model Interfaces
export interface ChartOfAccountOption {
  id: number;
  referenceNumber: number;
  accountName: string;
}

export interface LineItem {
  id: string; // Unique temporary ID for list keys
  accountId: number;
  lineDescription: string;
  debit: string; // Stored as formatted string for text input (e.g. "1.000.000")
  credit: string;
  suggestions: string[];
  showSuggestions: boolean;
}

// Helpers Format Angka
const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

// Format angka mentah/string ke format berpemisah titik
const formatNumberWithDots = (val: string | number): string => {
  if (val === '' || val === null || val === undefined) return '';
  const cleanStr = val.toString().replace(/\D/g, '');
  if (!cleanStr) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(cleanStr, 10));
};

// Mengubah format string berpemisah titik kembali ke number murni
const parseFormattedNumber = (val: string): number => {
  if (!val) return 0;
  const cleanStr = val.replace(/\D/g, '');
  return cleanStr ? parseInt(cleanStr, 10) : 0;
};

// Helper Generate Next Transaction Number (Format: PREFIX + YYMM + 0001)
const generateTxNumber = (journalType: string, dateStr: string): string => {
  const prefix = journalType === 'Adjusting' ? 'AJ' : 'GJ';
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const yy = dateObj.getFullYear().toString().slice(-2);
  const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  return `${prefix}${yy}${mm}0001`;
};

function JournalEntryContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entryIdParam = searchParams.get('id');
  const isEdit = Boolean(entryIdParam);

  // Form State Metadata
  const [journalType, setJournalType] = useState<string>('General');
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [transactionNumber, setTransactionNumber] = useState<string>('');
  const [availableAccounts, setAvailableAccounts] = useState<ChartOfAccountOption[]>([]);

  // Lines State
  const [lines, setLines] = useState<LineItem[]>([]);

  // Alert & Lock Message States
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const resetForm = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    setJournalType('General');
    setEntryDate(defaultDate);
    setTransactionNumber(generateTxNumber('General', defaultDate));
    setLines([
      {
        id: Date.now().toString() + '-1',
        accountId: 0,
        lineDescription: '',
        debit: '',
        credit: '',
        suggestions: [],
        showSuggestions: false,
      },
      {
        id: Date.now().toString() + '-2',
        accountId: 0,
        lineDescription: '',
        debit: '',
        credit: '',
        suggestions: [],
        showSuggestions: false,
      },
    ]);
    setValidationErrors([]);
    setSuccessMessage(null);
  };

  // Auto Generate Nomor Transaksi jika bukan mode edit
  useEffect(() => {
    if (!isEdit) {
      setTransactionNumber(generateTxNumber(journalType, entryDate));
    }
  }, [journalType, entryDate, isEdit]);

  // Data Initialization: Fetch Accounts & Journal Entry
  useEffect(() => {
    const initPage = async () => {
      setLoading(true);
      try {
        // 1. Fetch Chart of Accounts
        const accountsRes = await apiClient.get('/api/v1/chart-of-accounts');

        if (accountsRes.status === 200) {
          const rawAccounts = accountsRes.data;
          const accountsData = Array.isArray(rawAccounts)
            ? rawAccounts
            : Array.isArray(rawAccounts?.data)
            ? rawAccounts.data
            : Array.isArray(rawAccounts?.accounts)
            ? rawAccounts.accounts
            : [];

          setAvailableAccounts(
            accountsData.map((acc: any) => ({
              id: acc.id,
              referenceNumber: acc.referenceNumber,
              accountName: acc.accountName,
            }))
          );
        }

        // 2. Fetch data jika Edit Mode
        if (isEdit && entryIdParam) {
          const journalRes = await apiClient.get(`/api/v1/journals/${entryIdParam}`);

          if (journalRes.status !== 200) {
            throw new Error('Failed to retrieve journal entry data from the server.');
          }

          const journalData = journalRes.data;

          if (journalData.isClosedPeriod) {
            setLockedMessage(
              `Journal entry ${journalData.transactionNumber} belongs to a closed period and cannot be edited. View it from the Periods page instead.`
            );
          } else {
            setTransactionNumber(journalData.transactionNumber);
            setJournalType(journalData.journalType || 'General');
            setEntryDate(
              journalData.entryDate
                ? journalData.entryDate.split('T')[0]
                : new Date().toISOString().split('T')[0]
            );

            const rawLines = Array.isArray(journalData.lines) ? journalData.lines : [];
            if (rawLines.length > 0) {
              setLines(
                rawLines.map((l: any, idx: number) => ({
                  id: l.id ? l.id.toString() : `${Date.now()}-${idx}`,
                  accountId: l.accountId,
                  lineDescription: l.lineDescription || '',
                  debit: l.debit > 0 ? formatNumberWithDots(l.debit) : '',
                  credit: l.credit > 0 ? formatNumberWithDots(l.credit) : '',
                  suggestions: [],
                  showSuggestions: false,
                }))
              );
            }
          }
        } else {
          resetForm();
        }
      } catch (err: any) {
        setValidationErrors([err?.response?.data?.message || err.message || 'Failed to load data from the server.']);
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [isEdit, entryIdParam]);

  // Total Debit & Credit Calculation
  const totalDebit = useMemo(() => {
    return lines.reduce((sum, line) => sum + parseFormattedNumber(line.debit), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce((sum, line) => sum + parseFormattedNumber(line.credit), 0);
  }, [lines]);

  const isBalanced = useMemo(() => {
    return totalDebit > 0 && totalCredit > 0 && totalDebit === totalCredit;
  }, [totalDebit, totalCredit]);

  // Line Items Management Handlers
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        accountId: 0,
        lineDescription: '',
        debit: '',
        credit: '',
        suggestions: [],
        showSuggestions: false,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      alert('A journal entry must have at least two line items (Debit & Credit).');
      return;
    }
    setLines((prev) => prev.filter((line) => line.id !== id));
  };

  const updateLineField = (id: string, field: keyof LineItem, value: any) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        // Auto Clear debit/credit yang berseberangan
        if (field === 'debit' && value !== '') {
          return { ...line, debit: formatNumberWithDots(value), credit: '' };
        }
        if (field === 'credit' && value !== '') {
          return { ...line, credit: formatNumberWithDots(value), debit: '' };
        }

        return { ...line, [field]: value };
      })
    );
  };

  // Description Search Autocomplete
  const handleDescriptionInput = (id: string, text: string) => {
    updateLineField(id, 'lineDescription', text);

    if (text.trim().length < 2) {
      setLines((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, showSuggestions: false, suggestions: [] } : l
        )
      );
      return;
    }

    const historicalNotes = [
      'Payroll Disbursement',
      'Office Rent Payment',
      'Accounts Receivable Collection',
      'Supplies Purchase',
      'Owner Capital Contribution',
    ];

    const filtered = historicalNotes.filter((n) =>
      n.toLowerCase().includes(text.toLowerCase())
    );

    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, suggestions: filtered, showSuggestions: filtered.length > 0 }
          : l
      )
    );
  };

  const selectSuggestion = (id: string, suggestionText: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, lineDescription: suggestionText, showSuggestions: false }
          : l
      )
    );
  };

  // Submit Journal Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setSuccessMessage(null);

    const errors: string[] = [];

    const effectiveLines = lines.filter(
      (l) =>
        l.accountId !== 0 &&
        (parseFormattedNumber(l.debit) > 0 || parseFormattedNumber(l.credit) > 0)
    );

    if (effectiveLines.length < 2) {
      errors.push(
        'A journal entry must have at least two valid line items with accounts and amounts.'
      );
    }

    if (!isBalanced) {
      errors.push('Total debit must equal total credit before posting.');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const payload = {
        journalType,
        entryDate,
        transactionNumber,
        lines: effectiveLines.map((l) => ({
          accountId: l.accountId,
          lineDescription: l.lineDescription,
          debit: parseFormattedNumber(l.debit),
          credit: parseFormattedNumber(l.credit),
        })),
      };

      const endpoint = isEdit ? `/api/v1/journals/${entryIdParam}` : '/api/v1/journals';
      const response = isEdit
        ? await apiClient.put(endpoint, payload)
        : await apiClient.post(endpoint, payload);

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data?.message || 'Failed to save journal transaction to server.');
      }

      const result = response.data;

      if (isEdit) {
        setSuccessMessage(`Journal entry ${transactionNumber} has been updated.`);
        setTimeout(() => {
          navigate('/reports/general-journal');
        }, 1200);
      } else {
        const postedTxNum = result.transactionNumber || transactionNumber;
        setSuccessMessage(`Journal entry ${postedTxNum} has been posted successfully.`);
        resetForm();
      }
    } catch (err: any) {
      setValidationErrors([
        err?.response?.data?.message || err.message || 'An error occurred while processing the journal entry.',
      ]);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">Loading journal data from server...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {isEdit ? (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <IconEdit className="text-amber-500 h-7 w-7" /> Edit Journal Entry
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-muted-foreground border">
                  {transactionNumber}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Update this double-entry transaction for Aumo Finance.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <IconNotebook className="text-amber-500 h-7 w-7" /> Create Journal Entry
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Record double-entry financial transactions or adjusting entries for Aumo Finance.
              </p>
            </>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/reports/general-journal" className="flex items-center gap-1.5">
            <IconArrowLeft size={16} /> Back to Journal
          </Link>
        </Button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <IconCircleCheck className="h-5 w-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            className="text-emerald-400 hover:opacity-75 font-semibold text-xs"
            onClick={() => setSuccessMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          <div className="flex items-start gap-2">
            <IconAlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <ul className="list-disc list-inside space-y-1 font-medium">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {lockedMessage ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-amber-300 flex items-center gap-2 text-sm">
          <IconLock className="h-5 w-5 shrink-0" />
          <span>{lockedMessage}</span>
          <Link to="/reports/general-journal" className="underline hover:text-amber-100 font-medium ml-1">
            Back to General Journal
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Header Metadata */}
          <div className="rounded-xl border bg-card p-5 shadow-sm text-card-foreground">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Transaction Number Input */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <IconHash size={14} /> Transaction No.
                </label>
                <input
                  type="text"
                  className="w-full h-9 px-3 rounded-md border bg-muted text-foreground text-xs font-semibold focus:outline-none"
                  value={transactionNumber}
                  readOnly
                  tabIndex={-1}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <IconCategory size={14} /> Journal Type
                </label>
                <select
                  className="w-full h-9 px-3 rounded-md border bg-background text-foreground text-xs font-semibold focus:ring-1 focus:ring-ring focus:outline-none"
                  value={journalType}
                  onChange={(e) => setJournalType(e.target.value)}
                >
                  <option value="General">General Journal (GJ)</option>
                  <option value="Adjusting">Adjusting Entry (AJ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <IconCalendar size={14} /> Transaction Date
                </label>
                <input
                  type="date"
                  className="w-full h-9 px-3 rounded-md border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Journal Lines Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <IconListDetails className="text-amber-500 h-5 w-5" /> Journal Lines
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1 text-xs">
                <IconPlus size={14} /> Add Line
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="py-3 px-4 w-[10%]">Ref No.</th>
                    <th className="py-3 px-4 w-[25%]">Account Name</th>
                    <th className="py-3 px-4 w-[25%]">Description</th>
                    <th className="py-3 px-4 w-[15%] text-right">Debit</th>
                    <th className="py-3 px-4 w-[15%] text-right">Credit</th>
                    <th className="py-3 px-4 w-[10%] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b">
                  {lines.map((line) => {
                    const accountRef = availableAccounts.find(
                      (a) => a.id === line.accountId
                    )?.referenceNumber;

                    return (
                      <tr key={line.id} className="hover:bg-muted/30">
                        {/* Ref No. */}
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            className="w-full h-8 px-2 text-center rounded border bg-muted text-info text-xs focus:outline-none"
                            readOnly
                            tabIndex={-1}
                            placeholder="---"
                            value={accountRef ? accountRef.toString() : ''}
                          />
                        </td>

                        {/* Account Selection */}
                        <td className="py-2 px-4">
                          <select
                            className="w-full h-8 px-2 rounded border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                            value={line.accountId}
                            onChange={(e) =>
                              updateLineField(line.id, 'accountId', Number(e.target.value))
                            }
                          >
                            <option value={0} disabled>
                              Select Account...
                            </option>
                            {availableAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.referenceNumber} - {acc.accountName}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="py-2 px-4 relative">
                          <input
                            type="text"
                            className="w-full h-8 px-2 rounded border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                            placeholder="Note..."
                            autoComplete="off"
                            value={line.lineDescription}
                            onChange={(e) => handleDescriptionInput(line.id, e.target.value)}
                            onBlur={() => {
                              setTimeout(
                                () => updateLineField(line.id, 'showSuggestions', false),
                                200
                              );
                            }}
                          />
                          {line.showSuggestions && line.suggestions.length > 0 && (
                            <div className="absolute z-10 left-4 right-4 top-11 rounded-md border bg-popover shadow-md overflow-hidden">
                              {line.suggestions.map((suggestion, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground text-foreground border-b last:border-0"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectSuggestion(line.id, suggestion);
                                  }}
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Debit Input */}
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-full h-8 px-2 text-right rounded border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                            placeholder="0"
                            value={line.debit}
                            onChange={(e) => updateLineField(line.id, 'debit', e.target.value)}
                          />
                        </td>

                        {/* Credit Input */}
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-full h-8 px-2 text-right rounded border bg-background text-foreground text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                            placeholder="0"
                            value={line.credit}
                            onChange={(e) => updateLineField(line.id, 'credit', e.target.value)}
                          />
                        </td>

                        {/* Remove Line Action */}
                        <td className="py-2 px-4 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeLine(line.id)}
                          >
                            <IconTrash size={16} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/20 font-semibold text-xs">
                  <tr className="border-b">
                    <td colSpan={3} className="py-3 px-4 text-right">
                      Total Balance:
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400">
                      Rp {formatIDR(totalDebit)}
                    </td>
                    <td className="py-3 px-4 text-right text-red-400">
                      Rp {formatIDR(totalCredit)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right">
                      Status:
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-center">
                      {isBalanced ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                          <IconCircleCheck size={14} /> Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                          <IconAlertTriangle size={14} /> Unbalanced (Rp{' '}
                          {formatIDR(Math.abs(totalDebit - totalCredit))})
                        </span>
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Form Controls */}
          <div className="flex justify-end gap-3">
            {isEdit ? (
              <Button variant="outline" asChild>
                <Link to="/reports/general-journal">Cancel</Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset Form
              </Button>
            )}
            <Button
              type="submit"
              disabled={!isBalanced}
              className="gap-2"
            >
              <IconDeviceFloppy size={16} />
              {isEdit ? 'Save Changes' : 'Post Journal Entry'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function JournalEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <IconLoader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">Loading journal entry page...</span>
        </div>
      }
    >
      <JournalEntryContent />
    </Suspense>
  );
}
