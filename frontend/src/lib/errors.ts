/**
 * Read a human-readable message out of an API error.
 *
 * The backend wraps every non-2xx response in the R-27 envelope:
 *
 *   { "detail": ..., "error": { "code", "message", "request_id", "fields"? } }
 *
 * `error.message` is the contract going forward; `detail` is FastAPI's
 * legacy field (a string, or a list of field errors on 422) and will be
 * dropped in a future major. Resolution order:
 *
 *   1. `error.message`
 *   2. `detail` (string, or the 422 list joined by field message)
 *   3. the transport error's own message (axios / fetch / plain Error)
 *   4. `fallback`
 */

interface ValidationItem {
  loc?: unknown[];
  msg?: string;
}

interface ErrorEnvelope {
  code?: string;
  message?: string;
  request_id?: string;
}

interface ApiErrorData {
  detail?: string | ValidationItem[];
  error?: ErrorEnvelope;
}

interface ApiErrorLike {
  message?: unknown;
  response?: { status?: number; data?: unknown };
}

function responseData(err: unknown): ApiErrorData | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const data = (err as ApiErrorLike).response?.data;
  return data && typeof data === 'object' ? (data as ApiErrorData) : undefined;
}

function joinValidationErrors(items: ValidationItem[]): string {
  return items
    .map((item) => {
      const msg = typeof item?.msg === 'string' ? item.msg : '';
      // loc[0] is the source ("body", "query", ...), the rest is the field path.
      const field = Array.isArray(item?.loc) ? item.loc.slice(1).map(String).join('.') : '';
      if (!msg) return '';
      return field ? `${field}: ${msg}` : msg;
    })
    .filter(Boolean)
    .join('; ');
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = responseData(err);

  const envelopeMessage = data?.error?.message;
  if (typeof envelopeMessage === 'string' && envelopeMessage) return envelopeMessage;

  const detail = data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail)) {
    const joined = joinValidationErrors(detail);
    if (joined) return joined;
  }

  const transportMessage = (err as ApiErrorLike | undefined)?.message;
  if (typeof transportMessage === 'string' && transportMessage) return transportMessage;

  return fallback;
}

/** Correlation id for support messages; also sent as the `X-Request-ID` header. */
export function getRequestId(err: unknown): string | undefined {
  const id = responseData(err)?.error?.request_id;
  return typeof id === 'string' && id ? id : undefined;
}

export function getApiErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const status = (err as ApiErrorLike).response?.status;
  return typeof status === 'number' ? status : undefined;
}
