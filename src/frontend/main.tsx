import React from 'react';
import ReactDOM from 'react-dom/client';
// Import PrimeReact theme first, then components
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
// App specific styles last
import './index.css';
import './TabViewFix.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 