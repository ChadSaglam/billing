import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, ExternalLink } from 'lucide-react';
import { getSsoApps, openSsoApp } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { getApiErrorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Platform app switcher (R-103). Lists the products `/api/sso/apps` offers
 * and hands the browser over through `/api/sso/launch` — billing is the
 * identity issuer, so the other app receives a short-lived SSO token in the
 * URL fragment. Renders nothing when the platform is not configured, so an
 * unconfigured install shows no dead entry.
 */
export function AppSwitcher({ className }: { className?: string }) {
  const { t } = useT();
  const [launching, setLaunching] = useState<string | null>(null);
  const { data: apps = [] } = useQuery({
    queryKey: queryKeys.sso.apps,
    queryFn: () => getSsoApps(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (apps.length === 0) return null;

  const launch = async (id: string) => {
    setLaunching(id);
    try {
      await openSsoApp(id);
    } catch (err) {
      toast({
        title: t('nav.appLaunchFailed'),
        description: getApiErrorMessage(err, ''),
        variant: 'destructive',
      });
      setLaunching(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('shrink-0', className)}
          aria-label={t('nav.appsMenu')}
          data-testid="app-switcher"
        >
          <LayoutGrid className="h-4.5 w-4.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('nav.apps')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {apps.map((app) => (
          <DropdownMenuItem
            key={app.id}
            disabled={launching !== null}
            onSelect={() => void launch(app.id)}
            aria-label={t('nav.openApp', { name: app.name })}
            data-testid={`app-switcher-${app.id}`}
          >
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
            {app.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
