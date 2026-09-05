'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Script from 'next/script';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

/* ============================================================================
 * GLOBAL HELPERS & THEME CONTROLLER INLINE SCRIPT
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
 * ROOT LAYOUT COMPONENT
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

  useEffect(() => {
    setIsMounted(true);

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const hasToken = Boolean(token || userId);

    if (!hasToken && !isAuthRoute) {
      router.push('/auth');
    }
  }, [pathname, isAuthRoute, router]);

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
        {/* TABLER ICONS VIA CDN */}
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
            {/* MAIN CONTENT AREA */}
            <main id="mainContent" className="content flex-grow-1 p-2 p-md-4 d-flex flex-column" role="main">
              <div className="flex-grow-1">
                {children}
              </div>

              {/* FOOTER */}
              <footer className="mt-auto pt-3 border-top border-secondary border-opacity-10 text-center text-body-tertiary" style={{ fontSize: '0.75rem' }}>
                <div className="fw-medium text-body-secondary mb-1">Aumo Finance by rdmmonlight</div>
                <div>© 2026 rdmmonlight. All rights reserved. Proprietary.</div>
              </footer>
            </main>
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
          .hr-matte {
            border: none !important;
            height: 1px !important;
            background-color: rgba(255, 255, 255, 0.1) !important;
            opacity: 1 !important;
            box-shadow: none !important;
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
