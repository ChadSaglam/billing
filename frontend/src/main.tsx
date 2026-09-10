import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { Toaster } from '@/components/Toaster';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage, getApiErrorStatus, getRequestId } from '@/lib/errors';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: unknown) => {
        let msg = getApiErrorMessage(error, 'An unexpected error occurred');
        // Server-side failures are the ones support needs to correlate.
        const status = getApiErrorStatus(error);
        const requestId = getRequestId(error);
        if (status !== undefined && status >= 500 && requestId) msg += ` (Ref: ${requestId})`;
        toast({ title: msg, variant: 'destructive' });
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
