import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, SettingsIcon,
  FileText, Settings, Sun, Moon, Menu,
  X, Receipt, Search, LogOut, Bell,
  PanelLeftClose, PanelLeft, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearToken } from '@/lib/auth';
import { useT, type TKey } from '@/lib/i18n';
import { useDarkMode } from '@/hooks/use-dark-mode';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import CommandPalette from './shared/CommandPalette';

const navItems: { to: string; label: TKey; icon: typeof LayoutDashboard }[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'nav.clients', icon: Users },
  { to: '/documents', label: 'nav.documents', icon: FileText },
];

const mobileNavItems: { to: string; label: TKey; icon: typeof LayoutDashboard }[] = [
  ...navItems,
  { to: '/settings', label: 'nav.settings', icon: SettingsIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const { isDark, toggle } = useDarkMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  useKeyboardShortcuts(useCallback(() => setCmdOpen(true), []));

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const themeLabel = isDark ? t('nav.lightMode') : t('nav.darkMode');

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t('common.skipToContent')}
        </a>
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
        {/* Mobile bottom tab bar */}
        <nav
          aria-label={t('nav.mainNavigation')}
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <div className="flex items-center justify-around h-14">
            {mobileNavItems.map((item) => {
              const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {t(item.label)}
                </Link>
              );
            })}
          </div>
        </nav>


        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-200 lg:relative lg:translate-x-0',
            collapsed ? 'w-[68px]' : 'w-60',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Sidebar Header */}
          <div className={cn('flex h-14 items-center border-b px-3', collapsed ? 'justify-center' : 'gap-2 px-4')}>
            <Receipt className="h-6 w-6 text-primary shrink-0" aria-hidden="true" />
            {!collapsed && <span className="text-lg font-semibold tracking-tight">ChaDev</span>}
            <button
              className="ml-auto lg:hidden rounded-sm p-1 hover:bg-accent"
              onClick={() => setMobileOpen(false)}
              aria-label={t('nav.closeMenu')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Nav */}
          <nav aria-label={t('nav.mainNavigation')} className="flex-1 space-y-1 p-2 pt-3">
            {navItems.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);
              const label = t(item.label);

              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                  {!collapsed && label}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                );
              }
              return link;
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t p-2 space-y-1">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggle}
                    aria-label={themeLabel}
                    className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {isDark ? <Sun className="h-4.5 w-4.5" aria-hidden="true" /> : <Moon className="h-4.5 w-4.5" aria-hidden="true" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{themeLabel}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {isDark ? <Sun className="h-4.5 w-4.5" aria-hidden="true" /> : <Moon className="h-4.5 w-4.5" aria-hidden="true" />}
                {themeLabel}
              </button>
            )}

            {/* Collapse toggle — desktop only */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? t('nav.expand') : undefined}
              aria-expanded={!collapsed}
              className="hidden lg:flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {collapsed ? <PanelLeft className="h-4.5 w-4.5" aria-hidden="true" /> : (
                <>
                  <PanelLeftClose className="h-4.5 w-4.5" aria-hidden="true" />
                  <span className="flex-1 text-left">{t('nav.collapse')}</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Header Bar */}
          <header className="flex h-14 items-center gap-2 border-b bg-card px-4">
            {/* Mobile menu trigger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.openMenu')}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>

            {/* Search trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors w-full max-w-sm"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{t('nav.search')}</span>
              <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>

            <div className="flex-1" />

            <LanguageSwitcher className="hidden sm:flex" />

            {/* Notifications */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={t('nav.notifications')}>
                  <Bell className="h-4.5 w-4.5" aria-hidden="true" />
                  {/* Notification dot — show when there are overdue items */}
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('nav.notifications')}</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* User / Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('nav.userMenu')}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('nav.settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggle}>
                  {isDark ? <Sun className="mr-2 h-4 w-4" aria-hidden="true" /> : <Moon className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {themeLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Page content */}
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4 lg:p-8 focus:outline-none">
            {children}
          </main>
        </div>

        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      </div>
    </TooltipProvider>
  );
}
