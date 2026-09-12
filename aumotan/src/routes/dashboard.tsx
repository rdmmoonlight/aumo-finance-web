import { createFileRoute } from '@tanstack/react-router'
import DashboardPage from '@/pages/DashboardPage'

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  component: DashboardPage,
})
