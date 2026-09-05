'use client';

import React from 'react';
import Link from 'next/link';

interface SidebarProps {
  pathname: string;
  showReportsFlyout: boolean;
  currentUserEmail: string;
  toggleReportsFlyout: () => void;
  closeFlyout: () => void;
  handleSignOut: () => void;
}

export default function Sidebar({
  pathname,
  showReportsFlyout,
  currentUserEmail,
  toggleReportsFlyout,
  closeFlyout,
  handleSignOut,
}: SidebarProps) {
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
            <i className="bi bi-house-door-fill fs-5"></i>
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
                <i className="bi bi-columns-gap fs-5"></i>
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/ai-assistant"
                className={`nav-link icon-btn ${pathname === '/ai-assistant' ? 'active' : ''}`}
                title="AI Financial Assistant"
                onClick={closeFlyout}
              >
                <i className="bi bi-robot fs-5"></i>
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/journal-entry"
                className={`nav-link icon-btn ${pathname === '/journal-entry' ? 'active' : ''}`}
                title="Journal Entry"
                onClick={closeFlyout}
              >
                <i className="bi bi-journal-plus fs-5"></i>
              </Link>
            </li>

            <li className="nav-item mb-2">
              <button
                type="button"
                onClick={toggleReportsFlyout}
                className={`nav-link icon-btn border-0 bg-transparent ${showReportsFlyout ? 'active' : ''}`}
                title="Reports"
              >
                <i className="bi bi-folder fs-5"></i>
              </button>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/chart-of-accounts"
                className={`nav-link icon-btn ${pathname === '/chart-of-accounts' ? 'active' : ''}`}
                title="Chart of Accounts"
                onClick={closeFlyout}
              >
                <i className="bi bi-diagram-3 fs-5"></i>
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/periods"
                className={`nav-link icon-btn ${pathname === '/periods' ? 'active' : ''}`}
                title="Financial Periods"
                onClick={closeFlyout}
              >
                <i className="bi bi-calendar3 fs-5"></i>
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/guardian"
                className={`nav-link icon-btn ${pathname === '/guardian' ? 'active' : ''}`}
                title="Guardian Security"
                onClick={closeFlyout}
              >
                <i className="bi bi-shield-check fs-5"></i>
              </Link>
            </li>

            <li className="nav-item mb-2">
              <Link
                href="/tools"
                className={`nav-link icon-btn ${pathname === '/tools' ? 'active' : ''}`}
                title="Tools"
                onClick={closeFlyout}
              >
                <i className="bi bi-tools fs-5"></i>
              </Link>
            </li>
          </ul>

          <div className="mt-auto dropup position-relative">
            <button
              className="nav-link icon-btn border-0 bg-transparent"
              id="userDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              title="User Profile"
            >
              <i className="bi bi-person-circle fs-5"></i>
            </button>
            <span
              className="position-absolute bottom-0 end-0 p-1 bg-success border border-dark rounded-circle"
              style={{ width: '7px', height: '7px' }}
            ></span>

            <ul
              className="dropdown-menu dropdown-menu-dark shadow ms-2 mb-2 fs-7 border border-secondary border-opacity-10"
              aria-labelledby="userDropdown"
            >
              <li className="dropdown-header text-truncate" style={{ maxWidth: '180px' }}>
                {currentUserEmail}
              </li>
              <li>
                <hr className="dropdown-divider opacity-10" />
              </li>
              <li>
                <Link className="dropdown-item d-flex align-items-center" href="/settings" onClick={closeFlyout}>
                  <i className="bi bi-gear me-2"></i> Settings
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center text-danger w-100"
                  onClick={handleSignOut}
                >
                  <i className="bi bi-box-arrow-right me-2"></i> Sign Out
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
