import React from 'react';
import { NavLink } from 'react-router-dom';
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
  IconScaleOff, // Digunakan sebagai pengganti IconScaleOutline jika ingin variasi berbeda
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
  { label: 'Adjusted Trial Balance', path: '/reports/trial-balance/adjusted', icon: IconScaleOff }, // Diganti dari IconScaleOutline
  { label: 'Post-Closing Trial Balance', path: '/reports/trial-balance/post-closing', icon: IconReceipt2 },
  { label: 'Income Statement', path: '/reports/income-statement', icon: IconPigMoney },
  { label: 'Retained Earnings', path: '/reports/retained-earnings', icon: IconBuildingBank },
  { label: 'Financial Position', path: '/reports/statement-of-financial-position', icon: IconBuildingStore },
  { label: 'Cash Flow', path: '/reports/statement-of-cash-flow', icon: IconCash },
  { label: 'Worksheet', path: '/reports/worksheet', icon: IconTable },
];

// Sub-komponen NavItem untuk menjaga kebersihan kode
function NavItemLink({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 group ${
            isActive
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/50 shadow-sm'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              size={18}
              className={`transition-colors ${
                isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'
              }`}
              stroke={1.8}
            />
            <span>{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 bg-zinc-900 text-zinc-400 flex flex-col h-screen border-r border-zinc-800/80 font-sans antialiased selection:bg-zinc-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center font-bold text-zinc-100 shadow-sm">
          A
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-zinc-100 text-base tracking-wide leading-none">
            Aumo Finance
          </span>
          <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase mt-1">
            Accounting Suite
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
        {/* Main Domain Group */}
        <div>
          <div className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Main Domain
          </div>
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <NavItemLink key={item.path} item={item} />
            ))}
          </ul>
        </div>

        {/* Reports & Statements Group */}
        <div>
          <div className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Reports & Statements
          </div>
          <ul className="space-y-1">
            {reportNavItems.map((item) => (
              <NavItemLink key={item.path} item={item} />
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}