import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAuthenticated } from '@/lib/auth';
import { getSettings } from '@/lib/api';
import type { CompanySettings } from '@/types';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import Documents from '@/pages/Documents';
import DocumentDetail from '@/pages/DocumentDetail';
import DocumentForm from '@/pages/DocumentForm';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Portal from '@/pages/Portal';
import Onboarding from '@/pages/Onboarding';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading, isFetching } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: isAuthenticated(),
    retry: false,
  });

  if (isLoading || isFetching) return null;

  if (settings && !(settings as CompanySettings & { onboarding_completed?: boolean }).onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/:token" element={<Portal />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/documents/new" element={<DocumentForm />} />
                  <Route path="/documents/:id" element={<DocumentDetail />} />
                  <Route path="/documents/:id/edit" element={<DocumentForm />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </OnboardingGate>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}