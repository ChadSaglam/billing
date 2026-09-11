import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { CompanySettings } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, ErrorState, PageSkeleton } from '@/components/shared';
import { CompanyInfoTab } from '@/components/settings/CompanyInfoTab';
import { BankDetailsTab } from '@/components/settings/BankDetailsTab';
import { DefaultsTab } from '@/components/settings/DefaultsTab';
import { TemplatesTab } from '@/components/settings/TemplatesTab';
import { TeamTab } from '@/components/settings/TeamTab';
import { ServiceManager } from '@/components/ServiceManager';

export default function Settings() {
  const queryClient = useQueryClient();
  const { t } = useT();
  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [serviceManagerOpen, setServiceManagerOpen] = useState(false);

  const { data: settings, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast({ title: t('settings.saved') });
    },
    onError: () => toast({ title: t('settings.saveFailed'), variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const onFieldChange = (field: keyof CompanySettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) return <div className="p-6 max-w-4xl"><PageSkeleton variant="settings" /></div>;
  if (isError) {
    return (
      <div className="p-6 max-w-4xl">
        <ErrorState error={error} fallback={t('settings.loadFailed')} onRetry={() => refetch()} />
      </div>
    );
  }

  const saveButton = (
    <Button type="submit" disabled={mutation.isPending} className="mt-4">
      {mutation.isPending ? t('common.saving') : t('settings.save')}
    </Button>
  );

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title={t('settings.title')} />
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">{t('settings.tabCompany')}</TabsTrigger>
            <TabsTrigger value="bank">{t('settings.tabBank')}</TabsTrigger>
            <TabsTrigger value="defaults">{t('settings.tabDefaults')}</TabsTrigger>
            <TabsTrigger value="templates">{t('settings.tabTemplates')}</TabsTrigger>
            <TabsTrigger value="services">{t('settings.tabServices')}</TabsTrigger>
            <TabsTrigger value="team">{t('settings.tabTeam')}</TabsTrigger>
            <TabsTrigger value="language">{t('settings.tabLanguage')}</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyInfoTab form={form} onFieldChange={onFieldChange} />
            {saveButton}
          </TabsContent>

          <TabsContent value="bank">
            <BankDetailsTab form={form} onFieldChange={onFieldChange} />
            {saveButton}
          </TabsContent>

          <TabsContent value="defaults">
            <DefaultsTab form={form} onFieldChange={onFieldChange} />
            {saveButton}
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab
              value={form.pdf_template || 'modern'}
              onChange={(t: string) => setForm((prev) => ({ ...prev, pdf_template: t }))}
            />
            {saveButton}
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.serviceTemplates')}</CardTitle>
                <CardDescription>{t('settings.serviceTemplatesDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={() => setServiceManagerOpen(true)}>
                  {t('settings.manageServices')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <TeamTab />
          </TabsContent>

          <TabsContent value="language">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.language')}</CardTitle>
                <CardDescription>{t('settings.languageDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <LanguageSwitcher variant="select" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>

      <ServiceManager open={serviceManagerOpen} onOpenChange={setServiceManagerOpen} />
    </div>
  );
}
