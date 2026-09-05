'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  isAuthenticated: boolean;
  hasActivePeriod?: boolean;
  isViewingClosed?: boolean;
  periodText?: string;
  QuranVerse: React.ComponentType;
  changeTheme: (theme: 'dark' | 'light') => void;
  onPeriodChanged?: () => void;
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function Topbar({
  isAuthenticated,
  hasActivePeriod: propHasActivePeriod,
  isViewingClosed: propIsViewingClosed,
  periodText: propPeriodText,
  QuranVerse,
  changeTheme,
  onPeriodChanged,
}: TopbarProps) {
  const router = useRouter();

  const [hasActivePeriod, setHasActivePeriod] = useState<boolean>(propHasActivePeriod ?? false);
  const [isViewingClosed, setIsViewingClosed] = useState<boolean>(propIsViewingClosed ?? false);
  const [periodText, setPeriodText] = useState<string>(propPeriodText || 'No Period Selected');
  const [loadingPeriod, setLoadingPeriod] = useState<boolean>(false);

  const fetchSelectedPeriod = async () => {
    if (!isAuthenticated) return;
    setLoadingPeriod(true);
    try {
      const response = await fetch(`${API_BASE_URL}/web/periods`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const periods = Array.isArray(data?.periods) ? data.periods : [];
        const selectedId = data?.selectedPeriodId;

        if (selectedId) {
          const selected = periods.find((p: any) => p.id === selectedId);
          if (selected) {
            setHasActivePeriod(true);
            setIsViewingClosed(selected.isClosed);
            setPeriodText(`Viewing: ${selected.periodName}`);
            return;
          }
        }

        const activePeriod = periods.find((p: any) => !p.isClosed);
        if (activePeriod) {
          setHasActivePeriod(true);
          setIsViewingClosed(false);
          setPeriodText(activePeriod.periodName);
        } else if (periods.length > 0) {
          setHasActivePeriod(true);
          setIsViewingClosed(periods[0].isClosed);
          setPeriodText(periods[0].periodName);
        } else {
          setHasActivePeriod(false);
          setIsViewingClosed(false);
          setPeriodText('No Period Selected');
        }
      }
    } catch (err) {
      console.error('Failed to sync active period in Topbar:', err);
    } finally {
      setLoadingPeriod(false);
    }
  };

  useEffect(() => {
    fetchSelectedPeriod();

    const handlePeriodEvent = () => {
      fetchSelectedPeriod();
    };

    window.addEventListener('periodChanged', handlePeriodEvent);

    return () => {
      window.removeEventListener('periodChanged', handlePeriodEvent);
    };
  }, [isAuthenticated]);

  const handleClearSelection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/web/periods/clear-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        setHasActivePeriod(false);
        setIsViewingClosed(false);
        setPeriodText('No Period Selected');

        window.dispatchEvent(new Event('periodChanged'));

        if (onPeriodChanged) onPeriodChanged();
        router.refresh();
      }
    } catch (err) {
      console.error('Error clearing period selection:', err);
    }
  };

  const iconClass = !hasActivePeriod
    ? 'ti ti-calendar-off text-warning'
    : isViewingClosed
    ? 'ti ti-lock-filled text-secondary'
    : 'ti ti-calendar-check text-success';

  return (
    <>
      {/* BARIS PERTAMA: KHUSUS QURAN VERSE */}
      <header
        className="navbar navbar-expand topbar-solid py-2 sticky-top border-bottom border-secondary border-opacity-10"
        style={{ minHeight: '56px' }}
      >
        <div className="container-xxl px-3 d-flex align-items-center justify-content-center text-center">
          <QuranVerse />
        </div>
      </header>

      {/* BARIS KEDUAA: STATUS STRIP & AKSES FITUR */}
      {isAuthenticated && (
        <div
          className="status-strip px-3 py-1 d-flex justify-content-center align-items-center gap-3 text-nowrap border-bottom border-secondary border-opacity-10"
          style={{ minHeight: '36px', fontSize: '0.75rem' }}
        >
          {/* Dropdown Period */}
          <div className="dropdown">
            <button
              className="btn btn-sm btn-link text-decoration-none p-0 fw-medium d-flex align-items-center gap-2 dropdown-toggle shadow-none status-badge"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className={`${iconClass} fs-6`}></i>
              <span className={`text-body fw-semibold ${!hasActivePeriod ? 'text-danger' : ''}`}>
                {loadingPeriod ? 'Loading period...' : periodText}
              </span>
              {isViewingClosed && (
                <span
                  className="badge bg-secondary-subtle text-secondary border border-secondary-subtle font-monospace"
                  style={{ fontSize: '0.65rem' }}
                >
                  LOCKED
                </span>
              )}
            </button>

            <ul
              className="dropdown-menu shadow border border-secondary border-opacity-10 mt-1"
              style={{ fontSize: '0.75rem', minWidth: '190px' }}
            >
              <li>
                <h6 className="dropdown-header py-1 text-uppercase" style={{ fontSize: '0.65rem' }}>
                  Accounting Period
                </h6>
              </li>
              <li>
                <Link
                  className="dropdown-item py-1 text-primary fw-semibold d-flex align-items-center gap-2"
                  href="/periods"
                >
                  <i className="ti ti-circle-plus"></i> Open New Period
                </Link>
              </li>
              <li>
                <hr className="dropdown-divider my-1" />
              </li>
              <li>
                <Link className="dropdown-item py-1 d-flex align-items-center gap-2" href="/periods">
                  <i className="ti ti-list"></i> Manage All Periods
                </Link>
              </li>
              {hasActivePeriod && (
                <li>
                  <button
                    type="button"
                    className="dropdown-item py-1 text-danger d-flex align-items-center gap-2 border-0 bg-transparent w-100 text-start"
                    onClick={handleClearSelection}
                  >
                    <i className="ti ti-eye-off"></i> Stop Viewing
                  </button>
                </li>
              )}
            </ul>
          </div>

          <span className="text-secondary opacity-25">|</span>

          {/* Akses Fitur: Search, Theme, Guardian, & Sync */}
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm topbar-btn text-secondary p-0 border-0 shadow-none lh-1 d-flex align-items-center"
              type="button"
              data-bs-toggle="modal"
              data-bs-target="#searchModal"
              aria-label="Search"
              title="Search"
            >
              <i className="ti ti-search" style={{ fontSize: '1.1rem' }}></i>
            </button>

            <span className="text-secondary opacity-25">/</span>

            <div className="dropdown">
              <button
                className="btn btn-sm topbar-btn text-secondary p-0 border-0 shadow-none lh-1 d-flex align-items-center"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label="More Options"
                title="Theme Settings"
              >
                <i className="ti ti-dots-vertical" style={{ fontSize: '1.1rem' }}></i>
              </button>
              <ul
                className="dropdown-menu dropdown-menu-end shadow border border-secondary border-opacity-10"
                style={{ fontSize: '0.8rem', minWidth: '150px' }}
              >
                <li>
                  <h6 className="dropdown-header py-1 text-uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>
                    Theme Interface
                  </h6>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item py-1 d-flex align-items-center gap-2"
                    onClick={() => changeTheme('dark')}
                  >
                    <i className="ti ti-moon-stars text-warning"></i> Dark Matte
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item py-1 d-flex align-items-center gap-2"
                    onClick={() => changeTheme('light')}
                  >
                    <i className="ti ti-sun text-warning"></i> Light Minimal
                  </button>
                </li>
              </ul>
            </div>

            <span className="text-secondary opacity-25">/</span>

            <button
              className="btn btn-sm btn-link text-success p-0 border-0 shadow-none lh-1 d-flex align-items-center"
              type="button"
              title="Guardian Security: Protected & Active"
            >
              <i className="ti ti-shield-check-filled text-success" style={{ fontSize: '1.15rem' }}></i>
            </button>

            <span className="text-secondary opacity-25">/</span>

            <button
              id="syncBtn"
              className="btn btn-sm btn-link text-info p-0 border-0 shadow-none lh-1 d-flex align-items-center"
              type="button"
              title="Sync: Up to date"
              onClick={fetchSelectedPeriod}
            >
              <i
                id="syncIcon"
                className={`ti ${loadingPeriod ? 'ti-refresh spin' : 'ti-cloud-check'}`}
                style={{ fontSize: '1.15rem' }}
              ></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
