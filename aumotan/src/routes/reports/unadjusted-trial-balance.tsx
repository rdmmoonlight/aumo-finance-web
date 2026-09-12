import { createFileRoute } from '@tanstack/react-router'
import UnadjustedTrialBalancePage from '@/pages/reports/UnadjustedTrialBalancePage'
export const Route = createFileRoute('/reports/unadjusted-trial-balance')({ component: UnadjustedTrialBalancePage })
