import type { CompanySettings } from '@/types';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useT } from '@/lib/i18n';

interface DefaultsTabProps {
  form: Partial<CompanySettings>;
  onFieldChange: (field: keyof CompanySettings, value: string | number) => void;
}

export function DefaultsTab({ form, onFieldChange }: DefaultsTabProps) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.defaults')}</CardTitle>
        <CardDescription>{t('settings.defaultsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('settings.defaultHourlyRate')} type="number" min={0} step={0.01} value={form.default_hourly_rate as number || ''} onChange={(v) => onFieldChange('default_hourly_rate', Number(v))} />
          <FormField label={t('settings.defaultPaymentTerms')} type="number" min={0} value={form.default_payment_terms_days || ''} onChange={(v) => onFieldChange('default_payment_terms_days', Number(v))} />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('settings.nextInvoiceNumber')} type="number" min={1} value={form.next_invoice_number || ''} onChange={(v) => onFieldChange('next_invoice_number', Number(v))} />
          <FormField label={t('settings.nextOfferteNumber')} type="number" min={1} value={form.next_offerte_number || ''} onChange={(v) => onFieldChange('next_offerte_number', Number(v))} />
        </div>
      </CardContent>
    </Card>
  );
}
