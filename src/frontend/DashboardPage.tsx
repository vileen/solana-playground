import React, { useRef } from 'react';

import { ConfirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';

import Dashboard from './components/Dashboard.js';

const DashboardPage: React.FC = () => {
  const toast = useRef<Toast>(null);

  const handleSuccess = (message: string) => {
    toast.current?.show({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 3000,
    });
  };

  const handleError = (message: string) => {
    toast.current?.show({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  };

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Dashboard onSuccess={handleSuccess} onError={handleError} />
    </>
  );
};

export default DashboardPage; 