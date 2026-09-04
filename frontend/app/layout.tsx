'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';

// Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

import Topbar from './Topbar';
import Sidebar from './Sidebar';

/* ============================================================================
 * 1. QURAN VERSE ALGORITHM & COMPONENT
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
        const fallbackText = '"Allah does not charge a soul except with that which He has given it."';
        const fallbackRef = 'QS. At-Talaq 65:7';

        setVerseText(fallbackText);
        setVerseRef(fallbackRef);
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
 * 2. GLOBAL HELPERS & THEME CONTROLLER INLINE SCRIPT
 * ============================================================================ */
const globalHelpersScript = `
  (function() {
    try {
      const savedTheme = localStorage.getItem('aumo_theme');
      const theme = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
      document.documentElement.setAttribute('data-bs-theme', theme);
    } catch (error) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
  })();

  window.aumoModal = {
    show: function (elementId) {
      const element = document.getElementById(elementId);
      if (!element) return;
      if (typeof bootstrap === 'undefined') return;
      const instance = bootstrap.Modal.getOrCreateInstance(element);
      instance.show();
    },
    hide: function (elementId) {
      const element = document.getElementById(elementId);
      if (!element) return;
      if (typeof bootstrap === 'undefined') return;
      const instance = bootstrap.Modal.getInstance(element) || bootstrap.Modal.getOrCreateInstance(element);
      if (instance) instance.hide();

      setTimeout(() => {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        if (backdrops.length > 0 && !document.querySelector('.modal.show')) {
          backdrops.forEach(b => b.remove());
          document.body.classList.remove('modal-open');
          document.body.style.removeProperty('overflow');
          document.body.style.removeProperty('padding-right');
        }
      }, 150);
    }
  };

  window.aumoTheme = {
    get: function () {
      return document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'light' : 'dark';
    },
    set: function (themeName) {
      const theme = themeName === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-bs-theme', theme);
      localStorage.setItem('aumo_theme', theme);
    },
    toggle: function () {
      const nextTheme = this.get() === 'dark' ? 'light' : 'dark';
      this.set(nextTheme);
      return nextTheme;
    },
    restore: function () {
      const savedTheme = localStorage.getItem('aumo_theme');
      const theme = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
      document.documentElement.setAttribute('data-bs-theme', theme);
      return theme;
    }
  };

  window.setAppTheme = function(themeName) {
    window.aumoTheme.set(themeName);
  };

  window.aumoTime = {
    getLocalTimestamp: function () {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}T\${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}\`;
    }
  };

  window.triggerSyncProcess = function(isSuccess = true, queueTimeMs = 10000) {
    const syncBtn = document.getElementById('syncBtn');
    const syncIcon = document.getElementById('syncIcon');
    if (!syncBtn || !syncIcon) return;

    syncBtn.classList.remove('text-info', 'text-danger', 'text-success', 'text-secondary');
    syncBtn.style.color = '#d97706';
    syncBtn.title = "Syncing: In queue (10 seconds)...";
    syncIcon.className = "ti ti-refresh spin"; 

    setTimeout(() => {
      syncIcon.classList.remove('spin');
      syncBtn.style.color = '';
      if (isSuccess) {
        syncBtn.classList.add('text-info');
        syncBtn.title = "Sync: Saved to Database";
        syncIcon.className = "ti ti-cloud-check";
      } else {
        syncBtn.classList.add('text-danger');
        syncBtn.title = "Sync: Error saving data!";
        syncIcon.className = "ti ti-cloud-off";
      }
    }, queueTimeMs);
  };
`;

/* ============================================================================
 * 3. ROOT LAYOUT COMPONENT
 * ============================================================================ */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname.startsWith('/auth') || pathname === '/login';

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('User');

  const [hasActivePeriod] = useState<boolean>(true);
  const [isViewingClosed] = useState<boolean>(false);
  const [periodText] = useState<string>('Januari 2026');
  const [showReportsFlyout, setShowReportsFlyout] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    setShowReportsFlyout(false);

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');

    const hasToken = Boolean(token || userId);
    setIsAuthenticated(hasToken);

    if (userEmail) {
      setCurrentUserEmail(userEmail);
    }

    if (!hasToken && !isAuthRoute) {
      router.push('/auth');
    }
  }, [pathname, isAuthRoute, router]);

  const changeTheme = (theme: 'dark' | 'light') => {
    if (typeof window !== 'undefined' && (window as any).aumoTheme) {
      (window as any).aumoTheme.set(theme);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    setIsAuthenticated(false);
    setCurrentUserEmail('User');
    router.push('/auth');
  };

  const toggleReportsFlyout = () => setShowReportsFlyout((prev) => !prev);
  const closeFlyout = () => setShowReportsFlyout(false);

  if (!isMounted) {
    return (
      <html lang="en-US">
        <head>
          <script dangerouslySetInnerHTML={{ __html: globalHelpersScript }} />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
        </head>
        <body className="bg-dark text-white min-vh-100 d-flex align-items-center justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en-US">
      <head>
        <script dangerouslySetInnerHTML={{ __html: globalHelpersScript }} />
        {/* TABLER ICONS CDN */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body>
        {isAuthRoute ? (
          <div className="d-flex justify-content-center align-items-center min-vh-100 bg-body-tertiary">
            <div style={{ width: '100%', maxWidth: '420px', padding: '15px' }}>
              {children}
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column min-vh-100 min-vw-0 aumo-main-shell">
            <Topbar
              isAuthenticated={isAuthenticated}
              hasActivePeriod={hasActivePeriod}
              isViewingClosed={isViewingClosed}
              periodText={periodText}
              QuranVerse={QuranVerse}
              changeTheme={changeTheme}
            />

            {/* SEARCH MODAL */}
            {isAuthenticated && (
              <div className="modal fade" id="searchModal" tabIndex={-1} aria-hidden="true">
                <div className="modal-dialog modal-dialog-top modal-md mt-5">
                  <div className="modal-content topbar-solid border border-secondary border-opacity-10 shadow">
                    <div className="modal-body p-3">
                      <div className="input-group">
                        <span className="input-group-text bg-transparent border-0 text-warning">
                          <i className="ti ti-search"></i>
                        </span>
                        <input
                          type="search"
                          className="form-control bg-transparent border-0 shadow-none text-body"
                          placeholder="Type a command or search accounts, entries..."
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-close btn-close-white ms-2 my-auto"
                          data-bs-dismiss="modal"
                          aria-label="Close"
                        ></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MAIN SHELL & SIDEBAR SECTION */}
            <div className="d-flex flex-grow-1 position-relative">
              {isAuthenticated && (
                <Sidebar
                  pathname={pathname}
                  showReportsFlyout={showReportsFlyout}
                  currentUserEmail={currentUserEmail}
                  toggleReportsFlyout={toggleReportsFlyout}
                  closeFlyout={closeFlyout}
                  handleSignOut={handleSignOut}
                />
              )}

              {/* MAIN CONTENT AREA */}
              <main id="mainContent" className="content flex-grow-1 p-2 p-md-4 d-flex flex-column" role="main">
                {children}
              </main>
            </div>
          </div>
        )}

        <style jsx global>{`
          body {
            transition: background-color 0.2s ease, color 0.2s ease;
          }
          .content {
            transition: background-color 0.2s ease;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
            display: inline-block;
          }
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
          @media (max-width: 767.98px) {
            #mainContent {
              padding: 0.75rem 0.5rem !important;
            }
          }
        `}</style>

        <Script src="https://code.jquery.com/jquery-3.7.1.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}