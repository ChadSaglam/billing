import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * R-24: the three shared state components render server-side in the plain
 * node environment, which is enough to pin their contract (message source,
 * retry button, ARIA roles) without a DOM library.
 */

const envelopeError = {
  message: 'Request failed with status code 500',
  response: {
    status: 500,
    data: { error: { code: 'internal_error', message: 'Datenbank nicht erreichbar', request_id: 'abc123' } },
  },
};

describe('ErrorState', () => {
  it('shows error.message from the envelope and the request id', () => {
    const html = renderToStaticMarkup(<ErrorState error={envelopeError} />);
    expect(html).toContain('Datenbank nicht erreichbar');
    expect(html).toContain('Ref: abc123');
    expect(html).toContain('role="alert"');
  });

  it('falls back to the given text when the error carries no message', () => {
    const html = renderToStaticMarkup(<ErrorState error={{}} fallback="Kunden konnten nicht geladen werden" />);
    expect(html).toContain('Kunden konnten nicht geladen werden');
    expect(html).not.toContain('Ref:');
  });

  it('renders a retry button only when onRetry is given', () => {
    const withRetry = renderToStaticMarkup(<ErrorState error={{}} onRetry={vi.fn()} />);
    const without = renderToStaticMarkup(<ErrorState error={{}} />);
    expect(withRetry).toContain('Erneut versuchen');
    expect(without).not.toContain('Erneut versuchen');
  });
});

describe('PageSkeleton', () => {
  it('is announced as busy status and can drop the header block', () => {
    const html = renderToStaticMarkup(<PageSkeleton variant="detail" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    const noHeader = renderToStaticMarkup(<PageSkeleton variant="cards" rows={2} header={false} />);
    expect(noHeader.length).toBeLessThan(html.length);
  });
});

describe('EmptyState', () => {
  it('renders title, description and the primary action', () => {
    const html = renderToStaticMarkup(
      <EmptyState preset="clients" title="Keine Kunden" description="Erfassen Sie Ihren ersten Kunden" action={<button>Neuer Kunde</button>} />,
    );
    expect(html).toContain('Keine Kunden');
    expect(html).toContain('Erfassen Sie Ihren ersten Kunden');
    expect(html).toContain('<button>Neuer Kunde</button>');
  });
});
