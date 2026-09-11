import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSsoApps, launchSsoApp, openSsoApp, type SsoHttp } from '@/lib/api';

/**
 * R-103: the SSO helpers take the http client as a parameter, so they are
 * tested with a stub in the plain node environment — no axios, no network.
 */

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

function stubHttp(routes: Record<string, unknown>): SsoHttp & { calls: Array<{ url: string; params?: Record<string, string> }> } {
  const calls: Array<{ url: string; params?: Record<string, string> }> = [];
  return {
    calls,
    async get<T>(url: string, config?: { params?: Record<string, string> }) {
      calls.push({ url, params: config?.params });
      if (!(url in routes)) throw new Error(`unexpected ${url}`);
      const data = routes[url];
      if (data instanceof Error) throw data;
      return { data: data as T };
    },
  };
}

const apps = [{ id: 'buchhaltung', name: 'Buchhaltung', url: 'http://localhost:3000' }];

beforeEach(() => vi.restoreAllMocks());

describe('getSsoApps', () => {
  it('returns the list from /api/sso/apps', async () => {
    const http = stubHttp({ '/api/sso/apps': apps });
    expect(await getSsoApps(http)).toEqual(apps);
    expect(http.calls).toEqual([{ url: '/api/sso/apps', params: undefined }]);
  });

  it('normalises a non-array body to an empty list (unconfigured platform)', async () => {
    expect(await getSsoApps(stubHttp({ '/api/sso/apps': null }))).toEqual([]);
    expect(await getSsoApps(stubHttp({ '/api/sso/apps': {} }))).toEqual([]);
  });
});

describe('launchSsoApp', () => {
  it('asks /api/sso/launch for the app and returns the hand-off url', async () => {
    const http = stubHttp({ '/api/sso/launch': { url: 'http://localhost:3000/sso#token=abc' } });
    expect(await launchSsoApp('buchhaltung', http)).toBe('http://localhost:3000/sso#token=abc');
    expect(http.calls).toEqual([{ url: '/api/sso/launch', params: { app: 'buchhaltung' } }]);
  });

  it('propagates the 404 of an unconfigured platform', async () => {
    const notFound = Object.assign(new Error('Request failed with status code 404'), {
      response: { status: 404, data: { error: { code: 'http_404', message: 'SSO target not available' } } },
    });
    await expect(launchSsoApp('buchhaltung', stubHttp({ '/api/sso/launch': notFound }))).rejects.toBe(notFound);
  });

  it('rejects a response without a url instead of navigating to "undefined"', async () => {
    await expect(launchSsoApp('buchhaltung', stubHttp({ '/api/sso/launch': {} }))).rejects.toThrow(/no url/);
  });
});

describe('openSsoApp', () => {
  it('navigates the browser to the minted url', async () => {
    const http = stubHttp({ '/api/sso/launch': { url: 'http://localhost:3000/sso#token=abc' } });
    const navigate = vi.fn();
    await openSsoApp('buchhaltung', http, navigate);
    expect(navigate).toHaveBeenCalledWith('http://localhost:3000/sso#token=abc');
  });

  it('does not navigate when the launch fails', async () => {
    const navigate = vi.fn();
    await expect(openSsoApp('buchhaltung', stubHttp({ '/api/sso/launch': new Error('boom') }), navigate)).rejects.toThrow('boom');
    expect(navigate).not.toHaveBeenCalled();
  });
});
