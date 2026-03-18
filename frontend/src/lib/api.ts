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

// Request interceptor — attach JWT when available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Clients ──────────────────────────────────────────────
export const getClients = async (search?: string): Promise<Client[]> => {
  const params = search ? { search } : {};
  const { data } = await api.get<Client[]>('/api/clients', { params });
  return data;
};

export const getClient = async (id: number): Promise<Client> => {
  const { data } = await api.get<Client>(`/api/clients/${id}`);
  return data;
};

export const createClient = async (payload: CreateClientPayload): Promise<Client> => {
  const { data } = await api.post<Client>('/api/clients', payload);
  return data;
};

export const updateClient = async (id: number, payload: Partial<CreateClientPayload>): Promise<Client> => {
  const { data } = await api.put<Client>(`/api/clients/${id}`, payload);
  return data;
};

export const deleteClient = async (id: number): Promise<void> => {
  await api.delete(`/api/clients/${id}`);
};

// ── Documents ────────────────────────────────────────────
export const getDocuments = async (params?: {
  type?: string;
  status?: string;
  client_id?: number;
  search?: string;
}): Promise<Document[]> => {
  const { type, ...rest } = params || {};
  const queryParams = { ...rest, document_type: type };
  const { data } = await api.get<Document[]>('/api/documents', { params: queryParams });
  return data;
};

export const getDocument = async (id: number): Promise<Document> => {
  const { data } = await api.get<Document>(`/api/documents/${id}`);
  return data;
};

export const createDocument = async (payload: CreateDocumentPayload): Promise<Document> => {
  const { data } = await api.post<Document>('/api/documents', payload);
  return data;
};

export const updateDocument = async (id: number, payload: Partial<CreateDocumentPayload>): Promise<Document> => {
  const { data } = await api.put<Document>(`/api/documents/${id}`, payload);
  return data;
};

export const deleteDocument = async (id: number): Promise<void> => {
  await api.delete(`/api/documents/${id}`);
};

export const convertDocument = async (id: number): Promise<Document> => {
  const { data } = await api.post<Document>(`/api/documents/${id}/convert`);
  return data;
};

export const updateDocumentStatus = async (id: number, status: string): Promise<Document> => {
  const { data } = await api.patch<Document>(`/api/documents/${id}/status`, { status });
  return data;
};

export async function downloadDocumentPdf(docId: number, docNumber: string, docType: string): Promise<void> {
  const res = await api.get(`/api/documents/${docId}/pdf`, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const typeLabel = docType === 'rechnung' ? 'Rechnung' : 'Offerte';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${typeLabel}_${docNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function sendDocumentEmail(docId: number): Promise<{ message: string; recipient: string }> {
  const res = await api.post(`/api/documents/${docId}/send-email`);
  return res.data;
}

// ── Dashboard ────────────────────────────────────────────
export const getDashboard = async (): Promise<DashboardStats> => {
  const { data } = await api.get<DashboardStats>('/api/dashboard');
  return data;
};

// ── Settings ─────────────────────────────────────────────
export const getSettings = async (): Promise<CompanySettings> => {
  const { data } = await api.get<CompanySettings>('/api/settings');
  return data;
};

export const updateSettings = async (payload: Partial<CompanySettings>): Promise<CompanySettings> => {
  const { data } = await api.put<CompanySettings>('/api/settings', payload);
  return data;
};

// ── Services ─────────────────────────────────────────────
export const getServices = async (): Promise<ServiceTemplate[]> => {
  const { data } = await api.get<ServiceTemplate[]>('/api/services');
  return data;
};

export const createService = async (payload: CreateServicePayload): Promise<ServiceTemplate> => {
  const { data } = await api.post<ServiceTemplate>('/api/services', payload);
  return data;
};

export const updateService = async (id: number, payload: Partial<CreateServicePayload>): Promise<ServiceTemplate> => {
  const { data } = await api.put<ServiceTemplate>(`/api/services/${id}`, payload);
  return data;
};

export const deleteService = async (id: number): Promise<void> => {
  await api.delete(`/api/services/${id}`);
};

// ── Auth ─────────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  company_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  tenant_id: number;
  tenant_name: string;
}

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/api/auth/login', payload);
  return data;
};

export const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>('/api/auth/register', payload);
  return data;
};

export const getMe = async (): Promise<AuthUser> => {
  const { data } = await api.get<AuthUser>('/api/auth/me');
  return data;
};

// ── Logo ─────────────────────────────────────────────────
export const uploadLogo = async (file: File): Promise<{ logo_url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<{ logo_url: string }>('/api/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};



export default api;
