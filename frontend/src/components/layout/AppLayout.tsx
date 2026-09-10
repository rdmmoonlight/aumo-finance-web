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
  IconChevronRight,
} from '@tabler/icons-react';

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
    <li>
      <NavLink to={item.path}>
        {({ isActive }) => (
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text- font-medium transition-colors ${
              isActive
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <item.icon size={18} stroke={1.8} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white flex flex-col h-full shrink-0">
      <div className="h-16 px-5 border-b flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-black text-white grid place-items-center font-bold">A</div>
        <div className="flex flex-col">
          <span className="font-bold text-sm leading-none">Aumo Finance</span>
          <span className="text- text-gray-500 uppercase tracking-widest font-semibold">Accounting Suite</span>
        </div>
      </div>

      {/* PAKAI DIV BIASA, JANGAN ScrollArea */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-6">
          <h2 className="px-3 text- font-bold text-gray-400 uppercase tracking-widest mb-2">Main Domain</h2>
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItemLink key={item.path} item={item} />
            ))}
          </ul>
        </div>
        <div>
          <h2 className="px-3 text- font-bold text-gray-400 uppercase tracking-widest mb-2">Reports & Statements</h2>
          <ul className="space-y-1">
            {reportNavItems.map((item) => (
              <NavItemLink key={item.path} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between shrink-0">
      {/* Breadcrumb polos, tanpa komponen shadcn */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link to="/" className="hover:text-black">Home</Link>
        {pathSegments.map((seg, i) => {
          const url = `/${pathSegments.slice(0, i + 1).join('/')}`;
          const isLast = i === pathSegments.length - 1;
          return (
            <span key={url} className="flex items-center gap-1.5">
              <IconChevronRight size={12} />
              {isLast ? (
                <span className="font-semibold text-black capitalize">{seg.replace(/-/g, ' ')}</span>
              ) : (
                <Link to={url} className="capitalize hover:text-black">{seg.replace(/-/g, ' ')}</Link>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium">Ghofur</span>
        </div>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
        >
          <IconLogout size={15} /> Logout
        </button>
      </div>
    </header>
  );
}

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8f8f7] text-gray-900">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        {/* PAKAI DIV BIASA LAGI */}
        <div className="flex-1 overflow-auto">
          <main className="p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
