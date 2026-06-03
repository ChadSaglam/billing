import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSettings, createClient, completeOnboarding } from '@/lib/api';
import type { CompanySettings, CreateClientPayload } from '@/types';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogoUpload } from '@/components/LogoUpload';
import { Building2, Upload, Users, FileText, ChevronRight, ChevronLeft, Check } from 'lucide-react';

const STEPS = [
  { id: 'company', title: 'Company Info', icon: Building2, description: 'Set up your business details' },
  { id: 'logo', title: 'Upload Logo', icon: Upload, description: 'Add your company logo' },
  { id: 'client', title: 'First Client', icon: Users, description: 'Create your first client' },
  { id: 'done', title: 'Ready!', icon: FileText, description: "You're all set" },
] as const;

interface MutationError {
  response?: { data?: { detail?: string }; status?: number };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const [company, setCompany] = useState({
    company_name: '',
    street: '',
    postal_code: '',
    city: '',
    email: '',
    phone: '',
    uid: '',
    bank_name: '',
    iban: '',
    bic: '',
  });

  const [client, setClient] = useState<CreateClientPayload>({
    customer_number: '10001',
    company_name: '',
    street: '',
    postal_code: '',
    city: '',
    country: 'Schweiz',
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploaded, setLogoUploaded] = useState(false);

  const settingsMutation = useMutation({
    mutationFn: () => updateSettings(company as Partial<CompanySettings>),
    onSuccess: () => {
      toast({ title: 'Company info saved' });
      setStep(1);
    },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const clientMutation = useMutation({
    mutationFn: () => createClient(client),
    onSuccess: () => {
      toast({ title: 'Client created' });
      setStep(3);
    },
    onError: (err: MutationError) => {
      if (err.response?.status === 409) {
        toast({ title: 'Client already exists — skipping ahead' });
        setStep(3);
      } else {
        toast({ title: 'Failed to create client', variant: 'destructive' });
      }
    },
  });

  const finishMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: async () => {
      // refetchQueries waits for the fresh data — onboarding_completed will be true
      await queryClient.refetchQueries({ queryKey: ['settings'] });
      navigate('/', { replace: true });
    },
  });

  const companyField = (field: string, label: string, placeholder?: string) => (
    <div key={field}>
      <label className="text-sm font-medium">{label}</label>
      <Input
        value={(company as Record<string, string>)[field] || ''}
        onChange={(e) => setCompany((p) => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  const clientField = (field: keyof CreateClientPayload, label: string, placeholder?: string) => (
    <div key={field}>
      <label className="text-sm font-medium">{label}</label>
      <Input
        value={(client[field] as string) || ''}
        onChange={(e) => setClient((p) => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm transition-all ${
                    isDone
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && (
              <form
                onSubmit={(e) => { e.preventDefault(); settingsMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  {companyField('company_name', 'Company Name', 'My Company GmbH')}
                  {companyField('uid', 'UID', 'CHE-123.456.789')}
                  {companyField('street', 'Street', 'Bahnhofstrasse 1')}
                  {companyField('postal_code', 'PLZ', '8001')}
                  {companyField('city', 'City', 'Zürich')}
                  {companyField('email', 'Email', 'info@company.ch')}
                  {companyField('phone', 'Phone', '+41 44 123 45 67')}
                  {companyField('bank_name', 'Bank', 'UBS Switzerland AG')}
                  {companyField('iban', 'IBAN', 'CH93 0076 2011 6238 5295 7')}
                  {companyField('bic', 'BIC', 'UBSWCHZH80A')}
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={settingsMutation.isPending || !company.company_name}>
                    {settingsMutation.isPending ? 'Saving...' : 'Continue'}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <LogoUpload
                    value={logoUrl}
                    onChange={(url) => { setLogoUrl(url); setLogoUploaded(true); }}
                  />
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button onClick={() => setStep(2)}>
                    {logoUploaded ? 'Continue' : 'Skip for now'}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <form
                onSubmit={(e) => { e.preventDefault(); clientMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  {clientField('customer_number', 'Customer Nr.', '10001')}
                  {clientField('company_name', 'Company Name', 'Client GmbH')}
                  {clientField('street', 'Street', 'Hauptstrasse 10')}
                  {clientField('postal_code', 'PLZ', '8001')}
                  {clientField('city', 'City', 'Zürich')}
                  {clientField('country', 'Country', 'Schweiz')}
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="outline" type="button" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={() => setStep(3)}>
                      Skip
                    </Button>
                    <Button type="submit" disabled={clientMutation.isPending || !client.company_name}>
                      {clientMutation.isPending ? 'Creating...' : 'Create & Continue'}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="text-center space-y-6 py-8">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium">You're all set!</p>
                  <p className="text-muted-foreground mt-1">
                    Start creating your first Offerte or Rechnung.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => finishMutation.mutate()}
                  disabled={finishMutation.isPending}
                >
                  {finishMutation.isPending ? 'Finishing...' : 'Go to Dashboard'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}