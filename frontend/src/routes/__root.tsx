import { useState, useEffect } from 'react';
import { createRootRoute, Outlet, useLocation, useNavigate, Link, HeadContent, Scripts } from '@tanstack/react-router';
import appCss from '../styles/index.css?url';
import {
  IconLayoutDashboard, IconListDetails, IconFilePencil, IconCalendarTime, IconRobot, IconShieldCheck,
  IconTools, IconSettings, IconBook, IconFileCheck, IconLock, IconNotebook, IconScale, IconReceipt2,
  IconPigMoney, IconBuildingBank, IconCash, IconTable, IconBuildingStore, IconScaleOff, IconLogout, IconChevronRight,
  IconLoader2
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import apiClient from '@/services/apiClient';

interface MenuItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

interface UserProfile {
  userId: string;
  email: string;
  userName: string;
  fullName: string;
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
        <div className={cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}>
          <item.icon size={18} stroke={1.8} className="shrink-0" />
          <span className="truncate">{item.label}</span>
        </div>
      )}
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen shrink-0 overflow-hidden">
      <div className="h-16 px-5 border-b flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold shadow-sm">A</div>
        <div className="flex flex-col">
          <span className="font-bold text-sm leading-none tracking-tight">Aumo Finance</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Accounting Suite</span>
        </div>
      </div>
      
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <h2 className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Main Domain</h2>
          <div className="space-y-1">
            {mainNavItems.map((item) => <NavItemLink key={item.path} item={item} />)}
          </div>
        </div>
        <Separator />
        <div>
          <h2 className="px-3 mb-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Reports & Statements</h2>
          <div className="space-y-1">
            {reportNavItems.map((item) => <NavItemLink key={item.path} item={item} />)}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchUserProfile() {
      try {
        // Panggil GET /api/v1/auth/me via apiClient
        const res = await apiClient.get('/api/v1/auth/me');
        if (isMounted && res.data) {
          setUser(res.data);
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchUserProfile();
    return () => { isMounted = false; };
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await apiClient.post('/api/v1/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Hapus token lokal jika disimpan di localStorage / cookie
      localStorage.removeItem('token');
      sessionStorage.clear();
      setLoggingOut(false);
      navigate({ to: '/auth' });
    }
  };

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
                  {isLast ? (
                    <BreadcrumbPage className="capitalize">{seg.replace(/-/g, ' ')}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={url} className="capitalize">{seg.replace(/-/g, ' ')}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="hidden sm:flex gap-2 font-mono text-xs py-1 px-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {loading ? 'Loading...' : (user?.fullName || user?.userName || 'User')}
        </Badge>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout} 
          disabled={loggingOut}
          className="h-8 gap-1.5 text-xs"
        >
          {loggingOut ? <IconLoader2 size={15} className="animate-spin" /> : <IconLogout size={15} />}
          Logout
        </Button>
      </div>
    </header>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">Halaman tidak ditemukan.</p>
      <Link to="/dashboard" className="text-xs underline text-primary">Kembali ke Dashboard</Link>
    </div>
  );
}

function RootComponent() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';

  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {isAuthPage ? (
          <Outlet />
        ) : (
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
        )}
        <Scripts />
      </body>
    </html>
  );
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
});