import { createFileRoute } from '@tanstack/react-router'
import TrialBalancePage from '@/pages/reports/TrialBalancePage'
export const Route = createFileRoute('/reports/trial-balance')({ component: TrialBalancePage })
