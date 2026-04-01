const ACCESS_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

export const getToken = (): string | null => localStorage.getItem(ACCESS_KEY);
export const setToken = (token: string): void => localStorage.setItem(ACCESS_KEY, token);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);
export const setRefreshToken = (token: string): void => localStorage.setItem(REFRESH_KEY, token);

export const clearTokens = (): void => {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

export const clearToken = clearTokens;

export const isAuthenticated = (): boolean => !!getToken();
