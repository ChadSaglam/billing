import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { CompanySettings } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { CompanyInfoTab } from '@/components/settings/CompanyInfoTab';
import { BankDetailsTab } from '@/components/settings/BankDetailsTab';
import { DefaultsTab } from '@/components/settings/DefaultsTab';
import { TemplatesTab } from '@/components/settings/TemplatesTab';
import { ServiceManager } from '@/components/ServiceManager';

export default function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [serviceManagerOpen, setServiceManagerOpen] = useState(false);

  const { data: settings, isLoading } = useQuery({
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
      toast({ title: 'Settings saved successfully' });
    },
    onError: () => toast({ title: 'Failed to save settings', variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const onFieldChange = (field: keyof CompanySettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const saveButton = (
    <Button type="submit" disabled={mutation.isPending} className="mt-4">
      {mutation.isPending ? 'Saving...' : 'Save Settings'}
    </Button>
  );

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Settings" />
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">Company Info</TabsTrigger>
            <TabsTrigger value="bank">Bank Details</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
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
              value={(form as any).pdf_template || 'modern'}
              onChange={(t) => setForm((prev) => ({ ...prev, pdf_template: t }))}
            />
            {saveButton}
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>Service Templates</CardTitle>
                <CardDescription>Manage your reusable service catalog</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" onClick={() => setServiceManagerOpen(true)}>
                  Manage Services
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>

      <ServiceManager open={serviceManagerOpen} onOpenChange={setServiceManagerOpen} />
    </div>
  );
}
