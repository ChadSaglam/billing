import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/lib/api';
import type { CompanySettings } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogoUpload } from '@/components/LogoUpload';
import { ServiceManager } from '@/components/ServiceManager';

export default function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [serviceManagerOpen, setServiceManagerOpen] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Sync query data into local form state
  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Settings saved successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    },
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
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company details and defaults</p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company">Company Info</TabsTrigger>
          <TabsTrigger value="bank">Bank Details</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit}>
          {/* Company Info */}
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Your business details for invoices and documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={form.company_name || ''}
                      onChange={(e) => updateField('company_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UID</Label>
                    <Input
                      value={form.uid || ''}
                      onChange={(e) => updateField('uid', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Street</Label>
                  <Input
                    value={form.street || ''}
                    onChange={(e) => updateField('street', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input
                      value={form.postal_code || ''}
                      onChange={(e) => updateField('postal_code', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={form.city || ''}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={form.country || ''}
                      onChange={(e) => updateField('country', e.target.value)}
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => updateField('email', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={form.website || ''}
                      onChange={(e) => updateField('website', e.target.value)}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <LogoUpload
                    value={form.logo_url || null}
                    onChange={(url) => updateField('logo_url', url)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </TabsContent>

          {/* Bank Details */}
          <TabsContent value="bank" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bank Details</CardTitle>
                <CardDescription>Used for payment information on invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={form.bank_name || ''}
                    onChange={(e) => updateField('bank_name', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IBAN</Label>
                    <Input
                      value={form.iban || ''}
                      onChange={(e) => updateField('iban', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BIC/Swift</Label>
                    <Input
                      value={form.bic || ''}
                      onChange={(e) => updateField('bic', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </TabsContent>

          {/* Defaults */}
          <TabsContent value="defaults" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Defaults</CardTitle>
                <CardDescription>Default values for new documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Hourly Rate (CHF)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.default_hourly_rate || ''}
                      onChange={(e) => updateField('default_hourly_rate', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Payment Terms (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.default_payment_terms_days || ''}
                      onChange={(e) =>
                        updateField('default_payment_terms_days', Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Next Invoice Number</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.next_invoice_number || ''}
                      onChange={(e) => updateField('next_invoice_number', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Next Offerte Number</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.next_offerte_number || ''}
                      onChange={(e) => updateField('next_offerte_number', Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </TabsContent>
        </form>

        {/* Services — outside form since it manages its own data */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Templates</CardTitle>
              <CardDescription>Manage your reusable service catalog for quick line-item entry</CardDescription>
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
