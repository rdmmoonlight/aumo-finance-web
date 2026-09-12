import { createFileRoute } from '@tanstack/react-router'
import GuardianPage from '@/pages/GuardianPage'
export const Route = createFileRoute('/guardian')({ component: GuardianPage })
