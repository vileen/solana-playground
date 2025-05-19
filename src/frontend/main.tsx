import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
// Import PrimeReact theme first, then components
import 'primereact/resources/primereact.min.css';

import App from './App.js';
import { AppProvider } from './AppContext.js';
import DashboardPage from './DashboardPage.js';
import Layout from './Layout.js';
import './TabViewFix.css';
// App specific styles last
import './index.css';

// Create router with our routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <App />
      },
      {
        path: 'dashboard',
        element: <DashboardPage />
      }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  </React.StrictMode>
);
