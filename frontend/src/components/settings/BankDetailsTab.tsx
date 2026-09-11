import type { CompanySettings } from '@/types';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useT } from '@/lib/i18n';

interface BankDetailsTabProps {
  form: Partial<CompanySettings>;
  onFieldChange: (field: keyof CompanySettings, value: string | number) => void;
}

export function BankDetailsTab({ form, onFieldChange }: BankDetailsTabProps) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.bankDetails')}</CardTitle>
        <CardDescription>{t('settings.bankDetailsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label={t('field.bankName')} value={form.bank_name || ''} onChange={(v) => onFieldChange('bank_name', v)} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('field.iban')} value={form.iban || ''} onChange={(v) => onFieldChange('iban', v)} />
          <FormField label={t('field.bic')} value={form.bic || ''} onChange={(v) => onFieldChange('bic', v)} />
        </div>
      </CardContent>
    </Card>
  );
}
