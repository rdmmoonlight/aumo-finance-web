import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Memformat path aktif menjadi breadcrumb sederhana
  const formatPathname = (path: string) => {
    if (path === '/' || path === '') return 'Home';
    return path
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.replace(/-/g, ' '))
      .join(' / ');
  };

  const handleLogout = () => {
    // Navigasi ke halaman auth saat logout
    navigate('/auth');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Current Location / Breadcrumb */}
      <div className="text-sm font-medium text-gray-600 capitalize">
        {formatPathname(location.pathname)}
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}