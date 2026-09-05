'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IconHome,
  IconLayoutGrid,
  IconRobot,
  IconBookPlus,
  IconFolder,
  IconSitemap,
  IconCalendarEvent,
  IconShieldCheck,
  IconTools,
  IconSettings,
  IconLogout
} from '@tabler/icons-react';

interface SidebarProps {
  pathname: string;
  currentUserEmail?: string;
  handleSignOut: () => void;
  showReportsFlyout?: boolean;
  toggleReportsFlyout?: () => void;
  closeFlyout?: () => void;
}

export default function Sidebar({
  pathname,
  handleSignOut,
  showReportsFlyout: externalShowFlyout,
  toggleReportsFlyout: externalToggleFlyout,
  closeFlyout: externalCloseFlyout,
}: SidebarProps) {
  // State internal sebagai fallback jika tidak di-pass dari induk
  const [internalShowFlyout, setInternalShowFlyout] = useState<boolean>(false);

  const showReportsFlyout = externalShowFlyout ?? internalShowFlyout;
  const toggleReportsFlyout = externalToggleFlyout ?? (() => setInternalShowFlyout((prev) => !prev));
  const closeFlyout = externalCloseFlyout ?? (() => setInternalShowFlyout(false));

  return (
    <>
      <div className="sidebar-wrapper d-flex sidebar-sticky-matte">
        <nav id="sidebar-icons" className="sidebar-icons text-white d-flex flex-column align-items-center py-3">
          <Link
            href="/"
            className="brand-container text-center text-warning text-decoration-none mb-2"
            title="Aumo Finance Home"
            onClick={closeFlyout}
          >
            <IconHome size={22} />
          </Link>

          <hr className="hr-matte my-2 w-75" />

          <ul className="nav flex-column align-items-center w-100 flex-grow-1">
            <li className="nav-item mb-2">
              <Link
                href="/dashboard"
                className={`nav-link icon-btn ${pathname === '/dashboard' ? 'active' : ''}`}
                title="Dashboard"
                onClick={closeFlyout}
              >
                <IconLayoutGrid size={22} />
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/ai-assistant"
                className={`nav-link icon-btn ${pathname === '/ai-assistant' ? 'active' : ''}`}
                title="AI Financial Assistant"
                onClick={closeFlyout}
              >
                <IconRobot size={22} />
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/journal-entry"
                className={`nav-link icon-btn ${pathname === '/journal-entry' ? 'active' : ''}`}
                title="Journal Entry"
                onClick={closeFlyout}
              >
                <IconBookPlus size={22} />
              </Link>
            </li>

            <li className="nav-item mb-2">
              <button
                type="button"
                onClick={toggleReportsFlyout}
                className={`nav-link icon-btn border-0 bg-transparent ${showReportsFlyout ? 'active' : ''}`}
                title="Reports"
              >
                <IconFolder size={22} />
              </button>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/chart-of-accounts"
                className={`nav-link icon-btn ${pathname === '/chart-of-accounts' ? 'active' : ''}`}
                title="Chart of Accounts"
                onClick={closeFlyout}
              >
                <IconSitemap size={22} />
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/periods"
                className={`nav-link icon-btn ${pathname === '/periods' ? 'active' : ''}`}
                title="Financial Periods"
                onClick={closeFlyout}
              >
                <IconCalendarEvent size={22} />
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/guardian"
                className={`nav-link icon-btn ${pathname === '/guardian' ? 'active' : ''}`}
                title="Guardian Security"
                onClick={closeFlyout}
              >
                <IconShieldCheck size={22} />
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/tools"
                className={`nav-link icon-btn ${pathname === '/tools' ? 'active' : ''}`}
                title="Tools"
                onClick={closeFlyout}
              >
                <IconTools size={22} />
              </Link>
            </li>
          </ul>

          {/* Menus Bawah (Pilihan Settings & Sign Out) */}
          <div className="mt-auto dropup position-relative">
            <button
              className="nav-link icon-btn border-0 bg-transparent"
              id="settingsDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              title="Settings & Account"
            >
              <IconSettings size={22} />
            </button>

            <ul
              className="dropdown-menu dropdown-menu-dark shadow ms-2 mb-2 fs-7 border border-secondary border-opacity-10"
              aria-labelledby="settingsDropdown"
            >
              <li>
                <Link className="dropdown-item d-flex align-items-center gap-2" href="/settings" onClick={closeFlyout}>
                  <IconSettings size={18} />
                  <span>Settings</span>
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center gap-2 text-danger w-100"
                  onClick={handleSignOut}
                >
                  <IconLogout size={18} />
                  <span>Sign Out</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {showReportsFlyout && (
          <div id="reports-flyout" className="sidebar-flyout">
            <div className="p-3 border-bottom border-secondary border-opacity-10 d-flex justify-content-between align-items-center">
              <span className="fw-semibold text-body-secondary small text-uppercase tracking-wider" style={{ fontSize: '0.7rem' }}>
                Reports
              </span>
              <button
                type="button"
                onClick={closeFlyout}
                className="btn-close btn-close-white btn-sm opacity-50"
                aria-label="Close"
              ></button>
            </div>

            <div className="list-group list-group-flush p-2 small">
              <Link
                href="/reports/general-journal"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/general-journal' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                General Journal
              </Link>
              <Link
                href="/reports/general-ledger/permanent"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/general-ledger/permanent' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                GL (Permanent Accounts)
              </Link>
              <Link
                href="/reports/general-ledger/temporary"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/general-ledger/temporary' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                GL (Temporary Accounts)
              </Link>
              <Link
                href="/reports/trial-balance/unadjusted"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/trial-balance/unadjusted' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Trial Balance
              </Link>
              <Link
                href="/reports/adjusting-journal"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/adjusting-journal' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Adjusting Journal
              </Link>
              <Link
                href="/reports/trial-balance/adjusted"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/trial-balance/adjusted' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Adjusted Trial Balance
              </Link>
              <Link
                href="/reports/worksheet"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/worksheet' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Worksheet
              </Link>
              <Link
                href="/reports/income-statement"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/income-statement' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Income Statement
              </Link>
              <Link
                href="/reports/retained-earnings"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/retained-earnings' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Retained Earnings
              </Link>
              <Link
                href="/reports/statement-of-financial-position"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/statement-of-financial-position' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Financial Position
              </Link>
              <Link
                href="/reports/closing-journal"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/closing-journal' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Closing Journal
              </Link>
              <Link
                href="/reports/trial-balance/post-closing"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/trial-balance/post-closing' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Post-Closing TB
              </Link>
              <Link
                href="/reports/statement-of-cash-flow"
                className={`list-group-item list-group-item-action py-2 px-3 rounded mb-1 ${
                  pathname === '/reports/statement-of-cash-flow' ? 'active' : ''
                }`}
                onClick={closeFlyout}
              >
                Cash Flow
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* STYLES FOR SIDEBAR */}
      <style jsx global>{`
        .sidebar-sticky-matte {
          position: -webkit-sticky;
          position: sticky;
          top: 0;
          height: 100vh;
          max-height: 100vh;
          align-self: flex-start;
          z-index: 1030;
          flex-shrink: 0;
        }
        .sidebar-icons {
          width: 65px;
          height: 100vh;
          background-color: var(--bs-body-bg, #121212);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0;
          box-shadow: none;
        }
        .sidebar-flyout {
          width: 230px;
          height: 100vh;
          overflow-y: auto;
          background-color: var(--bs-body-bg, #121212);
          margin-left: 0;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0;
          box-shadow: none;
        }
        .icon-btn {
          color: var(--bs-secondary-color, #888888);
          padding: 0.5rem;
          border-radius: 0.375rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .icon-btn:hover {
          color: var(--bs-body-color, #ffffff);
          background-color: rgba(255, 255, 255, 0.05);
          box-shadow: none;
        }
        .icon-btn.active {
          color: var(--bs-body-color, #ffffff);
          background-color: rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }
        .hr-matte {
          border: none !important;
          height: 1px !important;
          background-color: rgba(255, 255, 255, 0.1) !important;
          opacity: 1 !important;
          box-shadow: none !important;
        }
        .sidebar-flyout .list-group-item {
          background-color: transparent;
          color: var(--bs-secondary-color, #aaa);
          border: none;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .sidebar-flyout .list-group-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--bs-body-color, #ffffff);
        }
        .sidebar-flyout .list-group-item.active {
          background-color: rgba(255, 255, 255, 0.1);
          color: var(--bs-body-color, #ffffff);
          font-weight: 500;
        }
      `}</style>
    </>
  );
}
