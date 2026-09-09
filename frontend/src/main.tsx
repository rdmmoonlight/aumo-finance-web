import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';

// Import global styles
import './styles/globals.css';
import './styles/index.css';
import './styles/utilities.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);