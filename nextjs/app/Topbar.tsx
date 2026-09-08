'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TopbarProps {
  isAuthenticated: boolean;
  changeTheme: (theme: 'dark' | 'light') => void;
  onPeriodChanged?: () => void;
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '');

/* ============================================================================
 * QURAN VERSE ALGORITHM & UTILITIES (DITARUH DI TOPBAR)
 * ============================================================================ */
const timeSlots = [
  0, 85, 169, 254, 339, 424, 508, 593, 678, 762, 847, 932, 1016, 1101, 1186, 1271, 1355
];

function calculateAyahNumber() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let slotIndex = 0;

  for (let i = timeSlots.length - 1; i >= 0; i--) {
    if (currentMinutes >= timeSlots[i]) {
      slotIndex = i;
      break;
    }
  }

  let ayahNumber = (dayOfYear - 1) * 17 + slotIndex + 1;
  if (ayahNumber > 6236) {
    ayahNumber = ((ayahNumber - 1) % 6236) + 1;
  }
  return ayahNumber;
}

let cachedVerseText: string | null = null;
let cachedVerseRef: string | null = null;

function QuranVerse() {
  const [verseText, setVerseText] = useState<string>(cachedVerseText || 'Loading verse...');
  const [verseRef, setVerseRef] = useState<string>(cachedVerseRef || '--');

  useEffect(() => {
    if (cachedVerseText && cachedVerseRef) {
      setVerseText(cachedVerseText);
      setVerseRef(cachedVerseRef);
      return;
    }

    const fetchVerse = async () => {
      try {
        const ayahNumber = calculateAyahNumber();
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/en.sahih`);
        const json = await res.json();

        if (json.code === 200 && json.data) {
          const data = json.data;
          const text = `"${data.text}"`;
          const reference = `QS. ${data.surah.englishName} ${data.surah.number}:${data.numberInSurah}`;

          cachedVerseText = text;
          cachedVerseRef = reference;

          setVerseText(text);
          setVerseRef(reference);
        } else {
          throw new Error('Invalid response structure');
        }
      } catch {
        setVerseText('"Allah does not charge a soul except with that which He has given it."');
        setVerseRef('QS. At-Talaq 65:7');
      }
    };

    fetchVerse();
  }, []);

  return (
    <div
      style={{
        width: '100%',
        padding: '0 4px',
        textAlign: 'center',
        margin: '0 auto',
        maxWidth: '95%',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 1.4,
      }}
    >
      <span style={{ fontSize: '0.75rem', fontStyle: 'italic', opacity: 0.8 }}>
        {verseText}
      </span>
      <span
        style={{
          fontSize: '0.675rem',
          fontWeight: 600,
          marginLeft: '4px',
          verticalAlign: 'baseline',
          backgroundColor: 'rgba(13, 110, 253, 0.15)',
          color: '#0d6efd',
          padding: '2px 6px',
          borderRadius: '4px',
          display: 'inline-block',
        }}
      >
        {verseRef}
      </span>
    </div>
  );
}

/* ============================================================================
 * MAIN TOPBAR COMPONENT
 * ============================================================================ */
export default function Topbar({
  isAuthenticated,
  changeTheme,
  onPeriodChanged,
}: TopbarProps) {
  const router = useRouter();

  // State Periode dikelola langsung di sini
  const [hasActivePeriod, setHasActivePeriod] = useState<boolean>(false);
  const [isViewingClosed, setIsViewingClosed] = useState<boolean>(false);
  const [periodText, setPeriodText] = useState<string>('No Period Selected');
  const [loadingPeriod, setLoadingPeriod] = useState<boolean>(false);

  // State Toggle Dropdown Custom React
  const [isPeriodOpen, setIsPeriodOpen] = useState<boolean>(false);
  const [isThemeOpen, setIsThemeOpen] = useState<boolean>(false);

  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        periodDropdownRef.current &&
        !periodDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPeriodOpen(false);
      }
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    const handlePeriodEvent = () => fetchSelectedPeriod();
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
        setIsPeriodOpen(false);
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
      {/* BARIS PERTAMA: QURAN VERSE */}
      <header className="topbar-solid">
        <div className="topbar-container">
          <QuranVerse />
        </div>
      </header>

      {/* BARIS KEDUA: STATUS STRIP & AKSES FITUR */}
      {isAuthenticated && (
        <div className="status-strip">
          {/* Dropdown Period */}
          <div className="dropdown-container" ref={periodDropdownRef}>
            <button
              className="status-btn"
              type="button"
              onClick={() => setIsPeriodOpen(!isPeriodOpen)}
            >
              <i className={`${iconClass}`} style={{ fontSize: '1rem' }}></i>
              <span
                style={{
                  fontWeight: 600,
                  color: !hasActivePeriod ? '#dc3545' : 'inherit',
                }}
              >
                {loadingPeriod ? 'Loading period...' : periodText}
              </span>
              {isViewingClosed && <span className="locked-badge">LOCKED</span>}
            </button>

            {isPeriodOpen && (
              <div className="custom-dropdown-menu left-align">
                <div className="dropdown-header">Accounting Period</div>
                <Link
                  className="custom-dropdown-item primary-text"
                  href="/periods"
                  onClick={() => setIsPeriodOpen(false)}
                >
                  <i className="ti ti-circle-plus"></i> Open New Period
                </Link>
                <div className="dropdown-divider"></div>
                <Link
                  className="custom-dropdown-item"
                  href="/periods"
                  onClick={() => setIsPeriodOpen(false)}
                >
                  <i className="ti ti-list"></i> Manage All Periods
                </Link>
                {hasActivePeriod && (
                  <button
                    type="button"
                    className="custom-dropdown-item danger-text"
                    onClick={handleClearSelection}
                  >
                    <i className="ti ti-eye-off"></i> Stop Viewing
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="divider-bar">|</span>

          {/* Akses Fitur: Search, Theme, Guardian, & Sync */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="icon-btn"
              type="button"
              aria-label="Search"
              title="Search"
            >
              <i className="ti ti-search" style={{ fontSize: '1.1rem' }}></i>
            </button>

            <span className="divider-bar">/</span>

            <div className="dropdown-container" ref={themeDropdownRef}>
              <button
                className="icon-btn"
                type="button"
                aria-label="More Options"
                title="Theme Settings"
                onClick={() => setIsThemeOpen(!isThemeOpen)}
              >
                <i className="ti ti-dots-vertical" style={{ fontSize: '1.1rem' }}></i>
              </button>

              {isThemeOpen && (
                <div className="custom-dropdown-menu right-align">
                  <div className="dropdown-header">Theme Interface</div>
                  <button
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      changeTheme('dark');
                      setIsThemeOpen(false);
                    }}
                  >
                    <i
                      className="ti ti-moon-stars"
                      style={{ color: '#ffc107' }}
                    ></i>{' '}
                    Dark Matte
                  </button>
                  <button
                    type="button"
                    className="custom-dropdown-item"
                    onClick={() => {
                      changeTheme('light');
                      setIsThemeOpen(false);
                    }}
                  >
                    <i
                      className="ti ti-sun"
                      style={{ color: '#ffc107' }}
                    ></i>{' '}
                    Light Minimal
                  </button>
                </div>
              )}
            </div>

            <span className="divider-bar">/</span>

            <button
              className="icon-btn"
              type="button"
              title="Guardian Security: Protected & Active"
              style={{ color: '#198754' }}
            >
              <i className="ti ti-shield-check-filled" style={{ fontSize: '1.15rem' }}></i>
            </button>

            <span className="divider-bar">/</span>

            <button
              id="syncBtn"
              className="icon-btn"
              type="button"
              title="Sync: Up to date"
              style={{ color: '#0dcaf0' }}
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

      <style jsx global>{`
        .topbar-solid {
          background-color: var(--bs-body-bg, #121212);
          position: sticky;
          top: 0;
          z-index: 1020;
          min-height: 56px;
          padding: 8px 0;
          border-bottom: 1px solid rgba(108, 117, 125, 0.2);
        }
        .topbar-container {
          max-width: 1320px;
          margin: 0 auto;
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .status-strip {
          background-color: var(--bs-body-bg, #121212);
          padding: 4px 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          white-space: nowrap;
          min-height: 36px;
          font-size: 0.75rem;
          border-bottom: 1px solid rgba(108, 117, 125, 0.2);
        }

        /* Dropdown Styling - Solid Background (Bukan Transparan) */
        .dropdown-container {
          position: relative;
          display: inline-block;
        }
        .custom-dropdown-menu {
          position: absolute;
          top: 100%;
          margin-top: 4px;
          background-color: var(--bs-body-bg, #1e1e1e);
          color: var(--bs-body-color, #ffffff);
          border: 1px solid rgba(108, 117, 125, 0.25);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          padding: 4px 0;
          z-index: 1050;
          font-size: 0.75rem;
          min-width: 190px;
        }
        .custom-dropdown-menu.left-align {
          left: 0;
        }
        .custom-dropdown-menu.right-align {
          right: 0;
        }
        .dropdown-header {
          padding: 4px 12px;
          font-size: 0.65rem;
          text-transform: uppercase;
          opacity: 0.6;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .custom-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 12px;
          background: transparent;
          border: none;
          color: inherit;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
          font-size: 0.75rem;
        }
        .custom-dropdown-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }
        .dropdown-divider {
          height: 1px;
          background-color: rgba(108, 117, 125, 0.2);
          margin: 4px 0;
        }

        /* Utility Elements */
        .status-btn {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0;
        }
        .status-btn:hover {
          opacity: 0.85;
        }
        .icon-btn {
          background: transparent;
          border: none;
          color: #6c757d;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .icon-btn:hover {
          color: var(--bs-body-color, #ffffff);
          transform: translateY(-1px);
        }
        .locked-badge {
          font-size: 0.65rem;
          padding: 1px 5px;
          border-radius: 3px;
          background-color: rgba(108, 117, 125, 0.2);
          color: #6c757d;
          border: 1px solid rgba(108, 117, 125, 0.3);
          font-family: monospace;
        }
        .divider-bar {
          color: #6c757d;
          opacity: 0.3;
        }
        .primary-text {
          color: #0d6efd;
          font-weight: 600;
        }
        .danger-text {
          color: #dc3545;
        }
        .text-warning {
          color: #ffc107;
        }
        .text-secondary {
          color: #6c757d;
        }
        .text-success {
          color: #198754;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
}
