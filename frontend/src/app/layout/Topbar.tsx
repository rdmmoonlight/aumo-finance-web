import React from "react"
import { useLocation, useNavigate, Link } from "react-router-dom"
import { IconLogout } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()

  // Memecah pathname menjadi array breadcrumb item
  const pathSegments = location.pathname.split("/").filter(Boolean)

  const handleLogout = () => {
    navigate("/auth")
  }

  return (
    <header className="h-16 border-b bg-background px-6 flex items-center justify-between text-foreground">
      {/* Dynamic Breadcrumb Shadcn */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {pathSegments.map((segment, index) => {
            const url = `/${pathSegments.slice(0, index + 1).join("/")}`
            const isLast = index === pathSegments.length - 1
            const title = segment.replace(/-/g, " ")

            return (
              <React.Fragment key={url}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="capitalize font-semibold">
                      {title}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={url} className="capitalize">
                        {title}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

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