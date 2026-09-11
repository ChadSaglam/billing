import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton } from './TableSkeleton';
import { useT } from '@/lib/i18n';

type Variant = 'list' | 'detail' | 'form' | 'dashboard' | 'settings' | 'cards';

interface PageSkeletonProps {
  variant?: Variant;
  /** Rows for the `list` variant. */
  rows?: number;
  /** Set false when the page already renders its real <PageHeader>. */
  header?: boolean;
}

/**
 * R-24: the loading placeholder for a whole route. Every page uses one of
 * these shapes instead of its own stack of <Skeleton>s. Announced to
 * assistive tech through role="status".
 */
export function PageSkeleton({ variant = 'list', rows = 5, header = true }: PageSkeletonProps) {
  const { t } = useT();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6 animate-in fade-in-0 duration-300">
      <span className="sr-only">{t('common.loading')}</span>
      {header && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      )}
      {variant === 'list' && <TableSkeleton rows={rows} />}
      {variant === 'cards' && (
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {variant === 'detail' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </>
      )}
      {variant === 'form' && (
        <>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-28 w-full" />
        </>
      )}
      {variant === 'dashboard' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-64 w-full" />
        </>
      )}
      {variant === 'settings' && (
        <>
          <Skeleton className="h-9 w-96" />
          <Skeleton className="h-72 w-full" />
        </>
      )}
    </div>
  );
}
