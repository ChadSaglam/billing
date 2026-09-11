import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, getRequestId } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  /** The caught error; `error.message` from the R-27 envelope is shown. */
  error: unknown;
  /** Heading, defaults to "Something went wrong". */
  title?: string;
  /** Fallback text when the error carries no message. */
  fallback?: string;
  onRetry?: () => void;
  /** `inline` for a card/section, `page` for a full route. */
  variant?: 'page' | 'inline';
  className?: string;
}

/**
 * R-24: one error surface for every query. Reads the message through
 * lib/errors.ts (envelope → detail → transport → fallback) and shows the
 * request id so support can correlate the log line.
 */
export function ErrorState({ error, title, fallback, onRetry, variant = 'page', className }: ErrorStateProps) {
  const { t } = useT();
  const message = getApiErrorMessage(error, fallback ?? t('common.errorGeneric'));
  const requestId = getRequestId(error);

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-lg border border-destructive/30 bg-destructive/5',
        variant === 'page' ? 'py-16 px-6' : 'py-8 px-4',
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3 mb-3">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-medium">{title ?? t('common.errorTitle')}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md">{message}</p>
      {requestId && (
        <p className="text-xs text-muted-foreground/70 mt-1 font-mono">Ref: {requestId}</p>
      )}
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
