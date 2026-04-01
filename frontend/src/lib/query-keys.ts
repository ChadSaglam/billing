export const queryKeys = {
  clients: {
    all: ['clients'] as const,
    list: (search?: string) => ['clients', { search }] as const,
    detail: (id: number | string) => ['clients', 'detail', String(id)] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (filters?: { type?: string; status?: string; search?: string }) =>
      ['documents', filters] as const,
    detail: (id: number | string) => ['documents', 'detail', String(id)] as const,
  },
  services: {
    all: ['services'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  team: {
    all: ['team'] as const,
    list: () => ['team', 'list'] as const,
  },
} as const;