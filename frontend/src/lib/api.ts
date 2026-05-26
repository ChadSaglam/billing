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
import { getToken, getRefreshToken, setToken, setRefreshToken, clearTokens } from '@/lib/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
          { refresh_token: refreshToken }
        );
        setToken(data.access_token);
        setRefreshToken(data.refresh_token);
        api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
        refreshQueue.forEach((cb) => cb(data.access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        clearTokens();
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
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
  const { data } = await api.post('/api/auth/login', payload);
  setToken(data.access_token);
  setRefreshToken(data.refresh_token);
  return data;
};

export const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const { data } = await api.post('/api/auth/register', payload);
  setToken(data.access_token);
  setRefreshToken(data.refresh_token);
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

// ── Bulk Actions ─────────────────────────────────────
export const bulkUpdateStatus = async (payload: {
  document_ids: number[];
  status: string;
  paid_at?: string;
  payment_method?: string;
  payment_reference?: string;
}): Promise<{ updated: number; total: number }> => {
  const { data } = await api.post('/api/documents/bulk/status', payload);
  return data;
};

export const bulkSendEmail = async (document_ids: number[]): Promise<{ sent: number; errors: string[] }> => {
  const { data } = await api.post('/api/documents/bulk/send-email', { document_ids });
  return data;
};

export const bulkDownloadPdfZip = async (document_ids: number[]): Promise<void> => {
  const res = await api.post('/api/documents/bulk/pdf-zip', { document_ids }, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'documents.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generatePortalToken = async (docId: number): Promise<Document> => {
  const { data } = await api.post(`/api/documents/${docId}/portal-token`);
  return data;
};

// ── Portal (public, no auth) ─────────────────────────
export const getPortalDocument = async (token: string) => {
  const { data } = await api.get(`/api/portal/${token}`);
  return data;
};

export const downloadPortalPdf = async (token: string): Promise<void> => {
  const res = await api.get(`/api/portal/${token}/pdf`, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const updateDocumentStatusWithPayment = async (
  id: number,
  payload: { status: string; paid_at?: string; payment_method?: string; payment_reference?: string }
): Promise<Document> => {
  const { data } = await api.patch(`/api/documents/${id}/status`, payload);
  return data;
};

export const duplicateDocument = async (id: number): Promise<Document> => {
  const { data } = await api.post<Document>(`/api/documents/${id}/duplicate`);
  return data;
};

// ── Team / Users ─────────────────────────────────────
export const getTeamUsers = async (): Promise<import('@/types').TeamUser[]> => {
  const { data } = await api.get('/api/users');
  return data;
};

export const inviteUser = async (
  payload: import('@/types').InviteUserPayload
): Promise<import('@/types').InviteResponse> => {
  const { data } = await api.post('/api/users/invite', payload);
  return data;
};

export const updateUser = async (
  id: number,
  payload: { full_name?: string; role?: string; is_active?: boolean }
): Promise<import('@/types').TeamUser> => {
  const { data } = await api.patch(`/api/users/${id}`, payload);
  return data;
};

export const removeUser = async (id: number): Promise<void> => {
  await api.delete(`/api/users/${id}`);
};

// ── Onboarding ───────────────────────────────────────
export const completeOnboarding = async (): Promise<void> => {
  await api.post('/api/settings/onboarding-complete');
};

export default api;