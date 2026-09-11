import { Outlet, useLocation, useNavigate, Link } from '@tanstack/react-router';
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
  IconChevronRight,
} from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

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
  return (
    <Link to={item.path} className="block">
      {({ isActive }: { isActive: boolean }) => (
        <div
          className={cn(
            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
             ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <item.icon size={18} stroke={1.8} className="shrink-0" />
          <span className="truncate">{item.label}</span>
        </div>
      )}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen shrink-0">
      <div className="h-16 px-5 border-b flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold shadow-sm">
          A
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm leading-none tracking-tight">Aumo Finance</span>
          <span className="text- text-muted-foreground uppercase tracking-widest font-semibold">
            Accounting Suite
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-4 space-y-6">
          <div>
            <h2 className="px-3 mb-2 text- font-bold text-muted-foreground/70 uppercase tracking-widest">
              Main Domain
            </h2>
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <NavItemLink key={item.path} item={item} />
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <h2 className="px-3 mb-2 text- font-bold text-muted-foreground/70 uppercase tracking-widest">
              Reports & Statements
            </h2>
            <div className="space-y-1">
              {reportNavItems.map((item) => (
                <NavItemLink key={item.path} item={item} />
              ))}
            </div>
          </div>
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </aside>
  );
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <header className="h-16 border-b bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {pathSegments.map((seg, i) => {
            const url = `/${pathSegments.slice(0, i + 1).join('/')}`;
            const isLast = i === pathSegments.length - 1;
            return (
              <div key={url} className="contents">
                <BreadcrumbSeparator>
                  <IconChevronRight size={14} />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {isLast? (
                    <BreadcrumbPage className="capitalize">{seg.replace(/-/g, ' ')}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={url} className="capitalize">
                        {seg.replace(/-/g, ' ')}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="hidden sm:flex gap-2 font-mono text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Ghofur
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/auth' })} className="h-8 gap-1.5 text-xs">
          <IconLogout size={15} />
          Logout
        </Button>
      </div>
    </header>
  );
}

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/20">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <ScrollArea className="flex-1">
          <main className="p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    </div>
  );
}