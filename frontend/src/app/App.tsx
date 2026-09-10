// app/App.tsx - BOX MCB NYA
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';

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

// Reports - SEMUA DI DALAM /reports
import GeneralJournalPage from '@/pages/reports/GeneralJournalPage';
import AdjustingJournalPage from '@/pages/reports/AdjustingJournalPage';
import ClosingJournalPage from '@/pages/reports/ClosingJournalPage';
import PermanentLedgerPage from '@/pages/reports/PermanentLedgerPage';
import TemporaryLedgerPage from '@/pages/reports/TemporaryLedgerPage';
import UnadjustedTrialBalancePage from '@/pages/reports/UnadjustedTrialBalancePage';
import AdjustedTrialBalancePage from '@/pages/reports/AdjustedTrialBalancePage';
import PostClosingTrialBalancePage from '@/pages/reports/PostClosingTrialBalancePage';
import IncomeStatementPage from '@/pages/reports/IncomeStatementPage';
import RetainedEarningsPage from '@/pages/reports/RetainedEarningsPage';
import StatementOfFinancialPositionPage from '@/pages/reports/StatementOfFinancialPositionPage';
import StatementOfCashFlowPage from '@/pages/reports/StatementOfCashFlowPage';
import WorksheetPage from '@/pages/reports/WorksheetPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

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

          {/* Reports */}
          <Route path="/reports/general-journal" element={<GeneralJournalPage />} />
          <Route path="/reports/adjusting-journal" element={<AdjustingJournalPage />} />
          <Route path="/reports/closing-journal" element={<ClosingJournalPage />} />

          {/* Ledger tetap 2 page */}
          <Route path="/reports/general-ledger/permanent" element={<PermanentLedgerPage />} />
          <Route path="/reports/general-ledger/temporary" element={<TemporaryLedgerPage />} />

          {/* Trial Balance tetap 3 jenis */}
          <Route path="/reports/trial-balance/unadjusted" element={<UnadjustedTrialBalancePage />} />
          <Route path="/reports/trial-balance/adjusted" element={<AdjustedTrialBalancePage />} />
          <Route path="/reports/trial-balance/post-closing" element={<PostClosingTrialBalancePage />} />

          <Route path="/reports/income-statement" element={<IncomeStatementPage />} />
          <Route path="/reports/retained-earnings" element={<RetainedEarningsPage />} />
          <Route path="/reports/statement-of-financial-position" element={<StatementOfFinancialPositionPage />} />
          <Route path="/reports/statement-of-cash-flow" element={<StatementOfCashFlowPage />} />
          <Route path="/reports/worksheet" element={<WorksheetPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}