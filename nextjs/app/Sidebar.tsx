'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  IconHome,
  IconLayoutGrid,
  IconCalendarEvent,
  IconSitemap,
  IconRobot,
  IconBook2,
  IconFolder,
  IconShieldCheck,
  IconTools,
  IconSettings,
  IconLogout,
  IconX
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
  const [internalShowFlyout, setInternalShowFlyout] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const settingsRef = useRef<HTMLDivElement>(null);

  const showReportsFlyout = externalShowFlyout ?? internalShowFlyout;
  const toggleReportsFlyout =
    externalToggleFlyout ?? (() => setInternalShowFlyout((prev) => !prev));
  const closeFlyout =
    externalCloseFlyout ?? (() => setInternalShowFlyout(false));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const reportsNavList = [
    { href: '/reports/general-journal', label: 'General Journal' },
    { href: '/reports/general-ledger/permanent', label: 'GL (Permanent Accounts)' },
    { href: '/reports/general-ledger/temporary', label: 'GL (Temporary Accounts)' },
    { href: '/reports/trial-balance/unadjusted', label: 'Trial Balance' },
    { href: '/reports/adjusting-journal', label: 'Adjusting Journal' },
    { href: '/reports/trial-balance/adjusted', label: 'Adjusted Trial Balance' },
    { href: '/reports/worksheet', label: 'Worksheet' },
    { href: '/reports/income-statement', label: 'Income Statement' },
    { href: '/reports/retained-earnings', label: 'Retained Earnings' },
    { href: '/reports/statement-of-financial-position', label: 'Financial Position' },
    { href: '/reports/closing-journal', label: 'Closing Journal' },
    { href: '/reports/trial-balance/post-closing', label: 'Post-Closing TB' },
    { href: '/reports/statement-of-cash-flow', label: 'Cash Flow' },
  ];

  return (
    <>
      <div className="sidebar-wrapper">
        <nav className="sidebar-icons">
          <Link
            href="/"
            className="brand-container"
            title="Aumo Finance Home"
            onClick={closeFlyout}
          >
            <IconHome size={22} />
          </Link>

          <div className="hr-matte"></div>

          <ul className="nav-list">
            {/* 1. Dashboard */}
            <li className="nav-item">
              <Link
                href="/dashboard"
                className={`icon-btn ${pathname === '/dashboard' ? 'active' : ''}`}
                title="Dashboard"
                onClick={closeFlyout}
              >
                <IconLayoutGrid size={22} />
              </Link>
            </li>

            {/* 2. Financial Periods (Periods) */}
            <li className="nav-item">
              <Link
                href="/periods"
                className={`icon-btn ${pathname === '/periods' ? 'active' : ''}`}
                title="Financial Periods"
                onClick={closeFlyout}
              >
                <IconCalendarEvent size={22} />
              </Link>
            </li>

            {/* 3. Chart of Accounts (CoA) */}
            <li className="nav-item">
              <Link
                href="/chart-of-accounts"
                className={`icon-btn ${pathname === '/chart-of-accounts' ? 'active' : ''}`}
                title="Chart of Accounts"
                onClick={closeFlyout}
              >
                <IconSitemap size={22} />
              </Link>
            </li>

            {/* Navigasi Lainnya */}
            <li className="nav-item">
              <Link
                href="/ai-assistant"
                className={`icon-btn ${pathname === '/ai-assistant' ? 'active' : ''}`}
                title="AI Financial Assistant"
                onClick={closeFlyout}
              >
                <IconRobot size={22} />
              </Link>
            </li>

            <li className="nav-item">
              <Link
                href="/journal-entry"
                className={`icon-btn ${pathname === '/journal-entry' ? 'active' : ''}`}
                title="Journal Entry"
                onClick={closeFlyout}
              >
                <IconBook2 size={22} />
              </Link>
            </li>

            <li className="nav-item">
              <button
                type="button"
                onClick={toggleReportsFlyout}
                className={`icon-btn ${showReportsFlyout ? 'active' : ''}`}
                title="Reports"
              >
                <IconFolder size={22} />
              </button>
            </li>

            <li className="nav-item">
              <Link
                href="/guardian"
                className={`icon-btn ${pathname === '/guardian' ? 'active' : ''}`}
                title="Guardian Security"
                onClick={closeFlyout}
              >
                <IconShieldCheck size={22} />
              </Link>
            </li>

            <li className="nav-item">
              <Link
                href="/tools"
                className={`icon-btn ${pathname === '/tools' ? 'active' : ''}`}
                title="Tools"
                onClick={closeFlyout}
              >
                <IconTools size={22} />
              </Link>
            </li>
          </ul>

          {/* Settings & Account Dropup */}
          <div className="bottom-settings-container" ref={settingsRef}>
            <button
              className={`icon-btn ${isSettingsOpen ? 'active' : ''}`}
              type="button"
              title="Settings & Account"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
            >
              <IconSettings size={22} />
            </button>

            {isSettingsOpen && (
              <div className="settings-dropup-menu">
                <Link
                  className="dropup-item"
                  href="/settings"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    closeFlyout();
                  }}
                >
                  <IconSettings size={18} />
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  className="dropup-item danger-item"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    handleSignOut();
                  }}
                >
                  <IconLogout size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {showReportsFlyout && (
          <div className="sidebar-flyout">
            <div className="flyout-header">
              <span className="flyout-title">Reports</span>
              <button
                type="button"
                onClick={closeFlyout}
                className="close-btn"
                aria-label="Close"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="flyout-list">
              {reportsNavList.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flyout-item ${pathname === item.href ? 'active' : ''}`}
                  onClick={closeFlyout}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .sidebar-wrapper {
          position: sticky;
          top: 0;
          height: 100vh;
          max-height: 100vh;
          align-self: flex-start;
          z-index: 1030;
          flex-shrink: 0;
          display: flex;
        }

        .sidebar-icons {
          width: 65px;
          height: 100vh;
          background-color: var(--bs-body-bg, #121212);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0;
          color: #ffffff;
        }

        .brand-container {
          color: #ffc107;
          text-decoration: none;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
        }

        .hr-matte {
          width: 75%;
          height: 1px;
          background-color: rgba(255, 255, 255, 0.1);
          margin: 8px 0 16px 0;
        }

        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-grow: 1;
        }

        .nav-item {
          margin-bottom: 8px;
        }

        .icon-btn {
          color: var(--bs-secondary-color, #888888);
          padding: 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease;
          text-decoration: none;
        }

        .icon-btn:hover {
          color: var(--bs-body-color, #ffffff);
          background-color: rgba(255, 255, 255, 0.05);
        }

        .icon-btn.active {
          color: var(--bs-body-color, #ffffff);
          background-color: rgba(255, 255, 255, 0.1);
        }

        .bottom-settings-container {
          margin-top: auto;
          position: relative;
        }

        .settings-dropup-menu {
          position: absolute;
          bottom: 100%;
          left: 10px;
          margin-bottom: 8px;
          background-color: var(--bs-body-bg, #1e1e1e);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          padding: 4px;
          min-width: 150px;
          z-index: 1040;
        }

        .dropup-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: var(--bs-body-color, #ffffff);
          text-decoration: none;
          font-size: 0.8rem;
          border-radius: 4px;
          cursor: pointer;
          text-align: left;
        }

        .dropup-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .dropup-item.danger-item {
          color: #dc3545;
        }

        .sidebar-flyout {
          width: 230px;
          height: 100vh;
          overflow-y: auto;
          background-color: var(--bs-body-bg, #121212);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
        }

        .flyout-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .flyout-title {
          font-weight: 600;
          color: var(--bs-secondary-color, #aaa);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border-radius: 4px;
        }

        .close-btn:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.1);
        }

        .flyout-list {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .flyout-item {
          display: block;
          padding: 8px 12px;
          border-radius: 4px;
          color: var(--bs-secondary-color, #aaa);
          text-decoration: none;
          font-size: 0.8rem;
          transition: background-color 0.15s ease, color 0.15s ease;
        }

        .flyout-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--bs-body-color, #ffffff);
        }

        .flyout-item.active {
          background-color: rgba(255, 255, 255, 0.1);
          color: var(--bs-body-color, #ffffff);
          font-weight: 500;
        }
      `}</style>
    </>
  );
}
