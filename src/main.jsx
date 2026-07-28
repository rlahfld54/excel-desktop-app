import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';

import App from './App';
import ThemeProvider from './utils/ThemeContext';
import { ToastProvider } from './components/common';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider>
        <ToastProvider><App /></ToastProvider>
      </ThemeProvider>
    </Router>
  </React.StrictMode>
);
