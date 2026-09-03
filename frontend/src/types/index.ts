export type Numeric = number | string;

export * as API from './api.generated';

// Client
export interface Client {
  id: number;
  customer_number: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientPayload {
  customer_number: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  street: string;
  postal_code: string;
  city: string;
  country?: string;
  notes?: string | null;
}

// Line Item
export interface LineItem {
  id?: number;
  document_id?: number;
  position: number;
  description: string;
  quantity: Numeric;
  unit_price: Numeric;
  total_price: Numeric;
  vat_rate: Numeric;
  unit: string;
  created_at?: string;
}

// Document
export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface Document {
  id: number;
  document_type: 'offerte' | 'rechnung';
  document_number: string;
  client_id: number;
  client?: Client;
  date: string;
  due_date: string | null;
  payment_terms_days: number;
  status: DocumentStatus;
  subtotal: Numeric;
  discount_percent: Numeric;
  discount_amount: Numeric;
  vat_amount: Numeric;
  total: Numeric;
  currency: string;
  notes: string | null;
  converted_from_id: number | null;
  converted_from?: Document | null;
  line_items: LineItem[];
  // Payment tracking
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  // Recurring
  recurrence: string | null;
  next_recurrence_date: string | null;
  // Portal
  portal_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentPayload {
  document_type: 'offerte' | 'rechnung';
  client_id: number;
  date: string;
  payment_terms_days: number;
  discount_percent: number;
  notes?: string | null;
  status?: string;
  recurrence?: string | null;
  line_items: {
    position: number;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    // No total_price: the server derives it from quantity x unit_price.
    vat_rate: number;
  }[];
}

// Dashboard
export interface DashboardStats {
  total_revenue: Numeric;
  outstanding: Numeric;
  overdue_count: number;
  total_clients: number;
  recent_documents: Document[];
}

// Company Settings
export interface CompanySettings {
  id: number;
  company_name: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  uid: string;
  bank_name: string;
  iban: string;
  bic: string;
  email: string;
  phone: string;
  website: string;
  default_hourly_rate: Numeric;
  default_payment_terms_days: number;
  logo_url: string | null;
  next_invoice_number: number;
  next_offerte_number: number;
  pdf_template: string;
}

// Service Template
export interface ServiceTemplate {
  id: number;
  name: string;
  category: string;
  description: string;
  unit: string;
  default_price: Numeric;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface CreateServicePayload {
  name: string;
  category: string;
  description: string;
  unit: string;
  default_price: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  outstanding: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DashboardStats {
  total_revenue: Numeric;
  outstanding: Numeric;
  overdue_count: number;
  total_clients: number;
  recent_documents: Document[];
  monthly_revenue: MonthlyRevenue[];
  status_distribution: StatusCount[];
}

// Team / Multi-user
export interface TeamUser {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'editor' | 'viewer';
  is_active: boolean;
  created_at: string;
}

export interface InviteUserPayload {
  email: string;
  full_name: string;
  role: string;
}

export interface InviteResponse {
  id: number;
  email: string;
  full_name: string;
  role: string;
  temp_password: string;
}