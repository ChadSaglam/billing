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

  const updateField = (field: keyof CompanySettings, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const saveButton = (
    <div className="flex justify-end">
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Manage your company details and defaults" />

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company">Company Info</TabsTrigger>
          <TabsTrigger value="bank">Bank Details</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit}>
          <TabsContent value="company" className="space-y-6">
            <CompanyInfoTab form={form} onFieldChange={updateField} />
            {saveButton}
          </TabsContent>
          <TabsContent value="bank" className="space-y-6">
            <BankDetailsTab form={form} onFieldChange={updateField} />
            {saveButton}
          </TabsContent>
          <TabsContent value="defaults" className="space-y-6">
            <DefaultsTab form={form} onFieldChange={updateField} />
            {saveButton}
          </TabsContent>
        </form>

        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Templates</CardTitle>
              <CardDescription>Manage your reusable service catalog</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => setServiceManagerOpen(true)}>
                Manage Services
              </Button>
            </CardContent>
          </Card>
          <ServiceManager open={serviceManagerOpen} onOpenChange={setServiceManagerOpen} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
