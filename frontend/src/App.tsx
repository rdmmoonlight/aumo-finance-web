// app/App.tsx - INI BOX MCB NYA
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// LAYOUT - Temboknya
import AppLayout from '@/components/layout/AppLayout';

// HALAMAN
import HomePage from '@/pages/HomePage';
import AuthPage from '@/pages/AuthPage';
import AIAssistantPage from '@/pages/AIAssistantPage';
import DashboardPage from '@/pages/DashboardPage';
import GuardianPage from '@/pages/GuardianPage';
import ChartOfAccountsPage from '@/pages/ChartOfAccountsPage';
import JournalEntryPage from '@/pages/JournalEntryPage';
import PeriodsPage from '@/pages/PeriodsPage';
import SettingsPage from '@/pages/SettingsPage';
import ToolsPage from '@/pages/ToolsPage';

// Reports
import AdjustingJournalPage from '@/pages/reports/adjusting-journal/AdjustingJournalPage';
import ClosingJournalPage from '@/pages/reports/closing-journal/ClosingJournalPage';
import GeneralJournalPage from '@/pages/reports/general-journal/GeneralJournalPage';
import PermanentLedgerPage from '@/pages/reports/general-ledger/permanent/PermanentLedgerPage';
import TemporaryLedgerPage from '@/pages/reports/general-ledger/temporary/TemporaryLedgerPage';
import IncomeStatementPage from '@/pages/reports/income-statement/IncomeStatementPage';
import RetainedEarningsPage from '@/pages/reports/retained-earnings/RetainedEarningsPage';
import StatementOfCashFlowPage from '@/pages/reports/statement-of-cash-flow/StatementOfCashFlowPage';
import StatementOfFinancialPositionPage from '@/pages/reports/statement-of-financial-position/StatementOfFinancialPositionPage';
import AdjustedTrialBalancePage from '@/pages/reports/trial-balance/adjusted/AdjustedTrialBalancePage';
import PostClosingTrialBalancePage from '@/pages/reports/trial-balance/post-closing/PostClosingTrialBalancePage';
import UnadjustedTrialBalancePage from '@/pages/reports/trial-balance/unadjusted/UnadjustedTrialBalancePage';
import WorksheetPage from '@/pages/reports/worksheet/WorksheetPage';

export default function App() {
  return (
    // MCB UTAMA: Router
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* MCB 1: Jalur Public - tanpa tembok */}
        <Route path="/auth" element={<AuthPage />} />

        {/* MCB 2: Jalur Private - semua lewat tembok AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ai-assistant" element={<AIAssistantPage />} />
          <Route path="/guardian" element={<GuardianPage />} />
          <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="/journal-entry" element={<JournalEntryPage />} />
          <Route path="/periods" element={<PeriodsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/tools" element={<ToolsPage />} />

          {/* Laporan */}
          <Route path="/reports/general-journal" element={<GeneralJournalPage />} />
          <Route path="/reports/adjusting-journal" element={<AdjustingJournalPage />} />
          <Route path="/reports/closing-journal" element={<ClosingJournalPage />} />
          <Route path="/reports/general-ledger/permanent" element={<PermanentLedgerPage />} />
          <Route path="/reports/general-ledger/temporary" element={<TemporaryLedgerPage />} />
          <Route path="/reports/income-statement" element={<IncomeStatementPage />} />
          <Route path="/reports/retained-earnings" element={<RetainedEarningsPage />} />
          <Route path="/reports/statement-of-cash-flow" element={<StatementOfCashFlowPage />} />
          <Route path="/reports/statement-of-financial-position" element={<StatementOfFinancialPositionPage />} />
          <Route path="/reports/trial-balance/unadjusted" element={<UnadjustedTrialBalancePage />} />
          <Route path="/reports/trial-balance/adjusted" element={<AdjustedTrialBalancePage />} />
          <Route path="/reports/trial-balance/post-closing" element={<PostClosingTrialBalancePage />} />
          <Route path="/reports/worksheet" element={<WorksheetPage />} />
        </Route>

        {/* MCB Pengaman: kalau salah ketik url, lempar ke home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
