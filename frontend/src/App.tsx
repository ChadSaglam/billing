import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import Documents from '@/pages/Documents';
import DocumentForm from '@/pages/DocumentForm';
import DocumentDetail from '@/pages/DocumentDetail';
import Settings from '@/pages/Settings';

function App() {
  return (
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
  );
}

export default App;
