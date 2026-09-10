import { describe, expect, it } from 'vitest';
import { getApiErrorMessage, getApiErrorStatus, getRequestId } from '@/lib/errors';

const axiosLike = (data: unknown, status = 400, message = 'Request failed with status code 400') => ({
  message,
  response: { status, data },
});

describe('getApiErrorMessage', () => {
  it('prefers error.message from the envelope', () => {
    const err = axiosLike({ detail: 'legacy', error: { code: 'x', message: 'Envelope wins' } });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Envelope wins');
  });

  it('falls back to a string detail when the envelope has no message', () => {
    expect(getApiErrorMessage(axiosLike({ detail: 'Document not found' }), 'fb')).toBe('Document not found');
    expect(getApiErrorMessage(axiosLike({ detail: 'x', error: { message: '' } }), 'fb')).toBe('x');
  });

  it('joins a 422 validation list as field: message', () => {
    const err = axiosLike({
      detail: [
        { loc: ['body', 'line_items', 0, 'unit_price'], msg: 'Input should be a valid decimal' },
        { loc: ['body', 'client_id'], msg: 'Field required' },
        { msg: 'no location' },
        { loc: ['body', 'x'] },
      ],
    }, 422);
    expect(getApiErrorMessage(err, 'fb')).toBe(
      'line_items.0.unit_price: Input should be a valid decimal; client_id: Field required; no location',
    );
  });

  it('uses the transport message when the body is unusable', () => {
    expect(getApiErrorMessage(axiosLike({ detail: [] }, 422, 'Network Error'), 'fb')).toBe('Network Error');
    expect(getApiErrorMessage(axiosLike('not json', 502, 'Bad Gateway'), 'fb')).toBe('Bad Gateway');
    expect(getApiErrorMessage(new Error('boom'), 'fb')).toBe('boom');
  });

  it('returns the fallback for empty, primitive or messageless errors', () => {
    expect(getApiErrorMessage(undefined, 'fb')).toBe('fb');
    expect(getApiErrorMessage(null, 'fb')).toBe('fb');
    expect(getApiErrorMessage('string error', 'fb')).toBe('fb');
    expect(getApiErrorMessage({}, 'fb')).toBe('fb');
    expect(getApiErrorMessage({ message: '' , response: { data: {} } }, 'fb')).toBe('fb');
  });
});

describe('getRequestId / getApiErrorStatus', () => {
  it('reads the request id only when it is a non-empty string', () => {
    expect(getRequestId(axiosLike({ error: { request_id: 'abc123' } }))).toBe('abc123');
    expect(getRequestId(axiosLike({ error: { request_id: '' } }))).toBeUndefined();
    expect(getRequestId(axiosLike({ error: { request_id: 42 } }))).toBeUndefined();
    expect(getRequestId(new Error('x'))).toBeUndefined();
  });

  it('reads a numeric HTTP status', () => {
    expect(getApiErrorStatus(axiosLike({}, 503))).toBe(503);
    expect(getApiErrorStatus({ response: { status: '500' } })).toBeUndefined();
    expect(getApiErrorStatus(null)).toBeUndefined();
  });
});
