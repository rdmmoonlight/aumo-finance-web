import { createFileRoute } from '@tanstack/react-router'
import IncomeStatementPage from '@/pages/reports/IncomeStatementPage'
export const Route = createFileRoute('/reports/income-statement')({ component: IncomeStatementPage })
