import { createFileRoute } from '@tanstack/react-router'
import ClosingJournalPage from '@/pages/reports/ClosingJournalPage'
export const Route = createFileRoute('/reports/closing-journal')({ component: ClosingJournalPage })
