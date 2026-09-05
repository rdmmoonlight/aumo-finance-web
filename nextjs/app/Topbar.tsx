'use client';

import React, { useState, useEffect } from 'react';
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
      className="w-100 px-1 text-center mx-auto"
      style={{
        maxWidth: '95%',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 1.4,
      }}
    >
      <span className="text-body-secondary fst-italic" style={{ fontSize: '0.75rem' }}>
        {verseText}
      </span>
      <span
        className="badge bg-primary-subtle text-primary fw-semibold ms-1 align-baseline"
        style={{ fontSize: '0.675rem' }}
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
      <header
        className="navbar navbar-expand topbar-solid py-2 sticky-top border-bottom border-secondary border-opacity-10"
        style={{ minHeight: '56px' }}
      >
        <div className="container-xxl px-3 d-flex align-items-center justify-content-center text-center">
          <QuranVerse />
        </div>
      </header>

      {/* BARIS KEDUA: STATUS STRIP & AKSES FITUR */}
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

      <style jsx global>{`
        .topbar-solid {
          background-color: var(--bs-body-bg, #121212);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 1020;
        }
        .status-strip {
          background-color: rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(8px);
        }
        .topbar-btn {
          transition: color 0.15s ease-in-out, transform 0.15s ease-in-out;
        }
        .topbar-btn:hover {
          color: var(--bs-body-color, #ffffff) !important;
          transform: translateY(-1px);
        }
        .status-badge {
          transition: opacity 0.15s ease-in-out;
        }
        .status-badge:hover {
          opacity: 0.85;
        }
      `}</style>
    </>
  );
}
