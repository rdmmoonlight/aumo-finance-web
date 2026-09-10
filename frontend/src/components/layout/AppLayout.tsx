import React from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  IconLayoutDashboard,
  IconListDetails,
  IconFilePencil,
  IconCalendarTime,
  IconRobot,
  IconShieldCheck,
  IconTools,
  IconSettings,
  IconBook,
  IconFileCheck,
  IconLock,
  IconNotebook,
  IconScale,
  IconReceipt2,
  IconPigMoney,
  IconBuildingBank,
  IconCash,
  IconTable,
  IconBuildingStore,
  IconScaleOff,
  IconLogout,
} from '@tabler/icons-react';

import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import "@/styles/index.css";

// ==========================================
// 1. SIDEBAR COMPONENT & TYPES
// ==========================================

interface MenuItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const mainNavItems: MenuItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: IconLayoutDashboard },
  { label: 'Chart of Accounts', path: '/chart-of-accounts', icon: IconListDetails },
  { label: 'Journal Entry', path: '/journal-entry', icon: IconFilePencil },
  { label: 'Periods', path: '/periods', icon: IconCalendarTime },
  { label: 'AI Assistant', path: '/ai-assistant', icon: IconRobot },
  { label: 'Guardian', path: '/guardian', icon: IconShieldCheck },
  { label: 'Tools', path: '/tools', icon: IconTools },
  { label: 'Settings', path: '/settings', icon: IconSettings },
];

const reportNavItems: MenuItem[] = [
  { label: 'General Journal', path: '/reports/general-journal', icon: IconBook },
  { label: 'Adjusting Journal', path: '/reports/adjusting-journal', icon: IconFileCheck },
  { label: 'Closing Journal', path: '/reports/closing-journal', icon: IconLock },
  { label: 'Permanent Ledger', path: '/reports/general-ledger/permanent', icon: IconNotebook },
  { label: 'Temporary Ledger', path: '/reports/general-ledger/temporary', icon: IconNotebook },
  { label: 'Unadjusted Trial Balance', path: '/reports/trial-balance/unadjusted', icon: IconScale },
  { label: 'Adjusted Trial Balance', path: '/reports/trial-balance/adjusted', icon: IconScaleOff },
  { label: 'Post-Closing Trial Balance', path: '/reports/trial-balance/post-closing', icon: IconReceipt2 },
  { label: 'Income Statement', path: '/reports/income-statement', icon: IconPigMoney },
  { label: 'Retained Earnings', path: '/reports/retained-earnings', icon: IconBuildingBank },
  { label: 'Financial Position', path: '/reports/statement-of-financial-position', icon: IconBuildingStore },
  { label: 'Cash Flow', path: '/reports/statement-of-cash-flow', icon: IconCash },
  { label: 'Worksheet', path: '/reports/worksheet', icon: IconTable },
];

function NavItemLink({ item }: { item: MenuItem }) {
  const Icon = item.icon;

  return (
    <li>
      <NavLink to={item.path} className="block">
        {({ isActive }) => (
          <Button
            asChild
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'w-full justify-start gap-3 px-3 font-normal text-xs transition-colors',
              isActive
                ? 'bg-secondary text-secondary-foreground font-medium shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <div>
              <Icon
                size={18}
                className={cn(
                  'shrink-0 transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
                stroke={1.8}
              />
              <span className="truncate">{item.label}</span>
            </div>
          </Button>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col h-screen font-sans antialiased shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
          A
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground text-sm tracking-wide leading-none">
            Aumo Finance
          </span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase mt-1">
            Accounting Suite
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {/* Main Domain Group */}
          <div>
            <h2 className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Main Domain
            </h2>
            <ul className="space-y-1">
              {mainNavItems.map((item) => (
                <NavItemLink key={item.path} item={item} />
              ))}
            </ul>
          </div>

          {/* Reports & Statements Group */}
          <div>
            <h2 className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Reports & Statements
            </h2>
            <ul className="space-y-1">
              {reportNavItems.map((item) => (
                <NavItemLink key={item.path} item={item} />
              ))}
            </ul>
          </div>
        </nav>
      </ScrollArea>
    </aside>
  );
}

// ==========================================
// 2. TOPBAR COMPONENT
// ==========================================

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Memecah pathname menjadi array breadcrumb item
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const handleLogout = () => {
    navigate("/auth");
  };

  return (
    <header className="h-16 border-b bg-background px-6 flex items-center justify-between text-foreground shrink-0">
      {/* Dynamic Breadcrumb Shadcn */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {pathSegments.map((segment, index) => {
            const url = `/${pathSegments.slice(0, index + 1).join("/")}`;
            const isLast = index === pathSegments.length - 1;
            const title = segment.replace(/-/g, " ");

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
            );
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
  );
}

// ==========================================
// 3. MAIN APP LAYOUT (DEFAULT EXPORT)
// ==========================================

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar />

        {/* Main Workspace Area with Shadcn ScrollArea */}
        <ScrollArea className="flex-1 bg-muted/30">
          <main className="p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <Outlet />
            </div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
