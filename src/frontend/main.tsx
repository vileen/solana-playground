import React from 'react';
import ReactDOM from 'react-dom/client';

import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
// Import PrimeReact theme first, then components
import 'primereact/resources/primereact.min.css';

import App from './App.js';
import { AppProvider } from './AppContext.js';
import './TabViewFix.css';
// App specific styles last
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
