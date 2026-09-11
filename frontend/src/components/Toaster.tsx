import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const { t } = useT();

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.variant === 'destructive' ? 'alert' : 'status'}
          className={cn(
            'rounded-lg border bg-background p-4 shadow-lg animate-in slide-in-from-bottom-5 fade-in-0',
            item.variant === 'destructive' && 'border-destructive/50 text-destructive'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              aria-label={t('common.close')}
              className="rounded-sm opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
