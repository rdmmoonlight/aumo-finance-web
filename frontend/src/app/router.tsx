import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layout Import
import AppLayout from '@/components/layout/AppLayout';

// Direct Page Imports
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

// Reports Page Imports
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

export default function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Public Route */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected App Routes (Wrapped inside AppLayout) */}
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

          {/* Reports Sub-routes */}
          <Route path="/reports">
            <Route path="general-journal" element={<GeneralJournalPage />} />
            <Route path="adjusting-journal" element={<AdjustingJournalPage />} />
            <Route path="closing-journal" element={<ClosingJournalPage />} />
            <Route path="general-ledger/permanent" element={<PermanentLedgerPage />} />
            <Route path="general-ledger/temporary" element={<TemporaryLedgerPage />} />
            <Route path="income-statement" element={<IncomeStatementPage />} />
            <Route path="retained-earnings" element={<RetainedEarningsPage />} />
            <Route path="statement-of-cash-flow" element={<StatementOfCashFlowPage />} />
            <Route path="statement-of-financial-position" element={<StatementOfFinancialPositionPage />} />
            <Route path="trial-balance/unadjusted" element={<UnadjustedTrialBalancePage />} />
            <Route path="trial-balance/adjusted" element={<AdjustedTrialBalancePage />} />
            <Route path="trial-balance/post-closing" element={<PostClosingTrialBalancePage />} />
            <Route path="worksheet" element={<WorksheetPage />} />
          </Route>
        </Route>

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}