'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Script from 'next/script';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import Topbar from './Topbar';
import Sidebar from './Sidebar';

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
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = pathname.startsWith('/auth') || pathname === '/login';

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('User');

  useEffect(() => {
    setIsMounted(true);

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');

    const hasToken = Boolean(token || userId);
    setIsAuthenticated(hasToken);

    if (userEmail) setCurrentUserEmail(userEmail);

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
            {/* TOPBAR */}
            <Topbar isAuthenticated={isAuthenticated} changeTheme={changeTheme} />

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

            {/* SIDEBAR & MAIN CONTENT */}
            <div className="d-flex flex-grow-1 position-relative">
              {isAuthenticated && (
                <Sidebar
                  pathname={pathname}
                  currentUserEmail={currentUserEmail}
                  handleSignOut={handleSignOut}
                />
              )}

              <main id="mainContent" className="content flex-grow-1 p-2 p-md-4 d-flex flex-column" role="main">
                <div className="flex-grow-1">
                  {children}
                </div>

                <footer className="mt-auto pt-3 border-top border-secondary border-opacity-10 text-center text-body-tertiary" style={{ fontSize: '0.75rem' }}>
                  <div className="fw-medium text-body-secondary mb-1">Aumo Finance by rdmmonlight</div>
                  <div>© 2026 rdmmonlight. All rights reserved. Proprietary.</div>
                </footer>
              </main>
            </div>
          </div>
        )}

        <style jsx global>{`
          body { transition: background-color 0.2s ease, color 0.2s ease; }
          .content { transition: background-color 0.2s ease; }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
            display: inline-block;
          }
          @media (max-width: 767.98px) {
            #mainContent { padding: 0.75rem 0.5rem !important; }
          }
        `}</style>

        <Script src="https://code.jquery.com/jquery-3.7.1.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
