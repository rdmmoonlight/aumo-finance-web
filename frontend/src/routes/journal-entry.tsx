import { createFileRoute } from '@tanstack/react-router'
import JournalEntryPage from '@/pages/JournalEntryPage'
export const Route = createFileRoute('/journal-entry')({ component: JournalEntryPage })
