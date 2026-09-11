import { createFileRoute } from '@tanstack/react-router'
import GeneralJournalPage from '@/pages/reports/GeneralJournalPage'
export const Route = createFileRoute('/reports/general-journal')({ component: GeneralJournalPage })
