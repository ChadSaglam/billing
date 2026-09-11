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
import { useT, type TKey } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const STEPS: { id: string; title: TKey; icon: typeof Building2; description: TKey }[] = [
  { id: 'company', title: 'onboarding.companyTitle', icon: Building2, description: 'onboarding.companyDesc' },
  { id: 'logo', title: 'onboarding.logoTitle', icon: Upload, description: 'onboarding.logoDesc' },
  { id: 'client', title: 'onboarding.clientTitle', icon: Users, description: 'onboarding.clientDesc' },
  { id: 'done', title: 'onboarding.doneTitle', icon: FileText, description: 'onboarding.doneDesc' },
];

interface MutationError {
  response?: { data?: { detail?: string }; status?: number };
}

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useT();
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
      toast({ title: t('onboarding.companySaved') });
      setStep(1);
    },
    onError: () => toast({ title: t('onboarding.saveFailed'), variant: 'destructive' }),
  });

  const clientMutation = useMutation({
    mutationFn: () => createClient(client),
    onSuccess: () => {
      toast({ title: t('onboarding.clientCreated') });
      setStep(3);
    },
    onError: (err: MutationError) => {
      if (err.response?.status === 409) {
        toast({ title: t('onboarding.clientExists') });
        setStep(3);
      } else {
        toast({ title: t('onboarding.clientFailed'), variant: 'destructive' });
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
      <label htmlFor={`company-${field}`} className="text-sm font-medium">{label}</label>
      <Input
        id={`company-${field}`}
        value={(company as Record<string, string>)[field] || ''}
        onChange={(e) => setCompany((p) => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  const clientField = (field: keyof CreateClientPayload, label: string, placeholder?: string) => (
    <div key={field}>
      <label htmlFor={`client-${field}`} className="text-sm font-medium">{label}</label>
      <Input
        id={`client-${field}`}
        value={(client[field] as string) || ''}
        onChange={(e) => setClient((p) => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
        <ol aria-label={t('onboarding.steps')} className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <li key={s.id} className="flex items-center gap-2" aria-current={isActive ? 'step' : undefined}>
                <div
                  aria-label={t('onboarding.step', { n: i + 1, title: t(s.title) })}
                  className={`h-10 w-10 rounded-full flex items-center justify-center text-sm transition-all ${
                    isDone
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t(STEPS[step].title)}</CardTitle>
            <CardDescription>{t(STEPS[step].description)}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && (
              <form
                onSubmit={(e) => { e.preventDefault(); settingsMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  {companyField('company_name', t('field.companyName'), 'My Company GmbH')}
                  {companyField('uid', t('field.uid'), 'CHE-123.456.789')}
                  {companyField('street', t('field.street'), 'Bahnhofstrasse 1')}
                  {companyField('postal_code', t('field.postalCode'), '8001')}
                  {companyField('city', t('field.city'), 'Zürich')}
                  {companyField('email', t('field.email'), 'info@company.ch')}
                  {companyField('phone', t('field.phone'), '+41 44 123 45 67')}
                  {companyField('bank_name', t('field.bankName'), 'UBS Switzerland AG')}
                  {companyField('iban', t('field.iban'), 'CH93 0076 2011 6238 5295 7')}
                  {companyField('bic', t('field.bic'), 'UBSWCHZH80A')}
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={settingsMutation.isPending || !company.company_name}>
                    {settingsMutation.isPending ? t('common.saving') : t('common.continue')}
                    <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
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
                    <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" /> {t('common.back')}
                  </Button>
                  <Button onClick={() => setStep(2)}>
                    {logoUploaded ? t('common.continue') : t('onboarding.skipForNow')}
                    <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
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
                  {clientField('customer_number', t('field.customerNumberShort'), '10001')}
                  {clientField('company_name', t('field.companyName'), 'Client GmbH')}
                  {clientField('street', t('field.street'), 'Hauptstrasse 10')}
                  {clientField('postal_code', t('field.postalCode'), '8001')}
                  {clientField('city', t('field.city'), 'Zürich')}
                  {clientField('country', t('field.country'), 'Schweiz')}
                </div>
                <div className="flex justify-between pt-4">
                  <Button variant="outline" type="button" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" /> {t('common.back')}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={() => setStep(3)}>
                      {t('common.skip')}
                    </Button>
                    <Button type="submit" disabled={clientMutation.isPending || !client.company_name}>
                      {clientMutation.isPending ? t('common.creating') : t('onboarding.createContinue')}
                      <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="text-center space-y-6 py-8">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-lg font-medium">{t('onboarding.allSet')}</p>
                  <p className="text-muted-foreground mt-1">
                    {t('onboarding.allSetDesc')}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={() => finishMutation.mutate()}
                  disabled={finishMutation.isPending}
                >
                  {finishMutation.isPending ? t('onboarding.finishing') : t('onboarding.goToDashboard')}
                  <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}