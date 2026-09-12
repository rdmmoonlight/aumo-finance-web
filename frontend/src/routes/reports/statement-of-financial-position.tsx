import { createFileRoute } from '@tanstack/react-router'
import StatementOfFinancialPositionPage from '@/pages/reports/StatementOfFinancialPositionPage'
export const Route = createFileRoute('/reports/statement-of-financial-position')({ component: StatementOfFinancialPositionPage })
