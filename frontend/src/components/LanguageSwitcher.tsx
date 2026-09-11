import { Languages } from 'lucide-react';
import { LOCALES, useT, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  /** `segmented` renders DE | EN pills, `select` a native select (settings). */
  variant?: 'segmented' | 'select';
  className?: string;
}

/** DE/EN toggle; the choice is persisted by the i18n store (R-25). */
export function LanguageSwitcher({ variant = 'segmented', className }: LanguageSwitcherProps) {
  const { t, locale, setLocale } = useT();

  if (variant === 'select') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <label htmlFor="language-select" className="text-sm font-medium">
          {t('common.language')}
        </label>
        <select
          id="language-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('nav.switchLanguage')}
      className={cn('flex items-center gap-1 rounded-lg border bg-background p-0.5', className)}
    >
      <Languages className="h-4 w-4 text-muted-foreground ml-1.5" aria-hidden="true" />
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          aria-pressed={locale === l.code}
          aria-label={l.label}
          data-testid={`lang-${l.code}`}
          className={cn(
            'rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            locale === l.code
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}
