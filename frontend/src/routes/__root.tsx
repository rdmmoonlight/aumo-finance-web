import { useState, useEffect } from 'react'
import {
  createRootRoute,
  Outlet,
  useLocation,
  useNavigate,
  Link,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import appCss from '../styles/index.css?url'
import apiClient from '@/services/apiClient'
import { IconLoader2 } from '@tabler/icons-react'

function NotFoundComponent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">Halaman tidak ditemukan.</p>
      <Link to="/dashboard" className="text-xs underline text-primary">
        Kembali ke Dashboard
      </Link>
    </div>
  )
}

function RootComponent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  const isAuthPage = location.pathname === '/auth'

  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      try {
        // Cek sesi/auth pengguna ke backend
        await apiClient.get('/api/v1/auth/me')
        if (isMounted) setIsAuthenticated(true)
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false)
          // Jika tidak di halaman login dan gagal auth, langsung tendang ke /auth
          if (!isAuthPage) {
            navigate({ to: '/auth' })
          }
        }
      }
    }

    checkAuth()
    return () => {
      isMounted = false
    }
  }, [location.pathname, isAuthPage, navigate])

  // Tampilkan layar loading sebentar saat mengecek autentikasi (mencegah flicker UI)
  if (isAuthenticated === null && !isAuthPage) {
    return (
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body className="antialiased grid place-items-center h-screen bg-background text-foreground">
          <div className="flex flex-col items-center gap-2">
            <IconLoader2 className="animate-spin text-primary" size={32} />
            <span className="text-xs text-muted-foreground font-medium">Memeriksa autentikasi...</span>
          </div>
          <Scripts />
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {/* Render halaman auth atau layout utama di dalam Outlet */}
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Aumo Finance' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
})
    
