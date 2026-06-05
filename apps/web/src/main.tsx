import ReactDOM from 'react-dom/client';

import React from 'react';

import App from './App.tsx';
import './i18n';
import './index.css';
import { ThemeProvider } from './theme/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
