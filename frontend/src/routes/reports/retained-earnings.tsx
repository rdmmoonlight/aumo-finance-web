import { createFileRoute } from '@tanstack/react-router'
import RetainedEarningsPage from '@/pages/reports/RetainedEarningsPage'
export const Route = createFileRoute('/reports/retained-earnings')({ component: RetainedEarningsPage })
