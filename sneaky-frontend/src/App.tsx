import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';

import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/Common/LoadingSpinner';

// Pages
import LoginPage from '@/pages/Auth/LoginPage';
import RegisterPage from '@/pages/Auth/RegisterPage';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import ServersPage from '@/pages/Servers/ServersPage';
import ServerDetailPage from '@/pages/Servers/ServerDetailPage';
import DomainsPage from '@/pages/Domains/DomainsPage';
import DeploymentsPage from '@/pages/Deployments/DeploymentsPage';
import BillingPage from '@/pages/Billing/BillingPage';
import SettingsPage from '@/pages/Settings/SettingsPage';
import NotFoundPage from '@/pages/NotFound/NotFoundPage';

const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <LoadingSpinner size={60} />
      </Box>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/servers/:id" element={<ServerDetailPage />} />
        <Route path="/domains" element={<DomainsPage />} />
        <Route path="/deployments" element={<DeploymentsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
};

export default App;