import React from 'react';
import { NavLink } from 'react-router-dom';

interface MenuItem {
  label: string;
  path: string;
  icon?: string;
}

const mainNavItems: MenuItem[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Chart of Accounts', path: '/chart-of-accounts' },
  { label: 'Journal Entry', path: '/journal-entry' },
  { label: 'Periods', path: '/periods' },
  { label: 'AI Assistant', path: '/ai-assistant' },
  { label: 'Guardian', path: '/guardian' },
  { label: 'Tools', path: '/tools' },
  { label: 'Settings', path: '/settings' },
];

const reportNavItems: MenuItem[] = [
  { label: 'General Journal', path: '/reports/general-journal' },
  { label: 'Adjusting Journal', path: '/reports/adjusting-journal' },
  { label: 'Closing Journal', path: '/reports/closing-journal' },
  { label: 'Permanent Ledger', path: '/reports/general-ledger/permanent' },
  { label: 'Temporary Ledger', path: '/reports/general-ledger/temporary' },
  { label: 'Unadjusted Trial Balance', path: '/reports/trial-balance/unadjusted' },
  { label: 'Adjusted Trial Balance', path: '/reports/trial-balance/adjusted' },
  { label: 'Post-Closing Trial Balance', path: '/reports/trial-balance/post-closing' },
  { label: 'Income Statement', path: '/reports/income-statement' },
  { label: 'Retained Earnings', path: '/reports/retained-earnings' },
  { label: 'Financial Position', path: '/reports/statement-of-financial-position' },
  { label: 'Cash Flow', path: '/reports/statement-of-cash-flow' },
  { label: 'Worksheet', path: '/reports/worksheet' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">
          A
        </div>
        <span className="font-semibold text-white text-lg tracking-wide">Aumo Finance</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Main Domain
          </div>
          <ul className="space-y-1">
            {mainNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Reports & Statements
          </div>
          <ul className="space-y-1">
            {reportNavItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}