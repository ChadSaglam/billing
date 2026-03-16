import axios from 'axios';
import type {
  Client,
  CreateClientPayload,
  Document,
  CreateDocumentPayload,
  DashboardStats,
  CompanySettings,
  ServiceTemplate,
  CreateServicePayload,
} from '@/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Clients
export const getClients = async (search?: string): Promise<Client[]> => {
  const params = search ? { search } : {};
  const { data } = await api.get('/api/clients', { params });
  return data;
};

export const getClient = async (id: number): Promise<Client> => {
  const { data } = await api.get(`/api/clients/${id}`);
  return data;
};

export const createClient = async (payload: CreateClientPayload): Promise<Client> => {
  const { data } = await api.post('/api/clients', payload);
  return data;
};

export const updateClient = async (id: number, payload: Partial<CreateClientPayload>): Promise<Client> => {
  const { data } = await api.put(`/api/clients/${id}`, payload);
  return data;
};

export const deleteClient = async (id: number): Promise<void> => {
  await api.delete(`/api/clients/${id}`);
};

// Documents
export const getDocuments = async (params?: {
  type?: string;
  status?: string;
  client_id?: number;
  search?: string;
}): Promise<Document[]> => {
  const { data } = await api.get('/api/documents', { params });
  return data;
};

export const getDocument = async (id: number): Promise<Document> => {
  const { data } = await api.get(`/api/documents/${id}`);
  return data;
};

export const createDocument = async (payload: CreateDocumentPayload): Promise<Document> => {
  const { data } = await api.post('/api/documents', payload);
  return data;
};

export const updateDocument = async (id: number, payload: Partial<CreateDocumentPayload>): Promise<Document> => {
  const { data } = await api.put(`/api/documents/${id}`, payload);
  return data;
};

export const deleteDocument = async (id: number): Promise<void> => {
  await api.delete(`/api/documents/${id}`);
};

export const convertDocument = async (id: number): Promise<Document> => {
  const { data } = await api.post(`/api/documents/${id}/convert`);
  return data;
};

export const updateDocumentStatus = async (id: number, status: string): Promise<Document> => {
  const { data } = await api.patch(`/api/documents/${id}/status`, { status });
  return data;
};

export const getDocumentPdfUrl = (id: number): string => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return `${baseURL}/api/documents/${id}/pdf`;
};

// Dashboard
export const getDashboard = async (): Promise<DashboardStats> => {
  const { data } = await api.get('/api/dashboard');
  return data;
};

// Settings
export const getSettings = async (): Promise<CompanySettings> => {
  const { data } = await api.get('/api/settings');
  return data;
};

export const updateSettings = async (payload: Partial<CompanySettings>): Promise<CompanySettings> => {
  const { data } = await api.put('/api/settings', payload);
  return data;
};

// Services (line item templates)
export const getServices = async (): Promise<ServiceTemplate[]> => {
  const { data } = await api.get('/api/services');
  return data;
};

export const createService = async (payload: CreateServicePayload): Promise<ServiceTemplate> => {
  const { data } = await api.post('/api/services', payload);
  return data;
};

export const updateService = async (id: number, payload: Partial<CreateServicePayload>): Promise<ServiceTemplate> => {
  const { data } = await api.put(`/api/services/${id}`, payload);
  return data;
};

export const deleteService = async (id: number): Promise<void> => {
  await api.delete(`/api/services/${id}`);
};

// Logo upload
export const uploadLogo = async (file: File): Promise<{ logo_url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export default api;
