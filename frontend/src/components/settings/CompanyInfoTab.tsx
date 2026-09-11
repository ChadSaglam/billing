import type { CompanySettings } from '@/types';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LogoUpload } from '@/components/LogoUpload';
import { useT } from '@/lib/i18n';

interface CompanyInfoTabProps {
  form: Partial<CompanySettings>;
  onFieldChange: (field: keyof CompanySettings, value: string | number) => void;
}

export function CompanyInfoTab({ form, onFieldChange }: CompanyInfoTabProps) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.companyInfo')}</CardTitle>
        <CardDescription>{t('settings.companyInfoDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('field.companyName')} value={form.company_name || ''} onChange={(v) => onFieldChange('company_name', v)} />
          <FormField label={t('field.uid')} value={form.uid || ''} onChange={(v) => onFieldChange('uid', v)} />
        </div>
        <FormField label={t('field.street')} value={form.street || ''} onChange={(v) => onFieldChange('street', v)} />
        <div className="grid grid-cols-3 gap-4">
          <FormField label={t('field.postalCode')} value={form.postal_code || ''} onChange={(v) => onFieldChange('postal_code', v)} />
          <FormField label={t('field.city')} value={form.city || ''} onChange={(v) => onFieldChange('city', v)} />
          <FormField label={t('field.country')} value={form.country || ''} onChange={(v) => onFieldChange('country', v)} />
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-4">
          <FormField label={t('field.email')} type="email" value={form.email || ''} onChange={(v) => onFieldChange('email', v)} />
          <FormField label={t('field.phone')} value={form.phone || ''} onChange={(v) => onFieldChange('phone', v)} />
          <FormField label={t('field.website')} value={form.website || ''} onChange={(v) => onFieldChange('website', v)} />
        </div>
        <Separator />
        <div className="space-y-2">
          <LogoUpload value={form.logo_url || null} onChange={(url) => onFieldChange('logo_url', url)} />
        </div>
      </CardContent>
    </Card>
  );
}
