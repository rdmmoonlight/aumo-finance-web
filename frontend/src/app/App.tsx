import React from 'react';
import AppRouter from './router';

/**
 * Komponen root aplikasi Aumo Frontend.
 * Tempat meletakkan provider global (Auth, Theme, Toast, dll) di masa mendatang.
 */
export default function App() {
  return (
    <React.Fragment>
      <AppRouter />
    </React.Fragment>
  );
}