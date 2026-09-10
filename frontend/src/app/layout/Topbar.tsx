import React from "react"
import { useLocation, useNavigate, Link } from "react-router-dom"
import { IconLogout } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export default function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()

  // Memecah pathname menjadi array breadcrumb item
  const pathSegments = location.pathname.split("/").filter(Boolean)

  const handleLogout = () => {
    // Navigasi ke halaman auth saat logout
    navigate("/auth")
  }

  return (
    <header className="h-16 border-b bg-background px-6 flex items-center justify-between text-foreground">
      {/* Dynamic Breadcrumb / Current Location */}
      <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm font-medium">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground transition-colors capitalize"
        >
          Home
        </Link>
        {pathSegments.map((segment, index) => {
          const url = `/${pathSegments.slice(0, index + 1).join("/")}`
          const isLast = index === pathSegments.length - 1
          const title = segment.replace(/-/g, " ")

          return (
            <React.Fragment key={url}>
              <span className="text-muted-foreground/60">/</span>
              {isLast ? (
                <span className="font-semibold text-foreground capitalize">
                  {title}
                </span>
              ) : (
                <Link
                  to={url}
                  className="text-muted-foreground hover:text-foreground transition-colors capitalize"
                >
                  {title}
                </Link>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
        >
          <IconLogout size={16} />
          <span>Logout</span>
        </Button>
      </div>
    </header>
  )
}